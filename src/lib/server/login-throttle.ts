/**
 * A brake on password guessing.
 *
 * `/api/auth/login` is the first unauthenticated, unmetered, CPU-heavy endpoint in
 * the app: every attempt runs 100,000 rounds of PBKDF2 (the most Workers allows). Without a brake that is both
 * a credential-stuffing target and a way to spend our CPU budget for free, so the
 * two are counted together.
 *
 * Two counters in KV, with two different limits:
 *
 * - per client IP, `MAX_ATTEMPTS` (8) failures, any email. The window is refreshed on
 *   every failure, and a success does NOT clear it, so one address gets at most 8
 *   wrong guesses per window no matter how it interleaves logins to its own account.
 * - per email, `EMAIL_MAX_ATTEMPTS` (64) failures, any IP, in a FIXED window that
 *   starts at the first failure (the expiry is stored with the count and not moved).
 *   This is the brake on a distributed guesser aimed at one account.
 *
 * The email limit is 8 × the IP limit on purpose. Before 2026-11-04 both were 8, and
 * one attacker could lock any user out from anywhere by sending 8 wrong passwords for
 * their email (Lean counterexample `cx_lockout_from_other_ip`, NebulaKit/proofs).
 * Now one address can add at most 8 to an email's count per window, so locking out
 * an owner takes 8 addresses working together inside 15 minutes; the Lean model
 * proves a single address cannot (`single_ip_cannot_lock_out`). A success clears the
 * email counter, so the owner getting in resets the account's brake.
 *
 * KV is eventually consistent, so a distributed attacker can squeeze extra tries
 * through the window; that is accepted. This raises the cost of guessing, it is not
 * an authorisation boundary, and it fails *open* when KV is unavailable rather than
 * locking everyone out of a working app.
 */

import type { KVNamespace } from '@cloudflare/workers-types';

/** Failures tolerated per client address before its window closes. */
export const MAX_ATTEMPTS = 8;

/** Failures tolerated per email, from all addresses together, per fixed window. */
export const EMAIL_MAX_ATTEMPTS = 64;

/** How long a failing identifier stays counted, in seconds. */
export const WINDOW_SECONDS = 15 * 60;

function keyFor(scope: string, value: string): string {
	return `login_attempts:${scope}:${value.toLowerCase()}`;
}

/** The client address, as far as Cloudflare will tell us. */
export function clientAddress(request: Request): string {
	return request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || 'unknown';
}

/** `count` or `count:expiresAtEpochSeconds`. A bare count (older format) has no fixed expiry. */
function parse(raw: string | null): { count: number; expiresAt: number | null } {
	const [c, e] = (raw ?? '').split(':');
	const count = Number(c);
	const expiresAt = Number(e);
	return {
		count: Number.isInteger(count) && count > 0 ? count : 0,
		expiresAt: Number.isInteger(expiresAt) && expiresAt > 0 ? expiresAt : null
	};
}

async function read(kv: KVNamespace, key: string) {
	return parse(await kv.get(key));
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

/**
 * Whether this attempt should be refused outright. Never throws: a KV outage must
 * not take login down with it.
 */
export async function isThrottled(
	kv: KVNamespace | undefined,
	ip: string,
	email: string,
	now: number = nowSeconds()
): Promise<boolean> {
	if (!kv) return false;
	try {
		const [byIp, byEmail] = await Promise.all([
			read(kv, keyFor('ip', ip)),
			read(kv, keyFor('email', email))
		]);
		const emailCount = byEmail.expiresAt !== null && byEmail.expiresAt <= now ? 0 : byEmail.count;
		return byIp.count >= MAX_ATTEMPTS || emailCount >= EMAIL_MAX_ATTEMPTS;
	} catch {
		return false;
	}
}

/** Record a failed attempt against both identifiers. */
export async function recordFailure(
	kv: KVNamespace | undefined,
	ip: string,
	email: string,
	now: number = nowSeconds()
): Promise<void> {
	if (!kv) return;
	try {
		await Promise.all([
			(async () => {
				// The IP window is refreshed on every failure, so sustained guessing from
				// one address keeps it shut rather than sliding out from under itself.
				const key = keyFor('ip', ip);
				const next = (await read(kv, key)).count + 1;
				await kv.put(key, String(next), { expirationTtl: WINDOW_SECONDS });
			})(),
			(async () => {
				// The email window is fixed at the first failure. A refreshed one would let
				// a single slow address (8 per IP window) pile up to the email limit.
				const key = keyFor('email', email);
				const cur = await read(kv, key);
				const live = cur.expiresAt !== null && cur.expiresAt > now;
				const expiresAt = live ? (cur.expiresAt as number) : now + WINDOW_SECONDS;
				const next = (live ? cur.count : 0) + 1;
				// KV refuses an absolute expiry under 60 s away; keep the floor.
				await kv.put(key, `${next}:${expiresAt}`, { expiration: Math.max(expiresAt, now + 60) });
			})()
		]);
	} catch {
		// Best effort. A missed count is not worth failing the request over.
	}
}

/**
 * The account has just authenticated: forget its email counter. The address counter
 * is NOT cleared, so an attacker cannot reset its own budget by logging in to an
 * account it controls between guesses.
 */
export async function clearFailures(
	kv: KVNamespace | undefined,
	_ip: string,
	email: string
): Promise<void> {
	if (!kv) return;
	try {
		await kv.delete(keyFor('email', email));
	} catch {
		// Same: a stale counter expires on its own.
	}
}
