export interface SessionUser {
	id: string;
	login: string;
	email: string;
	name?: string;
	avatarUrl?: string;
	isOwner: boolean;
	isAdmin?: boolean;
	/** Per-admin grant for /admin/stats. Refreshed from the DB on every request
	 *  by the auth hook, so revoking it takes effect without a re-login. */
	canViewStats?: boolean;
	githubLogin?: string;
	isPretend?: boolean;
	simulatedConnections?: string[];
}

interface SessionUserInput {
	id: string;
	email: string;
	name?: string | null;
	github_login?: string | null;
	github_avatar_url?: string | null;
	is_admin?: number | boolean;
	isOwner?: boolean;
	isAdmin?: boolean;
}

export function deriveLoginIdentifier(email: string, githubLogin?: string | null): string {
	if (githubLogin) {
		return githubLogin;
	}

	const [localPart] = email.split('@');
	return localPart || email;
}

export function createSessionUser(input: SessionUserInput): SessionUser {
	const githubLogin = input.github_login || undefined;
	const isAdmin =
		typeof input.isAdmin === 'boolean'
			? input.isAdmin
			: input.is_admin === 1 || input.is_admin === true;

	return {
		id: input.id,
		login: deriveLoginIdentifier(input.email, githubLogin),
		email: input.email,
		name: input.name || deriveLoginIdentifier(input.email, githubLogin),
		avatarUrl: input.github_avatar_url || undefined,
		isOwner: input.isOwner ?? false,
		isAdmin,
		githubLogin
	};
}

/**
 * Build the Set-Cookie header for a session.
 *
 * The value is an OPAQUE session id (from createAuthSession), never the user
 * object. The trusted payload lives server-side in sessions.data, so a client
 * that edits this cookie only names a different (non-existent) session and is
 * refused — isOwner/isAdmin can no longer be forged in the cookie.
 *
 * The cookie used to carry base64(JSON(user)); `encodeSession`/`decodeSessionCookie`
 * were removed with that scheme. Do not reintroduce a cookie the hooks trust
 * without a server-side lookup.
 */
export function buildSessionCookieHeader(sessionId: string, url: URL): string {
	const cookieParts = [
		`session=${sessionId}`,
		'Path=/',
		'HttpOnly',
		'SameSite=Lax',
		`Max-Age=${60 * 60 * 24 * 7}`
	];

	if (url.protocol === 'https:') {
		cookieParts.push('Secure');
	}

	return cookieParts.join('; ');
}
