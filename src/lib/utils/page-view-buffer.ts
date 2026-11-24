/**
 * Buffered page-view counters (docs/FREE_TIER_GUARD_RAILS.md).
 *
 * `recordPageView` costs one D1 batch of 9-10 upserts per page view (class, day, hour, referrer, country,
 * four audience dimensions, optionally a content item). On the Workers free plan D1 allows 100,000
 * rows written a day, so a busy day or a crawler burst could spend most of it on counters alone.
 *
 * This module adds the same counters in memory and writes each distinct counter once per flush with
 * `views = views + N`. Same rule as `usage.ts`: a quiet isolate writes on (almost) every view, a busy
 * one is capped at about one batch per `MIN_FLUSH_INTERVAL_MS`, so low traffic stays accurate and
 * high traffic is cheap. Counts can be lost only when an isolate is evicted holding an unflushed
 * remainder, which makes these figures a slight under-count, as the usage counter already is.
 *
 * The invariant (property-tested in tests/unit/page-view-buffer.test.ts): for any sequence of views
 * and any flush schedule, the increments written equal the views recorded, per counter.
 */

import type { D1Database } from '@cloudflare/workers-types';
import { normalizeCountry, type PageViewRecord, type ViewDimension } from '$lib/utils/page-views';

/** Smallest gap between writes from one isolate, once it has written. */
export const MIN_FLUSH_INTERVAL_MS = 5_000;
/** Force a flush once this many views are waiting, whatever the clock says. */
export const FLUSH_AT_VIEWS = 50;
/** D1 batches are chunked so a large drain never trips a statement-count limit. */
const BATCH_SIZE = 50;

type Counter = {
	table:
		| 'page_view_daily'
		| 'page_view_hourly'
		| 'referrer_daily'
		| 'country_view_daily'
		| 'content_view_daily'
		| 'view_dimension_daily'
		| 'traffic_class_daily';
	/** Key columns after `day`, in table order, as bound values. */
	key: Array<string | number>;
	day: string;
	views: number;
	signedIn: number;
};

const buffer = new Map<string, Counter>();
let pendingViews = 0;
let lastFlush: number | null = null;

/** Tests only. */
export function _resetPageViewBuffer(): void {
	buffer.clear();
	pendingViews = 0;
	lastFlush = null;
}

function bump(
	table: Counter['table'],
	day: string,
	key: Array<string | number>,
	signedIn: number
): void {
	const id = `${table}\u0000${day}\u0000${key.join('\u0000')}`;
	const hit = buffer.get(id);
	if (hit) {
		hit.views += 1;
		hit.signedIn += signedIn;
	} else {
		buffer.set(id, { table, key, day, views: 1, signedIn });
	}
}

/** Add one view to the buffer. Pure bookkeeping: no database, no clock. */
export function addPageView(view: PageViewRecord): void {
	const klass = view.trafficClass ?? 'human';
	bump('traffic_class_daily', view.day, [klass], 0);
	pendingViews += 1;
	// Bots and likely bots are counted by class only: the charts and breakdowns are of real visitors.
	if (klass !== 'human') return;
	const s = view.signedIn ? 1 : 0;
	bump('page_view_daily', view.day, [view.pathKey], s);
	bump('page_view_hourly', view.day, [view.hour], s);
	bump('referrer_daily', view.day, [view.referrerHost ?? '(direct)'], 0);
	bump('country_view_daily', view.day, [normalizeCountry(view.country)], 0);
	if (view.contentId) bump('content_view_daily', view.day, [view.contentId], 0);
	const dimensions: Array<[ViewDimension, string | undefined]> = [
		['os', view.os],
		['browser', view.browser],
		['device', view.device],
		['language', view.language]
	];
	for (const [dimension, value] of dimensions) {
		bump('view_dimension_daily', view.day, [dimension, value || '(unknown)'], 0);
	}
}

const SQL: Record<Counter['table'], string> = {
	page_view_daily: `INSERT INTO page_view_daily (day, path_key, views, signed_in)
		VALUES (?, ?, ?, ?)
		ON CONFLICT (day, path_key)
		DO UPDATE SET views = views + excluded.views, signed_in = signed_in + excluded.signed_in`,
	page_view_hourly: `INSERT INTO page_view_hourly (day, hour, views, signed_in)
		VALUES (?, ?, ?, ?)
		ON CONFLICT (day, hour)
		DO UPDATE SET views = views + excluded.views, signed_in = signed_in + excluded.signed_in`,
	referrer_daily: `INSERT INTO referrer_daily (day, referrer_host, views)
		VALUES (?, ?, ?)
		ON CONFLICT (day, referrer_host) DO UPDATE SET views = views + excluded.views`,
	country_view_daily: `INSERT INTO country_view_daily (day, country, views)
		VALUES (?, ?, ?)
		ON CONFLICT (day, country) DO UPDATE SET views = views + excluded.views`,
	content_view_daily: `INSERT INTO content_view_daily (day, content_id, views)
		VALUES (?, ?, ?)
		ON CONFLICT (day, content_id) DO UPDATE SET views = views + excluded.views`,
	view_dimension_daily: `INSERT INTO view_dimension_daily (day, dimension, value, views)
		VALUES (?, ?, ?, ?)
		ON CONFLICT (day, dimension, value) DO UPDATE SET views = views + excluded.views`,
	traffic_class_daily: `INSERT INTO traffic_class_daily (day, class, views)
		VALUES (?, ?, ?)
		ON CONFLICT (day, class) DO UPDATE SET views = views + excluded.views`
};

function takeAll(): Counter[] {
	const out = [...buffer.values()];
	buffer.clear();
	pendingViews = 0;
	return out;
}

/** Write everything waiting. Exposed for tests and for a scheduled sweep. */
export async function flushPageViews(db: D1Database, now = Date.now()): Promise<void> {
	const counters = takeAll();
	lastFlush = now;
	if (counters.length === 0) return;
	const statements = counters.map((c) => {
		const binds: Array<string | number> = [c.day, ...c.key, c.views];
		if (c.table === 'page_view_daily' || c.table === 'page_view_hourly') binds.push(c.signedIn);
		return db.prepare(SQL[c.table]).bind(...binds);
	});
	for (let i = 0; i < statements.length; i += BATCH_SIZE) {
		await db.batch(statements.slice(i, i + BATCH_SIZE));
	}
}

function flushDue(now: number): boolean {
	if (pendingViews >= FLUSH_AT_VIEWS) return true;
	if (lastFlush === null) return true; // first view this isolate has seen: write it out
	return now - lastFlush >= MIN_FLUSH_INTERVAL_MS;
}

/**
 * Count one page view. Returns a promise to hand to `waitUntil` when a flush is due, or null when
 * the view was only buffered, so the caller never waits on a counter.
 */
export function recordPageViewBuffered(
	db: D1Database,
	view: PageViewRecord,
	now = Date.now()
): Promise<void> | null {
	addPageView(view);
	return flushDue(now) ? flushPageViews(db, now) : null;
}
