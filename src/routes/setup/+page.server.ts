import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, locals }) => {
	// Check if admin has completed first login
	const adminFirstLoginCompleted = await platform?.env?.KV?.get('admin_first_login_completed');

	// If setup is locked (admin has logged in), redirect away from setup page
	if (adminFirstLoginCompleted) {
		// If user is authenticated (logged in), send to admin panel
		if (locals.user) {
			throw redirect(302, '/admin');
		}
		// If not authenticated, send to home page
		throw redirect(302, '/');
	}

	// Allow access to setup page if admin hasn't logged in yet
	return {};
};
