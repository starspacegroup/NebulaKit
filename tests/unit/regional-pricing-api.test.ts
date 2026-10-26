import '../helpers/server-response';
import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import {
	createOrder,
	createProduct,
	getCommerceSetting,
	getOrder,
	getRegionalPricingSettings,
	listOrders,
	priceCart,
	saveRegionalPricingSettings,
	setCommerceSetting,
	type Product
} from '@nebulakit/commerce';
import { createApiKey, type ApiScope } from '@nebulakit/security';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import { requestCountry } from '../../src/lib/server/checkout-pricing';
import * as checkout from '../../src/routes/api/v1/checkout/+server';
import * as quote from '../../src/routes/api/v1/checkout/quote/+server';
import * as pricing from '../../src/routes/api/v1/pricing/+server';
import * as preview from '../../src/routes/api/v1/pricing/preview/+server';
import * as orderRoute from '../../src/routes/api/v1/orders/[id]/+server';
import * as openapi from '../../src/routes/api/v1/openapi.json/+server';

type Handler = (event: never) => Promise<Response>;

let db: D1Database;
let env: Record<string, unknown>;
let ebook: Product;
let tee: Product;

beforeEach(async () => {
	db = createSqliteD1();
	env = { DB: db };
	ebook = await createProduct(db, {
		slug: 'ebook',
		name: 'E-book',
		priceCents: 2000,
		type: 'digital'
	});
	tee = await createProduct(db, { slug: 'tee', name: 'Tee', priceCents: 3000, type: 'physical' });
});

interface Options {
	method?: string;
	path?: string;
	params?: Record<string, string>;
	body?: unknown;
	key?: string;
	/** Cloudflare's view of the request (`request.cf.country`). */
	cf?: string;
	/** The `cf-ipcountry` header. */
	header?: string;
	user?: App.Locals['user'];
}

async function call(handler: unknown, options: Options = {}) {
	const url = new URL(options.path ?? '/api/v1/x', 'https://shop.test');
	const headers: Record<string, string> = {};
	if (options.key) headers.authorization = `Bearer ${options.key}`;
	if (options.header) headers['cf-ipcountry'] = options.header;
	let body: string | undefined;
	if (options.body !== undefined) {
		body = JSON.stringify(options.body);
		headers['content-type'] = 'application/json';
	}
	const request = new Request(url, { method: options.method ?? 'GET', headers, body });
	const event = {
		request,
		url,
		params: options.params ?? {},
		locals: { user: options.user },
		platform: { env, ...(options.cf ? { cf: { country: options.cf } } : {}) }
	};
	const response = await (handler as Handler)(event as never);
	const text = await response.text();
	return { status: response.status, json: text ? JSON.parse(text) : null };
}

async function key(...scopes: ApiScope[]) {
	return (await createApiKey(db, { name: 'test', scopes })).key;
}

const address = (country: string) => ({
	name: 'Ada',
	line1: '1 Main',
	city: 'Somewhere',
	postalCode: '12345',
	country
});
const order = (lines: { productId: string; quantity: number }[], extra = {}) => ({
	method: 'POST',
	body: { email: 'ada@example.com', lines, ...extra }
});
const digitalLines = () => [{ productId: ebook.id, quantity: 1 }];
const mixedLines = () => [
	{ productId: ebook.id, quantity: 1 },
	{ productId: tee.id, quantity: 1 }
];

async function turnOn(patch: Record<string, unknown> = {}) {
	await saveRegionalPricingSettings(db, {
		enabled: true,
		strength: 1,
		maxDiscount: 0.5,
		scope: 'digital',
		overrides: {},
		...patch
	} as never);
}

describe('migration 0022', () => {
	it('adds the settings and audit tables and touches nothing else', async () => {
		const tables = await db
			.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'commerce_%'")
			.all<{ name: string }>();
		expect(tables.results.map((t) => t.name).sort()).toEqual([
			'commerce_order_items',
			'commerce_order_regional',
			'commerce_orders',
			'commerce_products',
			'commerce_settings'
		]);
		const columns = await db.prepare('PRAGMA table_info(commerce_orders)').all<{ name: string }>();
		expect(columns.results.map((c) => c.name)).not.toContain('multiplier');
	});
});

