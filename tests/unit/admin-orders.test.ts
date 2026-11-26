import '../helpers/server-response';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { D1Database } from '@cloudflare/workers-types';
import {
	createOrder,
	createProduct,
	getOrder,
	priceCart,
	processStripeEvent,
	repriceOrder,
	setPaymentReference,
	transitionOrder
} from '@nebulakit/commerce';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import { load as listLoad } from '../../src/routes/admin/orders/+page.server';
import { load as detailLoad } from '../../src/routes/admin/orders/[id]/+page.server';
import layoutSource from '../../src/routes/admin/+layout.svelte?raw';

const owner = { isOwner: true } as never;
const shopAdmin = { isAdmin: true, permissions: ['shop'] } as never;
const plainAdmin = { isAdmin: true, permissions: [] } as never;

async function seed(db: D1Database) {
	const mug = await createProduct(db, {
		slug: 'mug',
		name: 'Mug',
		priceCents: 1250,
		type: 'physical'
	});
	const cart = await priceCart([{ productId: mug.id, quantity: 2 }], async () => mug, {
		shippingCents: 500
	});
	const order = await createOrder(db, cart, {
		email: 'grace@example.com',
		shippingAddress: {
			name: 'Grace Hopper',
			line1: '7 Navy Way',
			city: 'Arlington',
			postalCode: '22201',
			country: 'US'
		},
		paymentProvider: 'stripe'
	});
	await setPaymentReference(db, order.id, 'pi_test_42');
	return { mug, cart, order };
}

const event = (
	db: D1Database,
	locals: unknown,
	params: Record<string, string> = {},
	reveal = false
) =>
	({
		locals,
		params,
		platform: { env: { DB: db } },
		url: new URL(
			`https://site.test/admin/orders${params.status ? `?status=${params.status}` : ''}`
		),
		cookies: { get: (name: string) => (reveal && name === 'pii_reveal' ? '1' : undefined) }
	}) as never;

describe('/admin/orders', () => {
	it('needs the shop permission', async () => {
		const db = createSqliteD1();
		await expect(listLoad(event(db, { user: plainAdmin }))).rejects.toMatchObject({ status: 403 });
		await expect(detailLoad(event(db, { user: plainAdmin }, { id: 'x' }))).rejects.toMatchObject({
			status: 403
		});
	});

	it('lists orders with masked emails unless PII is revealed', async () => {
		const db = createSqliteD1();
		const { order } = await seed(db);
		const masked = (await listLoad(event(db, { user: shopAdmin }))) as {
			orders: Array<{ id: string; email: string; total: string; status: string }>;
		};
		expect(masked.orders).toHaveLength(1);
		expect(masked.orders[0]).toMatchObject({ id: order.id, total: '$30.00', status: 'pending' });
		expect(masked.orders[0].email).not.toContain('grace@');
		const revealed = (await listLoad(event(db, { user: owner }, {}, true))) as {
			orders: Array<{ email: string }>;
		};
		expect(revealed.orders[0].email).toBe('grace@example.com');
	});

	it('filters by status', async () => {
		const db = createSqliteD1();
		await seed(db);
		const paid = (await listLoad(event(db, { user: shopAdmin }, { status: 'paid' }))) as {
			orders: unknown[];
			status: string;
		};
		expect(paid.status).toBe('paid');
		expect(paid.orders).toEqual([]);
	});

	it('shows one order with its lines, totals and payment history, masked by default', async () => {
		const db = createSqliteD1();
		const { order } = await seed(db);
		await processStripeEvent(db, {
			id: 'evt_paid',
			type: 'payment_intent.succeeded',
			data: {
				object: {
					id: 'pi_test_42',
					status: 'succeeded',
					amount_received: 3000,
					currency: 'usd',
					metadata: { orderId: order.id, revision: '0' }
				}
			}
		});
		await processStripeEvent(db, {
			id: 'evt_refund',
			type: 'charge.refunded',
			data: {
				object: { id: 'ch_1', payment_intent: 'pi_test_42', amount_refunded: 1000, currency: 'usd' }
			}
		});
		const data = (await detailLoad(event(db, { user: shopAdmin }, { id: order.id }))) as {
			order: Record<string, unknown> & { address: { name: string; lines: string } };
			events: Array<{ type: string; outcome: string; amount: string | null }>;
		};
		expect(data.order).toMatchObject({
			status: 'paid',
			subtotal: '$25.00',
			shipping: '$5.00',
			total: '$30.00',
			paymentReference: 'pi_test_42',
			stripeUrl: 'https://dashboard.stripe.com/search?query=pi_test_42'
		});
		expect(data.order.email).not.toBe('grace@example.com');
		expect(data.order.address.name).not.toBe('Grace Hopper');
		expect(data.order.address.lines).not.toContain('Navy');
		expect(data.events).toEqual([
			expect.objectContaining({
				type: 'payment_intent.succeeded',
				outcome: 'mark-paid',
				amount: '$30.00'
			}),
			expect.objectContaining({ type: 'charge.refunded', outcome: 'record', amount: '$10.00' })
		]);
		await expect(
			detailLoad(event(db, { user: shopAdmin }, { id: crypto.randomUUID() }))
		).rejects.toMatchObject({ status: 404 });
	});

	it('is in the admin navigation for the shop permission', () => {
		expect(layoutSource).toContain(
			"{ path: '/admin/orders', label: 'Orders', icon: 'bag', permission: 'shop' }"
		);
	});
});

describe('repriceOrder', () => {
	it('replaces lines and totals of a pending order and bumps its revision', async () => {
		const db = createSqliteD1();
		const { mug, order } = await seed(db);
		const cart = await priceCart([{ productId: mug.id, quantity: 3 }], async () => mug);
		const result = await repriceOrder(db, order.id, 0, cart, {
			email: 'grace@example.com',
			shippingAddress: null
		});
		expect(result?.revision).toBe(1);
		expect(result?.order.totalCents).toBe(3750);
		expect(result?.order.items.map((i) => i.quantity)).toEqual([3]);
	});

	it('changes nothing when the order was paid, or its revision moved on', async () => {
		const db = createSqliteD1();
		const { mug, order } = await seed(db);
		const cart = await priceCart([{ productId: mug.id, quantity: 9 }], async () => mug);
		const details = { email: 'x@example.com', shippingAddress: null };
		expect(await repriceOrder(db, order.id, 5, cart, details)).toBeNull();
		await transitionOrder(db, order.id, 'paid');
		expect(await repriceOrder(db, order.id, 0, cart, details)).toBeNull();
		const after = await getOrder(db, order.id);
		expect(after).toMatchObject({ status: 'paid', totalCents: 3000, email: 'grace@example.com' });
		expect(after!.items.map((i) => i.quantity)).toEqual([2]);
	});
});

describe('content security policy', () => {
	it('allows exactly Stripe’s card and 3-D Secure frames, nothing wider', () => {
		const config = readFileSync(resolve(process.cwd(), 'svelte.config.js'), 'utf8');
		expect(config).toContain(
			"'frame-src': ['self', 'https://js.stripe.com', 'https://hooks.stripe.com']"
		);
		expect(config).not.toMatch(/stripe\.com\/\*|\*\.stripe\.com|https:\/\/\*/);
	});
});
