/**
 * Platform usage counters — how close we are to Cloudflare's plan limits.
 *
 * Why not reuse page-view stats: `page_view_daily` counts human page views
 * (non-bot HTML GET 200s). Cloudflare bills *every* Function invocation —
 * bots, /api/* calls, redirects, 404s, non-GET. On the free plan the account
 * shares 100,000 requests per UTC day and the site stops serving when they
 * run out, so the number that matters is the billable one.
 *
 * Why batch: a D1 write per request would roughly double our write volume and
 * eat the D1 free-tier write allowance at exactly the traffic level where we
 * can least afford it. Instead each isolate counts in memory and flushes
 * occasionally, turning N requests into ~N/FLUSH_EVERY writes.
 *
 * Accuracy: counts can be lost when an isolate is evicted holding an
 * unflushed remainder (at most FLUSH_EVERY-1 per isolate), so this is a
 * slight UNDER-count and a floor, not a billing-grade figure. Cloudflare's
 * dashboard remains the source of truth; this exists to give early warning.
 */

import type { D1Database } from '@cloudflare/workers-types';

/** Workers Free: 100,000 requests per UTC day, shared account-wide. */
export const FREE_DAILY_REQUESTS = 100_000;
/** Workers Paid: 10,000,000 requests per month included in the $5 base. */
export const PAID_MONTHLY_REQUESTS = 10_000_000;
/** Workers Paid overage, USD per additional million requests. */
export const PAID_OVERAGE_PER_MILLION = 0.3;

/** Hard cap on buffered requests before a flush is forced. */
const FLUSH_EVERY = 25;
/**
 * Minimum gap between writes from one isolate. Below this we buffer; above
 * it we write immediately.
 *
 * This is deliberately the inverse of a "batch every N" policy. Batching by
 * count alone breaks at LOW traffic — the common case here — because an
 * isolate holding 1-3 counts may never receive another request to trigger
 * the flush, and the counts die with it. Rate-limiting instead means a quiet
 * site writes on essentially every request (cheap, and accurate), while a
 * busy one is capped at ~1 write/second/isolate.
 */
const MIN_FLUSH_INTERVAL_MS = 1_000;

type Pending = { requests: number; notFound: number; bot: number };

const pending: Pending = { requests: 0, notFound: 0, bot: 0 };
let pendingDay = '';
// null, not 0: a timestamp sentinel of 0 is falsy, so `!lastFlush` would
// re-arm on every call and the time-based flush would never fire.
let lastFlush: number | null = null;

export function utcDayKey(now: Date): string {
	return now.toISOString().slice(0, 10);
}

/** Exposed for tests — resets the in-isolate accumulator. */
export function _resetUsageBuffer(): void {
	pending.requests = 0;
	pending.notFound = 0;
	pending.bot = 0;
	pendingDay = '';
	lastFlush = null;
}

function shouldFlush(now: number): boolean {
	if (pending.requests >= FLUSH_EVERY) return true;
	// First request this isolate has seen — write it out rather than risk
	// losing it if no second request ever arrives.
	if (lastFlush === null) return true;
	return now - lastFlush >= MIN_FLUSH_INTERVAL_MS;
}

async function flush(db: D1Database, day: string, batch: Pending): Promise<void> {
	await db
		.prepare(
			`INSERT INTO platform_usage_daily (day, requests, not_found, bot, updated_at)
			 VALUES (?, ?, ?, ?, datetime('now'))
			 ON CONFLICT(day) DO UPDATE SET
			   requests = requests + excluded.requests,
			   not_found = not_found + excluded.not_found,
			   bot = bot + excluded.bot,
			   updated_at = datetime('now')`
		)
		.bind(day, batch.requests, batch.notFound, batch.bot)
		.run();
}

/**
 * Record one Function invocation. Returns a promise to hand to `waitUntil`
 * when a flush is due, or null when the request was only buffered — so the
 * caller never blocks on the counter.
 */
