import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	// Check if reset route is disabled via admin settings
	if (platform?.env?.KV) {
		const resetDisabled = await platform.env.KV.get('reset_route_disabled');
		if (resetDisabled === 'true') {
			throw redirect(302, '/');
		}
	}

	return {};
};
