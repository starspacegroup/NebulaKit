import { handleCronRequest } from '$lib/server/scheduler/http';
import type { RequestHandler } from './$types';

/**
 * One round of status checks (the job is defined in
 * `$lib/server/scheduler/jobs/status-check.ts`).
 *
 * Called by the cron Worker in `cron-worker/` with `Authorization: Bearer
 * <CRON_SECRET>`, after it has fetched `/api/status/ping` from outside and added what it saw
 * to the query string; any scheduler that can POST works too.
 */
export const POST: RequestHandler = (event) => handleCronRequest(event, 'status-check');
