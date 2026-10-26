/**
 * Server-side pricing of a cart.
 *
 * Ported from Ammoura's `repriceCheckout` (2026-10-18). The cart lives in the
 * browser, so a checkout request arrives with its own idea of what things
 * cost; none of it is trusted. A cart line names a product and a quantity and
 * nothing else — every price is read from the catalog here.
 */
import {
	calculateTaxCents,
	calculateTotalCents,
	isCents,
	NO_TAX,
	regionalPriceCents,
	type TaxRule
} from './money';
import type { Product } from './types';

export interface CartLine {
	productId: string;
	quantity: number;
}

export interface PricedLine {
	product: Product;
	quantity: number;
	/** What is charged per unit, after any regional discount. */
	unitPriceCents: number;
	/** The catalog price, before any regional discount. */
	baseUnitPriceCents: number;
	lineTotalCents: number;
}

export interface PricedCart {
	lines: PricedLine[];
	currency: string;
	subtotalCents: number;
	/** The subtotal at catalog prices; equals `subtotalCents` when nothing was lowered. */
	baseSubtotalCents: number;
	shippingCents: number;
	taxCents: number;
	totalCents: number;
	taxRule: TaxRule;
}

export interface PricingOptions {
	taxRule?: TaxRule;
	shippingCents?: number;
	/** The shopper's regional (PPP) multiplier. Only ever lowers a price (see `regionalPriceCents`). */
	regionalMultiplier?: number;
	/** Which products the multiplier covers; `all` unless the site's settings say `digital`. */
	regionalScope?: 'digital' | 'all';
}

export class CommercePricingError extends Error {
	readonly status = 400;
}

export const MAX_QUANTITY = 999;
export const MAX_CART_LINES = 100;

export async function priceCart(
	lines: CartLine[],
	lookup: (productId: string) => Promise<Product | null>,
	options: PricingOptions = {}
): Promise<PricedCart> {
	const taxRule = options.taxRule ?? NO_TAX;
	const shippingCents = options.shippingCents ?? 0;
	if (!isCents(shippingCents)) throw new CommercePricingError('Invalid shipping cost');
	if (!Array.isArray(lines) || lines.length === 0) throw new CommercePricingError('Cart is empty');
	if (lines.length > MAX_CART_LINES) throw new CommercePricingError('Too many cart lines');

	const priced: PricedLine[] = [];
	let currency: string | null = null;
	for (const line of lines) {
		const quantity = line?.quantity;
		if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
			throw new CommercePricingError(`Quantity must be a whole number from 1 to ${MAX_QUANTITY}`);
		}
		if (typeof line.productId !== 'string' || !line.productId) {
			throw new CommercePricingError('Cart line is missing a product');
		}
		const product = await lookup(line.productId);
		if (!product || !product.active) {
			throw new CommercePricingError(`Unknown product "${line.productId}"`);
		}
		// One order is charged in one currency; a mixed cart is a corrupt one.
		if (currency && product.currency !== currency) {
			throw new CommercePricingError('Cart mixes currencies');
		}
		currency = product.currency;
		const covered = (options.regionalScope ?? 'all') === 'all' || product.type === 'digital';
		const unitPriceCents = covered
			? regionalPriceCents(product.priceCents, options.regionalMultiplier ?? 1)
			: product.priceCents;
		priced.push({
			product,
			quantity,
			unitPriceCents,
			baseUnitPriceCents: product.priceCents,
			lineTotalCents: unitPriceCents * quantity
		});
	}

	const subtotalCents = priced.reduce((sum, line) => sum + line.lineTotalCents, 0);
	const baseSubtotalCents = priced.reduce(
		(sum, line) => sum + line.baseUnitPriceCents * line.quantity,
		0
	);
	const taxCents = calculateTaxCents(subtotalCents, taxRule);
	return {
		lines: priced,
		currency: currency as string,
		subtotalCents,
		baseSubtotalCents,
		shippingCents,
		taxCents,
		totalCents: calculateTotalCents(subtotalCents, shippingCents, taxCents, taxRule),
		taxRule
	};
}
