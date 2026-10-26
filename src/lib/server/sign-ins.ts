/**
 * Sign-in tracking (docs/SIGN_IN_TRACKING.md). OFF BY DEFAULT.
 *
 * The template's analytics are deliberately identifier-free, so this is the one
 * place that stores an IP address, and it only does so after the OWNER turns it
 * on at /admin/sign-ins. While it is off, this file writes nothing: no event
 * rows and no `sessions.last_seen_at`.
 *
 * When on, what is kept is the minimum for "who signed in from where, and did
 * it fail":
 *  - the method (password, signup, github, discord), success or failure, and a
 *    few-word reason for a failure (never the password or the typed email);
 *  - the IP (stored in full, shown masked unless the owner reveals PII);
 *  - a coarse device bucket such as "Chrome on macOS". The raw User-Agent
 *    string is never stored;
 *  - the edge-provided country code;
 *  - for live sessions, `last_seen_at`, refreshed at most every 5 minutes.
 * Events older than 90 days are deleted as new ones are written (and by
 * POST /api/cron/prune-audit).
 *
 * Nothing here may block a sign-in. Every recorder swallows its own errors, so
 * a missing migration, a KV outage or a full table cannot refuse a login that
 * should succeed, or let one through that should not.
 */
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { browserBucket, osBucket } from '$lib/utils/page-views';
import { hashSessionToken } from '$lib/utils/db';

export const SIGN_IN_TRACKING_KEY = 'sign_in_tracking';
export const SIGN_IN_RETENTION_DAYS = 90;
export const SESSION_TOUCH_SECONDS = 5 * 60;

export type SignInMethod = 'password' | 'signup' | 'github' | 'discord';

export interface SignInTrackingSetting {
	enabled: boolean;
	updatedAt: string;
}

/** The owner's switch. Fails CLOSED: anything unreadable means "off". */
export async function readTracking(
	kv: KVNamespace | undefined | null
): Promise<SignInTrackingSetting> {
	const off = { enabled: false, updatedAt: '' };
	if (!kv) return off;
	try {
		const raw = await kv.get(SIGN_IN_TRACKING_KEY);
		if (!raw) return off;
		const parsed = JSON.parse(raw) as Partial<SignInTrackingSetting>;
		return {
			enabled: parsed.enabled === true,
			updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : ''
		};
	} catch {
		return off;
	}
}

export async function writeTracking(
	kv: KVNamespace,
	enabled: boolean,
	now: Date = new Date()
): Promise<SignInTrackingSetting> {
	const setting = { enabled, updatedAt: now.toISOString() };
	await kv.put(SIGN_IN_TRACKING_KEY, JSON.stringify(setting));
	return setting;
}

// ---------------------------------------------------------------------------
// Masking and device buckets
// ---------------------------------------------------------------------------

/**
 * Mask an address for display. IPv4 keeps the first two octets
 * (`203.0.x.x`); IPv6 keeps the first two groups (`2001:db8:…`). Anything else
 * is fully hidden.
 */
export function maskIp(ip: string | null | undefined): string {
	if (!ip) return '—';
	if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) return `${ip.split('.').slice(0, 2).join('.')}.x.x`;
	if (ip.includes(':')) return `${ip.split(':').slice(0, 2).join(':')}:…`;
	return '***';
}

/** "Chrome on macOS": a coarse bucket; the raw User-Agent is not kept. */
export function deviceLabel(ua: string | null | undefined): string {
	const agent = ua ?? '';
	const browser = browserBucket(null, agent);
	const os = osBucket(null, agent);
	if (browser === '(unknown)' && os === '(unknown)') return 'Unknown device';
	if (browser === '(unknown)') return os;
	if (os === '(unknown)') return browser;
	return `${browser} on ${os}`;
}

export interface RequestOrigin {
	ip: string | null;
	device: string;
	country: string | null;
}

export function requestOrigin(
	request: Request | undefined,
	cf?: { country?: unknown } | null
): RequestOrigin {
	const headers = request?.headers;
	// cf-connecting-ip is set by Cloudflare; the client cannot supply it through the edge.
	const ip = headers?.get('cf-connecting-ip')?.trim().slice(0, 64) || null;
	const country = typeof cf?.country === 'string' ? cf.country : null;
	return {
		ip,
		device: deviceLabel(headers?.get('user-agent')),
		// XX and T1 are Cloudflare's "unknown" and "Tor".
		country: country && /^[A-Z]{2}$/.test(country) && country !== 'XX' ? country : null
	};
}

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

