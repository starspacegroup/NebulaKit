import { redirect } from '@sveltejs/kit';
import { isDevAuthSimulationEnabled } from '$lib/utils/dev-auth';
import type { RequestHandler } from './$types';

// GET - Redirect to Discord OAuth
export const GET: RequestHandler = async ({ platform, url }) => {
	let clientId = platform?.env?.DISCORD_CLIENT_ID;

	// Try to fetch from KV if environment variable not set
	if (!clientId && platform?.env?.KV) {
		try {
			const stored = await platform.env.KV.get('auth_config:discord');
			if (stored) {
				const config = JSON.parse(stored);
				clientId = config.clientId;
			}
		} catch (err) {
			console.error('Failed to fetch from KV:', err);
		}
	}

	// Check if Discord OAuth is configured
	if (!clientId) {
		if (isDevAuthSimulationEnabled(url, platform)) {
			const role = url.searchParams.get('role');
			const params = new URLSearchParams({ provider: 'discord' });
			if (role === 'admin' || role === 'superadmin') {
				params.set('role', role);
			}

			throw redirect(302, `/api/auth/dev-simulate?${params.toString()}`);
		}

		throw redirect(302, '/setup?error=oauth_not_configured');
	}

	// Generate state for CSRF protection
	const state = crypto.randomUUID();

	// Store state in cookie for validation in callback
	// In production, store in session/KV with expiry

	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: `${url.origin}/api/auth/discord/callback`,
		response_type: 'code',
		scope: 'identify email',
		state
	});

	throw redirect(302, `https://discord.com/api/oauth2/authorize?${params}`);
};
