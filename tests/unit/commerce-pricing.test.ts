import { describe, expect, it } from 'vitest';
import {
	calculateTaxCents,
	calculateTotalCents,
	canTransition,
	CommercePricingError,
	formatMoney,
	isOrderStatus,
	nextStatuses,
	NO_TAX,
	priceCart,
	regionalPriceCents,
	type Product
} from '@nebulakit/commerce';

function product(overrides: Partial<Product> = {}): Product {
	return {
		id: 'p1',
		slug: 'tee',
		name: 'Tee',
		description: '',
		priceCents: 2500,
		currency: 'usd',
		imageUrl: null,
		type: 'physical',
		printfulVariantId: null,
		active: true,
		createdAt: '',
		updatedAt: '',
		...overrides
	};
}

const catalog = new Map<string, Product>([
	['p1', product()],
	['p2', product({ id: 'p2', slug: 'mug', name: 'Mug', priceCents: 1299 })],
	['off', product({ id: 'off', active: false })],
	['eur', product({ id: 'eur', currency: 'eur' })]
]);
const lookup = async (id: string) => catalog.get(id) ?? null;

describe('commerce money', () => {
	it('adds exclusive tax and extracts inclusive tax', () => {
		const exclusive = { enabled: true, ratePercent: 8.25, pricesIncludeTax: false };
		const inclusive = { enabled: true, ratePercent: 20, pricesIncludeTax: true };
		expect(calculateTaxCents(10000, exclusive)).toBe(825);
		expect(calculateTaxCents(12000, inclusive)).toBe(2000);
		expect(calculateTotalCents(10000, 500, 825, exclusive)).toBe(11325);
		expect(calculateTotalCents(12000, 500, 2000, inclusive)).toBe(12500);
		expect(calculateTotalCents(100, 0, 0)).toBe(100);
	});

	it('charges no tax for a disabled, corrupt or missing rule', () => {
		expect(calculateTaxCents(10000)).toBe(0);
		expect(calculateTaxCents(10000, NO_TAX)).toBe(0);
		expect(
			calculateTaxCents(10000, { enabled: true, ratePercent: 150, pricesIncludeTax: false })
		).toBe(0);
		expect(
			calculateTaxCents(10000, { enabled: true, ratePercent: NaN, pricesIncludeTax: false })
		).toBe(0);
		expect(calculateTaxCents(0, { enabled: true, ratePercent: 5, pricesIncludeTax: false })).toBe(
			0
		);
		expect(calculateTaxCents(1.5, { enabled: true, ratePercent: 5, pricesIncludeTax: false })).toBe(
			0
		);
	});

	it('lowers prices by a regional multiplier but never raises them', () => {
		expect(regionalPriceCents(2500, 0.4)).toBe(1000);
		expect(regionalPriceCents(2500, 1.3)).toBe(2500);
		expect(regionalPriceCents(2500, 0)).toBe(2500);
		expect(regionalPriceCents(2500, NaN)).toBe(2500);
	});

	it('formats cents as currency', () => {
		expect(formatMoney(1299)).toBe('$12.99');
		expect(formatMoney(1000, 'eur', 'en-US')).toBe('€10.00');
	});
});

describe('priceCart', () => {
	it('prices from the catalog, never from the cart', async () => {
		const cart = await priceCart(
			[{ productId: 'p1', quantity: 2, price: 1 } as never, { productId: 'p2', quantity: 1 }],
			lookup,
			{ taxRule: { enabled: true, ratePercent: 10, pricesIncludeTax: false }, shippingCents: 500 }
		);
		expect(cart.subtotalCents).toBe(6299);
		expect(cart.taxCents).toBe(630);
		expect(cart.totalCents).toBe(7429);
		expect(cart.currency).toBe('usd');
		expect(cart.lines[0]).toMatchObject({ unitPriceCents: 2500, lineTotalCents: 5000 });
	});

	it('applies a regional multiplier', async () => {
		const cart = await priceCart([{ productId: 'p1', quantity: 1 }], lookup, {
			regionalMultiplier: 0.5
		});
		expect(cart.totalCents).toBe(1250);
		expect(cart.taxRule).toBe(NO_TAX);
	});

	it.each([
		[[], 'Cart is empty'],
		[[{ productId: 'p1', quantity: 0 }], 'Quantity'],
		[[{ productId: 'p1', quantity: 1000 }], 'Quantity'],
		[[{ productId: 'p1', quantity: 1.5 }], 'Quantity'],
		[[{ productId: '', quantity: 1 }], 'missing a product'],
		[[{ productId: 'nope', quantity: 1 }], 'Unknown product'],
		[[{ productId: 'off', quantity: 1 }], 'Unknown product'],
		[
			[
				{ productId: 'p1', quantity: 1 },
				{ productId: 'eur', quantity: 1 }
			],
			'mixes currencies'
		],
		[Array.from({ length: 101 }, () => ({ productId: 'p1', quantity: 1 })), 'Too many']
	])('refuses a bad cart %#', async (lines, message) => {
		await expect(priceCart(lines as never, lookup)).rejects.toThrow(message);
	});

	it('refuses a bad shipping cost and a non-array cart', async () => {
		await expect(
			priceCart([{ productId: 'p1', quantity: 1 }], lookup, { shippingCents: -1 })
		).rejects.toBeInstanceOf(CommercePricingError);
		await expect(priceCart(null as never, lookup)).rejects.toThrow('Cart is empty');
	});
});

describe('order status machine', () => {
	it('allows forward moves and cancellation before shipping only', () => {
		expect(canTransition('pending', 'paid')).toBe(true);
		expect(canTransition('fulfilling', 'cancelled')).toBe(true);
		expect(canTransition('shipped', 'cancelled')).toBe(false);
		expect(canTransition('cancelled', 'paid')).toBe(false);
		expect(nextStatuses('delivered')).toEqual([]);
		expect(isOrderStatus('paid')).toBe(true);
		expect(isOrderStatus('refunded')).toBe(false);
		expect(isOrderStatus(3)).toBe(false);
	});
});
