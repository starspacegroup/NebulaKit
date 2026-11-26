import '../helpers/server-response';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import {
	buyNowAuction,
	createAuction,
	createProduct,
	ensureAuctionOrder,
	getAuction,
	getOrder,
	getOrderStatus,
	listOrderPaymentEvents,
	saveRegionalPricingSettings,
	setCommerceSetting,
	setPaymentReference,
	type Product
} from '@nebulakit/commerce';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import { stripeSignature } from '../helpers/commerce-fixtures';
import { fakeStripe } from '../helpers/fake-stripe';
import * as checkout from '../../src/routes/api/v1/checkout/+server';
import * as cancel from '../../src/routes/api/v1/checkout/cancel/+server';
import * as hook from '../../src/routes/api/v1/webhooks/stripe/+server';
import * as cartPage from '../../src/routes/cart/+page.server';
import { resolveCheckout } from '../../src/lib/server/checkout-mode';
import { CHECKOUT_LIMITS } from '../../src/lib/server/request-limit';

const SECRET = 'whsec_test';
const PK = 'pk_test_abcdefghijklmnop';
let db: D1Database;
let env: Record<string, unknown>;
let stripe: ReturnType<typeof fakeStripe>;
let ebook: Product;
let tee: Product;
let waits: Promise<unknown>[];
let ip = 0;

beforeEach(async () => {
	db = createSqliteD1();
	stripe = fakeStripe();
	vi.spyOn(globalThis, 'fetch').mockImplementation(stripe.fetch as never);
	env = {
		DB: db,
		STRIPE_SECRET_KEY: 'sk_test_x',
		STRIPE_PUBLISHABLE_KEY: PK,
		STRIPE_WEBHOOK_SECRET: SECRET
	};
	waits = [];
	ebook = await createProduct(db, {
		slug: 'ebook',
		name: 'E-book',
		priceCents: 2000,
		type: 'digital'
	});
	tee = await createProduct(db, { slug: 'tee', name: 'Tee', priceCents: 3000, type: 'physical' });
});

afterEach(() => vi.restoreAllMocks());

const address = {
	name: 'Ada',
	line1: '1 Main St',
	city: 'Lewiston',
	postalCode: '04240',
	country: 'US'
};
const KEY = '7d4c1f0e-1111-4a2b-9c3d-0123456789ab';

async function call(
	handler: unknown,
	body: unknown,
	opts: { path?: string; headers?: Record<string, string>; raw?: string } = {}
) {
	const url = new URL(opts.path ?? '/api/v1/checkout', 'https://shop.test');
	const request = new Request(url, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			// A fresh address per call unless a test pins one, so the request limit stays out of the way.
			'cf-connecting-ip': `203.0.113.${++ip % 250}`,
			...opts.headers
		},
		body: opts.raw ?? JSON.stringify(body)
	});
	const response = await (handler as (e: never) => Promise<Response>)({
		request,
		url,
		params: {},
		locals: {},
		platform: { env, context: { waitUntil: (p: Promise<unknown>) => waits.push(p) } }
	} as never);
	const text = await response.text();
	return { status: response.status, json: text ? JSON.parse(text) : null };
}

const pay = (extra: Record<string, unknown> = {}) =>
	call(checkout.POST, {
		email: 'ada@example.com',
		lines: [{ productId: ebook.id, quantity: 2 }],
		onSite: true,
		checkoutKey: KEY,
		...extra
	});

let eventCount = 0;
async function deliver(type: string, object: Record<string, unknown>, opts: { id?: string } = {}) {
	const body = JSON.stringify({ id: opts.id ?? `evt_t_${++eventCount}`, type, data: { object } });
	const { header } = await stripeSignature(body, SECRET);
	return call(hook.POST, null, {
		path: '/api/v1/webhooks/stripe',
		raw: body,
		headers: { 'stripe-signature': header }
	});
}

const succeeded = (intentId: string) => {
	const intent = stripe.intents.get(intentId)!;
	intent.status = 'succeeded';
	return { ...intent, amount_received: intent.amount };
};

