import { pruneViewStats, utcDay } from '$lib/utils/page-views';
import type { ScheduledJob } from '../types';

/** Roughly 13 months, so year-over-year comparisons still have last year's data. */
export const RETENTION_DAYS = 400;

/**
 * Drop page-view counter rows past the retention window. Without this the
 * counter tables grow one row per day per dimension forever.
 */
export const PRUNE_VIEW_STATS_JOB: ScheduledJob = {
	id: 'prune-view-stats',
	cron: '17 3 * * *',
	path: '/api/cron/prune-view-stats',
	description: 'Delete page-view counters older than the 13-month retention window.',
	timeoutMs: 30_000,
	async run({ db, now }) {
		const prunedBefore = utcDay(new Date(now * 1000 - RETENTION_DAYS * 24 * 60 * 60 * 1000));
		const result = await pruneViewStats(db, prunedBefore);
		return { prunedBefore, ...result };
	}
};
