import {
	applyStripeEvent,
	createOrder,
	manualPayments,
	setPaymentReference,
	stripePayments,
	validateCheckoutInput
} from '@nebulakit/commerce';
import { clientAddress } from '$lib/server/login-throttle';
import { CHECKOUT_LIMITS, hitLimits, pruneLimits } from '$lib/server/request-limit';
import { ApiError, apiJson, invalid, readJson, siteApi } from '$lib/server/site-api';
import { priceCheckout, requestCountry } from '$lib/server/checkout-pricing';
import { resolveCheckout } from '$lib/server/checkout-mode';
import {
	CheckoutClosedError,
	closeStalePayments,
	onPageCheckout
} from '$lib/server/onpage-checkout';
import type { CommerceEnv } from '$lib/server/site-info';
import type { Order } from '@nebulakit/commerce';

/**
 * POST /api/v1/checkout — public: a shopper places an order.
 *
 * Body: `{ email, lines: [{ productId, quantity }], shippingAddress?, onSite?, checkoutKey? }`.
 * Prices, tax and shipping are all computed here from the catalog and the
 * site's deployed settings — nothing about money is read from the body, and
 * any price, total or amount field in it is ignored.
 * With regional pricing on, the multiplier comes from the countries the
 * server finds for itself (the request's, the shipping address's) and is
 * recorded on the order.
 *
 * How it is paid (src/lib/server/checkout-mode.ts, docs/CHECKOUT.md):
 * - `onSite: true` from the site's own cart, with on-page checkout configured:
 *   one order and one Stripe PaymentIntent per `checkoutKey`; the answer's
 *   `payment.clientSecret` is confirmed by Stripe.js in the cart. 201 when
 *   this request made the order, 200 when it found the key's order (repriced
 *   if the cart changed). 409 with `orderStatus` when that checkout is over.
 * - Otherwise with `STRIPE_SECRET_KEY`: a hosted Stripe Checkout Session; the
 *   answer's `payment.redirectUrl` is Stripe's page.
 * - Without it: the order waits for a manual payment.
 * The order is marked paid only by the signed Stripe webhook, never by this
 * route or by the shopper coming back.
 *
 * Limited per client address (request-limit.ts): an order writes up to a
 * hundred rows and opens a live Stripe payment.
 */
export const POST = siteApi(null, async ({ db, event }) => {
	const env = (event.platform?.env ?? {}) as CommerceEnv;
	const parsed = validateCheckoutInput(await readJson(event));
	if (!parsed.ok) throw invalid(parsed.errors);
	const { email, lines, shippingAddress, onSite, checkoutKey } = parsed.value;

	// Counted before any pricing, so a refused client costs one statement per limit.
	const limit = await hitLimits(db, CHECKOUT_LIMITS, clientAddress(event.request));
	if (!limit.allowed) {
		throw new ApiError(429, 'Too many orders from this connection. Please try again in a while.');
	}
	event.platform?.context?.waitUntil?.(pruneLimits(db));

	const { cart, needsShipping, regional } = await priceCheckout(db, env, {
		lines,
		requestCountry: requestCountry(event),
		shippingCountry: shippingAddress?.country
	});
	if (needsShipping && !shippingAddress) {
		throw invalid(['shippingAddress is required for physical products']);
	}

	const config = await resolveCheckout(db, env);
	if (onSite && config.provider === 'stripe' && config.publishableKey) {
		if (!checkoutKey) throw invalid(['checkoutKey is required to pay on this page']);
		const stripe = stripePayments(env.STRIPE_SECRET_KEY as string);
		let result;
		try {
			result = await onPageCheckout(db, stripe, {
				checkoutKey,
				cart,
				email,
				shippingAddress,
				regional
			});
		} catch (err) {
			if (err instanceof CheckoutClosedError) {
				return apiJson(
					{ error: err.message, orderId: err.orderId, orderStatus: err.orderStatus },
					409
				);
			}
			throw err;
		}
		// On-page payments never finished (a declined card, a shopper who left) do not close by
		// themselves as Stripe's hosted page does: a few old ones are closed on each order.
		event.platform?.context?.waitUntil?.(
			closeStalePayments(db, stripe, (stale) => applyStripeEvent(db, stale))
		);
		return apiJson(
			{
				order: summary(result.order),
				payment: {
					provider: 'stripe',
					reference: result.order.paymentReference,
					redirectUrl: null,
					clientSecret: result.clientSecret
				}
			},
			result.created ? 201 : 200
		);
	}

	const provider =
		config.provider === 'stripe' ? stripePayments(env.STRIPE_SECRET_KEY as string) : manualPayments;
	const order = await createOrder(db, cart, {
		email,
		shippingAddress,
		paymentProvider: provider.name,
		regional
	});
	// A provider failure (PaymentProviderError, 502) leaves the order `pending`
	// with no reference: visible to the owner, harmless, and the shopper retries.
	const payment = await provider.createPayment(order, {
		successUrl: `${event.url.origin}/cart?order=${order.id}`,
		cancelUrl: `${event.url.origin}/cart`
	});
	await setPaymentReference(db, order.id, payment.reference);

	return apiJson({ order: summary(order), payment }, 201);
});

function summary(order: Order) {
	return {
		id: order.id,
		status: order.status,
		currency: order.currency,
		subtotalCents: order.subtotalCents,
		shippingCents: order.shippingCents,
		taxCents: order.taxCents,
		totalCents: order.totalCents,
		regional: order.regional
	};
}
