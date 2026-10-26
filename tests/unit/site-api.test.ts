import '../helpers/server-response';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { createApiKey, sha256Hex, type ApiScope } from '@nebulakit/security';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import { PACKAGE_VERSIONS } from '../../src/lib/server/site-info';
import * as site from '../../src/routes/api/v1/site/+server';
import * as updates from '../../src/routes/api/v1/site/updates/+server';
import * as products from '../../src/routes/api/v1/products/+server';
import * as product from '../../src/routes/api/v1/products/[id]/+server';
import * as orders from '../../src/routes/api/v1/orders/+server';
import * as order from '../../src/routes/api/v1/orders/[id]/+server';
import * as checkout from '../../src/routes/api/v1/checkout/+server';
import * as pages from '../../src/routes/api/v1/pages/+server';
import * as page from '../../src/routes/api/v1/pages/[slug]/+server';
import * as revisions from '../../src/routes/api/v1/pages/[slug]/revisions/+server';
import * as revision from '../../src/routes/api/v1/pages/[slug]/revisions/[id]/+server';
import * as stripeHook from '../../src/routes/api/v1/webhooks/stripe/+server';
import * as openapi from '../../src/routes/api/v1/openapi.json/+server';

type Handler = (event: never) => Promise<Response>;

let db: D1Database;
let env: Record<string, unknown>;

beforeEach(() => {
	db = createSqliteD1();
	env = { DB: db };
});

interface CallOptions {
	method?: string;
	path?: string;
	params?: Record<string, string>;
	body?: unknown;
	rawBody?: string;
	key?: string;
	headers?: Record<string, string>;
	user?: App.Locals['user'];
	noDb?: boolean;
}

async function call(handler: unknown, options: CallOptions = {}) {
	const method = options.method ?? 'GET';
	const url = new URL(options.path ?? '/api/v1/x', 'https://shop.test');
	const headers: Record<string, string> = { ...options.headers };
	if (options.key) headers.authorization = `Bearer ${options.key}`;
	let body: string | undefined = options.rawBody;
	if (options.body !== undefined) {
		body = JSON.stringify(options.body);
		headers['content-type'] ??= 'application/json';
	}
	const request = new Request(url, { method, headers, body });
	const event = {
		request,
		url,
		params: options.params ?? {},
		locals: { user: options.user },
		platform: { env: options.noDb ? {} : env }
	};
	const response = await (handler as Handler)(event as never);
	const text = await response.text();
	return { status: response.status, json: text ? JSON.parse(text) : null };
}

async function key(...scopes: ApiScope[]) {
	return (await createApiKey(db, { name: 'test', scopes })).key;
}

const owner = { id: 'o', login: 'owner', email: 'o@x', isOwner: true };
const admin = { id: 'a', login: 'admin', email: 'a@x', isOwner: false, isAdmin: true };
const member = { id: 'm', login: 'member', email: 'm@x', isOwner: false };

const address = {
	name: 'Ada',
	line1: '1 Main',
	city: 'Lewiston',
	postalCode: '04240',
	country: 'US'
};

async function seedProduct(input: Record<string, unknown> = {}) {
	const writer = await key('products:write');
	const res = await call(products.POST, {
		method: 'POST',
		key: writer,
		body: { slug: 'tee', name: 'Tee', priceCents: 2500, ...input }
	});
	expect(res.status).toBe(201);
	return res.json.product as { id: string; slug: string };
}