describe('settings storage', () => {
	it('reads as OFF when never saved, corrupt, or hand-damaged', async () => {
		expect(await getRegionalPricingSettings(db)).toMatchObject({ enabled: false });
		await setCommerceSetting(db, 'regional_pricing', '{not json');
		expect(await getRegionalPricingSettings(db)).toMatchObject({ enabled: false });
		await setCommerceSetting(db, 'regional_pricing', '{"enabled":true,"strength":9}');
		expect(await getRegionalPricingSettings(db)).toMatchObject({ enabled: true, strength: 1 });
	});
	it('upserts', async () => {
		await setCommerceSetting(db, 'k', 'a');
		await setCommerceSetting(db, 'k', 'b');
		expect(await getCommerceSetting(db, 'k')).toBe('b');
		expect(await getCommerceSetting(db, 'missing')).toBeNull();
		const saved = await saveRegionalPricingSettings(db, {
			enabled: true,
			strength: 7,
			maxDiscount: 0.4,
			scope: 'all',
			overrides: { in: 0.6 }
		});
		expect(saved).toEqual({
			enabled: true,
			strength: 1,
			maxDiscount: 0.4,
			scope: 'all',
			overrides: { IN: 0.6 }
		});
		expect(await getRegionalPricingSettings(db)).toEqual(saved);
	});
});

describe('where the country comes from', () => {
	const req = (headers: Record<string, string> = {}) => new Request('https://x.test', { headers });
	it('prefers Cloudflare cf.country, then the cf-ipcountry header, and drops non-countries', () => {
		expect(requestCountry({ request: req(), platform: { cf: { country: 'in' as never } } })).toBe(
			'IN'
		);
		expect(requestCountry({ request: req({ 'cf-ipcountry': 'br' }) })).toBe('BR');
		expect(
			requestCountry({
				request: req({ 'cf-ipcountry': 'BR' }),
				platform: { cf: { country: 'IN' } }
			})
		).toBe('IN');
		expect(requestCountry({ request: req({ 'cf-ipcountry': 'XX' }) })).toBeNull();
		expect(requestCountry({ request: req({ 'cf-ipcountry': 'T1' }) })).toBeNull();
		expect(requestCountry({ request: req() })).toBeNull();
	});
});

describe('checkout with regional pricing OFF (the default)', () => {
	it('is identical to today and writes no audit row', async () => {
		const res = await call(checkout.POST, { ...order(digitalLines()), cf: 'IN' });
		expect(res.status).toBe(201);
		expect(res.json.order).toMatchObject({ subtotalCents: 2000, totalCents: 2000, regional: null });
		const rows = await db.prepare('SELECT * FROM commerce_order_regional').all();
		expect(rows.results).toEqual([]);
		const q = await call(quote.POST, { method: 'POST', body: { lines: digitalLines() }, cf: 'IN' });
		expect(q.json.quote).toMatchObject({
			subtotalCents: 2000,
			baseSubtotalCents: 2000,
			totalCents: 2000,
			regional: null
		});
	});
});

