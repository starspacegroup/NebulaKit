import { redirect } from '@sveltejs/kit';
import { readAnalyticsConfig } from '$lib/server/analytics-config';
import { canManageStatsConnection } from '$lib/server/stats-guard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform }) => {
	// The admin layout has already established an admin session. This narrows to
	// the owner, and redirects rather than throwing so a stats-only admin who
	// followed a link lands back on the dashboard instead of an error page. The
	// API enforces the same rule on its own — hidden UI is not authorization.
	if (!canManageStatsConnection(locals.user)) {
		throw redirect(302, '/admin');
	}

	return { config: await readAnalyticsConfig(platform?.env?.KV) };
};
