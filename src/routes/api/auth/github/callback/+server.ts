import { reconcileOAuthAccount } from '$lib/server/oauth-account';
import { finalizeOAuthLogin } from '$lib/server/oauth-finalization';
import { resolveOwnerStatus } from '$lib/utils/auth-identity';
import { getAuthProviderCredentials } from '$lib/utils/auth-provider-config';
import {
	consumeOAuthTransaction,
	verifyOAuthState,
	verifyOAuthTransaction
} from '$lib/utils/oauth-state';
import { findValidSession } from '$lib/utils/db';
import { isRedirect, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies, platform, locals }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	if (!code) throw redirect(302, '/auth/login?error=no_code');

	const db = platform?.env?.DB;
	if (!db) {
		const browserState = await verifyOAuthState(
			'github',
			state,
			cookies.get('oauth_state_github'),
			platform?.env?.SESSION_SECRET
		);
		throw redirect(
			302,
			browserState ? '/auth/login?error=oauth_failed' : '/auth/login?error=invalid_state'
		);
	}

	// The session cookie is an opaque token under the merged scheme; validate it
	// against the sessions table before treating the caller as logged in — a
	// stale or forged cookie must not count as a live session for the link flow.
	const rawSessionToken = cookies.get('session');
	const currentSessionToken =
		rawSessionToken && (await findValidSession(db, rawSessionToken)) ? rawSessionToken : null;
	const pendingTransaction = await verifyOAuthTransaction(
		db,
		'github',
		state,
		cookies,
		platform.env.SESSION_SECRET,
		currentSessionToken || undefined
	);
	if (!pendingTransaction) throw redirect(302, '/auth/login?error=invalid_state');

	const existingUser = pendingTransaction.intent === 'link' ? locals.user : null;
	if (pendingTransaction.intent === 'link' && existingUser?.id !== pendingTransaction.userId) {
		throw redirect(302, '/auth/login?error=invalid_state');
	}

	try {
		const { clientId, clientSecret } = await getAuthProviderCredentials(platform, 'github');
		if (!clientId || !clientSecret) {
			throw redirect(302, '/auth/login?error=not_configured');
		}

		const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({
				client_id: clientId,
				client_secret: clientSecret,
				code,
				redirect_uri: `${url.origin}/api/auth/github/callback`
			})
		});
		if (!tokenResponse.ok) throw redirect(302, '/auth/login?error=token_exchange_failed');

		const accessToken = (await tokenResponse.json()).access_token;
		if (!accessToken) throw redirect(302, '/auth/login?error=no_access_token');

		// Consume state after authenticating the provider response and before identity mutations.
		const transaction = await consumeOAuthTransaction(
			db,
			'github',
			state,
			cookies,
			platform.env.SESSION_SECRET,
			currentSessionToken || undefined
		);
		if (!transaction) throw redirect(302, '/auth/login?error=invalid_state');

		const userResponse = await fetch('https://api.github.com/user', {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: 'application/vnd.github.v3+json',
				'User-Agent': 'NebulaKit'
			}
		});
		if (!userResponse.ok) throw redirect(302, '/auth/login?error=user_fetch_failed');
		const githubUser = await userResponse.json();
		const providerAccountId = githubUser.id.toString();

		const { userId, linkedProvider } = await reconcileOAuthAccount({
			db,
			provider: 'github',
			providerAccountId,
			legacyUserId: providerAccountId,
			email: githubUser.email,
			linkingUserId: transaction.intent === 'link' ? existingUser?.id : undefined,
			createUser: async (id) => {
				const isOwner = await resolveOwnerStatus(platform, {
					id,
					github_login: githubUser.login
				});
				await db
					.prepare(
						`INSERT INTO users (id, email, name, github_login, github_avatar_url, is_admin, created_at)
						 VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
					)
					.bind(
						id,
						githubUser.email || `${githubUser.login}@github.local`,
						githubUser.name,
						githubUser.login,
						githubUser.avatar_url,
						isOwner ? 1 : 0
					)
					.run();
			},
			updateUser: async (id, match) => {
				if (match === 'legacy') {
					await db
						.prepare(
							`UPDATE users SET name = ?, github_login = ?, github_avatar_url = ?,
							 updated_at = CURRENT_TIMESTAMP WHERE id = ?`
						)
						.bind(githubUser.name, githubUser.login, githubUser.avatar_url, id)
						.run();
					return;
				}
				await db
					.prepare(
						'UPDATE users SET github_login = ?, github_avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
					)
					.bind(githubUser.login, githubUser.avatar_url, id)
					.run();
			}
		});

		return finalizeOAuthLogin({
			db,
			platform,
			url,
			userId,
			currentSessionToken: linkedProvider ? currentSessionToken || undefined : undefined,
			linkedProvider
		});
	} catch (error) {
		if (isRedirect(error)) throw error;
		console.error('GitHub OAuth callback error:', error);
		throw redirect(302, '/auth/login?error=oauth_failed');
	}
};
