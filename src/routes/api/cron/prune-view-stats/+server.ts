import { handleCronRequest } from '$lib/server/scheduler/http';
import type { RequestHandler } from './$types';

/**
 * Prune page-view counter rows past the retention window (the job is defined
 * in `$lib/server/scheduler/jobs/prune-view-stats.ts`).
 *
 * Called by the cron Worker in `cron-worker/` with `Authorization: Bearer
 * <CRON_SECRET>`; any scheduler that can POST works too.
 */
export const POST: RequestHandler = (event) => handleCronRequest(event, 'prune-view-stats');