describe('checkout with regional pricing ON', () => {
	beforeEach(() => turnOn());

	it('charges the lowered price from the request country and records the audit', async () => {
		const res = await call(checkout.POST, { ...order(digitalLines()), cf: 'IN' });
		expect(res.status).toBe(201);
		const total = res.json.order.totalCents;
		expect(total).toBeLessThan(2000);
		expect(total).toBeGreaterThanOrEqual(1000); // the 50% cap
		expect(res.json.order.regional).toEqual({
			multiplier: total / 2000,
			countries: { request: 'IN' },
			baseSubtotalCents: 2000
		});
		// The audit row and the stored lines agree with what was charged.
		const stored = (await getOrder(db, res.json.order.id))!;
		expect(stored.totalCents).toBe(total);
		expect(stored.items[0]).toMatchObject({ unitPriceCents: total, lineTotalCents: total });
		expect(stored.regional).toEqual(res.json.order.regional);
		expect(stored.regional!.multiplier * stored.regional!.baseSubtotalCents).toBeCloseTo(total, 5);
	});

	it('takes the least generous of the request and shipping countries', async () => {
		const vpn = await call(checkout.POST, {
			...order(mixedLines(), { shippingAddress: address('US') }),
			cf: 'IN'
		});
		expect(vpn.json.order.totalCents).toBe(5000); // US shipping address: no discount at all
		expect(vpn.json.order.regional.countries).toEqual({ request: 'IN', shipping: 'US' });

		const reversed = await call(checkout.POST, {
			...order(digitalLines(), { shippingAddress: address('IN') }),
			cf: 'US'
		});
		expect(reversed.json.order.totalCents).toBe(2000);

		const both = await call(checkout.POST, {
			...order(digitalLines(), { shippingAddress: address('IN') }),
			cf: 'IN'
		});
		expect(both.json.order.totalCents).toBeLessThan(2000);
	});

	it('gives no discount when the request country is unknown or anonymised', async () => {
		for (const options of [{}, { header: 'XX' }, { header: 'T1' }]) {
			const res = await call(checkout.POST, { ...order(digitalLines()), ...options });
			expect(res.json.order.totalCents).toBe(2000);
			expect(res.json.order.regional).toMatchObject({
				multiplier: 1,
				countries: { request: null }
			});
		}
	});

	it('cannot be fooled by a request body that names a price or a country', async () => {
		const res = await call(checkout.POST, {
			method: 'POST',
			body: {
				email: 'ada@example.com',
				lines: [{ productId: ebook.id, quantity: 1, priceCents: 1 }],
				regionalMultiplier: 0.1,
				country: 'IN',
				multiplier: 0.1
			},
			cf: 'US'
		});
		expect(res.json.order.totalCents).toBe(2000);
	});

	it('lowers digital lines only under the digital scope, everything under all', async () => {
		const digitalScope = await call(checkout.POST, {
			...order(mixedLines(), { shippingAddress: address('IN') }),
			cf: 'IN'
		});
		const tee$ = digitalScope.json.order;
		expect(tee$.subtotalCents).toBeLessThan(5000);
		expect(tee$.subtotalCents).toBeGreaterThan(3000); // the tee kept its price
		await turnOn({ scope: 'all' });
		const everything = await call(checkout.POST, {
			...order(mixedLines(), { shippingAddress: address('IN') }),
			cf: 'IN'
		});
		expect(everything.json.order.subtotalCents).toBeLessThan(tee$.subtotalCents);
	});

	it('adds shipping and tax on top of the lowered subtotal, not the base', async () => {
		env.COMMERCE_TAX_RATE_PERCENT = '10';
		env.COMMERCE_FLAT_SHIPPING_CENTS = '500';
		const res = await call(checkout.POST, {
			...order(mixedLines(), { shippingAddress: address('IN') }),
			cf: 'IN'
		});
		const o = res.json.order;
		expect(o.shippingCents).toBe(500);
		expect(o.taxCents).toBe(Math.round(o.subtotalCents * 0.1));
		expect(o.totalCents).toBe(o.subtotalCents + 500 + o.taxCents);
	});

	it('never charges less than the floor per unit', async () => {
		const cheap = await createProduct(db, {
			slug: 'cheap',
			name: 'Cheap',
			priceCents: 100,
			type: 'digital'
		});
		await turnOn({ maxDiscount: 0.9 });
		const res = await call(checkout.POST, {
			...order([{ productId: cheap.id, quantity: 1 }]),
			cf: 'IN'
		});
		expect(res.json.order.totalCents).toBe(50);
	});

	it('honors an override and a full-price pin', async () => {
		await turnOn({ overrides: { IN: 0.8, DE: 0.9, CH: 1 } });
		const total = async (cf: string) =>
			(await call(checkout.POST, { ...order(digitalLines()), cf })).json.order.totalCents;
		expect(await total('IN')).toBe(1600);
		expect(await total('DE')).toBe(1800);
		expect(await total('CH')).toBe(2000);
	});

	it('reports the audit on the order read API', async () => {
		const res = await call(checkout.POST, { ...order(digitalLines()), cf: 'IN' });
		const reader = await key('orders:read');
		const read = await call(orderRoute.GET, { key: reader, params: { id: res.json.order.id } });
		expect(read.json.order.regional).toMatchObject({
			countries: { request: 'IN' },
			baseSubtotalCents: 2000
		});
		const listed = (await listOrders(db))[0];
		expect(listed.regional).toBeNull(); // lists carry totals, not audit
	});

	it('removes the audit row with its order', async () => {
		const res = await call(checkout.POST, { ...order(digitalLines()), cf: 'IN' });
		await db.prepare('DELETE FROM commerce_orders WHERE id = ?').bind(res.json.order.id).run();
		expect((await db.prepare('SELECT * FROM commerce_order_regional').all()).results).toEqual([]);
	});

	it('still refuses a physical cart without a shipping address', async () => {
		const res = await call(checkout.POST, { ...order(mixedLines()), cf: 'IN' });
		expect(res.status).toBe(422);
	});

	it('tolerates an unreadable audit blob', async () => {
		const res = await call(checkout.POST, { ...order(digitalLines()), cf: 'IN' });
		await db
			.prepare('UPDATE commerce_order_regional SET countries = ? WHERE order_id = ?')
			.bind('{broken', res.json.order.id)
			.run();
		expect((await getOrder(db, res.json.order.id))!.regional!.countries).toEqual({});
		await db
			.prepare('UPDATE commerce_order_regional SET countries = ? WHERE order_id = ?')
			.bind('[1]', res.json.order.id)
			.run();
		expect((await getOrder(db, res.json.order.id))!.regional!.countries).toEqual({});
	});
});

