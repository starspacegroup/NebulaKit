/**
 * D1 side of Google listings: the owner's listing settings, a keyset page of
 * feed products, the "last fetched" marker, and what the Merchant API sync
 * last sent. The rules themselves are in google-listing.ts (pure).
 *
 * Read budget (docs/LESSONS_FROM_PINFOOL.md): the feed pages through
 * `idx_commerce_products_active_id` by `id > ?`, so one full pass over N
 * products reads about N rows, never rescans, and holds at most one page in
 * memory. No call here writes more than once an hour on a public request.
 */
import type { D1Database } from '@cloudflare/workers-types';
import {
	parseListingSettings,
	type GoogleListingSettings,
	validateListingSettings
} from './google-listing';
import type { Validated } from './validation';
import { getCommerceSetting, productFromRow, setCommerceSetting } from './store';
import type { Product } from './types';

type Row = Record<string, unknown>;

const LISTING_SETTINGS_KEY = 'google_listings';
const FEED_FETCH_KEY = 'google_feed_fetch';

export async function getGoogleListingSettings(db: D1Database): Promise<GoogleListingSettings> {
	return parseListingSettings(await getCommerceSetting(db, LISTING_SETTINGS_KEY));
}

export async function saveGoogleListingSettings(
	db: D1Database,
	body: unknown
): Promise<Validated<GoogleListingSettings>> {
	const checked = validateListingSettings(body);
	if (checked.ok) await setCommerceSetting(db, LISTING_SETTINGS_KEY, JSON.stringify(checked.value));
	return checked;
}

export interface FeedPageOptions {
	/** Return rows with an id after this one (keyset cursor). */
	afterId?: string;
	/** 1 to 500. */
	limit?: number;
	/** Include products the owner left out of Google. Off for the feed; on for the health panel. */
	includeExcluded?: boolean;
}

/**
 * One page of products that may be sold: active, and not under an open
 * auction (an auction's price is a bid, not an offer Google can check).
 * Ordered by id, so the cursor is the last id of the previous page.
 */
export async function listProductsForFeed(
	db: D1Database,
	options: FeedPageOptions = {}
): Promise<Product[]> {
	const limit = Math.min(Math.max(Math.trunc(options.limit ?? 250), 1), 500);
	const { results } = await db
		.prepare(
			`SELECT p.* FROM commerce_products p
			 WHERE p.active = 1 AND p.id > ?
			   ${options.includeExcluded ? '' : 'AND p.google_excluded = 0'}
			   AND NOT EXISTS (
			     SELECT 1 FROM commerce_auctions a WHERE a.product_id = p.id AND a.status = 'open')
			 ORDER BY p.id LIMIT ?`
		)
		.bind(options.afterId ?? '', limit)
		.all<Row>();
	return results.map(productFromRow);
}

/**
 * Every active product, a page at a time, never more than `max` in all (the
 * cap is the guard against an unbounded read, not a promise of completeness:
 * callers report when it was hit).
 */
export async function* eachFeedProduct(
	db: D1Database,
	options: { pageSize?: number; max?: number; includeExcluded?: boolean; afterId?: string } = {}
): AsyncGenerator<Product> {
	const pageSize = options.pageSize ?? 250;
	const max = options.max ?? 50_000;
	let afterId = options.afterId ?? '';
	let seen = 0;
	while (seen < max) {
		const page = await listProductsForFeed(db, {
			afterId,
			limit: Math.min(pageSize, max - seen),
			includeExcluded: options.includeExcluded
		});
		if (page.length === 0) return;
		for (const product of page) yield product;
		seen += page.length;
		afterId = page[page.length - 1].id;
		if (page.length < pageSize) return;
	}
}

export interface FeedFetchInfo {
	at: string;
	by: string;
}

/**
 * Remember that something fetched the feed. At most one write an hour no
 * matter how often it is fetched: the upsert's WHERE leaves a recent row
 * alone, so a crawler loop cannot spend the free plan's write budget.
 */
export async function recordFeedFetch(db: D1Database, by: string, nowIso: string): Promise<void> {
	const value = JSON.stringify({
		at: nowIso,
		by: by.replace(/[\u0000-\u001F]/g, ' ').slice(0, 80)
	});
	await db
		.prepare(
			`INSERT INTO commerce_settings (key, value) VALUES (?, ?)
			 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
			 WHERE commerce_settings.updated_at < datetime('now', '-1 hour')`
		)
		.bind(FEED_FETCH_KEY, value)
		.run();
}

export async function getFeedFetch(db: D1Database): Promise<FeedFetchInfo | null> {
	const raw = await getCommerceSetting(db, FEED_FETCH_KEY);
	if (!raw) return null;
	try {
		const v = JSON.parse(raw) as Partial<FeedFetchInfo>;
		return typeof v.at === 'string' ? { at: v.at, by: String(v.by ?? '') } : null;
	} catch {
		return null;
	}
}

// ----------------------------------------------------------------- sync state

export interface SyncRow {
	productId: string;
	offerId: string;
	contentHash: string;
}

const toSync = (r: Row): SyncRow => ({
	productId: r.product_id as string,
	offerId: r.offer_id as string,
	contentHash: r.content_hash as string
});

/** What was last sent for these products. */
export async function getSyncRows(db: D1Database, ids: string[]): Promise<Map<string, SyncRow>> {
	const out = new Map<string, SyncRow>();
	if (ids.length === 0) return out;
	const { results } = await db
		.prepare(
			`SELECT product_id, offer_id, content_hash FROM commerce_google_sync
			 WHERE product_id IN (${ids.map(() => '?').join(',')})`
		)
		.bind(...ids)
		.all<Row>();
	for (const row of results) out.set(row.product_id as string, toSync(row));
	return out;
}

export async function markSynced(
	db: D1Database,
	rows: { productId: string; offerId: string; contentHash: string }[]
): Promise<void> {
	if (rows.length === 0) return;
	await db.batch(
		rows.map((r) =>
			db
				.prepare(
					`INSERT INTO commerce_google_sync (product_id, offer_id, content_hash) VALUES (?, ?, ?)
					 ON CONFLICT(product_id) DO UPDATE SET offer_id = excluded.offer_id,
					   content_hash = excluded.content_hash, synced_at = datetime('now')`
				)
				.bind(r.productId, r.offerId, r.contentHash)
		)
	);
}

export async function unmarkSynced(db: D1Database, productIds: string[]): Promise<void> {
	if (productIds.length === 0) return;
	await db.batch(
		productIds.map((id) =>
			db.prepare('DELETE FROM commerce_google_sync WHERE product_id = ?').bind(id)
		)
	);
}

/**
 * Synced products that should no longer be on Google: gone, archived, under
 * auction, or left out of the feed. One bounded page.
 */
export async function listStaleSynced(db: D1Database, limit: number): Promise<SyncRow[]> {
	const { results } = await db
		.prepare(
			`SELECT s.product_id, s.offer_id, s.content_hash FROM commerce_google_sync s
			 LEFT JOIN commerce_products p ON p.id = s.product_id
			 WHERE p.id IS NULL OR p.active = 0 OR p.google_excluded = 1
			    OR EXISTS (SELECT 1 FROM commerce_auctions a WHERE a.product_id = p.id AND a.status = 'open')
			 LIMIT ?`
		)
		.bind(Math.min(Math.max(limit, 1), 500))
		.all<Row>();
	return results.map(toSync);
}

export async function countSynced(db: D1Database): Promise<number> {
	const row = await db.prepare('SELECT COUNT(*) AS n FROM commerce_google_sync').first<Row>();
	return Number(row?.n ?? 0);
}
