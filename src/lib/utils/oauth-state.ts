import type { D1Database } from '@cloudflare/workers-types';
import { hashSessionToken } from './db';

// ── HMAC state-cookie signing ────────────────────────────────────────────────
// These lived in session.ts while the SESSION cookie was itself HMAC-signed.
// The opaque-sessions merge removed that scheme (the session cookie is now an
// opaque token verified against the DB), but the OAuth STATE cookie still
// rightly carries a signed payload — signing is this module's concern now.

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const DEV_FALLBACK_SECRET = 'nebulakit-dev-insecure-session-secret';

export function resolveSessionSecret(secret: string | undefined | null): string | null {
	if (secret) return secret;
	if (import.meta.env.DEV) return DEV_FALLBACK_SECRET;
	return null;
}

function bytesToBase64UrlSig(value: ArrayBuffer | Uint8Array): string {
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

	const payload = bytesToBase64UrlSig(encoder.encode(JSON.stringify(value)));
	const signature = await crypto.subtle.sign(
		'HMAC',
		await importSigningKey(resolvedSecret),
		encoder.encode(payload)
	);
	return `${payload}.${bytesToBase64UrlSig(signature)}`;
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
		if (bytesToBase64UrlSig(signatureBytes) !== signature) return null;
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


export type OAuthProvider = 'github' | 'discord';
export type OAuthIntent = 'login' | 'link';

export interface OAuthStatePayload {
	provider: OAuthProvider;
	state: string;
	intent: OAuthIntent;
	userId?: string;
	issuedAt: number;
}

const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

function createOpaqueState(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function oauthStateCookieName(provider: OAuthProvider): string {
	return `oauth_state_${provider}`;
}

export function oauthStateCookiePath(provider: OAuthProvider): string {
	return `/api/auth/${provider}/callback`;
}

export async function createOAuthState(
	provider: OAuthProvider,
	intent: OAuthIntent,
	userId: string | undefined,
	secret?: string | null
): Promise<{ state: string; cookie: string }> {
	const state = createOpaqueState();
	const payload: OAuthStatePayload = {
		provider,
		state,
		intent,
		...(intent === 'link' && userId ? { userId } : {}),
		issuedAt: Date.now()
	};
	return { state, cookie: await signValue(payload, secret) };
}

export async function verifyOAuthState(
	provider: OAuthProvider,
	state: string | undefined | null,
	cookie: string | undefined | null,
	secret?: string | null
): Promise<OAuthStatePayload | null> {
	if (!state) return null;
	const payload = await verifySignedValue<OAuthStatePayload>(cookie, secret);
	if (
		!payload ||
		payload.provider !== provider ||
		payload.state !== state ||
		(payload.intent !== 'login' && payload.intent !== 'link') ||
		typeof payload.issuedAt !== 'number' ||
		Date.now() - payload.issuedAt > OAUTH_STATE_MAX_AGE_SECONDS * 1000 ||
		payload.issuedAt > Date.now() + 60_000 ||
		(payload.intent === 'link' && !payload.userId)
	) {
		return null;
	}
	return payload;
}

export async function consumeOAuthState(
	provider: OAuthProvider,
	state: string | undefined | null,
	cookies: {
		get(name: string): string | undefined;
		delete(name: string, options: { path: string }): void;
	},
	secret?: string | null
): Promise<OAuthStatePayload | null> {
	const cookieName = oauthStateCookieName(provider);
	const cookie = cookies.get(cookieName);
	cookies.delete(cookieName, { path: oauthStateCookiePath(provider) });
	return verifyOAuthState(provider, state, cookie, secret);
}

interface StoredOAuthTransaction {
	intent: OAuthIntent;
	user_id: string | null;
	session_id: string | null;
}

interface OAuthStateCookies {
	get(name: string): string | undefined;
	delete(name: string, options: { path: string }): void;
}

/** Persist a state digest before redirecting to the provider. */
export async function createOAuthTransaction(
	db: D1Database,
	provider: OAuthProvider,
	intent: OAuthIntent,
	userId: string | undefined,
	boundSessionToken: string | undefined,
	secret?: string | null
): Promise<{ state: string; cookie: string }> {
	if (intent === 'link' && (!userId || !boundSessionToken)) {
		throw new Error('OAuth link transactions require an authenticated user and session');
	}

	const issued = await createOAuthState(provider, intent, userId, secret);
	const stateId = await hashSessionToken(issued.state);
	const sessionId = boundSessionToken ? await hashSessionToken(boundSessionToken) : null;
	const expiresAt = new Date(Date.now() + OAUTH_STATE_MAX_AGE_SECONDS * 1000).toISOString();

	await db
		.prepare(
			`INSERT INTO oauth_transactions
			 (id, provider, intent, user_id, session_id, expires_at)
			 VALUES (?, ?, ?, ?, ?, ?)`
		)
		.bind(
			stateId,
			provider,
			intent,
			intent === 'link' ? userId : null,
			intent === 'link' ? sessionId : null,
			expiresAt
		)
		.run();

	return issued;
}

/**
 * Verify the double-submit cookie and atomically consume the matching D1 row.
 * A copied browser cookie cannot replay the transaction after this update.
 */
async function validateTransactionBinding(
	payload: OAuthStatePayload,
	stored: StoredOAuthTransaction | null,
	boundSessionToken?: string
): Promise<OAuthStatePayload | null> {
	if (!stored || stored.intent !== payload.intent) return null;
	if (payload.intent === 'login') {
		return stored.user_id === null && stored.session_id === null ? payload : null;
	}

	if (!payload.userId || !boundSessionToken) return null;
	const boundSessionId = await hashSessionToken(boundSessionToken);
	return stored.user_id === payload.userId && stored.session_id === boundSessionId ? payload : null;
}

/** Validate an unexpired, unused transaction without preventing a provider-authentication retry. */
export async function verifyOAuthTransaction(
	db: D1Database,
	provider: OAuthProvider,
	state: string | undefined | null,
	cookies: OAuthStateCookies,
	secret?: string | null,
	boundSessionToken?: string
): Promise<OAuthStatePayload | null> {
	const payload = await verifyOAuthState(
		provider,
		state,
		cookies.get(oauthStateCookieName(provider)),
		secret
	);
	if (!payload) return null;

	const stateId = await hashSessionToken(payload.state);
	const stored = await db
		.prepare(
			`SELECT intent, user_id, session_id
			 FROM oauth_transactions
			 WHERE id = ?
			   AND provider = ?
			   AND consumed_at IS NULL
			   AND datetime(expires_at) > CURRENT_TIMESTAMP`
		)
		.bind(stateId, provider)
		.first<StoredOAuthTransaction>();

	return validateTransactionBinding(payload, stored, boundSessionToken);
}

/**
 * Atomically consume a previously validated transaction after token exchange.
 * Only one concurrent callback can cross this replay boundary.
 */
export async function consumeOAuthTransaction(
	db: D1Database,
	provider: OAuthProvider,
	state: string | undefined | null,
	cookies: OAuthStateCookies,
	secret?: string | null,
	boundSessionToken?: string
): Promise<OAuthStatePayload | null> {
	const cookieName = oauthStateCookieName(provider);
	const payload = await verifyOAuthState(provider, state, cookies.get(cookieName), secret);
	if (!payload) return null;

	const stateId = await hashSessionToken(payload.state);
	const stored = await db
		.prepare(
			`UPDATE oauth_transactions
			 SET consumed_at = CURRENT_TIMESTAMP
			 WHERE id = ?
			   AND provider = ?
			   AND consumed_at IS NULL
			   AND datetime(expires_at) > CURRENT_TIMESTAMP
			 RETURNING intent, user_id, session_id`
		)
		.bind(stateId, provider)
		.first<StoredOAuthTransaction>();
	cookies.delete(cookieName, { path: oauthStateCookiePath(provider) });

	return validateTransactionBinding(payload, stored, boundSessionToken);
}

export const oauthStateCookieOptions = (provider: OAuthProvider, url: URL) => ({
	path: oauthStateCookiePath(provider),
	httpOnly: true,
	sameSite: 'lax' as const,
	secure: url.protocol === 'https:',
	maxAge: OAUTH_STATE_MAX_AGE_SECONDS
});