describe('quote', () => {
	it('returns exactly what checkout would charge, with the honest breakdown', async () => {
		await turnOn();
		env.COMMERCE_TAX_RATE_PERCENT = '10';
		const q = await call(quote.POST, {
			method: 'POST',
			body: { lines: digitalLines(), shippingCountry: 'IN' },
			cf: 'IN'
		});
		expect(q.status).toBe(200);
		const placed = await call(checkout.POST, {
			...order(digitalLines(), { shippingAddress: address('IN') }),
			cf: 'IN'
		});
		expect(q.json.quote.totalCents).toBe(placed.json.order.totalCents);
		expect(q.json.quote).toMatchObject({
			baseSubtotalCents: 2000,
			lines: [{ productId: ebook.id, baseUnitPriceCents: 2000 }],
			regional: { countries: { request: 'IN', shipping: 'IN' } }
		});
		expect(q.json.quote.regional.discountPercent).toBeGreaterThan(0);
		expect(q.json.quote.regional.notice).toMatch(/lower for your region/);
	});

	it('says nothing about a discount when none applies', async () => {
		await turnOn();
		const q = await call(quote.POST, { method: 'POST', body: { lines: digitalLines() }, cf: 'US' });
		expect(q.json.quote.regional).toMatchObject({
			multiplier: 1,
			discountPercent: 0,
			notice: null
		});
	});

	it('is public, validates, and creates no order', async () => {
		expect((await call(quote.POST, { method: 'POST', body: { lines: [] } })).status).toBe(422);
		expect(
			(
				await call(quote.POST, {
					method: 'POST',
					body: { lines: [{ productId: 'nope', quantity: 1 }] }
				})
			).status
		).toBe(400);
		await call(quote.POST, { method: 'POST', body: { lines: digitalLines() } });
		expect(await listOrders(db)).toEqual([]);
	});
});

