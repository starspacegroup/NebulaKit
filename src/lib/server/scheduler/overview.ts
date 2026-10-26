import type { D1Database } from '@cloudflare/workers-types';
import { nextCronRun } from './cron';
import { SCHEDULED_JOBS } from './registry';
import { latestRun, recentRuns, type JobRunRow } from './store';

/** What a person should see for a job, in one word. */
export type JobHealth = 'never-run' | 'running' | 'stalled' | 'succeeded' | 'failed' | 'timed_out';

export interface JobOverview {
	id: string;
	description: string;
	cron: string;
	path: string;
	timeoutMs: number;
	health: JobHealth;
	lastRun: JobRunRow | null;
	/** ISO time of the next scheduled run, or null when the expression never fires. */
	nextRunAt: string | null;
}

export function healthOf(run: JobRunRow | null, nowSec: number): JobHealth {
	if (!run) return 'never-run';
	if (run.status === 'running') return run.lease_until <= nowSec ? 'stalled' : 'running';
	return run.status;
}

export async function getJobOverview(
	db: D1Database,
	now: Date = new Date()
): Promise<{ jobs: JobOverview[]; history: JobRunRow[] }> {
	const nowSec = Math.floor(now.getTime() / 1000);
	const [lastRuns, history] = await Promise.all([
		Promise.all(SCHEDULED_JOBS.map((job) => latestRun(db, job.id))),
		recentRuns(db, 25)
	]);
	const jobs = SCHEDULED_JOBS.map((job, index) => ({
		id: job.id,
		description: job.description,
		cron: job.cron,
		path: job.path,
		timeoutMs: job.timeoutMs,
		health: healthOf(lastRuns[index], nowSec),
		lastRun: lastRuns[index],
		nextRunAt: nextCronRun(job.cron, now)?.toISOString() ?? null
	}));
	return { jobs, history };
}
