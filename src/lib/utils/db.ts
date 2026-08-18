/**
 * Database utility functions for D1
 */
import type { D1Database } from '@cloudflare/workers-types';
import type { SessionUser } from './session';

export interface User {
	id: string;
	email: string;
	name?: string;
	created_at: Date;
}

export interface Session {
	id: string;
	user_id: string;
	expires_at: Date;
}

export interface CreatedSession extends Session {
	/** Raw bearer token returned once to the browser. D1 stores only its digest. */
	token: string;
}

function bytesToBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function createSessionToken(): string {
	return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashSessionToken(token: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
	return bytesToBase64Url(new Uint8Array(digest));
}

/**
 * Create a new user in the database
 */
export async function createUser(db: D1Database, email: string, name?: string): Promise<User> {
	// Generate UUID (Cloudflare Workers supports crypto.randomUUID)
	const id = crypto.randomUUID();
	const stmt = db.prepare('INSERT INTO users (id, email, name) VALUES (?, ?, ?) RETURNING *');
	const result = await stmt.bind(id, email, name || null).first<User>();

	if (!result) {
		throw new Error('Failed to create user');
	}

	return result;
}

/**
 * Find user by email
 */
export async function findUserByEmail(db: D1Database, email: string): Promise<User | null> {
	const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
	return await stmt.bind(email).first<User>();
}

/**
 * Find user by ID
 */
export async function findUserById(db: D1Database, id: string): Promise<User | null> {
	const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
	return await stmt.bind(id).first<User>();
}

/**
 * Create a new session
 */
export async function createSession(
	db: D1Database,
	userId: string,
	expiresInDays: number = 30
): Promise<CreatedSession> {
	const token = createSessionToken();
	const id = await hashSessionToken(token);
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + expiresInDays);

	const stmt = db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)');
	await stmt.bind(id, userId, expiresAt.toISOString()).run();

	return { id, token, user_id: userId, expires_at: expiresAt };
}

/**
 * Create a session and revoke the previous token as one D1 transaction.
 */
export async function replaceSession(
	db: D1Database,
	userId: string,
	previousToken: string,
	expiresInDays: number = 30
): Promise<CreatedSession> {
	const token = createSessionToken();
	const [id, previousId] = await Promise.all([
		hashSessionToken(token),
		hashSessionToken(previousToken)
	]);
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + expiresInDays);

	await db.batch([
		db
			.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
			.bind(id, userId, expiresAt.toISOString()),
		db.prepare('DELETE FROM sessions WHERE id = ?').bind(previousId)
	]);

	return { id, token, user_id: userId, expires_at: expiresAt };
}

/**
 * Create an authenticated session and return its opaque token for the cookie.
 *
 * The design is the opaque-sessions branch's: the cookie never carries the
 * user payload, which lives in `sessions.data` server-side and is read back
 * on every request (see getAuthSession), so isOwner/isAdmin cannot be forged
 * by editing the cookie. Two hardenings grafted from main's competing scheme
 * (deliberate improvement, called out in the merge record, not silent drift):
 *  - the token is 256-bit `createSessionToken()` output rather than a UUID
 *    (122 random bits), and
 *  - the DB row's id is `hashSessionToken(token)`, never the token itself, so
 *    a leaked sessions table exposes no value a cookie could present.
 */
export async function createAuthSession(
	db: D1Database,
	user: SessionUser,
	expiresInDays: number = 7
): Promise<string> {
	const token = createSessionToken();
	const id = await hashSessionToken(token);
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + expiresInDays);

	await db
		.prepare('INSERT INTO sessions (id, user_id, expires_at, data) VALUES (?, ?, ?, ?)')
		.bind(id, user.id, expiresAt.toISOString(), JSON.stringify(user))
		.run();

	return token;
}

/**
 * Create a fresh auth session and revoke a previous token as one D1
 * transaction — the opaque-scheme sibling of replaceSession, used when a
 * logged-in user re-authenticates (OAuth link flows) so the superseded cookie
 * cannot be replayed.
 */
export async function replaceAuthSession(
	db: D1Database,
	user: SessionUser,
	previousToken: string,
	expiresInDays: number = 7
): Promise<string> {
	const token = createSessionToken();
	const [id, previousId] = await Promise.all([
		hashSessionToken(token),
		hashSessionToken(previousToken)
	]);
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + expiresInDays);

	await db.batch([
		db
			.prepare('INSERT INTO sessions (id, user_id, expires_at, data) VALUES (?, ?, ?, ?)')
			.bind(id, user.id, expiresAt.toISOString(), JSON.stringify(user)),
		db.prepare('DELETE FROM sessions WHERE id = ?').bind(previousId)
	]);

	return token;
}

/**
 * Resolve a session cookie to its stored user payload, or null if the session
 * is unknown, expired, or predates this scheme (no stored payload). A forged
 * cookie resolves to null because it names no real session — fail closed.
 * The cookie presents the raw token; rows are keyed by its hash.
 */
export async function getAuthSession(
	db: D1Database,
	sessionToken: string
): Promise<SessionUser | null> {
	const sessionId = await hashSessionToken(sessionToken);
	// datetime(expires_at) normalizes the stored ISO string ("...T...Z") before
	// comparing: a raw string compare against datetime('now') ("... ...") sorts
	// 'T' after ' ', so a same-day expiry read as still-valid for up to a day.
	const row = await db
		.prepare("SELECT data FROM sessions WHERE id = ? AND datetime(expires_at) > datetime('now')")
		.bind(sessionId)
		.first<{ data: string | null }>();

	if (!row?.data) return null;
	try {
		return JSON.parse(row.data) as SessionUser;
	} catch {
		return null;
	}
}

/**
 * Find session by ID and check if it's valid
 */
// Union of both parents' hardening: HEAD hashes the presented token before
// lookup (ids at rest are SHA-256 digests, so a leaked DB exposes no live
// cookie values); the opaque-sessions branch normalizes expires_at with
// datetime() (a raw string compare sorts 'T' after ' ' and reads a same-day
// expiry as valid for up to a day). Taking either side alone would drop the
// other's fix.
export async function findValidSession(
	db: D1Database,
	sessionToken: string
): Promise<Session | null> {
	const sessionId = await hashSessionToken(sessionToken);
	const stmt = db.prepare(
		"SELECT * FROM sessions WHERE id = ? AND datetime(expires_at) > datetime('now')"
	);
	return await stmt.bind(sessionId).first<Session>();
}

/**
 * Delete session (logout)
 */
export async function deleteSession(db: D1Database, sessionToken: string): Promise<void> {
	const sessionId = await hashSessionToken(sessionToken);
	const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
	await stmt.bind(sessionId).run();
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(db: D1Database): Promise<void> {
	const stmt = db.prepare("DELETE FROM sessions WHERE datetime(expires_at) < datetime('now')");
	await stmt.run();
}