export function recordRequest(
	db: D1Database,
	opts: { day: string; notFound: boolean; bot: boolean; now?: number }
): Promise<void> | null {
	const now = opts.now ?? Date.now();

	// A day rollover must not fold today's counts into yesterday's row: flush
	// what we have under the old key first, then start the new day clean.
	if (pendingDay && pendingDay !== opts.day && pending.requests > 0) {
		const carry = { ...pending };
		const carryDay = pendingDay;
		_resetUsageBuffer();
		pendingDay = opts.day;
		lastFlush = now;
		pending.requests = 1;
		pending.notFound = opts.notFound ? 1 : 0;
		pending.bot = opts.bot ? 1 : 0;
		return flush(db, carryDay, carry);
	}

	pendingDay = opts.day;
	pending.requests += 1;
	if (opts.notFound) pending.notFound += 1;
	if (opts.bot) pending.bot += 1;

	if (!shouldFlush(now)) return null;

	const batch = { ...pending };
	const day = pendingDay;
	pending.requests = 0;
	pending.notFound = 0;
	pending.bot = 0;
	lastFlush = now;
	return flush(db, day, batch);
}

export interface UsageWindow {
	today: number;
	todayBot: number;
	todayNotFound: number;
	monthToDate: number;
	/** Highest single day in the trailing window — how big a spike we've seen. */
	peakDay: number;
	peakDayOn: string | null;
	days: Array<{ day: string; requests: number }>;
}

/** Read the counters for the admin dashboard. */
export async function getUsage(db: D1Database, now: Date): Promise<UsageWindow> {
	const day = utcDayKey(now);
	const monthPrefix = day.slice(0, 7);
	const since = new Date(now.getTime() - 29 * 86_400_000).toISOString().slice(0, 10);

	const rows = await db
		.prepare(
			`SELECT day, requests, not_found, bot FROM platform_usage_daily
			 WHERE day >= ? ORDER BY day ASC`
		)
		.bind(since)
		.all<{ day: string; requests: number; not_found: number; bot: number }>();

	const list = rows.results ?? [];
	const todayRow = list.find((r) => r.day === day);
	let peakDay = 0;
	let peakDayOn: string | null = null;
	let monthToDate = 0;
	for (const r of list) {
		if (r.day.startsWith(monthPrefix)) monthToDate += r.requests;
		if (r.requests > peakDay) {
			peakDay = r.requests;
			peakDayOn = r.day;
		}
	}

	return {
		today: todayRow?.requests ?? 0,
		todayBot: todayRow?.bot ?? 0,
		todayNotFound: todayRow?.not_found ?? 0,
		monthToDate,
		peakDay,
		peakDayOn,
		days: list.map((r) => ({ day: r.day, requests: r.requests }))
	};
}

/**
 * Turn raw counts into what an operator actually needs to decide something:
 * how much of today's free allowance is gone, and — if we keep going at this
 * rate — whether we run out before the UTC reset.
 */
export function projectUsage(usage: UsageWindow, now: Date) {
	const msIntoDay = now.getTime() - Date.parse(`${utcDayKey(now)}T00:00:00Z`);
	const fractionOfDay = Math.max(msIntoDay / 86_400_000, 0.0001);
	const projectedToday = Math.round(usage.today / fractionOfDay);
	const percentUsed = (usage.today / FREE_DAILY_REQUESTS) * 100;

	// Hours until the free allowance is gone at the current rate.
	const ratePerHour = usage.today / (fractionOfDay * 24);
	const remaining = Math.max(FREE_DAILY_REQUESTS - usage.today, 0);
	const hoursToLimit = ratePerHour > 0 ? remaining / ratePerHour : Infinity;
	const hoursToReset = (86_400_000 - msIntoDay) / 3_600_000;

	const overageMillions = Math.max(usage.monthToDate - PAID_MONTHLY_REQUESTS, 0) / 1_000_000;

	return {
		percentUsed,
		projectedToday,
		hoursToLimit,
		hoursToReset,
		/** True when today is on track to exhaust the free plan before reset. */
		willExhaustToday: hoursToLimit < hoursToReset,
		estimatedPaidOverageUsd: overageMillions * PAID_OVERAGE_PER_MILLION,
		monthPercentOfPaidAllowance: (usage.monthToDate / PAID_MONTHLY_REQUESTS) * 100
	};
}
