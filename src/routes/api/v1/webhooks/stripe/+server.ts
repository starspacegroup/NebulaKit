import { getOrder, transitionOrder, verifyStripeSignature } from '@nebulakit/commerce';
import { ApiError, apiJson, siteApi } from '$lib/server/site-api';
import type { CommerceEnv } from '$lib/server/site-info';

interface StripeEvent {
	type?: string;
	data?: { object?: { id?: string; payment_status?: string; metadata?: { orderId?: string } } };
}

/**
 * POST /api/v1/webhooks/stripe — Stripe tells the site a checkout finished.
 *
 * Authenticated by the `Stripe-Signature` HMAC under `STRIPE_WEBHOOK_SECRET`,
 * not by an API key. Marks the order paid only when the session is actually
 * paid (delayed methods complete unpaid) and only when the session id is the
 * one this site recorded for that order — metadata alone is not trusted.
 * Replays are harmless: an order that is already past `pending` is left alone.
 */
export const POST = siteApi(null, async ({ db, event }) => {
	const env = (event.platform?.env ?? {}) as CommerceEnv;
	if (!env.STRIPE_WEBHOOK_SECRET) throw new ApiError(503, 'Stripe is not configured');
	const payload = await event.request.text();
	const signed = await verifyStripeSignature(
		payload,
		event.request.headers.get('stripe-signature'),
		env.STRIPE_WEBHOOK_SECRET
	);
	if (!signed) throw new ApiError(400, 'Invalid signature');

	let stripeEvent: StripeEvent;
	try {
		stripeEvent = JSON.parse(payload);
	} catch {
		throw new ApiError(400, 'Invalid payload');
	}
	const session = stripeEvent.data?.object;
	if (stripeEvent.type !== 'checkout.session.completed' || session?.payment_status !== 'paid') {
		return apiJson({ received: true, ignored: true });
	}
	const order = session.metadata?.orderId ? await getOrder(db, session.metadata.orderId) : null;
	if (!order || order.paymentReference !== session.id) {
		return apiJson({ received: true, ignored: true });
	}
	if (order.status === 'pending') await transitionOrder(db, order.id, 'paid');
	return apiJson({ received: true });
});
