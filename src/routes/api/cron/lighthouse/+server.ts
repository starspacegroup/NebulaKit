import { handleCronRequest } from '$lib/server/scheduler/http';
import type { RequestHandler } from './$types';

/**
 * Re-audit every public page through PageSpeed Insights (the job is defined in
 * `$lib/server/scheduler/jobs/lighthouse.ts`). `?strategy=desktop` audits the
 * desktop form factor instead of mobile.
 *
 * Authenticated with the shared `CRON_SECRET` bearer because the caller is a
 * scheduler: the Worker in `cron-worker/`, or anything that can POST.
 */
export const POST: RequestHandler = (event) => handleCronRequest(event, 'lighthouse');
