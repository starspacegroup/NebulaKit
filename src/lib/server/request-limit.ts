import type { D1Database } from '@cloudflare/workers-types';

/**
 * A limit on how often one client address may do something costly. Ported from PinFool
 * (src/lib/server/request-limit.ts, migration 0039 there, 0036 here).
 *
 * Fixed windows, counted in D1 (KV allows only 1,000 writes a day on the free plan, so it cannot hold
 * counters). One statement per check: it adds the hit and returns the new count, so two requests at
 * the same moment cannot both read "one left". The address is stored only as a SHA-256.
 *
 * This is a guard on cost, not an authorisation boundary: if the table cannot be reached the request
 * is allowed, because a broken counter must never stop a real customer from paying.
 */
export interface RequestLimit {
	/** Names what is being limited; part of the row's key. */
	scope: string;
	/** Most hits allowed in one window. */
	max: number;
	windowSeconds: number;
}

/** Placing an order: 10 in ten minutes and 40 in a day from one address. */
export const CHECKOUT_LIMITS: RequestLimit[] = [
	{ scope: 'checkout:10m', max: 10, windowSeconds: 600 },
	{ scope: 'checkout:day', max: 40, windowSeconds: 86_400 }
];

/**
 * Backing out of an order (each closes a live Stripe payment): 20 in ten minutes from one address.
 * The order id is the key, so this only stops a script cycling through ids it somehow holds.
 */
export const CANCEL_LIMITS: RequestLimit[] = [
	{ scope: 'checkout-cancel:10m', max: 20, windowSeconds: 600 }
];

/** The start (unix seconds) of the fixed window that `nowMs` falls in. */
export function windowStart(nowMs: number, windowSeconds: number): number {
	const seconds = Math.floor(nowMs / 1000);
	return seconds - (seconds % windowSeconds);
}

/** Whether a window that has now been hit `hits` times is still within its limit. */
export function withinLimit(hits: number, max: number): boolean {
	return hits <= max;
}

async function sha256(text: string): Promise<string> {
	const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface LimitResult {
	allowed: boolean;
	/** Seconds until the window that refused it ends (0 when allowed). */
	retryAfter: number;
}

/**
 * Count one hit against every limit given, and say whether all of them still allow it. Every limit is
 * counted even when an earlier one refuses, so a refused client cannot keep the longer window empty.
 */
export async function hitLimits(
	db: D1Database,
	limits: readonly RequestLimit[],
	address: string,
	nowMs = Date.now()
): Promise<LimitResult> {
	try {
		const who = await sha256(address);
		let retryAfter = 0;
		for (const limit of limits) {
			const start = windowStart(nowMs, limit.windowSeconds);
			const row = await db
				.prepare(
					`INSERT INTO request_limits (scope, who, window_start, hits) VALUES (?, ?, ?, 1)
					 ON CONFLICT (scope, who, window_start) DO UPDATE SET hits = hits + 1
					 RETURNING hits`
				)
				.bind(limit.scope, who, start)
				.first<{ hits: number }>();
			if (!withinLimit(Number(row?.hits ?? 1), limit.max)) {
				retryAfter = Math.max(retryAfter, start + limit.windowSeconds - Math.floor(nowMs / 1000));
			}
		}
		return { allowed: retryAfter === 0, retryAfter };
	} catch (err) {
		console.error('request limit unavailable, allowing the request:', err);
		return { allowed: true, retryAfter: 0 };
	}
}

/** Most old rows removed in one go: never an unbounded DELETE. */
const PRUNE_BATCH = 200;

/** Delete windows that ended more than two days ago. Safe to call often; never throws. */
export async function pruneLimits(db: D1Database, nowMs = Date.now()): Promise<void> {
	try {
		await db
			.prepare(
				`DELETE FROM request_limits WHERE (scope, who, window_start) IN (
					 SELECT scope, who, window_start FROM request_limits WHERE window_start < ? LIMIT ?
				 )`
			)
			.bind(Math.floor(nowMs / 1000) - 2 * 86_400, PRUNE_BATCH)
			.run();
	} catch {
		// old rows are only clutter
	}
}
