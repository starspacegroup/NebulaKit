import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (!locals.user) throw error(401, 'Authentication required');
	if (!locals.user.isOwner) throw error(403, 'Only the owner can reset configuration');

	// Check if reset route is disabled via admin settings
	if (platform?.env?.KV) {
		const resetDisabled = await platform.env.KV.get('reset_route_disabled');
		if (resetDisabled === 'true') {
			throw redirect(302, '/');
		}
	}

	return {};
};
