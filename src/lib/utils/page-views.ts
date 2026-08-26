/**
 * First-party page-view analytics (docs/ADMIN_STATS.md): daily AGGREGATE
 * counters written by the `pageViewsHandler` hook and read by /admin/stats.
 *
 * No raw request rows, no cookies, no identifiers, no IP addresses. Everything
 * below either bumps a `(day, …)` counter or maps a request header to a small
 * closed vocabulary — the raw User-Agent is read transiently and never stored,
 * because a full UA string is quasi-identifying while a value from a fixed list
 * is not.
 *
 * The bucketing functions are pure so they can be unit-tested without a browser
 * or a database.
 */

import type { D1Database } from '@cloudflare/workers-types';

export interface PageViewRecord {
	day: string; // 'YYYY-MM-DD' (UTC)
	hour: number; // 0-23 (UTC) — backs the hourly "1 day" traffic window
	pathKey: string; // SvelteKit route id
	signedIn: boolean;
	/** CMS item this view was of, when the route was a content item. Set by the
	 *  content route into `locals.viewedContentId`, so attributing a view costs
	 *  no second lookup. */
	contentId?: string;
	referrerHost?: string;
	country?: string; // ISO 3166-1 alpha-2 from the edge; never derived from IP by us
	os?: string;
	browser?: string;
	device?: string;
	language?: string;
}

export interface DailyViews {
	day: string;
	views: number;
	signedIn: number;
}

export interface HourlyViews {
	/** 'YYYY-MM-DDTHH' (UTC) — sortable, and what fillHourlySeries keys on. */
	hourKey: string;
	views: number;
	signedIn: number;
}

export interface PathViews {
	pathKey: string;
	views: number;
	signedIn: number;
}

export interface ReferrerViews {
	referrerHost: string;
	views: number;
}

export interface CountryViews {
	country: string;
	views: number;
}

export interface ContentViews {
	contentId: string;
	views: number;
	/** Null when the item has been deleted since the views were counted. */
	title: string | null;
	/** Public path, or null when the item or its type is gone. */
	path: string | null;
}

export type ViewDimension = 'os' | 'browser' | 'device' | 'language' | 'viewport';

export interface DimensionViews {
	value: string;
	views: number;
}

/** Cloudflare's country values are ISO alpha-2 plus specials like 'T1' (Tor)
 *  and 'XX' (unknown). Anything else (absent in dev, malformed) collapses to
 *  '(unknown)' so cardinality stays bounded and totals still match. */
export function normalizeCountry(country: string | null | undefined): string {
	if (typeof country === 'string' && /^[A-Z0-9]{2}$/.test(country)) return country;
	return '(unknown)';
}

/* ── Audience-dimension bucketing ────────────────────────────────────────
   Everything below maps request headers to a SMALL fixed vocabulary. The raw
   User-Agent / client-hint strings are read transiently and never stored — only
   the bucket lands in D1. */

/** Viewport buckets mirror common CSS breakpoints (CSS px). */
export const VIEWPORT_BUCKETS = ['under-640', '640-1023', '1024-1535', '1536-plus'] as const;

export function viewportBucketFromWidth(width: number): string | null {
	if (!Number.isFinite(width) || width <= 0 || width > 20000) return null;
	if (width < 640) return 'under-640';
	if (width < 1024) return '640-1023';
	if (width < 1536) return '1024-1535';
	return '1536-plus';
}

/** OS bucket from Sec-CH-UA-Platform (Chromium, sent by default, quoted like
 *  `"Windows"`) with a coarse UA fallback for Firefox/Safari. */
