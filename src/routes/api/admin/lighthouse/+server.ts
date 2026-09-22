import { error, json } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth-guards';
import { isStrategy, runLighthouseSweep } from '$lib/server/lighthouse';
import type { RequestHandler } from './$types';

/**
 * Run the audit now, from the admin page.
 *
 * The scheduled path is `/api/cron/lighthouse`, which authenticates with a
 * shared secret because its caller is a scheduler. This one authenticates the
 * session, because its caller is a person who just pressed a button — and the
 * two must not share a door: a bearer secret in a browser is a secret in a
 * browser.
 *
 * Guarded server-side rather than by hiding the button. Hiding UI is not
 * authorization.
 */
export const POST: RequestHandler = async ({ request, locals, platform }) => {
	requireAdmin(locals);

	const db = platform?.env?.DB;
	if (!db) {
		throw error(503, 'Database not available');
	}

	const body = (await request.json().catch(() => ({}))) as { strategy?: string };
	const result = await runLighthouseSweep(db, {
		strategy: isStrategy(body.strategy) ? body.strategy : 'mobile',
		apiKey: platform?.env?.PAGESPEED_API_KEY
	});

	return json(result);
};