type Platform = App.Platform | undefined;

export interface SignInAttempt {
	method: SignInMethod;
	success: boolean;
	userId?: string | null;
	/** Why a failure failed, in a few words. Never the password or the typed email. */
	reason?: string | null;
}

/**
 * Record one attempt, if the owner turned tracking on. Returns whether a row
 * was written. Never throws.
 */
export async function recordSignIn(
	platform: Platform,
	request: Request | undefined,
	attempt: SignInAttempt
): Promise<boolean> {
	try {
		const db = platform?.env?.DB;
		if (!db || !(await readTracking(platform?.env?.KV)).enabled) return false;
		const origin = requestOrigin(request, platform?.cf as { country?: unknown } | undefined);
		await db.batch([
			db
				.prepare(
					`INSERT INTO sign_in_events (id, user_id, method, success, reason, ip, device, country)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.bind(
					crypto.randomUUID(),
					attempt.userId ?? null,
					attempt.method,
					attempt.success ? 1 : 0,
					attempt.reason ? attempt.reason.slice(0, 80) : null,
					origin.ip,
					origin.device,
					origin.country
				),
			db
				.prepare(
					`DELETE FROM sign_in_events WHERE created_at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now', ?)`
				)
				.bind(`-${SIGN_IN_RETENTION_DAYS} days`)
		]);
		return true;
	} catch (err) {
		console.error('[sign-ins] could not record an attempt:', err);
		return false;
	}
}

/**
 * `recordSignIn` off the critical path: handed to `waitUntil` when the
 * platform has one, awaited otherwise. The caller never sees an error.
 */
export async function trackSignIn(
	platform: Platform,
	request: Request | undefined,
	attempt: SignInAttempt
): Promise<void> {
	const work = recordSignIn(platform, request, attempt);
	const waitUntil = platform?.context?.waitUntil?.bind(platform.context);
	if (waitUntil) waitUntil(work);
	else await work;
}

// Sessions touched recently by this isolate, so a busy page does not read the
// setting or write per request. Bounded: cleared rather than allowed to grow.
const touched = new Map<string, number>();
const TOUCHED_MAX = 5000;

/** Reset the per-isolate touch cache. Tests only. */
export function resetTouchCache(): void {
	touched.clear();
}

/**
 * Mark a session as used now, at most once per SESSION_TOUCH_SECONDS, and only
 * while tracking is on. The in-memory throttle runs first, so a request that is
 * not due costs nothing, not even the setting read. Never throws.
 */
export async function touchSession(
	platform: Platform,
	sessionToken: string,
	now: Date = new Date()
): Promise<boolean> {
	try {
		const db = platform?.env?.DB;
		if (!db) return false;
		const ms = now.getTime();
		const last = touched.get(sessionToken);
		if (last !== undefined && ms - last < SESSION_TOUCH_SECONDS * 1000) return false;
		if (touched.size >= TOUCHED_MAX) touched.clear();
		touched.set(sessionToken, ms);
		if (!(await readTracking(platform?.env?.KV)).enabled) return false;
		const stamp = now.toISOString().slice(0, 19) + 'Z';
		const stale = new Date(ms - SESSION_TOUCH_SECONDS * 1000).toISOString().slice(0, 19) + 'Z';
		const result = await db
			.prepare(
				'UPDATE sessions SET last_seen_at = ? WHERE id = ? AND (last_seen_at IS NULL OR last_seen_at < ?)'
			)
			.bind(stamp, await hashSessionToken(sessionToken), stale)
			.run();
		return (result.meta?.changes ?? 0) > 0;
	} catch (err) {
		console.error('[sign-ins] could not touch a session:', err);
		return false;
	}
}

/** `touchSession` for the auth hook: off the critical path, errors swallowed. */
export async function trackSessionSeen(platform: Platform, sessionToken: string): Promise<void> {
	const work = touchSession(platform, sessionToken);
	const waitUntil = platform?.context?.waitUntil?.bind(platform.context);
	if (waitUntil) waitUntil(work);
	else await work;
}

// ---------------------------------------------------------------------------
// Reading, revoking, pruning (the owner's page)
// ---------------------------------------------------------------------------

export interface SignInRow {
	id: string;
	at: string;
	method: string;
	success: boolean;
	reason: string | null;
	userId: string | null;
	email: string | null;
	ip: string | null;
	device: string | null;
	country: string | null;
}

