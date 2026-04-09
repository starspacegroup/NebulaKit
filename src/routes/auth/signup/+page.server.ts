import { redirect } from '@sveltejs/kit';
import { getConfiguredAuthProviders } from '$lib/utils/auth-provider-config';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	if (locals.user) {
		const errorCode = url.searchParams.get('error');

		if (errorCode === 'unauthorized') {
			throw redirect(302, '/?error=forbidden');
		}

		throw redirect(302, '/');
	}

	return {
		configuredProviders: await getConfiguredAuthProviders(platform)
	};
};