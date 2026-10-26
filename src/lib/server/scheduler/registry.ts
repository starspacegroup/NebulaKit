/**
 * Every piece of recurring work the app owns.
 *
 * Adding a job is one entry here plus its route under `src/routes/api/cron/`
 * and its cron in `cron-worker/wrangler.toml` and `cron-worker/src/index.ts`.
 * `tests/unit/scheduler-registry.test.ts` reads all four and fails if any
 * disagree, so a job cannot be registered on a schedule nothing fires.
 */
import { LIGHTHOUSE_JOB } from './jobs/lighthouse';
import { PRUNE_AUDIT_JOB } from './jobs/prune-audit';
import { PRUNE_VIEW_STATS_JOB } from './jobs/prune-view-stats';
import type { ScheduledJob } from './types';

export const SCHEDULED_JOBS: readonly ScheduledJob[] = [
	PRUNE_VIEW_STATS_JOB,
	LIGHTHOUSE_JOB,
	PRUNE_AUDIT_JOB
];

export function getScheduledJob(id: string): ScheduledJob | undefined {
	return SCHEDULED_JOBS.find((job) => job.id === id);
}

/** Every distinct cron expression the registry needs fired, sorted. */
export function registeredCrons(): string[] {
	return [...new Set(SCHEDULED_JOBS.map((job) => job.cron))].sort();
}
