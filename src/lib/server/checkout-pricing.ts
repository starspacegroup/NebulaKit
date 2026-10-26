/**
 * One place that prices a checkout, shared by `POST /api/v1/checkout` (which
 * charges it) and `POST /api/v1/checkout/quote` (which only shows it), so the
 * total a shopper is quoted is the total they are charged.
 *
 * Regional (purchasing-power) pricing is applied here, on the server, from
 * countries the server found out for itself: Cloudflare's view of the
 * request and the shipping address. Nothing about price or country in a
 * request body is trusted beyond the shipping address the shopper typed, and
 * that can only ever raise the multiplier (least generous country wins).
 */
import type { D1Database, IncomingRequestCfProperties } from '@cloudflare/workers-types';
import {
	getProduct,
	getRegionalPricingSettings,
	normalizeCountry,
	orderMultiplier,
	priceCart,
	regionalNotice,
	type CartLine,
	type OrderRegionalPricing,
	type PricedCart
} from '@nebulakit/commerce';
import { flatShippingFromEnv, taxRuleFromEnv, type CommerceEnv } from './site-info';

/**
 * The country Cloudflare sees the request coming from: the edge-provided
 * `cf.country`, or the `cf-ipcountry` header it also sets. Null off
 * Cloudflare (local dev, tests) and for anonymised origins (`XX`, `T1`),
 * which regional pricing treats as full price.
 */
export function requestCountry(event: {
	request: Request;
	platform?: { cf?: Pick<IncomingRequestCfProperties, 'country'> } | undefined;
}): string | null {
	return (
		normalizeCountry(event.platform?.cf?.country) ??
		normalizeCountry(event.request.headers.get('cf-ipcountry'))
	);
}

export interface PricedCheckout {
	cart: PricedCart;
	needsShipping: boolean;
	/** Null when regional pricing is off, in which case nothing here differs from the catalog. */
	regional: OrderRegionalPricing | null;
	/** Whole percent off the catalog price that was applied (0 when none). */
	discountPercent: number;
	notice: string | null;
}

export async function priceCheckout(
	db: D1Database,
	env: CommerceEnv,
	input: {
		lines: CartLine[];
		requestCountry: string | null;
		/** `undefined`: no shipping country yet or none needed. A string: the address's country. */
		shippingCountry?: string;
	}
): Promise<PricedCheckout> {
	const settings = await getRegionalPricingSettings(db);
	const sources: Record<string, string | null> = { request: input.requestCountry };
	if (input.shippingCountry !== undefined) {
		sources.shipping = normalizeCountry(input.shippingCountry);
	}
	const multiplier = orderMultiplier(settings, Object.values(sources));
	const base = {
		taxRule: taxRuleFromEnv(env),
		regionalMultiplier: multiplier,
		regionalScope: settings.scope
	};
	const lookup = (id: string) => getProduct(db, id);

	let cart = await priceCart(input.lines, lookup, base);
	const needsShipping = cart.lines.some((line) => line.product.type === 'physical');
	if (needsShipping) {
		cart = await priceCart(input.lines, lookup, {
			...base,
			shippingCents: flatShippingFromEnv(env)
		});
	}

	// "What was lowered" is read off the priced lines, so a scope that covers
	// no product in this cart reports 0% instead of a discount nobody got.
	const discountPercent =
		cart.baseSubtotalCents > cart.subtotalCents
			? Math.round((1 - cart.subtotalCents / cart.baseSubtotalCents) * 100)
			: 0;
	return {
		cart,
		needsShipping,
		regional: settings.enabled
			? { multiplier, countries: sources, baseSubtotalCents: cart.baseSubtotalCents }
			: null,
		discountPercent,
		notice: regionalNotice(discountPercent)
	};
}