describe('on-page checkout: the price is the server’s', () => {
	it('creates one PaymentIntent for the server total, whatever the body says about money', async () => {
		const res = await pay({
			lines: [
				{ productId: ebook.id, quantity: 2, unitPriceCents: 1, priceCents: 1, totalCents: 1 }
			],
			totalCents: 1,
			amount: 1,
			currency: 'jpy'
		});
		expect(res.status).toBe(201);
		expect(res.json.order.totalCents).toBe(4000);
		expect(res.json.payment.clientSecret).toMatch(/^pi_test_\d+_secret/);
		expect(res.json.payment.redirectUrl).toBeNull();
		const [created] = stripe.created();
		expect(created.form.amount).toBe('4000');
		expect(created.form.currency).toBe('usd');
		expect(created.form['metadata[orderId]']).toBe(res.json.order.id);
		expect(created.form['metadata[revision]']).toBe('0');
		expect(created.form['allowed_payment_method_types[0]']).toBe('card');
	});

	it('charges tax, shipping and the regional price, all computed on the server', async () => {
		env.COMMERCE_TAX_RATE_PERCENT = '10';
		env.COMMERCE_FLAT_SHIPPING_CENTS = '500';
		await saveRegionalPricingSettings(db, {
			...(await import('@nebulakit/commerce')).parseRegionalPricing(null),
			enabled: true,
			scope: 'all'
		});
		const res = await call(
			checkout.POST,
			{
				email: 'ada@example.com',
				lines: [{ productId: tee.id, quantity: 1 }],
				shippingAddress: { ...address, country: 'IN' },
				onSite: true,
				checkoutKey: KEY
			},
			{ headers: { 'cf-ipcountry': 'IN' } }
		);
		expect(res.status).toBe(201);
		const order = await getOrder(db, res.json.order.id);
		expect(order!.subtotalCents).toBeLessThan(3000);
		expect(order!.shippingCents).toBe(500);
		expect(order!.totalCents).toBe(order!.subtotalCents + 500 + order!.taxCents);
		expect(stripe.created()[0].form.amount).toBe(String(order!.totalCents));
	});

	it('sends an Idempotency-Key with every POST to Stripe', async () => {
		const first = await pay();
		await pay({ lines: [{ productId: ebook.id, quantity: 3 }] });
		await call(cancel.POST, { orderId: first.json.order.id }, { path: '/api/v1/checkout/cancel' });
		expect(stripe.posts().length).toBeGreaterThanOrEqual(3);
		for (const post of stripe.posts()) expect(post.idempotencyKey, post.path).toBeTruthy();
	});

	it('needs a checkout key to pay on the page', async () => {
		const res = await pay({ checkoutKey: undefined });
		expect(res.status).toBe(422);
		expect(stripe.calls).toEqual([]);
	});
});

describe('on-page checkout: one order, one PaymentIntent', () => {
	it('a double submit reuses the order and its PaymentIntent', async () => {
		const a = await pay();
		const b = await pay();
		expect(a.status).toBe(201);
		expect(b.status).toBe(200);
		expect(b.json.order.id).toBe(a.json.order.id);
		expect(b.json.payment.clientSecret).toBe(a.json.payment.clientSecret);
		expect(stripe.created()).toHaveLength(1);
		// Nothing changed, so Stripe is only read, never written, the second time.
		expect(stripe.posts()).toHaveLength(1);
	});

	it('two submits at the same moment still make one order and one PaymentIntent', async () => {
		const [a, b] = await Promise.all([pay(), pay()]);
		expect([a.status, b.status].sort()).toEqual([200, 201]);
		expect(a.json.order.id).toBe(b.json.order.id);
		expect(new Set(stripe.created().map((c) => c.idempotencyKey)).size).toBe(1);
		expect(stripe.intents.size).toBe(1);
		const { results } = await db.prepare('SELECT id FROM commerce_orders').all();
		expect(results).toHaveLength(1);
	});

	it('a changed cart updates the same PaymentIntent and reprices the order', async () => {
		const a = await pay();
		const b = await pay({ lines: [{ productId: ebook.id, quantity: 5 }] });
		expect(b.status).toBe(200);
		expect(b.json.order.id).toBe(a.json.order.id);
		expect(b.json.order.totalCents).toBe(10000);
		expect(stripe.created()).toHaveLength(1);
		const update = stripe.posts().find((c) => c.path.startsWith('/v1/payment_intents/pi_'));
		expect(update?.form.amount).toBe('10000');
		expect(update?.form['metadata[revision]']).toBe('1');
		expect(update?.idempotencyKey).toBe(`order-intent-${a.json.order.id}-r1`);
		const order = await getOrder(db, a.json.order.id);
		expect(order!.totalCents).toBe(10000);
		expect(order!.items).toHaveLength(1);
		expect(order!.items[0].quantity).toBe(5);
		// And back again: a new revision, not a replay of the first update.
		const c = await pay();
		expect(c.json.order.totalCents).toBe(4000);
		expect([...stripe.intents.values()][0].amount).toBe(4000);
		expect([...stripe.intents.values()][0].metadata.revision).toBe('2');
	});

	it('refuses to reprice a payment that is already being made, and leaves the order alone', async () => {
		const a = await pay();
		stripe.intents.get(a.json.payment.reference)!.status = 'processing';
		const b = await pay({ lines: [{ productId: ebook.id, quantity: 9 }] });
		expect(b.status).toBe(409);
		expect(b.json.orderStatus).toBe('paid');
		expect((await getOrder(db, a.json.order.id))!.totalCents).toBe(4000);
	});

	it('a checkout whose order was paid or cancelled answers 409 with its status', async () => {
		const a = await pay();
		await deliver('payment_intent.succeeded', succeeded(a.json.payment.reference));
		const again = await pay();
		expect(again.status).toBe(409);
		expect(again.json).toMatchObject({ orderId: a.json.order.id, orderStatus: 'paid' });
	});
});

