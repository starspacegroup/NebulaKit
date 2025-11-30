/**
 * Database utility functions for D1
 */
import type { D1Database } from '@cloudflare/workers-types';

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
 * Find session by ID and check if it's valid
 */
export async function findValidSession(db: D1Database, sessionId: string): Promise<Session | null> {
	const stmt = db.prepare('SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")');
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
	const stmt = db.prepare('DELETE FROM sessions WHERE expires_at < datetime("now")');
	await stmt.run();
}
