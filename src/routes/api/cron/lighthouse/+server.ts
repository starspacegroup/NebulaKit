import { error, json } from '@sveltejs/kit';
import { isStrategy, runLighthouseSweep } from '$lib/server/lighthouse';
import type { RequestHandler } from './$types';

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let mismatch = 0;
	for (let i = 0; i < a.length; i++) {
		mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return mismatch === 0;
}

/**
 * Re-audit every public page through PageSpeed Insights and store the results.
 *
 * Authenticated with the same shared bearer secret as the other `/api/cron/*`
 * endpoints, because the caller is a scheduler rather than a user. Set
 * `CRON_SECRET` and POST with `Authorization: Bearer <secret>`.
 *
 * **There is no cron in a Pages deployment.** Cloudflare Pages has no Cron
 * Triggers — that is a Workers feature — so something external has to call
 * this: a one-line scheduled Worker, a GitHub Actions `schedule`, or any host
 * that can make an authenticated POST. Daily is plenty; PSI's keyless rate
 * limit will not tolerate much more, and the scores do not move hourly.
 *
 * `?strategy=desktop` audits the desktop form factor instead of mobile. They
 * are stored separately because PSI scores them very differently and it is
 * mobile that Google ranks on.
 */
export const POST: RequestHandler = async ({ request, url, platform }) => {
	const secret = platform?.env?.CRON_SECRET;
	if (!secret) {
		throw error(503, 'CRON_SECRET not configured');
	}

	const authHeader = request.headers.get('authorization') ?? '';
	if (!timingSafeEqual(authHeader, `Bearer ${secret}`)) {
		throw error(401, 'Unauthorized');
	}

	const db = platform?.env?.DB;
	if (!db) {
		throw error(503, 'Database not available');
	}

	const requested = url.searchParams.get('strategy');
	const result = await runLighthouseSweep(db, {
		strategy: isStrategy(requested) ? requested : 'mobile',
		// Optional. Without it PSI still answers, just at a much lower rate limit,
		// which is survivable for a handful of pages once a day.
		apiKey: platform?.env?.PAGESPEED_API_KEY
	});

	return json(result);
};
