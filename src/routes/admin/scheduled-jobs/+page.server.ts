import { error } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth-guards';
import { getJobOverview } from '$lib/server/scheduler/overview';
import type { PageServerLoad } from './$types';

/**
 * Registered jobs with their last run and next expected run, for admins (the
 * same predicate as the admin layout). The load guards itself: the layout's
 * redirect does not run for a direct `/admin/scheduled-jobs/__data.json` fetch,
 * so without this an anonymous request read every job's run history.
 */
export const load: PageServerLoad = async ({ platform, locals }) => {
	requireAdmin(locals);
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Database not available');
	return getJobOverview(db);
};
