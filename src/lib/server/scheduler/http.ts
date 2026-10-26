import { error, json } from '@sveltejs/kit';
import { authorizeCronRequest } from './authorize';
import { executeJob, type JobOutcome } from './runner';
import { getScheduledJob } from './registry';

/** A scheduled time more than a day from now is ignored; it is not a retry of anything real. */
const MAX_SCHEDULED_SKEW_MS = 24 * 60 * 60 * 1000;

/** Header the cron Worker sets to the tick it is delivering. Retries repeat it. */
export const SCHEDULED_TIME_HEADER = 'x-cron-scheduled-time';

const STATUS_BY_OUTCOME: Record<JobOutcome, number> = {
	succeeded: 200,
	// Already done or underway elsewhere. Success from the scheduler's view:
	// retrying it would only be refused again.
	skipped: 200,
	failed: 500,
	timed_out: 504
};

export function scheduledTimeFrom(request: Request, nowMs: number): number | undefined {
	const raw = request.headers.get(SCHEDULED_TIME_HEADER);
	if (!raw || !/^\d{1,15}$/.test(raw)) return undefined;
	const value = Number(raw);
	return Math.abs(value - nowMs) <= MAX_SCHEDULED_SKEW_MS ? value : undefined;
}

/**
 * The whole body of a `/api/cron/*` route: authorize, run the registered job,
 * answer with a status the scheduler can act on. 5xx makes the cron Worker
 * retry; 2xx, including `skipped`, does not.
 */
export async function handleCronRequest(
	event: { request: Request; url: URL; platform?: App.Platform },
	jobId: string
): Promise<Response> {
	const env = event.platform?.env;
	authorizeCronRequest(event.request, env);

	const job = getScheduledJob(jobId);
	if (!job) throw error(404, 'Unknown job');
	if (!env?.DB) throw error(503, 'Database not available');

	const result = await executeJob(env.DB, env, job, {
		trigger: 'cron',
		scheduledAtMs: scheduledTimeFrom(event.request, Date.now()),
		params: event.url.searchParams
	});
	return json(result, { status: STATUS_BY_OUTCOME[result.outcome] });
}
