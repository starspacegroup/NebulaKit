import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, fetch }) => {
	// Fetch OAuth configuration from KV
	let authConfig = null;
	let adminId = null;
	let adminUsername = null;
	let resetRouteDisabled = false;

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

			// Get reset route status
			resetRouteDisabled = (await platform.env.KV.get('reset_route_disabled')) === 'true';
		} catch (err) {
			console.error('Failed to fetch setup info from KV:', err);
		}
	}

	return {
		keys: await loadAuthKeys(fetch),
		setupInfo: {
			hasOAuthConfig: !!authConfig,
			oauthProvider: authConfig?.provider || null,
			oauthClientId: authConfig?.clientId || null,
			adminId: adminId || null,
			adminUsername: adminUsername || null,
			resetRouteDisabled
		}
	};
};

async function loadAuthKeys(fetch: typeof globalThis.fetch) {
	try {
		const response = await fetch('/api/admin/auth-keys');
		if (response.ok) {
			const data = await response.json();
			return data.keys || [];
		}
		throw error(response.status || 500, 'Failed to load authentication keys');
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		console.error('Failed to load auth keys:', err);
		throw error(500, 'Failed to load authentication keys');
	}
}
