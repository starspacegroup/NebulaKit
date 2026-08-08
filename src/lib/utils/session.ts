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

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const DEV_FALLBACK_SECRET = 'nebulakit-dev-insecure-session-secret';

export function resolveSessionSecret(secret: string | undefined | null): string | null {
	if (secret) return secret;
	if (import.meta.env.DEV) return DEV_FALLBACK_SECRET;
	return null;
}

function bytesToBase64Url(value: ArrayBuffer | Uint8Array): string {
	const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): ArrayBuffer {
	let normalized = value.replace(/-/g, '+').replace(/_/g, '/');
	while (normalized.length % 4) normalized += '=';
	const binary = atob(normalized);
	const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
	return bytes.buffer;
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);
}

export async function signValue(value: unknown, secret?: string | null): Promise<string> {
	const resolvedSecret = resolveSessionSecret(secret);
	if (!resolvedSecret) {
		throw new Error('SESSION_SECRET is not configured; refusing to issue an unsigned cookie');
	}

	const payload = bytesToBase64Url(encoder.encode(JSON.stringify(value)));
	const signature = await crypto.subtle.sign(
		'HMAC',
		await importSigningKey(resolvedSecret),
		encoder.encode(payload)
	);
	return `${payload}.${bytesToBase64Url(signature)}`;
}

export async function verifySignedValue<T>(
	value: string | undefined | null,
	secret?: string | null
): Promise<T | null> {
	const resolvedSecret = resolveSessionSecret(secret);
	if (!value || !resolvedSecret) return null;

	const parts = value.split('.');
	if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
	const [payload, signature] = parts;

	try {
		const signatureBytes = base64UrlToBytes(signature);
		if (bytesToBase64Url(signatureBytes) !== signature) return null;
		const valid = await crypto.subtle.verify(
			'HMAC',
			await importSigningKey(resolvedSecret),
			signatureBytes,
			encoder.encode(payload)
		);
		if (!valid) return null;
		return JSON.parse(decoder.decode(base64UrlToBytes(payload))) as T;
	} catch {
		return null;
	}
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

export function encodeSession(user: SessionUser, secret?: string | null): Promise<string> {
	return signValue(user, secret);
}

export async function decodeSessionCookie(
	sessionCookie?: string,
	secret?: string | null
): Promise<SessionUser | null> {
	const user = await verifySignedValue<SessionUser>(sessionCookie, secret);
	if (
		!user ||
		typeof user.id !== 'string' ||
		typeof user.login !== 'string' ||
		typeof user.email !== 'string' ||
		typeof user.isOwner !== 'boolean'
	) {
		return null;
	}
	return user;
}

export async function decodeDatabaseSessionCookie(
	sessionCookie?: string,
	secret?: string | null
): Promise<string | null> {
	const session = await verifySignedValue<{ token: string }>(sessionCookie, secret);
	return session && typeof session.token === 'string' && session.token ? session.token : null;
}

export async function buildSessionCookieHeader(
	user: SessionUser,
	url: URL,
	secret?: string | null
): Promise<string> {
	return buildCookieHeader(await encodeSession(user, secret), url);
}

/**
 * D1 stores only the opaque token's digest. The cookie signs the raw token so
 * unsigned values are rejected before any database lookup.
 */
export async function buildDatabaseSessionCookieHeader(
	token: string,
	url: URL,
	secret?: string | null
): Promise<string> {
	if (!token) {
		throw new Error('Refusing to issue an empty database session token');
	}

	return buildCookieHeader(await signValue({ token }, secret), url);
}

function buildCookieHeader(value: string, url: URL): string {
	const cookieParts = [
		`session=${value}`,
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