describe('site API authentication', () => {
	it('refuses without a database', async () => {
		expect((await call(site.GET, { noDb: true })).status).toBe(503);
	});

	it('needs credentials for scoped endpoints and the right scope', async () => {
		expect((await call(site.GET)).status).toBe(401);
		expect((await call(site.GET, { key: 'nk_not-a-real-key' })).status).toBe(401);
		const reader = await key('products:read');
		const res = await call(site.GET, { key: reader });
		expect(res).toEqual({ status: 403, json: { error: 'This key lacks the site:read scope' } });
	});

	it('refuses a bad key even on a public endpoint', async () => {
		expect((await call(products.GET, { key: 'nk_wrong' })).status).toBe(401);
	});

	it('accepts the orchestrator key from the environment and logs its calls', async () => {
		const orchestrator = 'nk_orchestrator_for_tests';
		env.ORCHESTRATOR_KEY_SHA256 = await sha256Hex(orchestrator);
		const res = await call(site.GET, { key: orchestrator, path: '/api/v1/site' });
		expect(res.status).toBe(200);
		expect(res.json).toMatchObject({
			template: { name: 'nebulakit' },
			// Not pinned: a forced security bump must not fail every site's tests.
			packages: PACKAGE_VERSIONS,
			updates: { autoApplyFeatures: false, optedIn: [], updatedAt: null }
		});
		const logged = await db.prepare('SELECT * FROM api_key_calls').all();
		expect(logged.results).toEqual([
			expect.objectContaining({ key_id: null, method: 'GET', path: '/api/v1/site', status: 200 })
		]);
	});

	it('keeps answering when the call log cannot be written', async () => {
		const reader = await key('site:read');
		await db.prepare('DROP TABLE api_key_calls').run();
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect((await call(site.GET, { key: reader })).status).toBe(200);
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});

	it('treats owner and admin sessions as API callers, with owner-only kept owner-only', async () => {
		const prefs = { autoApplyFeatures: true, optedIn: ['builder@0.2.0'] };
		expect((await call(site.GET, { user: owner })).status).toBe(200);
		expect((await call(site.GET, { user: member })).status).toBe(401);
		expect((await call(updates.PUT, { method: 'PUT', user: admin, body: prefs })).status).toBe(403);
		const saved = await call(updates.PUT, { method: 'PUT', user: owner, body: prefs });
		expect(saved.status).toBe(200);
		expect(saved.json).toMatchObject(prefs);
		expect((await call(updates.GET, { user: admin })).json).toMatchObject(prefs);
	});

	it('requires JSON on session writes (the CSRF guard)', async () => {
		const res = await call(updates.PUT, {
			method: 'PUT',
			user: owner,
			rawBody: 'autoApplyFeatures=true',
			headers: { 'content-type': 'application/x-www-form-urlencoded' }
		});
		expect(res.status).toBe(415);
		const noType = await call(updates.PUT, { method: 'PUT', user: owner, rawBody: '{}' });
		expect(noType.status).toBe(415);
	});
});

describe('site update preferences', () => {
	it('validates and dedupes the owner choice', async () => {
		const adminKey = await key('site:admin');
		const bad = await call(updates.PUT, { method: 'PUT', key: adminKey, body: { optedIn: 'x' } });
		expect(bad.status).toBe(422);
		expect(bad.json.details).toHaveLength(2);
		expect((await call(updates.PUT, { method: 'PUT', key: adminKey, body: [] })).status).toBe(422);
		expect(
			(
				await call(updates.PUT, {
					method: 'PUT',
					key: adminKey,
					rawBody: '{',
					headers: { 'content-type': 'application/json' }
				})
			).status
		).toBe(400);
		const ok = await call(updates.PUT, {
			method: 'PUT',
			key: adminKey,
			body: { autoApplyFeatures: false, optedIn: ['a', 'a', 'b'] }
		});
		expect(ok.json.optedIn).toEqual(['a', 'b']);
		await db.prepare("UPDATE site_update_preferences SET opted_in = '{bad'").run();
		expect((await call(updates.GET, { key: adminKey })).json.optedIn).toEqual([]);
		await db.prepare(`UPDATE site_update_preferences SET opted_in = '{"a":1}'`).run();
		expect((await call(updates.GET, { key: adminKey })).json.optedIn).toEqual([]);
	});
});

