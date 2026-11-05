import { handleCronRequest } from '$lib/server/scheduler/http';
import type { RequestHandler } from './$types';

/**
 * Start timestamp proofs for scheduled items that went live and nobody has
 * opened yet (the job is defined in
 * `$lib/server/scheduler/jobs/publish-scheduled.ts`).
 *
 * Called by the cron Worker in `cron-worker/` with `Authorization: Bearer
 * <CRON_SECRET>`; any scheduler that can POST works too.
 */
export const POST: RequestHandler = (event) => handleCronRequest(event, 'publish-scheduled');
