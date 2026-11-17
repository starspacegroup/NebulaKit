import { getStatusSnapshot } from '$lib/server/status';
import type { PageServerLoad } from './$types';

/**
 * /status — public. If the data cannot be read the page says so; it never falls back to an
 * all-clear, because "we could not look" is not "nothing is wrong".
 */
export const load: PageServerLoad = async ({ platform, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, max-age=30' });
	const db = platform?.env?.DB;
	if (!db) return { snapshot: null };
	try {
		return { snapshot: await getStatusSnapshot(db) };
	} catch (thrown) {
		console.error('Status: could not read the snapshot:', thrown);
		return { snapshot: null };
	}
};
