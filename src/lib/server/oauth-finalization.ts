import { createAuthSession, replaceAuthSession } from '$lib/utils/db';
import { resolveOwnerStatus, type AuthIdentityRecord } from '$lib/utils/auth-identity';
import { buildSessionCookieHeader, createSessionUser } from '$lib/utils/session';
import type { D1Database } from '@cloudflare/workers-types';
import type { OAuthProvider } from '$lib/utils/oauth-state';

interface FinalizeOAuthLoginOptions {
	db: D1Database;
	platform: App.Platform;
	url: URL;
	userId: string;
	currentSessionToken?: string;
	linkedProvider?: OAuthProvider;
}

/**
 * Merge resolution record: this finalization used to mint main's HMAC-signed
 * DB session. It now issues the opaque-sessions scheme instead — the cookie
 * carries an opaque token, the trusted payload lives in sessions.data, and a
 * link-flow re-auth revokes the previous token in the same D1 batch
 * (replaceAuthSession), preserving main's no-replay property.
 */
export async function finalizeOAuthLogin({
	db,
	platform,
	url,
	userId,
	currentSessionToken,
	linkedProvider
}: FinalizeOAuthLoginOptions): Promise<Response> {
	const user = await db
		.prepare(
			'SELECT id, email, name, github_login, github_avatar_url, is_admin FROM users WHERE id = ?'
		)
		.bind(userId)
		.first<AuthIdentityRecord>();
	if (!user) throw new Error('OAuth user disappeared before session finalization');

	const isOwner = await resolveOwnerStatus(platform, user);
	const sessionUser = createSessionUser({
		...user,
		isOwner,
		isAdmin: user.is_admin === 1 || isOwner
	});
	const sessionToken = currentSessionToken
		? await replaceAuthSession(db, sessionUser, currentSessionToken, 7)
		: await createAuthSession(db, sessionUser, 7);
	if (isOwner && platform.env.KV) {
		const marker = await platform.env.KV.get('admin_first_login_completed');
		if (!marker) await platform.env.KV.put('admin_first_login_completed', 'true');
	}

	const destination = linkedProvider
		? `/profile?linked=${linkedProvider}`
		: isOwner || user.is_admin === 1
			? '/admin'
			: '/';

	return new Response(null, {
		status: 302,
		headers: {
			Location: new URL(destination, url.origin).toString(),
			'Set-Cookie': buildSessionCookieHeader(sessionToken, url)
		}
	});
}
