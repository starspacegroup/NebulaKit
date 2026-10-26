import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import {
	CommerceConflictError,
	createOrder,
	createProduct,
	deleteProduct,
	getOrder,
	getProduct,
	listOrders,
	listProducts,
	priceCart,
	transitionOrder,
	updateProduct
} from '@nebulakit/commerce';
import { createSqliteD1 } from '../helpers/sqlite-d1';

let db: D1Database;

beforeEach(() => {
	db = createSqliteD1(['0016_commerce.sql', '0022_commerce_settings.sql']);
});

describe('commerce store: products', () => {
	it('creates, reads, lists, updates and deletes products', async () => {
		const tee = await createProduct(db, {
			slug: 'tee',
			name: 'Tee',
			priceCents: 2500,
			printfulVariantId: 9
		});
		expect(tee).toMatchObject({
			slug: 'tee',
			currency: 'usd',
			type: 'physical',
			active: true,
			printfulVariantId: 9
		});
		await createProduct(db, { slug: 'hidden', name: 'Hidden', priceCents: 1, active: false });

		expect(await getProduct(db, 'tee')).toMatchObject({ id: tee.id });
		expect(await getProduct(db, tee.id)).toMatchObject({ slug: 'tee' });
		expect(await getProduct(db, 'nope')).toBeNull();
		expect((await listProducts(db)).map((p) => p.slug)).toEqual(['tee']);
		expect(await listProducts(db, { includeInactive: true, limit: 9999 })).toHaveLength(2);

		const updated = await updateProduct(db, tee.id, {
			priceCents: 3000,
			active: false,
			imageUrl: 'https://x.test/a.png'
		});
		expect(updated).toMatchObject({
			priceCents: 3000,
			active: false,
			imageUrl: 'https://x.test/a.png'
		});
		expect(await updateProduct(db, tee.id, {})).toMatchObject({ priceCents: 3000 });
		expect(await updateProduct(db, 'missing', { name: 'x' })).toBeNull();
		await updateProduct(db, tee.id, { active: true });

		expect(await deleteProduct(db, tee.id)).toBe(true);
		expect(await deleteProduct(db, tee.id)).toBe(false);
	});

	it('reports a taken slug as a conflict', async () => {
		const a = await createProduct(db, { slug: 'a', name: 'A', priceCents: 1 });
		await createProduct(db, { slug: 'b', name: 'B', priceCents: 1 });
		await expect(
			createProduct(db, { slug: 'a', name: 'A2', priceCents: 1 })
		).rejects.toBeInstanceOf(CommerceConflictError);
		await expect(updateProduct(db, a.id, { slug: 'b' })).rejects.toBeInstanceOf(
			CommerceConflictError
		);
	});

	it('passes through database errors that are not conflicts', async () => {
		await expect(
			createProduct(db, { slug: 'neg', name: 'Neg', priceCents: -5 })
		).rejects.not.toBeInstanceOf(CommerceConflictError);
		const p = await createProduct(db, { slug: 'ok', name: 'Ok', priceCents: 5 });
		await expect(updateProduct(db, p.id, { priceCents: -5 })).rejects.not.toBeInstanceOf(
			CommerceConflictError
		);
	});
});

describe('commerce store: orders', () => {
	async function placeOrder(withAddress = true) {
		const tee = await createProduct(db, { slug: 'tee', name: 'Tee', priceCents: 2500 });
		const cart = await priceCart([{ productId: tee.id, quantity: 2 }], (id) => getProduct(db, id), {
			shippingCents: 400
		});
		return createOrder(db, cart, {
			email: 'ada@example.com',
			shippingAddress: withAddress
				? { name: 'Ada', line1: '1 Main', city: 'X', postalCode: '1', country: 'US' }
				: null,
			paymentProvider: 'manual'
		});
	}

	it('writes an order with its lines, copying name and price', async () => {
		const order = await placeOrder();
		expect(order).toMatchObject({
			status: 'pending',
			subtotalCents: 5000,
			shippingCents: 400,
			totalCents: 5400,
			paymentProvider: 'manual',
			shippingAddress: { name: 'Ada' }
		});
		expect(order.items).toEqual([
			expect.objectContaining({
				name: 'Tee',
				unitPriceCents: 2500,
				quantity: 2,
				lineTotalCents: 5000
			})
		]);
		expect(await getOrder(db, 'missing')).toBeNull();
	});

	it('lists orders, optionally by status', async () => {
		const order = await placeOrder(false);
		expect((await getOrder(db, order.id))?.shippingAddress).toBeNull();
		expect(await listOrders(db)).toHaveLength(1);
		expect(await listOrders(db, { status: 'paid', limit: 0 })).toHaveLength(0);
		expect((await listOrders(db, { status: 'pending' }))[0].items).toEqual([]);
	});

	it('moves orders only along allowed transitions and keeps references', async () => {
		const order = await placeOrder();
		const paid = await transitionOrder(db, order.id, 'paid', { paymentReference: 'cs_1' });
		expect(paid).toMatchObject({ status: 'paid', paymentReference: 'cs_1' });
		const fulfilling = await transitionOrder(db, order.id, 'fulfilling', {
			fulfillmentReference: 'pf_1'
		});
		expect(fulfilling).toMatchObject({ paymentReference: 'cs_1', fulfillmentReference: 'pf_1' });
		await expect(transitionOrder(db, order.id, 'pending')).rejects.toThrow(
			'cannot move from fulfilling to pending'
		);
		expect(await transitionOrder(db, 'missing', 'paid')).toBeNull();
	});

	it('refuses a transition when the order changed underneath it', async () => {
		const order = await placeOrder();
		const racing = {
			prepare: (sql: string) => {
				const stmt = db.prepare(sql);
				if (!sql.trim().startsWith('UPDATE commerce_orders')) return stmt;
				return {
					bind: () => ({ run: async () => ({ success: true, meta: { changes: 0 } }) })
				};
			}
		} as unknown as D1Database;
		await expect(transitionOrder(racing, order.id, 'paid')).rejects.toThrow('changed while');
	});

	it('keeps a corrupt address from breaking the order read', async () => {
		const order = await placeOrder();
		await db
			.prepare("UPDATE commerce_orders SET shipping_address = '{bad' WHERE id = ?")
			.bind(order.id)
			.run();
		expect((await getOrder(db, order.id))?.shippingAddress).toBeNull();
	});
});
