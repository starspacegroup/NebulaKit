import { getConfiguredAuthProviders } from '$lib/utils/auth-provider-config';
import { isDevAuthSimulationEnabled } from '$lib/utils/dev-auth';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	// If user is already logged in
	if (locals.user) {
		// If they were redirected here with unauthorized error, it means they lack permissions
		// This can happen if they're logged in but not the owner trying to access /admin
		const errorCode = url.searchParams.get('error');
		if (errorCode === 'unauthorized') {
			// They're logged in but tried to access a page they don't have permission for
			// This is actually a "forbidden" scenario, not "unauthorized"
			// Redirect to home with a more accurate message
			throw redirect(302, '/?error=forbidden');
		}

		// Otherwise, redirect logged-in users to home
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
