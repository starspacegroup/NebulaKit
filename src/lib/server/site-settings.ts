import type { D1Database } from '@cloudflare/workers-types';
import { canonicalTimeZone, TZ_AUTO } from '$lib/utils/timezone';

/**
 * Generic site-level key/value settings (migration 0032, `site_settings`).
 * Reads fail soft: a database that has not run the migration reads as "never
 * configured", never as an error that takes an admin page down.
 */

export const ADMIN_TIMEZONE_KEY = 'admin_timezone';

export async function readSiteSetting(
	db: D1Database | undefined,
	key: string
): Promise<string | null> {
	if (!db) return null;
	try {
		const row = await db
			.prepare('SELECT value FROM site_settings WHERE key = ?')
			.bind(key)
			.first<{ value: string }>();
		return row?.value ?? null;
	} catch {
		return null;
	}
}

export async function writeSiteSetting(db: D1Database, key: string, value: string): Promise<void> {
	await db
		.prepare(
			`INSERT INTO site_settings (key, value, updated_at)
			 VALUES (?, ?, datetime('now'))
			 ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
		)
		.bind(key, value)
		.run();
}

/** The stored admin zone: a canonical IANA name, or 'auto' (also for anything unreadable). */
export async function readAdminTimeZoneSetting(db: D1Database | undefined): Promise<string> {
	const raw = await readSiteSetting(db, ADMIN_TIMEZONE_KEY);
	if (!raw || raw === TZ_AUTO) return TZ_AUTO;
	return canonicalTimeZone(raw) ?? TZ_AUTO;
}

/** Validate and store. Returns the stored value, or null when the zone is unknown. */
export async function saveAdminTimeZoneSetting(
	db: D1Database,
	input: unknown
): Promise<string | null> {
	const value = input === TZ_AUTO ? TZ_AUTO : canonicalTimeZone(input);
	if (!value) return null;
	await writeSiteSetting(db, ADMIN_TIMEZONE_KEY, value);
	return value;
}

/** A user's own zone: a canonical IANA name, or 'auto' when they have no preference. */
export async function readUserTimeZone(
	db: D1Database | undefined,
	userId: string | undefined
): Promise<string> {
	if (!db || !userId) return TZ_AUTO;
	try {
		const row = await db
			.prepare('SELECT time_zone FROM users WHERE id = ?')
			.bind(userId)
			.first<{ time_zone: string | null }>();
		return (row?.time_zone && canonicalTimeZone(row.time_zone)) || TZ_AUTO;
	} catch {
		// Before migration 0033 the column does not exist: no preference.
		return TZ_AUTO;
	}
}

/**
 * Store the signed-in user's own zone ('auto' clears it). The id comes from the
 * session, never the request. Returns the stored value, or null when the zone is
 * unknown or the user has no row.
 */
export async function saveUserTimeZone(
	db: D1Database,
	userId: string,
	input: unknown
): Promise<string | null> {
	const value = input === TZ_AUTO ? TZ_AUTO : canonicalTimeZone(input);
	if (!value) return null;
	const result = await db
		.prepare('UPDATE users SET time_zone = ? WHERE id = ?')
		.bind(value === TZ_AUTO ? null : value, userId)
		.run();
	return (result.meta?.changes ?? 1) > 0 ? value : null;
}