export function osBucket(platformHint: string | null, ua: string | null): string {
	const hint = (platformHint ?? '').replace(/"/g, '').trim();
	if (hint) {
		const known = ['Windows', 'macOS', 'Android', 'iOS', 'Linux', 'Chrome OS', 'Chromium OS'];
		const match = known.find((k) => k.toLowerCase() === hint.toLowerCase());
		if (match) return match === 'Chromium OS' ? 'Chrome OS' : match;
		return '(other)';
	}
	const agent = ua ?? '';
	if (/iPhone|iPad|iPod/.test(agent)) return 'iOS';
	if (/Android/.test(agent)) return 'Android';
	if (/Windows NT/.test(agent)) return 'Windows';
	if (/CrOS/.test(agent)) return 'Chrome OS';
	if (/Mac OS X/.test(agent)) return 'macOS';
	if (/Linux/.test(agent)) return 'Linux';
	return '(unknown)';
}

/** Browser bucket from Sec-CH-UA brands (preferring the real brand over
 *  "Chromium"/"Not.A/Brand") with a coarse UA fallback. */
export function browserBucket(uaHint: string | null, ua: string | null): string {
	const hint = uaHint ?? '';
	if (hint) {
		const brands = [...hint.matchAll(/"([^"]+)";v=/g)].map((m) => m[1]);
		const named = ['Google Chrome', 'Microsoft Edge', 'Opera', 'Brave', 'Samsung Internet'];
		for (const brand of brands) {
			const match = named.find((n) => n.toLowerCase() === brand.toLowerCase());
			if (match) return match === 'Google Chrome' ? 'Chrome' : match;
		}
		if (brands.some((b) => /Chromium/i.test(b))) return 'Chromium';
	}
	const agent = ua ?? '';
	if (/Edg(e|A|iOS)?\//.test(agent)) return 'Microsoft Edge';
	if (/OPR\/|Opera/.test(agent)) return 'Opera';
	if (/SamsungBrowser\//.test(agent)) return 'Samsung Internet';
	if (/Firefox\/|FxiOS\//.test(agent)) return 'Firefox';
	if (/CriOS\//.test(agent)) return 'Chrome';
	if (/Chrome\//.test(agent)) return 'Chrome';
	if (/Safari\//.test(agent)) return 'Safari';
	return '(unknown)';
}

/** Device class from Sec-CH-UA-Mobile ('?1'/'?0') with a UA fallback. */
export function deviceBucket(mobileHint: string | null, ua: string | null): string {
	const agent = ua ?? '';
	if (/iPad|Tablet/i.test(agent)) return 'tablet';
	if (mobileHint === '?1') return 'mobile';
	if (mobileHint === '?0') return 'desktop';
	if (/Mobi/.test(agent)) return 'mobile';
	if (agent) return 'desktop';
	return '(unknown)';
}

/** First Accept-Language tag, normalized to `xx` / `xx-XX`. */
export function languageBucket(acceptLanguage: string | null): string {
	const first = (acceptLanguage ?? '').split(',')[0]?.split(';')[0]?.trim() ?? '';
	const m = first.match(/^([a-zA-Z]{2,3})(?:-([a-zA-Z0-9]{2,8}))?$/);
	if (!m) return '(unknown)';
	const primary = m[1].toLowerCase();
	return m[2] ? `${primary}-${m[2].toUpperCase()}` : primary;
}

/** UTC calendar day for a timestamp. */
export function utcDay(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/** UTC hour-of-day (0-23) for a timestamp. */
export function utcHour(date: Date): number {
	return date.getUTCHours();
}

/** 'YYYY-MM-DDTHH' key for a timestamp — the hourly-series equivalent of {@link utcDay}. */
export function utcHourKey(date: Date): string {
	return `${utcDay(date)}T${String(utcHour(date)).padStart(2, '0')}`;
}

/** Extract a bare host from a Referer header value; null for same-site,
 *  unparseable, or absent referrers. */
export function referrerHostFrom(referrer: string | null, ownHost: string): string | null {
	if (!referrer) return null;
	try {
		const host = new URL(referrer).hostname.toLowerCase();
		if (!host || host === ownHost.toLowerCase()) return null;
		return host;
	} catch {
		return null;
	}
}

/** Record one page view as a batch of counter upserts. Fire-and-forget from the
 *  hook (via waitUntil); throws only to its caller's catch. */
export async function recordPageView(db: D1Database, view: PageViewRecord): Promise<void> {
	const statements = [
		db
			.prepare(
				`INSERT INTO page_view_daily (day, path_key, views, signed_in)
				 VALUES (?, ?, 1, ?)
				 ON CONFLICT (day, path_key)
				 DO UPDATE SET views = views + 1, signed_in = signed_in + excluded.signed_in`
			)
			.bind(view.day, view.pathKey, view.signedIn ? 1 : 0),
		// Totals-only hourly counter (no path breakdown) — 24 rows a day, enough
		// to render the "1 day" window as real hours instead of two day bars.
		db
			.prepare(
				`INSERT INTO page_view_hourly (day, hour, views, signed_in)
				 VALUES (?, ?, 1, ?)
				 ON CONFLICT (day, hour)
				 DO UPDATE SET views = views + 1, signed_in = signed_in + excluded.signed_in`
			)
			.bind(view.day, view.hour, view.signedIn ? 1 : 0),
		db
			.prepare(
				`INSERT INTO referrer_daily (day, referrer_host, views)
				 VALUES (?, ?, 1)
				 ON CONFLICT (day, referrer_host) DO UPDATE SET views = views + 1`
			)
			.bind(view.day, view.referrerHost ?? '(direct)'),
		db
			.prepare(
				`INSERT INTO country_view_daily (day, country, views)
				 VALUES (?, ?, 1)
				 ON CONFLICT (day, country) DO UPDATE SET views = views + 1`
			)
			.bind(view.day, normalizeCountry(view.country))
	];

	// Only content-item routes carry an id, so a site with no CMS content never
	// writes a row here — the one unbounded table stays empty until it is earning
	// its keep.
	if (view.contentId) {
		statements.push(
			db
				.prepare(
					`INSERT INTO content_view_daily (day, content_id, views)
					 VALUES (?, ?, 1)
					 ON CONFLICT (day, content_id) DO UPDATE SET views = views + 1`
				)
				.bind(view.day, view.contentId)
		);
	}

	const dimensions: Array<[ViewDimension, string | undefined]> = [
		['os', view.os],
		['browser', view.browser],
		['device', view.device],
		['language', view.language]
	];
	for (const [dimension, value] of dimensions) {
		statements.push(
			db
				.prepare(
					`INSERT INTO view_dimension_daily (day, dimension, value, views)
					 VALUES (?, ?, ?, 1)
					 ON CONFLICT (day, dimension, value) DO UPDATE SET views = views + 1`
				)
				.bind(view.day, dimension, value || '(unknown)')
		);
	}

	await db.batch(statements);
}

export async function listDailyViews(db: D1Database, sinceDay: string): Promise<DailyViews[]> {
	const result = await db
		.prepare(
			`SELECT day, SUM(views) AS views, SUM(signed_in) AS signed_in
			 FROM page_view_daily WHERE day >= ? GROUP BY day ORDER BY day`
		)
		.bind(sinceDay)
		.all<{ day: string; views: number; signed_in: number }>();
	return (result.results ?? []).map((r) => ({
		day: r.day,
		views: r.views,
		signedIn: r.signed_in
	}));
}

/** Hourly counters at or after `sinceHourKey` ('YYYY-MM-DDTHH', UTC). The day
 *  prefix is compared first so the scan stays on the primary key. */
export async function listHourlyViews(
	db: D1Database,
	sinceHourKey: string
): Promise<HourlyViews[]> {
	const sinceDay = sinceHourKey.slice(0, 10);
	const result = await db
		.prepare(
			`SELECT day, hour, views, signed_in
			 FROM page_view_hourly
			 WHERE day >= ? AND (day || 'T' || substr('0' || hour, -2)) >= ?
			 ORDER BY day, hour`
		)
		.bind(sinceDay, sinceHourKey)
		.all<{ day: string; hour: number; views: number; signed_in: number }>();
	return (result.results ?? []).map((r) => ({
		hourKey: `${r.day}T${String(r.hour).padStart(2, '0')}`,
		views: r.views,
		signedIn: r.signed_in
	}));
}

export async function listViewsByPath(
	db: D1Database,
	sinceDay: string,
	limit = 50
): Promise<PathViews[]> {
	const result = await db
		.prepare(
			`SELECT path_key, SUM(views) AS views, SUM(signed_in) AS signed_in
			 FROM page_view_daily WHERE day >= ?
			 GROUP BY path_key ORDER BY views DESC LIMIT ?`
		)
		.bind(sinceDay, limit)
		.all<{ path_key: string; views: number; signed_in: number }>();
	return (result.results ?? []).map((r) => ({
		pathKey: r.path_key,
		views: r.views,
		signedIn: r.signed_in
	}));
}

export async function listReferrers(
	db: D1Database,
	sinceDay: string,
	limit = 50
): Promise<ReferrerViews[]> {
	const result = await db
		.prepare(
			`SELECT referrer_host, SUM(views) AS views
			 FROM referrer_daily WHERE day >= ?
			 GROUP BY referrer_host ORDER BY views DESC LIMIT ?`
		)
		.bind(sinceDay, limit)
		.all<{ referrer_host: string; views: number }>();
	return (result.results ?? []).map((r) => ({ referrerHost: r.referrer_host, views: r.views }));
}

export async function listCountries(
	db: D1Database,
	sinceDay: string,
	limit = 50
): Promise<CountryViews[]> {
	const result = await db
		.prepare(
			`SELECT country, SUM(views) AS views
			 FROM country_view_daily WHERE day >= ?
			 GROUP BY country ORDER BY views DESC LIMIT ?`
		)
		.bind(sinceDay, limit)
		.all<{ country: string; views: number }>();
	return (result.results ?? []).map((r) => ({ country: r.country, views: r.views }));
}

/**
 * Most-viewed CMS items in the window.
 *
 * LEFT JOIN, not INNER: an item deleted since the views were counted still has
 * a row here until the retention cron catches up, and dropping it would quietly
 * understate the period's traffic. Those rows come back with a null title and
 * path, and the UI shows the id.
 */
export async function listTopContent(
	db: D1Database,
	sinceDay: string,
	limit = 20
): Promise<ContentViews[]> {
	const result = await db
		.prepare(
			`SELECT v.content_id, SUM(v.views) AS views, i.title, i.slug, t.slug AS type_slug
			 FROM content_view_daily v
			 LEFT JOIN content_items i ON i.id = v.content_id
			 LEFT JOIN content_types t ON t.id = i.content_type_id
			 WHERE v.day >= ?
			 GROUP BY v.content_id ORDER BY views DESC LIMIT ?`
		)
		.bind(sinceDay, limit)
		.all<{
			content_id: string;
			views: number;
			title: string | null;
			slug: string | null;
			type_slug: string | null;
		}>();
	return (result.results ?? []).map((r) => ({
		contentId: r.content_id,
		views: r.views,
		title: r.title?.trim() || null,
		path: r.type_slug && r.slug ? `/${r.type_slug}/${r.slug}` : null
	}));
}

export async function listDimension(
	db: D1Database,
	dimension: ViewDimension,
	sinceDay: string,
	limit = 20
): Promise<DimensionViews[]> {
	const result = await db
		.prepare(
			`SELECT value, SUM(views) AS views
			 FROM view_dimension_daily WHERE dimension = ? AND day >= ?
			 GROUP BY value ORDER BY views DESC LIMIT ?`
		)
		.bind(dimension, sinceDay, limit)
		.all<{ value: string; views: number }>();
	return (result.results ?? []).map((r) => ({ value: r.value, views: r.views }));
}

/** One beacon-reported viewport sample (bucket pre-validated by the caller). */
export async function recordViewportSample(
	db: D1Database,
	day: string,
	bucket: string
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO view_dimension_daily (day, dimension, value, views)
			 VALUES (?, 'viewport', ?, 1)
			 ON CONFLICT (day, dimension, value) DO UPDATE SET views = views + 1`
		)
		.bind(day, bucket)
		.run();
}

/**
 * Delete counter rows older than the retention window (cron-driven).
 *
 * Covers every daily counter table, including `platform_usage_daily` — that one
 * is only a row a day, but nothing else deletes it, so leaving it out meant it
 * grew for the life of the deployment.
 */
export async function pruneViewStats(db: D1Database, beforeDay: string): Promise<void> {
	await db.batch([
		db.prepare('DELETE FROM page_view_daily WHERE day < ?').bind(beforeDay),
		db.prepare('DELETE FROM page_view_hourly WHERE day < ?').bind(beforeDay),
		db.prepare('DELETE FROM referrer_daily WHERE day < ?').bind(beforeDay),
		db.prepare('DELETE FROM country_view_daily WHERE day < ?').bind(beforeDay),
		db.prepare('DELETE FROM view_dimension_daily WHERE day < ?').bind(beforeDay),
		db.prepare('DELETE FROM platform_usage_daily WHERE day < ?').bind(beforeDay),
		db.prepare('DELETE FROM content_view_daily WHERE day < ?').bind(beforeDay)
	]);
}
