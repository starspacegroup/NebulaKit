import { error, json } from '@sveltejs/kit';
import { site } from '$lib/site.config';
import { loadStatsSummary, parseTrafficWindow } from '$lib/server/stats-summary';
import { verifyStatsToken } from '$lib/server/stats-token';
import type { RequestHandler } from './$types';

/**
 * GET /api/stats/summary — the admin dashboard's numbers, as JSON, for an
 * external dashboard (docs/ADMIN_STATS.md, "Reading the numbers from outside").
 *
 * Authenticated with the owner-issued stats token (`/admin/analytics`), sent
 * as `Authorization: Bearer nks_…`, rather than a session: the caller is
 * another site, not a browser with a cookie. Read-only, aggregate counters
 * only — exactly what `/admin` shows to an admin holding `can_view_stats`,
 * assembled by the same function so the two can never disagree.
 *
 * `?window=1|7|30|90` picks the traffic window, as on `/admin`.
 *
 * No `Cache-Control` sharing and no CORS headers on purpose: the dashboard
 * proxies this server-side with the token, so a browser never holds it.
 */
export const GET: RequestHandler = async ({ request, url, platform }) => {
	const kv = platform?.env?.KV;
	const db = platform?.env?.DB;
	if (!kv || !db) {
		throw error(503, 'Stats are not available on this deployment');
	}

	const verdict = await verifyStatsToken(kv, request.headers.get('authorization'));
	if (verdict === 'missing') {
		throw error(401, 'This site has not issued a stats token. Issue one at /admin/analytics.');
	}
	if (verdict === 'invalid') {
		throw error(401, 'Invalid stats token');
	}

	let summary;
	try {
		summary = await loadStatsSummary(db, parseTrafficWindow(url.searchParams.get('window')));
	} catch {
		throw error(500, 'Failed to load stats');
	}

	return json(
		{
			site: { name: site.name, url: site.url },
			generatedAt: new Date().toISOString(),
			...summary
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
};
