import { redirect } from '@sveltejs/kit';
import { isDevAuthSimulationEnabled } from '$lib/utils/dev-auth';
import type { RequestHandler } from './$types';

// GET - Redirect to GitHub OAuth
export const GET: RequestHandler = async ({ platform, url }) => {
	let clientId = platform?.env?.GITHUB_CLIENT_ID;

	// Try to fetch from KV if environment variable not set
	if (!clientId && platform?.env?.KV) {
		try {
			const stored = await platform.env.KV.get('auth_config:github');
			if (stored) {
				const config = JSON.parse(stored);
				clientId = config.clientId;
			}
		} catch (err) {
			console.error('Failed to fetch from KV:', err);
		}
	}

	// Check if GitHub OAuth is configured
	if (!clientId) {
		if (isDevAuthSimulationEnabled(url, platform)) {
			const role = url.searchParams.get('role');
			const mode = url.searchParams.get('mode');
			const params = new URLSearchParams({ provider: 'github' });
			if (role === 'admin' || role === 'superadmin') {
				params.set('role', role);
			}
			if (mode === 'link') {
				params.set('mode', 'link');
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
		redirect_uri: `${url.origin}/api/auth/github/callback`,
		scope: 'read:user user:email',
		state
	});

	throw redirect(302, `https://github.com/login/oauth/authorize?${params}`);
};
