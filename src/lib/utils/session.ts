export interface SessionUser {
	id: string;
	login: string;
	email: string;
	name?: string;
	avatarUrl?: string;
	isOwner: boolean;
	isAdmin?: boolean;
	githubLogin?: string;
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

function toBase64Url(value: string): string {
	return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
	let normalized = value;
	if (normalized.includes('-') || normalized.includes('_')) {
		normalized = normalized.replace(/-/g, '+').replace(/_/g, '/');
	}
	while (normalized.length % 4) {
		normalized += '=';
	}

	return atob(normalized);
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

export function encodeSession(user: SessionUser): string {
	return toBase64Url(JSON.stringify(user));
}

export function decodeSessionCookie(sessionCookie?: string): SessionUser | null {
	if (!sessionCookie) {
		return null;
	}

	try {
		return JSON.parse(fromBase64Url(sessionCookie)) as SessionUser;
	} catch {
		return null;
	}
}

export function buildSessionCookieHeader(user: SessionUser, url: URL): string {
	const cookieParts = [
		`session=${encodeSession(user)}`,
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
