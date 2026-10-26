/**
 * Running a job: claim it, record it, bound it, close it.
 *
 * `executeJob` never throws. Its callers are a cron route and an admin button,
 * and neither can do anything useful with an exception; the run row is the
 * report.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { claimRun, finishRun, pruneRunHistory, type RunTrigger } from './store';
import type { JobDetail, ScheduledJob } from './types';

/** The lease outlasts the timeout by this much, so a hung run is cut off before its slot is reclaimable. */
export const LEASE_GRACE_MS = 30_000;

/** An error message is for a person reading a table, not a stack. */
const MAX_ERROR_LENGTH = 500;

export type JobOutcome = 'succeeded' | 'failed' | 'timed_out' | 'skipped';

export interface JobResult {
	job: string;
	outcome: JobOutcome;
	durationMs: number;
	runId?: string;
	detail?: JobDetail;
	error?: string;
}

export interface ExecuteOptions {
	trigger: RunTrigger;
	/** When the scheduler meant the job to run (ms). Retries share it, hence share a slot. Defaults to now. */
	scheduledAtMs?: number;
	params?: URLSearchParams;
	/** Injected by tests. */
	clock?: () => number;
}

class JobTimeoutError extends Error {
	constructor(timeoutMs: number) {
		super(`Job exceeded its ${timeoutMs}ms timeout`);
		this.name = 'JobTimeoutError';
	}
}

/**
 * Race a job against its timeout. A Worker cannot kill a running promise, so
 * the abort signal is how a job cooperates; what this guarantees is that the
 * run is recorded and returned on time.
 */
async function withTimeout<T>(
	work: (signal: AbortSignal) => Promise<T>,
	timeoutMs: number
): Promise<T> {
	const controller = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => {
			controller.abort();
			reject(new JobTimeoutError(timeoutMs));
		}, timeoutMs);
	});
	try {
		return await Promise.race([work(controller.signal), timeout]);
	} finally {
		clearTimeout(timer);
	}
}

function describe(thrown: unknown): string {
	const text = thrown instanceof Error ? thrown.message : String(thrown);
	return text.slice(0, MAX_ERROR_LENGTH);
}

export async function executeJob(
	db: D1Database,
	env: NonNullable<App.Platform['env']>,
	job: ScheduledJob,
	options: ExecuteOptions
): Promise<JobResult> {
	const clock = options.clock ?? Date.now;
	const startedMs = clock();
	const now = Math.floor(startedMs / 1000);
	const slot = Math.floor((options.scheduledAtMs ?? startedMs) / 60_000);

	let runId: string | null;
	try {
		runId = await claimRun(db, {
			jobId: job.id,
			trigger: options.trigger,
			slot,
			now,
			leaseUntil: now + Math.ceil((job.timeoutMs + LEASE_GRACE_MS) / 1000)
		});
	} catch (thrown) {
		// No claim means no guarantee against a double run, so do not run. Loud,
		// not "skipped": a missing table (migration 0023 not applied) must show.
		console.error(`Could not claim scheduled job "${job.id}":`, thrown);
		return { job: job.id, outcome: 'failed', durationMs: 0, error: describe(thrown) };
	}
	if (!runId) return { job: job.id, outcome: 'skipped', durationMs: 0 };

	let outcome: Exclude<JobOutcome, 'skipped'> = 'succeeded';
	let detail: JobDetail | undefined;
	let error: string | undefined;
	try {
		detail = await withTimeout(
			(signal) =>
				job.run({ db, env, now, signal, params: options.params ?? new URLSearchParams() }),
			job.timeoutMs
		);
	} catch (thrown) {
		outcome = thrown instanceof JobTimeoutError ? 'timed_out' : 'failed';
		error = describe(thrown);
		console.error(`Scheduled job "${job.id}" ${outcome}:`, thrown);
	}

	const finishedMs = clock();
	const durationMs = Math.max(0, finishedMs - startedMs);
	try {
		await finishRun(db, runId, outcome, {
			finishedAt: Math.floor(finishedMs / 1000),
			error: error ?? null,
			detail: detail ? JSON.stringify(detail) : null
		});
	} catch (thrown) {
		// The lease expires on its own, which is what it is for.
		console.error(`Could not record the outcome of "${job.id}":`, thrown);
	}

	// History that needs its own job to stay small is a second thing that can
	// fail, so every run trims it. Never allowed to fail the run.
	try {
		await pruneRunHistory(db, now);
	} catch (thrown) {
		console.error('Could not prune scheduled job run history:', thrown);
	}

	return { job: job.id, outcome, durationMs, runId, detail, error };
}
