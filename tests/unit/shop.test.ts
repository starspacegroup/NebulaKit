import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { createProduct, updateProduct } from '@nebulakit/commerce';
import {
	CART_STORAGE_KEY,
	addToCart,
	cartCount,
	cartSubtotalCents,
	checkoutLines,
	loadCart,
	needsShipping,
	parseCart,
	removeFromCart,
	saveCart,
	setQuantity,
	type CartItem
} from '../../src/lib/shop/cart';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import * as shopList from '../../src/routes/shop/+page.server';
import * as shopProduct from '../../src/routes/shop/[slug]/+page.server';

const tee: CartItem = {
	productId: 'p1',
	slug: 'tee',
	name: 'Tee',
	unitPriceCents: 2500,
	currency: 'usd',
	physical: true,
	quantity: 1
};
const ebook: CartItem = { ...tee, productId: 'p2', slug: 'book', name: 'Book', physical: false };

describe('cart', () => {
	it('adds, merges, sets and removes lines', () => {
		let cart = addToCart([], tee);
		cart = addToCart(cart, { ...tee, quantity: 2 });
		expect(cart).toEqual([{ ...tee, quantity: 3 }]);
		cart = addToCart(cart, ebook);
		expect(cartCount(cart)).toBe(4);
		expect(cartSubtotalCents(cart)).toBe(2500 * 3 + 2500);
		expect(setQuantity(cart, 'p1', 5)[0].quantity).toBe(5);
		expect(setQuantity(cart, 'p1', 0).map((l) => l.productId)).toEqual(['p2']);
		expect(setQuantity(cart, 'p1', Number.NaN).map((l) => l.productId)).toEqual(['p2']);
		expect(removeFromCart(cart, 'p2')).toHaveLength(1);
		expect(checkoutLines(cart)).toEqual([
			{ productId: 'p1', quantity: 3 },
			{ productId: 'p2', quantity: 1 }
		]);
	});

	it('keeps quantities whole and within limits', () => {
		expect(addToCart([], { ...tee, quantity: 2.9 })[0].quantity).toBe(2);
		expect(addToCart([], { ...tee, quantity: -4 })[0].quantity).toBe(1);
		expect(addToCart([], { ...tee, quantity: 5000 })[0].quantity).toBe(999);
	});

	it('knows when a cart needs shipping', () => {
		expect(needsShipping([ebook])).toBe(false);
		expect(needsShipping([ebook, tee])).toBe(true);
	});

	it('reads stored carts defensively', () => {
		expect(parseCart(null)).toEqual([]);
		expect(parseCart('{nope')).toEqual([]);
		expect(parseCart('{"a":1}')).toEqual([]);
		expect(parseCart(JSON.stringify([tee, { productId: 'x' }, null, 4]))).toEqual([tee]);
		expect(parseCart(JSON.stringify([{ ...tee, quantity: 0 }]))).toEqual([]);
		expect(parseCart(JSON.stringify([{ ...tee, quantity: 1000 }]))).toEqual([]);
	});

	it('survives missing or throwing storage', () => {
		const store = new Map<string, string>();
		const storage = {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => void store.set(k, v)
		};
		saveCart(storage, [tee]);
		expect(store.has(CART_STORAGE_KEY)).toBe(true);
		expect(loadCart(storage)).toEqual([tee]);

		const broken = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			}
		};
		expect(loadCart(broken)).toEqual([]);
		expect(() => saveCart(broken, [tee])).not.toThrow();
		expect(loadCart(undefined)).toEqual([]);
		expect(() => saveCart(undefined, [tee])).not.toThrow();
	});
});

describe('/shop', () => {
	let db: D1Database;
	beforeEach(() => {
		db = createSqliteD1();
	});
	const event = (params: Record<string, string> = {}, env: object = { DB: db }) =>
		({ params, platform: { env } }) as never;
	const status = async (promise: unknown) => {
		try {
			await promise;
			return 'resolved';
		} catch (err) {
			return (err as { status: number }).status;
		}
	};

	it('lists active products with formatted prices', async () => {
		await createProduct(db, { slug: 'tee', name: 'Tee', priceCents: 2500 });
		const hidden = await createProduct(db, { slug: 'old', name: 'Old', priceCents: 100 });
		await updateProduct(db, hidden.id, { active: false });
		const data = (await shopList.load(event())) as {
			products: Array<{ slug: string; price: string }>;
		};
		expect(data.products.map((p) => [p.slug, p.price])).toEqual([['tee', '$25.00']]);
		expect(await status(shopList.load(event({}, {})))).toBe(503);
	});

	it('shows one active product by its slug and nothing else', async () => {
		const tee = await createProduct(db, {
			slug: 'tee',
			name: 'Tee',
			priceCents: 2500,
			type: 'physical'
		});
		const data = (await shopProduct.load(event({ slug: 'tee' }))) as {
			product: { id: string; price: string; physical: boolean };
		};
		expect(data.product).toMatchObject({ id: tee.id, price: '$25.00', physical: true });
		// A product id is not a URL for it.
		expect(await status(shopProduct.load(event({ slug: tee.id })))).toBe(404);
		expect(await status(shopProduct.load(event({ slug: 'none' })))).toBe(404);
		await updateProduct(db, tee.id, { active: false });
		expect(await status(shopProduct.load(event({ slug: 'tee' })))).toBe(404);
		expect(await status(shopProduct.load(event({ slug: 'tee' }, {})))).toBe(503);
	});
});
