import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Stats moved to the admin dashboard. Keep old links (and their ?window=)
// working.
export const load: PageServerLoad = ({ url }) => {
	throw redirect(308, `/admin${url.search}`);
};