describe('products API', () => {
	it('creates, lists, reads, updates and deletes', async () => {
		const tee = await seedProduct();
		const writer = await key('products:write', 'products:read');
		await call(products.POST, {
			method: 'POST',
			key: writer,
			body: { slug: 'off', name: 'Off', priceCents: 1, active: false }
		});

		const publicList = await call(products.GET, { path: '/api/v1/products?all=1' });
		expect(publicList.json.products.map((p: { slug: string }) => p.slug)).toEqual(['tee']);
		const fullList = await call(products.GET, {
			path: '/api/v1/products?all=1&limit=5',
			key: writer
		});
		expect(fullList.json.products).toHaveLength(2);

		expect((await call(product.GET, { params: { id: 'tee' } })).json.product.id).toBe(tee.id);
		expect((await call(product.GET, { params: { id: 'off' } })).status).toBe(404);
		expect((await call(product.GET, { params: { id: 'off' }, key: writer })).status).toBe(200);

		const patched = await call(product.PATCH, {
			method: 'PATCH',
			key: writer,
			params: { id: 'tee' },
			body: { priceCents: 3000 }
		});
		expect(patched.json.product.priceCents).toBe(3000);
		expect(
			(
				await call(product.PATCH, {
					method: 'PATCH',
					key: writer,
					params: { id: 'tee' },
					body: { priceCents: -1 }
				})
			).status
		).toBe(422);
		expect(
			(
				await call(product.PATCH, {
					method: 'PATCH',
					key: writer,
					params: { id: 'nope' },
					body: {}
				})
			).status
		).toBe(404);

		expect(
			(await call(product.DELETE, { method: 'DELETE', key: writer, params: { id: tee.id } })).status
		).toBe(204);
		expect(
			(await call(product.DELETE, { method: 'DELETE', key: writer, params: { id: tee.id } })).status
		).toBe(404);
	});

	it('reports validation errors and slug conflicts', async () => {
		await seedProduct();
		const writer = await key('products:write');
		const bad = await call(products.POST, { method: 'POST', key: writer, body: { slug: 'X' } });
		expect(bad.status).toBe(422);
		const dupe = await call(products.POST, {
			method: 'POST',
			key: writer,
			body: { slug: 'tee', name: 'Tee', priceCents: 1 }
		});
		expect(dupe).toEqual({ status: 409, json: { error: 'Slug "tee" is taken' } });
	});
});

