import { error, redirect } from '@sveltejs/kit';
import { isDevAuthSimulationEnabled } from '$lib/utils/dev-auth';
import { getAuthProviderCredentials } from '$lib/utils/auth-provider-config';
import {
	createOAuthTransaction,
	oauthStateCookieName,
	oauthStateCookieOptions
} from '$lib/utils/oauth-state';
import { findValidSession } from '$lib/utils/db';
import type { RequestHandler } from './$types';

// GET - Redirect to Discord OAuth
export const GET: RequestHandler = async ({ platform, url, cookies, locals }) => {
	const { clientId } = await getAuthProviderCredentials(platform, 'discord');

	// Check if Discord OAuth is configured
	if (!clientId) {
		if (isDevAuthSimulationEnabled(url, platform)) {
			const role = url.searchParams.get('role');
			const mode = url.searchParams.get('mode');
			const params = new URLSearchParams({ provider: 'discord' });
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
	// Opaque scheme: the raw cookie is the session token; bind the transaction
	// only to a session that is live in the DB right now.
	const rawSessionToken = linking ? cookies.get('session') : undefined;
	const boundSessionToken =
		rawSessionToken && (await findValidSession(db, rawSessionToken)) ? rawSessionToken : undefined;
	if (linking && !boundSessionToken) {
		throw redirect(302, '/auth/login?error=authentication_required');
	}
	const { state, cookie } = await createOAuthTransaction(
		db,
		'discord',
		linking ? 'link' : 'login',
		linking ? locals.user?.id : undefined,
		boundSessionToken || undefined,
		platform?.env?.SESSION_SECRET
	);
	cookies.set(oauthStateCookieName('discord'), cookie, oauthStateCookieOptions('discord', url));

	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: `${url.origin}/api/auth/discord/callback`,
		response_type: 'code',
		scope: 'identify email',
		state
	});

	throw redirect(302, `https://discord.com/api/oauth2/authorize?${params}`);
};
