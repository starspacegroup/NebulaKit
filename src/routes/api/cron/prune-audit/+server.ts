import { handleCronRequest } from '$lib/server/scheduler/http';
import type { RequestHandler } from './$types';

/**
 * Prune audit rows and sign-in events past their retention windows (the job is
 * defined in `$lib/server/scheduler/jobs/prune-audit.ts`).
 *
 * Called by the cron Worker in `cron-worker/` with `Authorization: Bearer
 * <CRON_SECRET>`; any scheduler that can POST works too.
 */
export const POST: RequestHandler = (event) => handleCronRequest(event, 'prune-audit');
