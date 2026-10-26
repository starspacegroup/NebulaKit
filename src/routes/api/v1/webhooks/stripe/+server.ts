import { applyStripeEvent, verifiedStripeEmail, verifyStripeSignature } from '@nebulakit/commerce';
import { ApiError, apiJson, siteApi } from '$lib/server/site-api';
import type { CommerceEnv } from '$lib/server/site-info';
import { sendOrderReceipt } from '$lib/server/order-emails';

/**
 * POST /api/v1/webhooks/stripe — Stripe tells the site what happened to a checkout.
 *
 * Authenticated by the `Stripe-Signature` HMAC under `STRIPE_WEBHOOK_SECRET`
 * (checked in constant time, replay window 5 minutes), not by an API key.
 * Without the secret it answers 503 so Stripe keeps retrying until the site
 * is configured. What each event does is `applyStripeEvent` in
 * packages/commerce/src/stripe-events.ts:
 *
 * - `checkout.session.completed` / `async_payment_succeeded`, when paid: the
 *   order becomes `paid` and the receipt is sent (once only).
 * - `checkout.session.async_payment_failed` / `expired`: a still-`pending`
 *   order becomes `cancelled`.
 *
 * Replays change nothing a second time: only the delivery that moved the
 * order sends the receipt, and `email_log` refuses a second one regardless.
 * Always 200 for a verified event, so Stripe stops retrying events this site
 * has no use for.
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

	let stripeEvent;
	try {
		stripeEvent = JSON.parse(payload);
	} catch {
		throw new ApiError(400, 'Invalid payload');
	}
	if (typeof stripeEvent !== 'object' || stripeEvent === null) {
		throw new ApiError(400, 'Invalid payload');
	}

	const result = await applyStripeEvent(db, stripeEvent);
	if (result.outcome === 'ignored') {
		if (result.reason === 'amount-mismatch' || result.reason === 'order-cancelled') {
			// Money and order disagree; a person has to look. Ids only, no PII.
			console.error('stripe webhook: needs attention', {
				reason: result.reason,
				session: stripeEvent.data?.object?.id
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
