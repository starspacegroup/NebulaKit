import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// Check if user is authenticated
	if (!locals.user) {
		throw redirect(302, '/auth/login?error=unauthorized');
	}

	// Check if user is the OAuth app owner
	if (!locals.user.isOwner) {
		throw redirect(302, '/?error=forbidden');
	}

	return {
		user: locals.user
	};
};
