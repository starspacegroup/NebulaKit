import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	// Fetch OAuth configuration from KV
	let authConfig = null;
	let adminId = null;
	let adminUsername = null;

	if (platform?.env?.KV) {
		try {
			// Get OAuth config
			const authConfigStr = await platform.env.KV.get('auth_config:github');
			if (authConfigStr) {
				authConfig = JSON.parse(authConfigStr);
			}

			// Get admin user info
			adminId = await platform.env.KV.get('github_owner_id');
			adminUsername = await platform.env.KV.get('github_owner_username');
		} catch (err) {
			console.error('Failed to fetch setup info from KV:', err);
		}
	}

	return {
		setupInfo: {
			hasOAuthConfig: !!authConfig,
			oauthProvider: authConfig?.provider || null,
			oauthClientId: authConfig?.clientId || null,
			adminId: adminId || null,
			adminUsername: adminUsername || null
		}
	};
};