describe('checkout modes', () => {
	it('falls back to hosted Checkout without a publishable key, and with CHECKOUT_MODE=hosted', async () => {
		for (const change of [{ STRIPE_PUBLISHABLE_KEY: undefined }, { CHECKOUT_MODE: 'hosted' }]) {
			Object.assign(env, change);
			const res = await pay({ checkoutKey: crypto.randomUUID() });
			expect(res.status).toBe(201);
			expect(res.json.payment.redirectUrl).toMatch(/^https:\/\/checkout\.stripe\.test\//);
			env.STRIPE_PUBLISHABLE_KEY = PK;
			delete env.CHECKOUT_MODE;
		}
		expect(stripe.created()).toHaveLength(0);
	});

	it('reads the mode from the site setting when the variable is unset', async () => {
		await setCommerceSetting(db, 'checkout_mode', 'hosted');
		expect((await resolveCheckout(db, env as never)).mode).toBe('hosted');
		env.CHECKOUT_MODE = 'onpage';
		expect((await resolveCheckout(db, env as never)).mode).toBe('onpage');
		env.CHECKOUT_MODE = 'nonsense';
		await setCommerceSetting(db, 'checkout_mode', 'nonsense');
		expect((await resolveCheckout(db, env as never)).mode).toBe('onpage');
	});

	it('keeps the manual provider when no secret key is set', async () => {
		delete env.STRIPE_SECRET_KEY;
		const res = await pay();
		expect(res.status).toBe(201);
		expect(res.json.payment).toMatchObject({ provider: 'manual', redirectUrl: null });
		expect(stripe.calls).toEqual([]);
	});

	it('gives the cart page only the mode and a public key, never a secret', async () => {
		const data = (await cartPage.load({ platform: { env } } as never)) as {
			checkout: Record<string, unknown>;
		};
		expect(data.checkout).toEqual({ provider: 'stripe', mode: 'onpage', publishableKey: PK });
		expect(JSON.stringify(data)).not.toContain('sk_test');
		env.STRIPE_PUBLISHABLE_KEY = 'sk_test_oops_not_a_publishable_key';
		const unsafe = (await cartPage.load({ platform: { env } } as never)) as {
			checkout: Record<string, unknown>;
		};
		expect(unsafe.checkout.publishableKey).toBeNull();
	});
});

describe('request limits', () => {
	it('refuses an address that places too many orders', async () => {
		const max = CHECKOUT_LIMITS[0].max;
		const statuses: number[] = [];
		for (let i = 0; i <= max; i++) {
			const res = await call(
				checkout.POST,
				{ email: 'a@b.co', lines: [{ productId: ebook.id, quantity: 1 }] },
				{ headers: { 'cf-connecting-ip': '198.51.100.7' } }
			);
			statuses.push(res.status);
		}
		expect(statuses.slice(0, max).every((s) => s === 201)).toBe(true);
		expect(statuses[max]).toBe(429);
	});
});

describe('cancel', () => {
	const cancelOrder = (orderId: string) =>
		call(cancel.POST, { orderId }, { path: '/api/v1/checkout/cancel' });

	it('cancels the PaymentIntent first, then the order', async () => {
		const a = await pay();
		const res = await cancelOrder(a.json.order.id);
		expect(res.json).toEqual({ status: 'cancelled' });
		expect(stripe.intents.get(a.json.payment.reference)!.status).toBe('canceled');
		expect(await getOrderStatus(db, a.json.order.id)).toBe('cancelled');
		// Stripe's own notice arriving later changes nothing.
		const late = await deliver('payment_intent.canceled', {
			...stripe.intents.get(a.json.payment.reference)!
		});
		expect(late.status).toBe(200);
		expect(await getOrderStatus(db, a.json.order.id)).toBe('cancelled');
	});

	it('leaves a paid (or being paid) order alone and answers 409', async () => {
		const a = await pay();
		stripe.intents.get(a.json.payment.reference)!.status = 'succeeded';
		const res = await cancelOrder(a.json.order.id);
		expect(res.status).toBe(409);
		expect(await getOrderStatus(db, a.json.order.id)).toBe('pending');
	});

	it('refuses ids that are not order ids, and unknown orders', async () => {
		expect((await cancelOrder('nope')).status).toBe(422);
		expect((await cancelOrder(crypto.randomUUID())).status).toBe(404);
	});

	it('releases the auction hold: a winner who backs out lapses the auction', async () => {
		const product = await createProduct(db, {
			slug: 'vase',
			name: 'Vase',
			priceCents: 100,
			type: 'digital'
		});
		const now = Date.now();
		const auction = await createAuction(db, {
			slug: 'vase',
			productId: product.id,
			startingCents: 1000,
			buyNowCents: 5000,
			startsAt: new Date(now - 60_000).toISOString(),
			endsAt: new Date(now + 3_600_000).toISOString()
		});
		await buyNowAuction(db, auction.id, { id: 'u1', email: 'win@example.com' });
		const { order } = await ensureAuctionOrder(db, auction.id, { paymentProvider: 'stripe' });
		// The auction page pays through a hosted session (unchanged by on-page checkout).
		const session = await (
			await import('@nebulakit/commerce')
		)
			.stripePayments('sk_test_x')
			.createPayment(order!, { successUrl: 'https://s/ok', cancelUrl: 'https://s/no' });
		await setPaymentReference(db, order!.id, session.reference);

		const res = await cancelOrder(order!.id);
		expect(res.json).toEqual({ status: 'cancelled' });
		expect(stripe.sessions.get(session.reference)!.status).toBe('expired');
		expect((await getAuction(db, auction.id))!.status).toBe('lapsed');
	});
});

describe('webhook: PaymentIntents', () => {
	it('marks the order paid only on the signed succeeded event, once', async () => {
		const a = await pay();
		expect(await getOrderStatus(db, a.json.order.id)).toBe('pending');
		const event = succeeded(a.json.payment.reference);
		expect((await deliver('payment_intent.succeeded', event, { id: 'evt_same' })).json).toEqual({
			received: true
		});
		expect(await getOrderStatus(db, a.json.order.id)).toBe('paid');
		expect((await deliver('payment_intent.succeeded', event, { id: 'evt_same' })).json).toEqual({
			received: true,
			duplicate: true
		});
		const history = await listOrderPaymentEvents(db, a.json.order.id);
		expect(history.map((e) => e.outcome)).toEqual(['mark-paid']);
	});

	it('refuses a short payment or one in another currency', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const a = await pay();
		const paid = succeeded(a.json.payment.reference);
		const short = await deliver('payment_intent.succeeded', { ...paid, amount_received: 3999 });
		expect(short.json.ignored).toBe(true);
		const foreign = await deliver('payment_intent.succeeded', { ...paid, currency: 'eur' });
		expect(foreign.json.ignored).toBe(true);
		const none = await deliver('payment_intent.succeeded', { ...paid, amount_received: undefined });
		expect(none.json.ignored).toBe(true);
		expect(await getOrderStatus(db, a.json.order.id)).toBe('pending');
	});

	it('does not trust a succeeded event that is not really succeeded, or names another intent', async () => {
		const a = await pay();
		const intent = stripe.intents.get(a.json.payment.reference)!;
		await deliver('payment_intent.succeeded', { ...intent, amount_received: 4000 });
		await deliver('payment_intent.succeeded', {
			...intent,
			id: 'pi_forged',
			status: 'succeeded',
			amount_received: 4000
		});
		expect(await getOrderStatus(db, a.json.order.id)).toBe('pending');
	});

	it('records a declined card and a refund without moving the order', async () => {
		const a = await pay();
		const ref = a.json.payment.reference;
		await deliver('payment_intent.payment_failed', { ...stripe.intents.get(ref)! });
		expect(await getOrderStatus(db, a.json.order.id)).toBe('pending');
		await deliver('payment_intent.succeeded', succeeded(ref));
		await deliver('charge.refunded', {
			id: 'ch_1',
			payment_intent: ref,
			amount_refunded: 1500,
			currency: 'usd'
		});
		expect(await getOrderStatus(db, a.json.order.id)).toBe('paid');
		const history = await listOrderPaymentEvents(db, a.json.order.id);
		expect(history.map((e) => [e.type, e.outcome])).toEqual([
			['payment_intent.payment_failed', 'record'],
			['payment_intent.succeeded', 'mark-paid'],
			['charge.refunded', 'record']
		]);
		expect(history[2].amountMinor).toBe(1500);
	});

	it('is safe out of order: canceled after succeeded stays paid; succeeded after canceled stays cancelled', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const a = await pay();
		const paid = succeeded(a.json.payment.reference);
		await deliver('payment_intent.succeeded', paid);
		await deliver('payment_intent.canceled', { ...paid, status: 'canceled' });
		expect(await getOrderStatus(db, a.json.order.id)).toBe('paid');

		const b = await pay({ checkoutKey: crypto.randomUUID() });
		const intent = stripe.intents.get(b.json.payment.reference)!;
		await deliver('payment_intent.canceled', { ...intent, status: 'canceled' });
		await deliver('payment_intent.succeeded', {
			...intent,
			status: 'succeeded',
			amount_received: 4000
		});
		expect(await getOrderStatus(db, b.json.order.id)).toBe('cancelled');
		expect(error).toHaveBeenCalledWith(
			'stripe webhook: needs attention',
			expect.objectContaining({ reason: 'order-cancelled' })
		);
	});

	it('asks Stripe to redeliver a payment for a repricing not yet written, and is not fooled by an old one', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const a = await pay();
		const ref = a.json.payment.reference;
		const ahead = { ...succeeded(ref), metadata: { orderId: a.json.order.id, revision: '1' } };
		const early = await deliver('payment_intent.succeeded', ahead, { id: 'evt_early' });
		expect(early.status).toBe(503);
		expect(await getOrderStatus(db, a.json.order.id)).toBe('pending');
		// Not remembered: the redelivery is applied once the order is at that revision.
		await db.prepare('UPDATE commerce_orders SET payment_revision = 1').run();
		expect((await deliver('payment_intent.succeeded', ahead, { id: 'evt_early' })).status).toBe(
			200
		);
		expect(await getOrderStatus(db, a.json.order.id)).toBe('paid');

		const b = await pay({ checkoutKey: crypto.randomUUID() });
		await db
			.prepare('UPDATE commerce_orders SET payment_revision = 3 WHERE id = ?')
			.bind(b.json.order.id)
			.run();
		const stale = await deliver('payment_intent.succeeded', succeeded(b.json.payment.reference));
		expect(stale.json.ignored).toBe(true);
		expect(await getOrderStatus(db, b.json.order.id)).toBe('pending');
	});
});

