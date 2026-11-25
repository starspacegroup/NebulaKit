import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import fc from 'fast-check';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import {
	createProduct,
	eachFeedProduct,
	getFeedFetch,
	getGoogleListingSettings,
	listProductsForFeed,
	recordFeedFetch,
	saveGoogleListingSettings,
	type GoogleAttributes,
	type ProductInput
} from '@nebulakit/commerce';
import { auditCatalog, feedStream, listingContext } from '../../src/lib/server/google-feed';
import { handleFeedRequest, type FeedCache } from '../../src/lib/server/google-feed-http';
import { GET as getRss } from '../../src/routes/feeds/google-products.xml/+server';
import { GET as getTsv } from '../../src/routes/feeds/google-products.tsv/+server';
import { site } from '../../src/lib/site.config';
import { createSqliteD1 } from '../helpers/sqlite-d1';

const MIGRATIONS = [
	'0016_commerce.sql',
	'0022_commerce_settings.sql',
	'0026_commerce_auctions.sql',
	'0027_commerce_auction_deadlines.sql',
	'0037_google_listings.sql'
];
const NOW = Date.parse('2026-11-25T12:00:00Z');
let db: D1Database;

beforeEach(() => {
	db = createSqliteD1(MIGRATIONS);
});

async function add(
	slug: string,
	patch: Partial<ProductInput> = {},
	google: Partial<GoogleAttributes> = {}
) {
	return createProduct(db, {
		slug,
		name: `Product ${slug}`,
		description: `About ${slug}.`,
		priceCents: 1299,
		imageUrl: 'https://cdn.example.com/a.jpg',
		google: { brand: 'Acme', gtin: '036000291452', ...google },
		...patch
	});
}

async function read(stream: ReadableStream<Uint8Array>): Promise<string> {
	return new Response(stream).text();
}

async function feed(format: 'rss' | 'tsv', pageSize?: number) {
	const ctx = await listingContext(db, {}, NOW);
	return read(feedStream(format, db, ctx, { pageSize }));
}

describe('feed contents', () => {
	it('matches the specification fixture: every required attribute present, in a stable shape', async () => {
		await saveGoogleListingSettings(db, {
			shipCountries: ['US'],
			handlingDaysMin: 0,
			handlingDaysMax: 1,
			transitDaysMin: 2,
			transitDaysMax: 5
		});
		const p = await add('mug', { imageUrl: '/media/mug.jpg' }, { color: 'Blue', weightGrams: 350 });
		const xml = (await feed('rss')).replaceAll(p.id, 'ID');
		const fixture = readFileSync(resolve(__dirname, '../fixtures/google-feed-mug.xml'), 'utf-8')
			.replaceAll('{SITE}', site.url)
			.replaceAll('{NAME}', site.name)
			.replaceAll('{DESCRIPTION}', site.description);
		expect(xml).toBe(fixture);
	});

	it('every item carries the attributes Google requires', async () => {
		await add('a');
		await add('b', { currency: 'eur' });
		const xml = await feed('rss');
		const items = xml.split('<item>').slice(1);
		expect(items).toHaveLength(2);
		for (const item of items) {
			for (const attr of [
				'id',
				'title',
				'description',
				'link',
				'image_link',
				'availability',
				'price',
				'brand',
				'gtin',
				'condition'
			]) {
				expect(item, attr).toMatch(new RegExp(`<g:${attr}>[^<]+</g:${attr}>`));
			}
			expect(item).toMatch(/<g:price>\d+\.\d{2} [A-Z]{3}<\/g:price>/);
			expect(item).toContain(`<g:link>${site.url}/shop/`);
		}
		expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
		expect(xml).toContain('<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">');
	});

	it('lists active products only, never auctions, never excluded or invalid ones', async () => {
		await add('live');
		await add('archived', { active: false });
		await add('left-out', {}, { excluded: true });
		await add('no-image', { imageUrl: null });
		const auctioned = await add('auctioned');
		await db
			.prepare(
				`INSERT INTO commerce_auctions (id, slug, product_id, title, starting_cents, starts_at, ends_at)
				 VALUES ('a1', 'a1', ?, 't', 100, '2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z')`
			)
			.bind(auctioned.id)
			.run();
		const xml = await feed('rss');
		expect(xml).toContain('/shop/live<');
		for (const slug of ['archived', 'left-out', 'no-image', 'auctioned'])
			expect(xml).not.toContain(`/shop/${slug}<`);
		expect(xml).toContain('<!-- items: 1, left out: 1 -->');
	});

	it('lists a product again once its auction has ended', async () => {
		const p = await add('was-auction');
		await db
			.prepare(
				`INSERT INTO commerce_auctions (id, slug, product_id, title, starting_cents, starts_at, ends_at, status)
				 VALUES ('a1', 'a1', ?, 't', 100, '2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z', 'unsold')`
			)
			.bind(p.id)
			.run();
		expect(await feed('rss')).toContain('/shop/was-auction<');
	});

	it('produces a TSV with a header and one row per product', async () => {
		await add('a');
		await add('b');
		const lines = (await feed('tsv')).replace(/\n$/, '').split('\n');
		expect(lines).toHaveLength(3);
		const width = lines[0].split('\t').length;
		for (const line of lines) expect(line.split('\t')).toHaveLength(width);
		expect(lines[0].startsWith('id\ttitle\tdescription\tlink\timage_link')).toBe(true);
	});

	it('states availability from the owner setting, defaulting to in stock', async () => {
		await add('def');
		await add('out', {}, { availability: 'out_of_stock' });
		await add('pre', {}, { availability: 'preorder', availabilityDate: '2026-12-20' });
		const xml = await feed('rss');
		expect(xml).toContain('<g:availability>in_stock</g:availability>');
		expect(xml).toContain('<g:availability>out_of_stock</g:availability>');
		expect(xml).toContain('<g:availability>preorder</g:availability>');
		expect(xml).toContain('<g:availability_date>2026-12-20</g:availability_date>');
	});

	it('uses the shop shipping charge and the settings for shipping', async () => {
		await saveGoogleListingSettings(db, { shipCountries: ['US', 'CA'] });
		await add('x');
		const ctx = await listingContext(db, { COMMERCE_FLAT_SHIPPING_CENTS: '799' }, NOW);
		const xml = await read(feedStream('rss', db, ctx));
		expect(xml.match(/<g:shipping>/g)).toHaveLength(2);
		expect(xml).toContain('<g:price>7.99 USD</g:price>');
	});
});

