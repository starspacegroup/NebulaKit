import { error } from '@sveltejs/kit';
import { getJobOverview } from '$lib/server/scheduler/overview';
import type { PageServerLoad } from './$types';

/**
 * Registered jobs with their last run and next expected run. The admin layout
 * guard has already required an admin session; run state is not more sensitive
 * than the Lighthouse scores next door.
 */
export const load: PageServerLoad = async ({ platform }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Database not available');
	return getJobOverview(db);
};