export async function listSignIns(db: D1Database, limit = 100): Promise<SignInRow[]> {
	try {
		const { results } = await db
			.prepare(
				`SELECT e.id, e.created_at, e.method, e.success, e.reason, e.user_id, u.email,
				        e.ip, e.device, e.country
				 FROM sign_in_events e LEFT JOIN users u ON u.id = e.user_id
				 ORDER BY e.created_at DESC, e.rowid DESC LIMIT ?`
			)
			.bind(Math.min(Math.max(Math.trunc(limit), 1), 200))
			.all<{
				id: string;
				created_at: string;
				method: string;
				success: number;
				reason: string | null;
				user_id: string | null;
				email: string | null;
				ip: string | null;
				device: string | null;
				country: string | null;
			}>();
		return results.map((r) => ({
			id: r.id,
			at: r.created_at,
			method: r.method,
			success: r.success === 1,
			reason: r.reason,
			userId: r.user_id,
			email: r.email,
			ip: r.ip,
			device: r.device,
			country: r.country
		}));
	} catch (err) {
		console.error('[sign-ins] could not list events:', err);
		return [];
	}
}

export interface SessionRow {
	id: string;
	userId: string;
	email: string | null;
	createdAt: string | null;
	lastSeenAt: string | null;
	expiresAt: string;
}

/** Live sessions, most recently active first. `data IS NOT NULL` skips pre-opaque rows. */
export async function listSessions(db: D1Database, limit = 100): Promise<SessionRow[]> {
	try {
		const { results } = await db
			.prepare(
				`SELECT s.id, s.user_id, u.email, s.created_at, s.last_seen_at, s.expires_at
				 FROM sessions s LEFT JOIN users u ON u.id = s.user_id
				 WHERE s.data IS NOT NULL AND datetime(s.expires_at) > datetime('now')
				 ORDER BY datetime(COALESCE(s.last_seen_at, s.created_at)) DESC LIMIT ?`
			)
			.bind(Math.min(Math.max(Math.trunc(limit), 1), 200))
			.all<{
				id: string;
				user_id: string;
				email: string | null;
				created_at: string | null;
				last_seen_at: string | null;
				expires_at: string;
			}>();
		return results.map((r) => ({
			id: r.id,
			userId: r.user_id,
			email: r.email,
			createdAt: r.created_at,
			lastSeenAt: r.last_seen_at,
			expiresAt: r.expires_at
		}));
	} catch (err) {
		console.error('[sign-ins] could not list sessions:', err);
		return [];
	}
}

/** Sign one session out. Returns whether there was a session to revoke. */
export async function revokeSession(db: D1Database, sessionId: string): Promise<boolean> {
	const result = await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
	return (result.meta?.changes ?? 0) > 0;
}

/** Delete events past the retention window. Returns how many went. */
export async function pruneSignIns(
	db: D1Database,
	days: number = SIGN_IN_RETENTION_DAYS
): Promise<number> {
	const result = await db
		.prepare(
			`DELETE FROM sign_in_events WHERE created_at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now', ?)`
		)
		.bind(`-${Math.max(1, Math.trunc(days))} days`)
		.run();
	return result.meta?.changes ?? 0;
}

/** Delete all recorded history (the owner's "clear" button). */
export async function clearSignIns(db: D1Database): Promise<number> {
	const result = await db.prepare('DELETE FROM sign_in_events').run();
	await db.prepare('UPDATE sessions SET last_seen_at = NULL').run();
	return result.meta?.changes ?? 0;
}

export interface SignInSummary {
	last24h: { success: number; failure: number };
	last7d: { success: number; failure: number };
}

export async function signInSummary(db: D1Database): Promise<SignInSummary> {
	const empty = { last24h: { success: 0, failure: 0 }, last7d: { success: 0, failure: 0 } };
	try {
		const row = await db
			.prepare(
				`SELECT
				   SUM(CASE WHEN success = 1 AND created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day') THEN 1 ELSE 0 END) AS s1,
				   SUM(CASE WHEN success = 0 AND created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day') THEN 1 ELSE 0 END) AS f1,
				   SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS s7,
				   SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS f7
				 FROM sign_in_events
				 WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-7 days')`
			)
			.first<{ s1: number | null; f1: number | null; s7: number | null; f7: number | null }>();
		return {
			last24h: { success: row?.s1 ?? 0, failure: row?.f1 ?? 0 },
			last7d: { success: row?.s7 ?? 0, failure: row?.f7 ?? 0 }
		};
	} catch {
		return empty;
	}
}
