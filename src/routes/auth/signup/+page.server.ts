import { redirect } from '@sveltejs/kit';
import { getConfiguredAuthProviders } from '$lib/utils/auth-provider-config';
import { isDevAuthSimulationEnabled } from '$lib/utils/dev-auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	if (locals.user) {
		const errorCode = url.searchParams.get('error');

		if (errorCode === 'unauthorized') {
			throw redirect(302, '/?error=forbidden');
		}

		throw redirect(302, '/');
	}

	const configuredProviders = await getConfiguredAuthProviders(platform);
	const devAuthSimulationEnabled = isDevAuthSimulationEnabled(url, platform);
	const simulatedProviders = {
		github: devAuthSimulationEnabled && !configuredProviders.github,
		discord: devAuthSimulationEnabled && !configuredProviders.discord
	};

	return {
		configuredProviders,
		simulatedProviders,
		devAuthSimulationEnabled
	};
};