describe('hostile text', () => {
	const hostile = [
		'</item></channel></rss><script>alert(1)</script>',
		']]> <![CDATA[ x ]]>',
		'<g:price>0.01 USD</g:price>',
		'a\u0000b\u0007c\u001fd',
		'tab\there\nnewline\r\nwindows',
		'emoji \u{1F600}\u{1F468}‍\u{1F469} ‮evil‬ שלום',
		'lone \uD800 surrogate',
		'"quotes" & \'apostrophes\' &amp; &#x3C;',
		'</script><script>alert(1)</script>',
		'{"@type":"Product"} \u2028 \u2029'
	];

	it.each(hostile)('cannot break the XML or the TSV: %j', async (text) => {
		await add(
			'h',
			{ name: text, description: text },
			{ brand: text.slice(0, 60) || 'x', color: text }
		);
		// a name with markup is refused outright; only plain hostile text is listed
		const rss = await feed('rss');
		const tsv = await feed('tsv');
		if (rss.includes('<item>')) {
			const doc = new DOMParser().parseFromString(rss, 'application/xml');
			expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
			expect(doc.getElementsByTagName('item')).toHaveLength(1);
			expect(rss).not.toContain('<script');
			expect(rss).not.toContain('<![CDATA[');
		}
		const rows = tsv.replace(/\n$/, '').split('\n');
		expect(rows.length).toBeLessThanOrEqual(2);
		for (const row of rows) expect(row.split('\t')).toHaveLength(rows[0].split('\t').length);
	});

	it('property: any name, description and color keeps the feed well-formed', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.string({ unit: 'binary', minLength: 1, maxLength: 80 }),
				fc.string({ unit: 'binary', minLength: 1, maxLength: 200 }),
				async (name, description) => {
					const local = createSqliteD1(MIGRATIONS);
					await createProduct(local, {
						slug: 'p',
						name,
						description,
						priceCents: 100,
						imageUrl: 'https://cdn.example.com/a.jpg',
						google: { brand: 'B', gtin: '036000291452', color: name.slice(0, 40) }
					});
					const ctx = await listingContext(local, {}, NOW);
					const rss = await read(feedStream('rss', local, ctx));
					const doc = new DOMParser().parseFromString(rss, 'application/xml');
					return (
						doc.getElementsByTagName('parsererror').length === 0 &&
						doc.getElementsByTagName('item').length <= 1
					);
				}
			),
			{ numRuns: 60 }
		);
	});
});