describe('pricing settings API: scope enforcement', () => {
	it('needs authentication, then the right scope, for read and write', async () => {
		expect((await call(pricing.GET)).status).toBe(401);
		expect((await call(pricing.PUT, { method: 'PUT', body: {} })).status).toBe(401);

		const productsOnly = await key('products:read', 'products:write', 'site:read');
		expect((await call(pricing.GET, { key: productsOnly })).status).toBe(403);
		expect((await call(preview.GET, { key: productsOnly })).status).toBe(403);

		const reader = await key('pricing:read');
		expect((await call(pricing.GET, { key: reader })).status).toBe(200);
		const denied = await call(pricing.PUT, { key: reader, method: 'PUT', body: { enabled: true } });
		expect(denied).toEqual({
			status: 403,
			json: { error: 'This key lacks the pricing:write scope' }
		});
		expect((await getRegionalPricingSettings(db)).enabled).toBe(false);

		const writer = await key('pricing:write');
		expect(
			(await call(pricing.PUT, { key: writer, method: 'PUT', body: { enabled: true } })).status
		).toBe(200);
		// write does not imply read
		expect((await call(pricing.GET, { key: writer })).status).toBe(403);

		const admin = await key('site:admin');
		expect((await call(pricing.GET, { key: admin })).status).toBe(200);
	});

	it('lets owners and admins through by session, and refuses members and anonymous', async () => {
		const owner = { id: 'o', login: 'owner', email: 'o@x', isOwner: true };
		const admin = { id: 'a', login: 'admin', email: 'a@x', isOwner: false, isAdmin: true };
		const member = { id: 'm', login: 'member', email: 'm@x', isOwner: false };
		for (const user of [owner, admin]) {
			expect((await call(pricing.GET, { user })).status).toBe(200);
			expect(
				(await call(pricing.PUT, { user, method: 'PUT', body: { strength: 0.4 } })).status
			).toBe(200);
		}
		expect((await call(pricing.GET, { user: member })).status).toBe(401);
		// A session write must be JSON: the CSRF guard.
		const form = await (async () => {
			const url = new URL('/api/v1/pricing', 'https://shop.test');
			const request = new Request(url, {
				method: 'PUT',
				headers: { 'content-type': 'text/plain' },
				body: '{"enabled":true}'
			});
			const response = await (pricing.PUT as unknown as Handler)({
				request,
				url,
				params: {},
				locals: { user: owner },
				platform: { env }
			} as never);
			return response.status;
		})();
		expect(form).toBe(415);
	});

	it('reads, merges partial updates, and refuses bad values without saving them', async () => {
		const writer = await key('pricing:read', 'pricing:write');
		const initial = await call(pricing.GET, { key: writer });
		expect(initial.json.settings).toEqual({
			enabled: false,
			strength: 0.5,
			maxDiscount: 0.5,
			scope: 'digital',
			overrides: {}
		});
		expect(initial.json.priceLevelIndexUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);

		const put = await call(pricing.PUT, {
			key: writer,
			method: 'PUT',
			body: { enabled: true, overrides: { IN: 0.7 } }
		});
		expect(put.json.settings).toMatchObject({
			enabled: true,
			strength: 0.5,
			overrides: { IN: 0.7 }
		});
		const again = await call(pricing.PUT, {
			key: writer,
			method: 'PUT',
			body: { maxDiscount: 0.3 }
		});
		expect(again.json.settings).toMatchObject({
			enabled: true,
			maxDiscount: 0.3,
			overrides: { IN: 0.7 }
		});

		const bad = await call(pricing.PUT, {
			key: writer,
			method: 'PUT',
			body: { maxDiscount: 5, scope: 'x' }
		});
		expect(bad.status).toBe(422);
		expect(bad.json.details).toHaveLength(2);
		const notJson = await (async () => {
			const url = new URL('/api/v1/pricing', 'https://shop.test');
			const response = await (pricing.PUT as unknown as Handler)({
				request: new Request(url, {
					method: 'PUT',
					headers: { authorization: `Bearer ${writer}` },
					body: 'nope'
				}),
				url,
				params: {},
				locals: {},
				platform: { env }
			} as never);
			return response.status;
		})();
		expect(notJson).toBe(400);
		expect((await getRegionalPricingSettings(db)).maxDiscount).toBe(0.3);
	});

	it('changing the settings changes what checkout charges', async () => {
		const writer = await key('pricing:write');
		const before = await call(checkout.POST, { ...order(digitalLines()), cf: 'IN' });
		expect(before.json.order.totalCents).toBe(2000);
		await call(pricing.PUT, { key: writer, method: 'PUT', body: { enabled: true, strength: 1 } });
		const on = await call(checkout.POST, { ...order(digitalLines()), cf: 'IN' });
		expect(on.json.order.totalCents).toBeLessThan(2000);
		await call(pricing.PUT, { key: writer, method: 'PUT', body: { enabled: false } });
		const off = await call(checkout.POST, { ...order(digitalLines()), cf: 'IN' });
		expect(off.json.order.totalCents).toBe(2000);
	});
});

