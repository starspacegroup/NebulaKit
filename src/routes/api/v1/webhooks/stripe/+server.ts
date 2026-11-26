import {
	processStripeEvent,
	STRIPE_EVENT_ID,
	verifiedStripeEmail,
	verifyStripeSignature
} from '@nebulakit/commerce';
import { ApiError, apiJson, siteApi } from '$lib/server/site-api';
import type { CommerceEnv } from '$lib/server/site-info';
import { sendOrderReceipt } from '$lib/server/order-emails';

/**
 * POST /api/v1/webhooks/stripe — Stripe tells the site what happened to a payment.
 *
 * The only thing that marks an order paid. The shopper's return to `/cart?order=…`, and the card
 * form's own "succeeded", only start a status poll.
 *
 * Authenticated by the `Stripe-Signature` HMAC under `STRIPE_WEBHOOK_SECRET` (or, while rolling
 * the secret or changing accounts, `STRIPE_WEBHOOK_SECRET_PREVIOUS`), checked in constant time
 * with a 5-minute timestamp tolerance; not by an API key. Without the secret it answers 503 so
 * Stripe keeps retrying until the site is configured (fails closed: nothing is applied).
 *
 * A verified event is applied once per event id (`processStripeEvent`, payment-events.ts), and
 * what it does is the proved state machine in stripe-events.ts / dafny/PaymentCore.dfy:
 *
 * - `checkout.session.completed` / `async_payment_succeeded` (paid) and
 *   `payment_intent.succeeded`: a pending order becomes `paid`, the receipt is sent once.
 * - `checkout.session.async_payment_failed` / `expired` and `payment_intent.canceled`: a pending
 *   order becomes `cancelled`.
 * - `payment_intent.payment_failed` and `charge.refunded`: recorded on the order's payment
 *   history; the status does not change.
 *
 * Always 200 for a verified event this site is done with, so Stripe stops retrying; 503 when the
 * order's repricing is still being written (Stripe redelivers).
 */
export const POST = siteApi(null, async ({ db, event }) => {
	const env = (event.platform?.env ?? {}) as CommerceEnv;
	if (!env.STRIPE_WEBHOOK_SECRET) throw new ApiError(503, 'Stripe is not configured');
	const payload = await event.request.text();
	const signature = event.request.headers.get('stripe-signature');
	const secrets = [env.STRIPE_WEBHOOK_SECRET, env.STRIPE_WEBHOOK_SECRET_PREVIOUS].filter(
		(secret): secret is string => !!secret
	);
	let signed = false;
	for (const secret of secrets) {
		if (await verifyStripeSignature(payload, signature, secret)) {
			signed = true;
			break;
		}
	}
	if (!signed) throw new ApiError(400, 'Invalid signature');

	let stripeEvent;
	try {
		stripeEvent = JSON.parse(payload);
	} catch {
		throw new ApiError(400, 'Invalid payload');
	}
	if (
		typeof stripeEvent !== 'object' ||
		stripeEvent === null ||
		typeof stripeEvent.id !== 'string' ||
		!STRIPE_EVENT_ID.test(stripeEvent.id)
	) {
		throw new ApiError(400, 'Invalid payload');
	}

	const result = await processStripeEvent(db, stripeEvent);
	if (result.outcome === 'duplicate') return apiJson({ received: true, duplicate: true });
	if (result.outcome === 'retry') {
		// The order's repricing has not landed yet; Stripe will deliver this again.
		throw new ApiError(503, 'Not ready for this event yet');
	}
	if (result.outcome === 'ignored') {
		if (['amount-mismatch', 'order-cancelled', 'stale-revision'].includes(result.reason)) {
			// Money and order disagree; a person has to look. Ids only, no PII.
			console.error('stripe webhook: needs attention', {
				reason: result.reason,
				event: stripeEvent.id,
				object: stripeEvent.data?.object?.id
			});
		}
		return apiJson({ received: true, ignored: true });
	}
	if (result.outcome === 'paid' && result.changed) {
		// Not awaited: the response must not wait on the email provider.
		void sendOrderReceipt(event.platform, result.order, verifiedStripeEmail(stripeEvent));
	}
	return apiJson({ received: true });
});