describe('large catalogs', () => {
	it('pages through every product exactly once, in id order', async () => {
		for (let i = 0; i < 23; i++) await add(`p${String(i).padStart(2, '0')}`);
		const seen: string[] = [];
		for await (const p of eachFeedProduct(db, { pageSize: 5 })) seen.push(p.id);
		expect(seen).toHaveLength(23);
		expect(new Set(seen).size).toBe(23);
		expect(seen).toEqual([...seen].sort());
		const xml = await feed('rss', 4);
		expect(xml.match(/<item>/g)).toHaveLength(23);
	});

	it('stops at the cap rather than reading without bound', async () => {
		for (let i = 0; i < 12; i++) await add(`c${i}`);
		const seen: string[] = [];
		for await (const p of eachFeedProduct(db, { pageSize: 5, max: 7 })) seen.push(p.id);
		expect(seen).toHaveLength(7);
		const page = await listProductsForFeed(db, { limit: 9999 });
		expect(page.length).toBeLessThanOrEqual(500);
	});

	it('reads the catalog through the (active, id) index, never a full sort', async () => {
		const plan = createSqliteD1(MIGRATIONS);
		const rows = await plan
			.prepare(
				`EXPLAIN QUERY PLAN SELECT p.* FROM commerce_products p
				 WHERE p.active = 1 AND p.id > ? AND p.google_excluded = 0 ORDER BY p.id LIMIT ?`
			)
			.bind('', 10)
			.all<{ detail: string }>();
		const detail = rows.results.map((r) => r.detail).join(' | ');
		expect(detail).toMatch(/idx_commerce_products_active_id/);
		expect(detail).not.toMatch(/TEMP B-TREE/);
	});

	it('aborts the response instead of delivering a short feed when a read fails', async () => {
		await add('a');
		const failing = {
			prepare: () => ({
				bind: () => ({ all: () => Promise.reject(new Error('D1 down')) })
			})
		} as unknown as D1Database;
		const ctx = await listingContext(db, {}, NOW);
		await expect(read(feedStream('rss', failing, ctx))).rejects.toThrow('D1 down');
	});
});

describe('audit', () => {
	it('counts what Google would take and lists the first problems, errors first', async () => {
		await add('ok');
		await add('warn', {}, { gtin: null, mpn: null });
		await add('no-image', { imageUrl: null });
		await add('bad-price', { priceCents: 0 });
		const ctx = await listingContext(db, {}, NOW);
		const audit = await auditCatalog(db, ctx, {}, { maxProblems: 3 });
		expect(audit).toMatchObject({
			checked: 4,
			valid: 2,
			invalid: 2,
			withWarnings: 2,
			capped: false
		});
		expect(audit.problems).toHaveLength(3);
		expect(audit.problems[0].severity).toBe('error');
		expect(audit.problems.every((p) => p.slug && p.productId && p.name)).toBe(true);
	});

	it('reports a catalog larger than the cap as capped', async () => {
		for (let i = 0; i < 6; i++) await add(`q${i}`);
		const ctx = await listingContext(db, {}, NOW);
		expect(await auditCatalog(db, ctx, {}, { max: 4 })).toMatchObject({ checked: 4, capped: true });
	});

	it('flags a tax setup Google would reject', async () => {
		await saveGoogleListingSettings(db, { shipCountries: ['US'] });
		const ctx = await listingContext(db, {}, NOW);
		const audit = await auditCatalog(
			db,
			ctx,
			{ COMMERCE_TAX_RATE_PERCENT: '8', COMMERCE_PRICES_INCLUDE_TAX: 'true' },
			{}
		);
		expect(audit.site.map((p) => p.severity)).toContain('error');
	});
});

describe('settings and the fetch marker', () => {
	it('round-trips settings and refuses bad ones without saving', async () => {
		expect(await saveGoogleListingSettings(db, { shipCountries: ['us'] })).toMatchObject({
			ok: false
		});
		expect((await getGoogleListingSettings(db)).shipCountries).toEqual([]);
		await saveGoogleListingSettings(db, { shipCountries: ['US'], defaultBrand: 'House' });
		expect(await getGoogleListingSettings(db)).toMatchObject({
			shipCountries: ['US'],
			defaultBrand: 'House'
		});
	});

	it('records a fetch at most once an hour', async () => {
		await recordFeedFetch(db, 'Googlebot', '2026-11-25T12:00:00.000Z');
		await recordFeedFetch(db, 'Other', '2026-11-25T12:30:00.000Z');
		expect(await getFeedFetch(db)).toEqual({ at: '2026-11-25T12:00:00.000Z', by: 'Googlebot' });
		await db
			.prepare(
				"UPDATE commerce_settings SET updated_at = datetime('now', '-2 hours') WHERE key = 'google_feed_fetch'"
			)
			.run();
		await recordFeedFetch(db, 'Later\u0000\nbot', '2026-11-25T14:00:00.000Z');
		expect(await getFeedFetch(db)).toEqual({ at: '2026-11-25T14:00:00.000Z', by: 'Later  bot' });
	});

	it('reads a corrupt marker as never fetched', async () => {
		await db
			.prepare("INSERT INTO commerce_settings (key, value) VALUES ('google_feed_fetch', '{oops')")
			.run();
		expect(await getFeedFetch(db)).toBeNull();
	});
});

