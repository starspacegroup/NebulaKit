import { utcHourKey } from '$lib/utils/page-views';
import { error } from '@sveltejs/kit';
import { canViewStats } from '$lib/server/stats-guard';
import { loadStatsSummary, parseTrafficWindow } from '$lib/server/stats-summary';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, url, locals }) => {
	// The dashboard is every admin's landing page, but its stats are gated on the
	// stats permission: owner always, plain admins only when granted
	// can_view_stats. The admin layout guard has already run. An admin without
	// the grant gets the page with no stats data, not a 403.
	if (!canViewStats(locals.user)) {
		return {
			canViewStats: false as const,
			stats: null,
			traffic: null,
			usage: null,
			trafficWindow: 30,
			trafficNowHour: utcHourKey(new Date())
		};
	}

	if (!platform?.env?.DB) {
		// Local dev without D1 — return a fully-shaped empty payload rather than
		// throwing, so the page still renders and explains itself.
		return {
			canViewStats: true as const,
			stats: null,
			traffic: null,
			usage: null,
			trafficWindow: 30,
			trafficNowHour: utcHourKey(new Date())
		};
	}

	// The window is a query param so the UI can toggle it with a plain link —
	// shareable, and it survives a reload. The assembly itself is shared with
	// /api/stats/summary (src/lib/server/stats-summary.ts).
	try {
		const summary = await loadStatsSummary(
			platform.env.DB,
			parseTrafficWindow(url.searchParams.get('window'))
		);
		return { canViewStats: true as const, ...summary };
	} catch {
		throw error(500, 'Failed to load stats');
	}
};
