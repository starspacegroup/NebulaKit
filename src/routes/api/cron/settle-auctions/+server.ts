import { handleCronRequest } from '$lib/server/scheduler/http';
import type { RequestHandler } from './$types';

/**
 * Close ended auctions and bill their winners (the job is defined in
 * `$lib/server/scheduler/jobs/settle-auctions.ts`).
 *
 * Called by the cron Worker in `cron-worker/` with `Authorization: Bearer
 * <CRON_SECRET>`; any scheduler that can POST works too.
 */
export const POST: RequestHandler = (event) => handleCronRequest(event, 'settle-auctions');