describe('checkout and orders API', () => {
	it('prices from the catalog, applies site tax and shipping, and records a manual payment', async () => {
		const tee = await seedProduct();
		env.COMMERCE_TAX_RATE_PERCENT = '10';
		env.COMMERCE_FLAT_SHIPPING_CENTS = '500';
		const res = await call(checkout.POST, {
			method: 'POST',
			body: {
				email: 'ada@example.com',
				lines: [{ productId: tee.id, quantity: 2, priceCents: 1 }],
				shippingAddress: address
			}
		});
		expect(res.status).toBe(201);
		expect(res.json.order).toMatchObject({
			status: 'pending',
			subtotalCents: 5000,
			shippingCents: 500,
			taxCents: 500,
			totalCents: 6000
		});
		expect(res.json.payment).toEqual({
			provider: 'manual',
			reference: `manual_${res.json.order.id}`,
			redirectUrl: null
		});

		const reader = await key('orders:read', 'orders:write');
		const listed = await call(orders.GET, { key: reader, path: '/api/v1/orders?status=pending' });
		expect(listed.json.orders).toHaveLength(1);
		expect(
			(await call(orders.GET, { key: reader, path: '/api/v1/orders?status=lost' })).status
		).toBe(400);
		expect(
			(await call(orders.GET, { key: reader, path: '/api/v1/orders?limit=x' })).json.orders
		).toHaveLength(1);

		const one = await call(order.GET, { key: reader, params: { id: res.json.order.id } });
		expect(one.json.order.items).toHaveLength(1);
		expect(one.json.order.paymentReference).toBe(`manual_${res.json.order.id}`);
		expect((await call(order.GET, { key: reader, params: { id: 'nope' } })).status).toBe(404);

		const paid = await call(order.PATCH, {
			method: 'PATCH',
			key: reader,
			params: { id: res.json.order.id },
			body: { status: 'paid', paymentReference: 'cash-1' }
		});
		expect(paid.json.order).toMatchObject({ status: 'paid', paymentReference: 'cash-1' });
		const backwards = await call(order.PATCH, {
			method: 'PATCH',
			key: reader,
			params: { id: res.json.order.id },
			body: { status: 'pending' }
		});
		expect(backwards.status).toBe(409);
		const shipped = await call(order.PATCH, {
			method: 'PATCH',
			key: reader,
			params: { id: res.json.order.id },
			body: { status: 'fulfilling', fulfillmentReference: 'pf-1' }
		});
		expect(shipped.json.order.fulfillmentReference).toBe('pf-1');
		const badPatch = await call(order.PATCH, {
			method: 'PATCH',
			key: reader,
			params: { id: res.json.order.id },
			body: { status: 'lost', paymentReference: 5, fulfillmentReference: '' }
		});
		expect(badPatch.json.details).toHaveLength(3);
		expect(
			(
				await call(order.PATCH, {
					method: 'PATCH',
					key: reader,
					params: { id: 'nope' },
					body: { status: 'paid' }
				})
			).status
		).toBe(404);
	});

	it('needs an address for physical goods but not for digital ones', async () => {
		const tee = await seedProduct();
		const ebook = await seedProduct({
			slug: 'ebook',
			name: 'Ebook',
			type: 'digital',
			priceCents: 900
		});
		env.COMMERCE_FLAT_SHIPPING_CENTS = '500';
		const noAddress = await call(checkout.POST, {
			method: 'POST',
			body: { email: 'a@b.co', lines: [{ productId: tee.id, quantity: 1 }] }
		});
		expect(noAddress.status).toBe(422);
		const digital = await call(checkout.POST, {
			method: 'POST',
			body: { email: 'a@b.co', lines: [{ productId: ebook.id, quantity: 1 }] }
		});
		expect(digital.json.order).toMatchObject({ shippingCents: 0, totalCents: 900 });
		expect((await call(checkout.POST, { method: 'POST', body: { email: 'x' } })).status).toBe(422);
		const unknown = await call(checkout.POST, {
			method: 'POST',
			body: { email: 'a@b.co', lines: [{ productId: 'ghost', quantity: 1 }] }
		});
		expect(unknown.status).toBe(400);
	});

	it('pays through Stripe when configured, and the webhook marks the order paid', async () => {
		const tee = await seedProduct();
		env.STRIPE_SECRET_KEY = 'sk_test_123';
		env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({ id: 'cs_test_1', url: 'https://checkout.stripe.test/cs_test_1' }),
				{
					status: 200
				}
			)
		);
		const res = await call(checkout.POST, {
			method: 'POST',
			body: {
				email: 'a@b.co',
				lines: [{ productId: tee.id, quantity: 1 }],
				shippingAddress: address
			}
		});
		fetchSpy.mockRestore();
		expect(res.json.payment).toEqual({
			provider: 'stripe',
			reference: 'cs_test_1',
			redirectUrl: 'https://checkout.stripe.test/cs_test_1'
		});
		const orderId = res.json.order.id;

		async function signed(payload: object, secret = 'whsec_test') {
			const body = JSON.stringify(payload);
			const t = Math.floor(Date.now() / 1000);
			const k = await crypto.subtle.importKey(
				'raw',
				new TextEncoder().encode(secret),
				{ name: 'HMAC', hash: 'SHA-256' },
				false,
				['sign']
			);
			const sig = Array.from(
				new Uint8Array(
					await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${t}.${body}`))
				),
				(b) => b.toString(16).padStart(2, '0')
			).join('');
			return call(stripeHook.POST, {
				method: 'POST',
				rawBody: body,
				headers: { 'stripe-signature': `t=${t},v1=${sig}` }
			});
		}
		const completed = (id: string, status = 'paid', sessionId = 'cs_test_1') => ({
			type: 'checkout.session.completed',
			data: { object: { id: sessionId, payment_status: status, metadata: { orderId: id } } }
		});

		expect((await signed(completed(orderId), 'whsec_wrong')).status).toBe(400);
		expect((await signed(completed(orderId, 'unpaid'))).json).toEqual({
			received: true,
			ignored: true
		});
		expect((await signed(completed(orderId, 'paid', 'cs_forged'))).json.ignored).toBe(true);
		expect((await signed(completed('ghost'))).json.ignored).toBe(true);
		expect(
			(
				await signed({
					type: 'checkout.session.completed',
					data: { object: { payment_status: 'paid' } }
				})
			).json.ignored
		).toBe(true);
		expect((await signed(completed(orderId))).json).toEqual({ received: true });
		expect((await signed(completed(orderId))).json).toEqual({ received: true });
		const status = await db
			.prepare('SELECT status FROM commerce_orders WHERE id = ?')
			.bind(orderId)
			.first('status');
		expect(status).toBe('paid');
	});

	it('refuses webhooks when Stripe is not configured or the payload is not JSON', async () => {
		expect((await call(stripeHook.POST, { method: 'POST', rawBody: '{}' })).status).toBe(503);
		env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
		const t = Math.floor(Date.now() / 1000);
		const k = await crypto.subtle.importKey(
			'raw',
			new TextEncoder().encode('whsec_test'),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign']
		);
		const sig = Array.from(
			new Uint8Array(
				await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${t}.not json`))
			),
			(b) => b.toString(16).padStart(2, '0')
		).join('');
		const res = await call(stripeHook.POST, {
			method: 'POST',
			rawBody: 'not json',
			headers: { 'stripe-signature': `t=${t},v1=${sig}` }
		});
		expect(res.status).toBe(400);
	});

	it('turns an unexpected failure into a 500 without leaking it', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		await db.prepare('DROP TABLE commerce_orders').run();
		const reader = await key('orders:read');
		expect(await call(orders.GET, { key: reader })).toEqual({
			status: 500,
			json: { error: 'Internal error' }
		});
		spy.mockRestore();
	});
});