describe('pricing preview API', () => {
	it('shows the multiplier for a country, and the price for an amount', async () => {
		await turnOn({ overrides: { IN: 0.8 } });
		const reader = await key('pricing:read');
		const res = await call(preview.GET, {
			key: reader,
			path: '/api/v1/pricing/preview?country=in&priceCents=2000'
		});
		expect(res.json.preview).toMatchObject({
			country: 'IN',
			multiplier: 0.8,
			discountPercent: 20,
			source: 'override',
			priceCents: 2000,
			regionalPriceCents: 1600
		});
		const bare = await call(preview.GET, {
			key: reader,
			path: '/api/v1/pricing/preview?country=CH'
		});
		expect(bare.json.preview).toMatchObject({ multiplier: 1, source: 'none' });
		expect(bare.json.preview.priceCents).toBeUndefined();
	});
	it('refuses a missing country and a bad amount', async () => {
		const reader = await key('pricing:read');
		for (const path of [
			'/api/v1/pricing/preview',
			'/api/v1/pricing/preview?country=nope',
			'/api/v1/pricing/preview?country=IN&priceCents=1.5',
			'/api/v1/pricing/preview?country=IN&priceCents=-1',
			'/api/v1/pricing/preview?country=IN&priceCents=abc'
		]) {
			expect((await call(preview.GET, { key: reader, path })).status).toBe(422);
		}
	});
});

describe('the OpenAPI document', () => {
	it('describes the new methods with their scopes', async () => {
		const { json } = await call(openapi.GET);
		expect(json.paths['/api/v1/pricing'].get['x-required-scope']).toBe('pricing:read');
		expect(json.paths['/api/v1/pricing'].put['x-required-scope']).toBe('pricing:write');
		expect(json.paths['/api/v1/pricing/preview'].get['x-required-scope']).toBe('pricing:read');
		expect(json.paths['/api/v1/checkout/quote'].post.security).toEqual([]);
		expect(json.components.schemas.RegionalPricing).toBeDefined();
		expect(json.components.schemas.Quote).toBeDefined();
	});
});

describe('createOrder / priceCart directly', () => {
	it('stores a regional audit only when given one', async () => {
		const lookup = async () => ebook;
		const cart = await priceCart([{ productId: ebook.id, quantity: 1 }], lookup, {
			regionalMultiplier: 0.5
		});
		const plain = await createOrder(db, cart, {
			email: 'a@b.co',
			shippingAddress: null,
			paymentProvider: 'manual'
		});
		expect(plain.regional).toBeNull();
		const audited = await createOrder(db, cart, {
			email: 'a@b.co',
			shippingAddress: null,
			paymentProvider: 'manual',
			regional: {
				multiplier: 0.5,
				countries: { request: 'IN', shipping: null },
				baseSubtotalCents: 2000
			}
		});
		expect(audited.regional).toEqual({
			multiplier: 0.5,
			countries: { request: 'IN', shipping: null },
			baseSubtotalCents: 2000
		});
	});
});
