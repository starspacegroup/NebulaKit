import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Authentication keys moved to the admin Settings page.
export const load: PageServerLoad = () => {
	throw redirect(308, '/admin/settings');
};
