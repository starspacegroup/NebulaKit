/**
 * Run records and the claim, over `scheduled_job_runs` (migration 0023).
 *
 * All times are unix seconds. `slot` is the scheduled minute since the epoch.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { deleteInBatches } from '$lib/server/bounded-delete';

export type RunTrigger = 'cron' | 'manual';
export type RunStatus = 'running' | 'succeeded' | 'failed' | 'timed_out';

export interface JobRunRow {
	id: string;
	job_id: string;
	trigger: RunTrigger;
	slot: number;
	attempts: number;
	started_at: number;
	finished_at: number | null;
	status: RunStatus;
	error: string | null;
	detail: string | null;
	lease_until: number;
}

const COLUMNS = `id, job_id, trigger, slot, attempts, started_at, finished_at, status, error,
	detail, lease_until`;

/** Run history older than this is dropped. Long enough to debug a bad month. */
export const RUN_HISTORY_DAYS = 30;
/** Rows one history prune may delete. A backlog drains over several runs. */
export const RUN_HISTORY_BUDGET = 500;

export interface ClaimInput {
	jobId: string;
	trigger: RunTrigger;
	slot: number;
	now: number;
	leaseUntil: number;
}

/**
 * Claim `(job, trigger, slot)` for this caller. Returns the run id, or null
 * when somebody else has it.
 *
 * One statement, so it is atomic. The row is inserted, or an existing row for
 * the same slot is taken over only when the previous attempt `failed`/
 * `timed_out`, or is `running` on an expired lease (it died mid-flight). A
 * `succeeded` row is never taken over, which is what makes a duplicate
 * delivery harmless. The `NOT EXISTS` guard additionally refuses to start while
 * a different run of the same job (another slot, or the other trigger) holds a live lease, so a slow
 * run is not overlapped by the next tick or by "Run now".
 *
 * The id is replaced on takeover and every later write is scoped to it, so a
 * stale run that wakes up after losing its lease cannot overwrite the new one.
 */
export async function claimRun(db: D1Database, input: ClaimInput): Promise<string | null> {
	const id = crypto.randomUUID();
	const result = await db
		.prepare(
			`INSERT INTO scheduled_job_runs (id, job_id, trigger, slot, started_at, status, lease_until)
			 SELECT ?1, ?2, ?3, ?4, ?5, 'running', ?6
			 WHERE NOT EXISTS (
				 SELECT 1 FROM scheduled_job_runs
				 WHERE job_id = ?2 AND status = 'running' AND lease_until > ?5
					 AND NOT (trigger = ?3 AND slot = ?4)
			 )
			 ON CONFLICT (job_id, trigger, slot) DO UPDATE SET
				 id = excluded.id,
				 attempts = scheduled_job_runs.attempts + 1,
				 started_at = excluded.started_at,
				 finished_at = NULL,
				 status = 'running',
				 error = NULL,
				 detail = NULL,
				 lease_until = excluded.lease_until
			 WHERE scheduled_job_runs.status <> 'succeeded'
				 AND (scheduled_job_runs.status <> 'running' OR scheduled_job_runs.lease_until <= ?5)`
		)
		.bind(id, input.jobId, input.trigger, input.slot, input.now, input.leaseUntil)
		.run();
	return (result.meta?.changes ?? 0) > 0 ? id : null;
}

/** Close a run. Scoped to the id so a run that lost its lease cannot clobber its successor. */
export async function finishRun(
	db: D1Database,
	runId: string,
	status: Exclude<RunStatus, 'running'>,
	fields: { finishedAt: number; error?: string | null; detail?: string | null }
): Promise<boolean> {
	const result = await db
		.prepare(
			`UPDATE scheduled_job_runs
			 SET status = ?, finished_at = ?, error = ?, detail = ?
			 WHERE id = ? AND status = 'running'`
		)
		.bind(status, fields.finishedAt, fields.error ?? null, fields.detail ?? null, runId)
		.run();
	return (result.meta?.changes ?? 0) > 0;
}

/** The most recent run of one job, any trigger. */
export async function latestRun(db: D1Database, jobId: string): Promise<JobRunRow | null> {
	return db
		.prepare(
			`SELECT ${COLUMNS} FROM scheduled_job_runs WHERE job_id = ?
			 ORDER BY started_at DESC, rowid DESC LIMIT 1`
		)
		.bind(jobId)
		.first<JobRunRow>();
}

/** Most recent runs across all jobs, newest first. */
export async function recentRuns(db: D1Database, limit = 25): Promise<JobRunRow[]> {
	const size = Math.min(Math.max(Math.floor(limit), 1), 200);
	const { results } = await db
		.prepare(
			`SELECT ${COLUMNS} FROM scheduled_job_runs
			 ORDER BY started_at DESC, rowid DESC LIMIT ?`
		)
		.bind(size)
		.all<JobRunRow>();
	return results ?? [];
}

/**
 * Delete run history past the retention window, in bounded batches on the
 * primary key. Returns the number of rows removed.
 */
export async function pruneRunHistory(db: D1Database, now: number): Promise<number> {
	const { deleted } = await deleteInBatches(db, {
		table: 'scheduled_job_runs',
		where: 'started_at < ?',
		binds: [now - RUN_HISTORY_DAYS * 24 * 60 * 60],
		keyColumn: 'id',
		budget: RUN_HISTORY_BUDGET
	});
	return deleted;
}
