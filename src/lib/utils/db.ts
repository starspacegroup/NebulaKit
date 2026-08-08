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
): Promise<Session> {
	// Generate UUID (Cloudflare Workers supports crypto.randomUUID)
	const id = crypto.randomUUID();
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + expiresInDays);

	const stmt = db.prepare(
		'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?) RETURNING *'
	);
	const result = await stmt.bind(id, userId, expiresAt.toISOString()).first<Session>();

	if (!result) {
		throw new Error('Failed to create session');
	}

	return result;
}

/**
 * Create an authenticated session and return its opaque id for the cookie.
 *
 * The id is a random UUID; the TRUSTED user payload is stored in `sessions.data`
 * server-side and read back on every request (see getAuthSession). The cookie
 * never carries the payload, so isOwner/isAdmin cannot be forged by editing it.
 */
export async function createAuthSession(
	db: D1Database,
	user: SessionUser,
	expiresInDays: number = 7
): Promise<string> {
	const id = crypto.randomUUID();
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + expiresInDays);

	await db
		.prepare('INSERT INTO sessions (id, user_id, expires_at, data) VALUES (?, ?, ?, ?)')
		.bind(id, user.id, expiresAt.toISOString(), JSON.stringify(user))
		.run();

	return id;
}

/**
 * Resolve a session cookie to its stored user payload, or null if the session
 * is unknown, expired, or predates this scheme (no stored payload). A forged
 * cookie resolves to null because it names no real session — fail closed.
 */
export async function getAuthSession(
	db: D1Database,
	sessionId: string
): Promise<SessionUser | null> {
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
export async function findValidSession(db: D1Database, sessionId: string): Promise<Session | null> {
	const stmt = db.prepare(
		"SELECT * FROM sessions WHERE id = ? AND datetime(expires_at) > datetime('now')"
	);
	return await stmt.bind(sessionId).first<Session>();
}

/**
 * Delete session (logout)
 */
export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
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