function fakeCache(): FeedCache & { store: Map<string, Response>; puts: number } {
	const store = new Map<string, Response>();
	return {
		store,
		puts: 0,
		async match(req) {
			return store.get(req.url)?.clone();
		},
		async put(req, res) {
			this.puts++;
			store.set(req.url, new Response(await res.text(), { headers: res.headers }));
		}
	};
}

function event(path: string, platform: Partial<App.Platform> | undefined, method = 'GET') {
	const url = new URL(`https://localhost${path}`);
	return {
		request: new Request(url, { method, headers: { 'user-agent': 'Googlebot-Test' } }),
		url,
		platform: platform as App.Platform
	};
}

describe('HTTP', () => {
	it('answers 503 without a database', async () => {
		expect(
			(await handleFeedRequest(event('/feeds/google-products.xml', { env: {} } as never), 'rss'))
				.status
		).toBe(503);
	});

	it('serves the feed with feed headers, and is noindex', async () => {
		await add('a');
		const res = await handleFeedRequest(
			event('/feeds/google-products.xml', { env: { DB: db } } as never),
			'rss',
			{ cache: null }
		);
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toBe('application/xml; charset=utf-8');
		expect(res.headers.get('cache-control')).toBe('public, max-age=900');
		expect(res.headers.get('x-robots-tag')).toBe('noindex');
		expect(await res.text()).toContain('<item>');
		const tsv = await handleFeedRequest(
			event('/feeds/google-products.tsv', { env: { DB: db } } as never),
			'tsv',
			{ cache: null }
		);
		expect(tsv.headers.get('content-type')).toBe('text/tab-separated-values; charset=utf-8');
	});

	it('serves from the cache without touching D1, and never fans out on the query string', async () => {
		await add('a');
		const cache = fakeCache();
		const waits: Promise<unknown>[] = [];
		const platform = {
			env: { DB: db },
			context: { waitUntil: (p: Promise<unknown>) => waits.push(p) }
		} as never;
		const first = await handleFeedRequest(
			event('/feeds/google-products.xml?x=1', platform),
			'rss',
			{ cache }
		);
		const body = await first.text();
		await Promise.all(waits);
		expect(cache.puts).toBe(1);

		const spy = vi.spyOn(db, 'prepare');
		const second = await handleFeedRequest(
			event('/feeds/google-products.xml?x=2', platform),
			'rss',
			{ cache }
		);
		expect(await second.text()).toBe(body);
		// only the throttled "last fetched" write reaches D1; no product read
		const sql = spy.mock.calls.map((c) => String(c[0]));
		expect(sql.some((s) => /FROM commerce_products/.test(s))).toBe(false);
		expect(cache.puts).toBe(1);
	});

	it('does not cache a HEAD response and does not write to KV', async () => {
		await add('a');
		const cache = fakeCache();
		const kv = { put: vi.fn(), get: vi.fn() };
		const res = await handleFeedRequest(
			event('/feeds/google-products.xml', { env: { DB: db, KV: kv } } as never, 'HEAD'),
			'rss',
			{ cache }
		);
		await res.arrayBuffer();
		expect(cache.puts).toBe(0);
		expect(kv.put).not.toHaveBeenCalled();
	});

	it('records the fetch, with the caller, in the settings table', async () => {
		await add('a');
		const waits: Promise<unknown>[] = [];
		const platform = {
			env: { DB: db },
			context: { waitUntil: (p: Promise<unknown>) => waits.push(p) }
		} as never;
		await (
			await handleFeedRequest(event('/feeds/google-products.xml', platform), 'rss', { cache: null })
		).text();
		await Promise.all(waits);
		expect((await getFeedFetch(db))?.by).toBe('Googlebot-Test');
	});

	it('a failure while recording the fetch never fails the feed', async () => {
		await add('a');
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		const real = db.prepare.bind(db);
		vi.spyOn(db, 'prepare').mockImplementation(((sql: string) => {
			if (/INTO commerce_settings/.test(sql)) throw new Error('write budget');
			return real(sql);
		}) as never);
		const res = await handleFeedRequest(
			event('/feeds/google-products.xml', { env: { DB: db } } as never),
			'rss',
			{ cache: null }
		);
		expect(res.status).toBe(200);
		await res.text();
		err.mockRestore();
	});

	it('the two routes are wired to the handler', async () => {
		await add('a');
		const platform = { env: { DB: db } } as never;
		const rss = await getRss(event('/feeds/google-products.xml', platform) as never);
		expect(rss.headers.get('content-type')).toContain('xml');
		const tsv = await getTsv(event('/feeds/google-products.tsv', platform) as never);
		expect(tsv.headers.get('content-type')).toContain('tab-separated');
	});
});
