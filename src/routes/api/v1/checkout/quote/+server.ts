import { validateQuoteInput } from '@nebulakit/commerce';
import { apiJson, invalid, readJson, siteApi } from '$lib/server/site-api';
import { priceCheckout, requestCountry } from '$lib/server/checkout-pricing';
import type { CommerceEnv } from '$lib/server/site-info';

/**
 * POST /api/v1/checkout/quote — public: what a cart would cost, without
 * placing an order. Priced by the same code as checkout, so the figure shown
 * is the figure charged (the shipping country is the one thing it may not
 * know yet; a country that is less generous raises the price at checkout,
 * and `regional.countries` says which countries were considered).
 *
 * Body: `{ lines: [{ productId, quantity }], shippingCountry? }`.
 */
export const POST = siteApi(null, async ({ db, event }) => {
	const env = (event.platform?.env ?? {}) as CommerceEnv;
	const parsed = validateQuoteInput(await readJson(event));
	if (!parsed.ok) throw invalid(parsed.errors);
	const { cart, regional, discountPercent, notice } = await priceCheckout(db, env, {
		lines: parsed.value.lines,
		requestCountry: requestCountry(event),
		shippingCountry: parsed.value.shippingCountry
	});
	return apiJson({
		quote: {
			currency: cart.currency,
			lines: cart.lines.map((line) => ({
				productId: line.product.id,
				quantity: line.quantity,
				unitPriceCents: line.unitPriceCents,
				baseUnitPriceCents: line.baseUnitPriceCents,
				lineTotalCents: line.lineTotalCents
			})),
			subtotalCents: cart.subtotalCents,
			baseSubtotalCents: cart.baseSubtotalCents,
			shippingCents: cart.shippingCents,
			taxCents: cart.taxCents,
			totalCents: cart.totalCents,
			regional: regional && { ...regional, discountPercent, notice }
		}
	});
});
