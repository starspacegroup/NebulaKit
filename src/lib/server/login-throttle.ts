/**
 * A brake on password guessing.
 *
 * `/api/auth/login` is the first unauthenticated, unmetered, CPU-heavy endpoint in
 * the app: every attempt runs 100,000 rounds of PBKDF2 (the most Workers allows). Without a brake that is both
 * a credential-stuffing target and a way to spend our CPU budget for free, so the
 * two are counted together.
 *
 * Deliberately modest. It counts failures in KV against the client IP *and* the
 * email being tried, so one attacker cannot lock out a real user by hammering their
 * address from elsewhere — the IP runs out of attempts first. KV is eventually
 * consistent, so a distributed attacker can squeeze extra tries through the window;
 * that is accepted. This raises the cost of guessing, it is not an authorisation
 * boundary, and it fails *open* when KV is unavailable rather than locking everyone
 * out of a working app.
 */

import type { KVNamespace } from '@cloudflare/workers-types';

/** Failures tolerated per identifier before the window closes. */
export const MAX_ATTEMPTS = 8;

/** How long a failing identifier stays counted, in seconds. */
export const WINDOW_SECONDS = 15 * 60;

function keyFor(scope: string, value: string): string {
	return `login_attempts:${scope}:${value.toLowerCase()}`;
}

/** The client address, as far as Cloudflare will tell us. */
export function clientAddress(request: Request): string {
	return request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || 'unknown';
}

async function count(kv: KVNamespace, key: string): Promise<number> {
	const raw = await kv.get(key);
	const parsed = Number(raw);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Whether this attempt should be refused outright. Never throws: a KV outage must
 * not take login down with it.
 */
export async function isThrottled(
	kv: KVNamespace | undefined,
	ip: string,
	email: string
): Promise<boolean> {
	if (!kv) return false;
	try {
		const [byIp, byEmail] = await Promise.all([
			count(kv, keyFor('ip', ip)),
			count(kv, keyFor('email', email))
		]);
		return byIp >= MAX_ATTEMPTS || byEmail >= MAX_ATTEMPTS;
	} catch {
		return false;
	}
}

/** Record a failed attempt against both identifiers. */
export async function recordFailure(
	kv: KVNamespace | undefined,
	ip: string,
	email: string
): Promise<void> {
	if (!kv) return;
	try {
		await Promise.all(
			[keyFor('ip', ip), keyFor('email', email)].map(async (key) => {
				const next = (await count(kv, key)) + 1;
				// The TTL is refreshed on every failure, so sustained guessing keeps the
				// window shut rather than sliding out from under itself.
				await kv.put(key, String(next), { expirationTtl: WINDOW_SECONDS });
			})
		);
	} catch {
		// Best effort. A missed count is not worth failing the request over.
	}
}

/** Forget the failures for a pair that has just authenticated successfully. */
export async function clearFailures(
	kv: KVNamespace | undefined,
	ip: string,
	email: string
): Promise<void> {
	if (!kv) return;
	try {
		await Promise.all([kv.delete(keyFor('ip', ip)), kv.delete(keyFor('email', email))]);
	} catch {
		// Same: a stale counter expires on its own.
	}
}
