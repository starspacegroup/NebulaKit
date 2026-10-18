import {
	createOrder,
	getProduct,
	manualPayments,
	priceCart,
	setPaymentReference,
	stripePayments,
	validateCheckoutInput
} from '@nebulakit/commerce';
import { apiJson, invalid, readJson, siteApi } from '$lib/server/site-api';
import { flatShippingFromEnv, taxRuleFromEnv, type CommerceEnv } from '$lib/server/site-info';

/**
 * POST /api/v1/checkout — public: a shopper places an order.
 *
 * Body: `{ email, lines: [{ productId, quantity }], shippingAddress? }`.
 * Prices, tax and shipping are all computed here from the catalog and the
 * site's deployed settings — nothing about money is read from the body.
 * Pays through Stripe when `STRIPE_SECRET_KEY` is set, otherwise the order
 * waits for a manual payment.
 */
export const POST = siteApi(null, async ({ db, event }) => {
	const env = (event.platform?.env ?? {}) as CommerceEnv;
	const parsed = validateCheckoutInput(await readJson(event));
	if (!parsed.ok) throw invalid(parsed.errors);
	const { email, lines, shippingAddress } = parsed.value;

	let cart = await priceCart(lines, (id) => getProduct(db, id), { taxRule: taxRuleFromEnv(env) });
	const needsShipping = cart.lines.some((line) => line.product.type === 'physical');
	if (needsShipping && !shippingAddress) {
		throw invalid(['shippingAddress is required for physical products']);
	}
	if (needsShipping) {
		cart = await priceCart(lines, (id) => getProduct(db, id), {
			taxRule: taxRuleFromEnv(env),
			shippingCents: flatShippingFromEnv(env)
		});
	}

	const provider = env.STRIPE_SECRET_KEY ? stripePayments(env.STRIPE_SECRET_KEY) : manualPayments;
	const order = await createOrder(db, cart, {
		email,
		shippingAddress,
		paymentProvider: provider.name
	});
	// A provider failure (PaymentProviderError, 502) leaves the order `pending`
	// with no reference: visible to the owner, harmless, and the shopper retries.
	const payment = await provider.createPayment(order, {
		successUrl: `${event.url.origin}/?order=${order.id}`,
		cancelUrl: `${event.url.origin}/`
	});
	await setPaymentReference(db, order.id, payment.reference);

	return apiJson(
		{
			order: {
				id: order.id,
				status: order.status,
				currency: order.currency,
				subtotalCents: order.subtotalCents,
				shippingCents: order.shippingCents,
				taxCents: order.taxCents,
				totalCents: order.totalCents
			},
			payment
		},
		201
	);
});
