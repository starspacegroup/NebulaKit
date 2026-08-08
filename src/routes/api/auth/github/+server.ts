import { error, redirect } from '@sveltejs/kit';
import { isDevAuthSimulationEnabled } from '$lib/utils/dev-auth';
import { getAuthProviderCredentials } from '$lib/utils/auth-provider-config';
import {
	createOAuthTransaction,
	oauthStateCookieName,
	oauthStateCookieOptions
} from '$lib/utils/oauth-state';
import { decodeDatabaseSessionCookie } from '$lib/utils/session';
import type { RequestHandler } from './$types';

// GET - Redirect to GitHub OAuth
export const GET: RequestHandler = async ({ platform, url, cookies, locals }) => {
	const { clientId } = await getAuthProviderCredentials(platform, 'github');

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

	const linking = url.searchParams.get('mode') === 'link';
	if (linking && !locals.user) {
		throw redirect(302, '/auth/login?error=authentication_required');
	}
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'OAuth state storage is unavailable');
	const boundSessionToken = linking
		? await decodeDatabaseSessionCookie(cookies.get('session'), platform?.env?.SESSION_SECRET)
		: undefined;
	if (linking && !boundSessionToken) {
		throw redirect(302, '/auth/login?error=authentication_required');
	}
	const { state, cookie } = await createOAuthTransaction(
		db,
		'github',
		linking ? 'link' : 'login',
		linking ? locals.user?.id : undefined,
		boundSessionToken || undefined,
		platform?.env?.SESSION_SECRET
	);
	cookies.set(oauthStateCookieName('github'), cookie, oauthStateCookieOptions('github', url));

	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: `${url.origin}/api/auth/github/callback`,
		scope: 'read:user user:email',
		state
	});

	throw redirect(302, `https://github.com/login/oauth/authorize?${params}`);
};
