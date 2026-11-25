import { handleCronRequest } from '$lib/server/scheduler/http';
import type { RequestHandler } from './$types';

/**
 * Send changed products to Google Merchant Center (the job is defined in
 * `$lib/server/scheduler/jobs/google-merchant-sync.ts`; it does nothing while
 * the sync setting is off).
 *
 * Called by the cron Worker in `cron-worker/` with `Authorization: Bearer
 * <CRON_SECRET>`; any scheduler that can POST works too.
 */
export const POST: RequestHandler = (event) => handleCronRequest(event, 'google-merchant-sync');
