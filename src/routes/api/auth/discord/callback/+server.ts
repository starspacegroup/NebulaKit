import { reconcileOAuthAccount } from '$lib/server/oauth-account';
import { finalizeOAuthLogin } from '$lib/server/oauth-finalization';
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
			'discord',
			state,
			cookies.get('oauth_state_discord'),
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
		'discord',
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
		const { clientId, clientSecret } = await getAuthProviderCredentials(platform, 'discord');
		if (!clientId || !clientSecret) {
			throw redirect(302, '/auth/login?error=not_configured');
		}

		const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: clientId,
				client_secret: clientSecret,
				code,
				grant_type: 'authorization_code',
				redirect_uri: `${url.origin}/api/auth/discord/callback`
			})
		});
		if (!tokenResponse.ok) throw redirect(302, '/auth/login?error=token_exchange_failed');

		const accessToken = (await tokenResponse.json()).access_token;
		if (!accessToken) throw redirect(302, '/auth/login?error=no_access_token');

		const transaction = await consumeOAuthTransaction(
			db,
			'discord',
			state,
			cookies,
			platform.env.SESSION_SECRET,
			currentSessionToken || undefined
		);
		if (!transaction) throw redirect(302, '/auth/login?error=invalid_state');

		const userResponse = await fetch('https://discord.com/api/users/@me', {
			headers: { Authorization: `Bearer ${accessToken}` }
		});
		if (!userResponse.ok) throw redirect(302, '/auth/login?error=user_fetch_failed');
		const discordUser = await userResponse.json();
		const providerUserId = `discord_${discordUser.id}`;

		const { userId, linkedProvider } = await reconcileOAuthAccount({
			db,
			provider: 'discord',
			providerAccountId: discordUser.id,
			legacyUserId: providerUserId,
			email: discordUser.email,
			linkingUserId: transaction.intent === 'link' ? existingUser?.id : undefined,
			createUser: async (id) => {
				// Discord cannot bootstrap ownership; privilege comes from a canonical linked account.
				await db
					.prepare(
						`INSERT INTO users (id, email, name, created_at)
						 VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
					)
					.bind(
						id,
						discordUser.email || `${discordUser.username}@discord.local`,
						discordUser.global_name || discordUser.username
					)
					.run();
			},
			updateUser: async (id, match) => {
				if (match !== 'legacy') return;
				await db
					.prepare('UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
					.bind(discordUser.global_name || discordUser.username, id)
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
		console.error('Discord OAuth callback error:', error);
		throw redirect(302, '/auth/login?error=oauth_failed');
	}
};