describe('pages API', () => {
	const document = {
		version: 2,
		blocks: [{ id: 'h', type: 'heading', props: { text: 'Hi', level: 1, align: 'start' } }]
	};

	it('creates, replaces, reads, lists and deletes pages', async () => {
		const writer = await key('pages:write', 'pages:read');
		const created = await call(page.PUT, {
			method: 'PUT',
			key: writer,
			params: { slug: 'about' },
			body: { title: 'About', document }
		});
		expect(created.status).toBe(201);
		expect(created.json.page).toMatchObject({ slug: 'about', published: false, document });

		expect((await call(page.GET, { params: { slug: 'about' } })).status).toBe(404);
		expect((await call(pages.GET)).json.pages).toEqual([]);
		expect((await call(pages.GET, { key: writer })).json.pages).toHaveLength(1);

		const replaced = await call(page.PUT, {
			method: 'PUT',
			key: writer,
			params: { slug: 'about' },
			body: { title: 'About us', document, published: true }
		});
		expect(replaced.status).toBe(200);
		expect((await call(page.GET, { params: { slug: 'about' } })).json.page.title).toBe('About us');

		expect(
			(await call(page.DELETE, { method: 'DELETE', key: writer, params: { slug: 'about' } })).status
		).toBe(204);
		expect(
			(await call(page.DELETE, { method: 'DELETE', key: writer, params: { slug: 'about' } })).status
		).toBe(404);
	});

	it('refuses unsafe or malformed pages', async () => {
		const writer = await key('pages:write');
		const res = await call(page.PUT, {
			method: 'PUT',
			key: writer,
			params: { slug: 'Bad Slug' },
			body: {
				title: '',
				published: 'yes',
				document: {
					version: 2,
					blocks: [{ id: 'b', type: 'button', props: { label: 'x', href: 'javascript:alert(1)' } }]
				}
			}
		});
		expect(res.status).toBe(422);
		expect(res.json.details).toHaveLength(4);
		const empty = await call(page.PUT, {
			method: 'PUT',
			key: writer,
			params: { slug: 'x' },
			body: null
		});
		expect(empty.status).toBe(422);
	});
});

