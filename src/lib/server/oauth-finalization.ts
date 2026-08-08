import { createSession, replaceSession } from '$lib/utils/db';
import { resolveOwnerStatus, type AuthIdentityRecord } from '$lib/utils/auth-identity';
import { buildDatabaseSessionCookieHeader } from '$lib/utils/session';
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
	const session = currentSessionToken
		? await replaceSession(db, user.id, currentSessionToken, 7)
		: await createSession(db, user.id, 7);
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
			'Set-Cookie': await buildDatabaseSessionCookieHeader(
				session.token,
				url,
				platform.env.SESSION_SECRET
			)
		}
	});
}
