import { error, json } from '@sveltejs/kit';
import { requireOwner } from '$lib/server/auth-guards';
import { getScheduledJob } from '$lib/server/scheduler/registry';
import { executeJob } from '$lib/server/scheduler/runner';
import type { RequestHandler } from './$types';

/**
 * Run a registered job now, from the admin page.
 *
 * The scheduled path is `/api/cron/*`, which takes the shared secret because
 * its caller is a scheduler. This one takes the session, because its caller is
 * a person, and the two must not share a door: a bearer secret in a browser is
 * a secret in a browser. It runs the same job through the same claim, so
 * pressing the button during a scheduled run is skipped rather than doubled.
 *
 * JSON-only, like the site API: a cross-site form post carries the cookie but
 * cannot set `Content-Type: application/json` without a CORS preflight.
 */
export const POST: RequestHandler = async ({ request, locals, platform }) => {
	requireOwner(locals);

	const type = request.headers.get('content-type') ?? '';
	if (!type.toLowerCase().startsWith('application/json')) {
		throw error(415, 'Send JSON (Content-Type: application/json)');
	}

	const body = (await request.json().catch(() => null)) as { jobId?: unknown } | null;
	const job = typeof body?.jobId === 'string' ? getScheduledJob(body.jobId) : undefined;
	if (!job) throw error(400, 'jobId must name a registered job');

	const env = platform?.env;
	if (!env?.DB) throw error(503, 'Database not available');

	const result = await executeJob(env.DB, env, job, { trigger: 'manual' });
	return json(result);
};