describe('page revisions API', () => {
	const doc = (text: string) => ({
		version: 2,
		blocks: [{ id: 'h', type: 'heading', props: { text, level: 1, align: 'start' } }]
	});

	it('records each changed save, lists them, and restores one', async () => {
		const writer = await key('pages:write', 'pages:read');
		const put = (title: string, text: string, published = false) =>
			call(page.PUT, {
				method: 'PUT',
				key: writer,
				params: { slug: 'about' },
				body: { title, document: doc(text), published }
			});
		await put('About', 'One');
		await put('About', 'One'); // same content: no new revision
		await put('About', 'Two', true);

		const list = await call(revisions.GET, { key: writer, params: { slug: 'about' } });
		expect(list.status).toBe(200);
		expect(list.json.revisions).toHaveLength(2);
		expect(list.json.revisions[0]).toMatchObject({ title: 'About', blocks: 1, author: 'test' });
		expect(list.json.revisions[0].document).toBeUndefined();

		const oldest = list.json.revisions[1].id as string;
		const one = await call(revision.GET, { key: writer, params: { slug: 'about', id: oldest } });
		expect(one.json.revision.document).toEqual(doc('One'));

		const restored = await call(revision.POST, {
			method: 'POST',
			key: writer,
			params: { slug: 'about', id: oldest }
		});
		expect(restored.status).toBe(200);
		expect(restored.json.page.document).toEqual(doc('One'));
		expect(restored.json.page.published).toBe(true); // visibility is not rewound

		const after = await call(revisions.GET, { key: writer, params: { slug: 'about' } });
		expect(after.json.revisions).toHaveLength(3);
	});

	it('keeps the newest 50 and removes them with the page', async () => {
		const writer = await key('pages:write', 'pages:read');
		for (let i = 0; i < 53; i++) {
			await call(page.PUT, {
				method: 'PUT',
				key: writer,
				params: { slug: 'busy' },
				body: { title: 'Busy', document: doc(`v${i}`) }
			});
		}
		const list = await call(revisions.GET, { key: writer, params: { slug: 'busy' } });
		expect(list.json.revisions).toHaveLength(50);
		await call(page.DELETE, { method: 'DELETE', key: writer, params: { slug: 'busy' } });
		const left = await db
			.prepare('SELECT COUNT(*) AS n FROM builder_page_revisions')
			.first<{ n: number }>();
		expect(left?.n).toBe(0);
	});

	it('needs scopes and finds nothing for an unknown page or revision', async () => {
		const reader = await key('pages:read');
		const writer = await key('pages:write');
		expect((await call(revisions.GET, { params: { slug: 'x' } })).status).toBe(401);
		expect((await call(revisions.GET, { key: reader, params: { slug: 'none' } })).status).toBe(404);
		expect(
			(await call(revision.GET, { key: reader, params: { slug: 'none', id: 'zz' } })).status
		).toBe(404);
		expect(
			(await call(revision.POST, { method: 'POST', key: reader, params: { slug: 'a', id: 'b' } }))
				.status
		).toBe(403);
		expect(
			(await call(revision.POST, { method: 'POST', key: writer, params: { slug: 'a', id: 'b' } }))
				.status
		).toBe(404);
	});
});

describe('OpenAPI document', () => {
	it('is served publicly and names the scope of each operation', async () => {
		const response = await openapi.GET();
		const doc = await response.json();
		expect(doc.openapi).toBe('3.1.0');
		expect(doc.paths['/api/v1/orders'].get['x-required-scope']).toBe('orders:read');
		expect(doc.paths['/api/v1/checkout'].post.security).toEqual([]);
		expect(doc.paths['/api/v1/pages/{slug}'].put.requestBody).toBeDefined();
		expect(doc.paths['/api/v1/pages/{slug}/revisions/{id}'].post['x-required-scope']).toBe(
			'pages:write'
		);
	});
});
