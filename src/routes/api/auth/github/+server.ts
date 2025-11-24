import { redirect } from '@sveltejs/kit';
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
