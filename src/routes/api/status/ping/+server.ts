/**
 * GET /api/status/ping — what the status page's outside probe fetches.
 *
 * It does the least that still proves the site is serving: it runs as the app, and it touches
 * no database. That is deliberate. `/api/health` checks D1 and answers 503 when it is down; if
 * the probe used it, a database outage would also read as the website being down, and the page
 * would report one failure twice. The database has its own check.
 */
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
	new Response(JSON.stringify({ ok: true }), {
		headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
	});
