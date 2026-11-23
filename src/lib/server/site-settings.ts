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
