import type { KVNamespace } from '@cloudflare/workers-types';
import { hashSessionToken } from '$lib/utils/db';

/**
 * The stats token (docs/ADMIN_STATS.md, "Reading the numbers from outside").
 *
 * One owner-issued bearer token per site lets an external dashboard read the
 * admin stats summary at `/api/stats/summary` — the same object `/admin`
 * renders, nothing more. It is deliberately a single token with no scopes:
 * the endpoint is read-only, exposes only aggregate counters, and a site has
 * one owner, so a key pool would be ceremony.
 *
 * Only the SHA-256 of the token is stored. The plaintext is returned exactly
 * once, from the issuing call, and cannot be read back — rotating replaces it,
 * revoking removes it. Like `analytics_config`, this is one KV key: it is
 * configuration, not a per-user row, so it needs no migration.
 */
export const STATS_TOKEN_KEY = 'stats_api_token';
export const STATS_TOKEN_PREFIX = 'nks_';
/** Random bytes behind the token: 24 bytes → 48 hex characters. */
const TOKEN_BYTES = 24;
/** How much of the token the admin page shows to tell one issue from the next. */
const VISIBLE_PREFIX_LENGTH = STATS_TOKEN_PREFIX.length + 6;

export interface StatsTokenMeta {
	/** `nks_` plus the first six characters — enough to recognise, useless to guess. */
	prefix: string;
	createdAt: string;
}

interface StoredStatsToken extends StatsTokenMeta {
	hash: string;
}

function hex(bytes: Uint8Array): string {
	let out = '';
	for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
	return out;
}

export function generateStatsToken(): string {
	return STATS_TOKEN_PREFIX + hex(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
}

/** Same digest the session store uses, so there is one hashing convention. */
export async function hashStatsToken(token: string): Promise<string> {
	return hashSessionToken(token);
}

/** Read the stored record. Fails soft like the analytics config read: a
 *  missing binding, an unreachable KV, or a malformed value means "no token". */
async function readStoredToken(
	kv: KVNamespace | undefined | null
): Promise<StoredStatsToken | null> {
	if (!kv) return null;

	let raw: string | null;
	try {
		raw = await kv.get(STATS_TOKEN_KEY);
	} catch (err) {
		console.error('Failed to read stats token from KV:', err);
		return null;
	}
	if (!raw) return null;

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}

	const candidate = parsed as Partial<StoredStatsToken> | null;
	if (
		!candidate ||
		typeof candidate.hash !== 'string' ||
		!candidate.hash ||
		typeof candidate.prefix !== 'string' ||
		typeof candidate.createdAt !== 'string'
	) {
		return null;
	}
	return { hash: candidate.hash, prefix: candidate.prefix, createdAt: candidate.createdAt };
}

/** What the admin page may know: when it was issued and how it starts. Never the hash. */
export async function readStatsTokenMeta(
	kv: KVNamespace | undefined | null
): Promise<StatsTokenMeta | null> {
	const stored = await readStoredToken(kv);
	return stored ? { prefix: stored.prefix, createdAt: stored.createdAt } : null;
}

/** Issue a fresh token, replacing any existing one. The plaintext is returned
 *  here and nowhere else. */
export async function issueStatsToken(
	kv: KVNamespace,
	now: Date = new Date()
): Promise<{ token: string; meta: StatsTokenMeta }> {
	const token = generateStatsToken();
	const meta: StatsTokenMeta = {
		prefix: token.slice(0, VISIBLE_PREFIX_LENGTH),
		createdAt: now.toISOString()
	};
	const stored: StoredStatsToken = { ...meta, hash: await hashStatsToken(token) };
	await kv.put(STATS_TOKEN_KEY, JSON.stringify(stored));
	return { token, meta };
}

export async function revokeStatsToken(kv: KVNamespace): Promise<void> {
	await kv.delete(STATS_TOKEN_KEY);
}

/** The credential out of an `Authorization: Bearer …` header, or null. */
export function bearerToken(authorization: string | null | undefined): string | null {
	if (!authorization) return null;
	const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization);
	return match ? match[1] : null;
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let mismatch = 0;
	for (let i = 0; i < a.length; i++) {
		mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return mismatch === 0;
}

export type StatsTokenVerdict = 'ok' | 'missing' | 'invalid';

/**
 * Check an Authorization header against the issued token.
 *
 * `missing` means this site has never issued one (or it was revoked) — the
 * caller can say so, because it is the fix the operator needs. `invalid`
 * covers an absent header, a malformed one, and a wrong token alike; nothing
 * in the answer says which.
 */
export async function verifyStatsToken(
	kv: KVNamespace | undefined | null,
	authorization: string | null | undefined
): Promise<StatsTokenVerdict> {
	const stored = await readStoredToken(kv);
	if (!stored) return 'missing';

	const presented = bearerToken(authorization);
	if (!presented || !presented.startsWith(STATS_TOKEN_PREFIX)) return 'invalid';

	const hash = await hashStatsToken(presented);
	return timingSafeEqual(hash, stored.hash) ? 'ok' : 'invalid';
}