describe('webhook: authentication', () => {
	it('fails closed without a secret, and refuses forged, stale and id-less events', async () => {
		const a = await pay();
		const paid = succeeded(a.json.payment.reference);
		const body = JSON.stringify({
			id: 'evt_x',
			type: 'payment_intent.succeeded',
			data: { object: paid }
		});
		const send = (raw: string, header: string) =>
			call(hook.POST, null, {
				path: '/api/v1/webhooks/stripe',
				raw,
				headers: { 'stripe-signature': header }
			});

		const forged = await stripeSignature(body, 'whsec_attacker');
		expect((await send(body, forged.header)).status).toBe(400);
		const stale = await stripeSignature(body, SECRET, Math.floor(Date.now() / 1000) - 301);
		expect((await send(body, stale.header)).status).toBe(400);
		const noId = JSON.stringify({ type: 'payment_intent.succeeded', data: { object: paid } });
		expect((await send(noId, (await stripeSignature(noId, SECRET)).header)).status).toBe(400);

		delete env.STRIPE_WEBHOOK_SECRET;
		expect((await send(body, (await stripeSignature(body, SECRET)).header)).status).toBe(503);
		expect(await getOrderStatus(db, a.json.order.id)).toBe('pending');
	});

	it('accepts the previous signing secret while it is set', async () => {
		const a = await pay();
		env.STRIPE_WEBHOOK_SECRET = 'whsec_new';
		env.STRIPE_WEBHOOK_SECRET_PREVIOUS = SECRET;
		await deliver('payment_intent.succeeded', succeeded(a.json.payment.reference));
		expect(await getOrderStatus(db, a.json.order.id)).toBe('paid');
	});
});
