import {
	applyStripeEvent,
	CommerceConflictError,
	getOrder,
	lapseAuction,
	stripePayments
} from '@nebulakit/commerce';
import { clientAddress } from '$lib/server/login-throttle';
import { CANCEL_LIMITS, hitLimits } from '$lib/server/request-limit';
import { ApiError, apiJson, invalid, notFound, readJson, siteApi } from '$lib/server/site-api';
import type { CommerceEnv } from '$lib/server/site-info';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/v1/checkout/cancel — public: a shopper backs out of an order they have not paid.
 * Ported from PinFool.
 *
 * Body: `{ orderId }`. The id is the key, as it is for the order's status poll: it is random and
 * only the shopper who placed the order has it.
 *
 * Order of work matters, because money is involved:
 * 1. Stripe is asked to close the payment (cancel an on-page PaymentIntent, expire a hosted
 *    Checkout Session). Once closed it can never be paid.
 * 2. Only then is the order cancelled here, by the same code that handles Stripe's own
 *    `payment_intent.canceled` / `checkout.session.expired`, so that notice arriving later changes
 *    nothing.
 * 3. What the order was holding is released. The template keeps no stock counts, so the one hold
 *    is an auction's: a winner who backs out lapses the auction (the owner can relist it), exactly
 *    as an unpaid deadline would.
 * If Stripe says the payment cannot be closed (it was paid, or is being paid), the order is left
 * alone and the answer is 409: the shopper is shown their paid order instead.
 */
export const POST = siteApi(null, async ({ db, event }) => {
	const env = (event.platform?.env ?? {}) as CommerceEnv;
	const body = (await readJson(event)) as { orderId?: unknown } | null;
	const orderId = typeof body?.orderId === 'string' ? body.orderId : '';
	if (!UUID.test(orderId)) throw invalid(['orderId must be an order id']);

	const limit = await hitLimits(db, CANCEL_LIMITS, clientAddress(event.request));
	if (!limit.allowed) throw new ApiError(429, 'Too many requests. Please try again in a while.');

	const order = await getOrder(db, orderId);
	if (!order) throw notFound('Order');
	if (order.status === 'cancelled') return apiJson({ status: 'cancelled' });
	if (order.status !== 'pending') throw new ApiError(409, 'This order has already been paid.');
	// Only an order waiting on a Stripe payment is backed out of here.
	if (order.paymentProvider !== 'stripe' || !order.paymentReference || !env.STRIPE_SECRET_KEY) {
		throw new ApiError(409, 'This order cannot be cancelled here. Please contact the shop.');
	}
	const closed = await stripePayments(env.STRIPE_SECRET_KEY).expirePayment(order.paymentReference);
	if (!closed) throw new ApiError(409, 'This order has already been paid.');

	const result = await applyStripeEvent(db, {
		type: order.paymentReference.startsWith('pi_')
			? 'payment_intent.canceled'
			: 'checkout.session.expired',
		data: { object: { id: order.paymentReference, metadata: { orderId: order.id } } }
	});
	const status = result.outcome === 'cancelled' ? 'cancelled' : order.status;

	if (status === 'cancelled') {
		const auction = await db
			.prepare("SELECT id FROM commerce_auctions WHERE order_id = ? AND status = 'sold'")
			.bind(order.id)
			.first<{ id: string }>();
		if (auction) {
			try {
				await lapseAuction(db, auction.id);
			} catch (err) {
				// Already lapsed or moved by the deadline sweep: the hold is gone either way.
				if (!(err instanceof CommerceConflictError)) throw err;
			}
		}
	}
	return apiJson({ status });
});
