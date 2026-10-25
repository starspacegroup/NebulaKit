/**
 * The emails an order triggers. Each is once-only per order (`email_log`).
 * Neither throws; a failed email never fails the order change that caused it.
 */
import type { Order } from '@nebulakit/commerce';
import { orderReceipt, orderShipped } from '$lib/emails/templates';
import { sendEmailAfterResponse, type SendResult } from '$lib/server/email';

/** Receipt, sent when an order becomes paid. `to` is Stripe's verified address when known. */
export function sendOrderReceipt(
	platform: App.Platform | undefined,
	order: Order,
	to: string | null = null
): Promise<SendResult> {
	const rendered = orderReceipt(order);
	return sendEmailAfterResponse(platform, {
		to: to ?? order.email,
		...rendered,
		template: 'order-receipt',
		relatedType: 'order',
		relatedId: order.id
	});
}

/** Sent when an order is marked shipped. The fulfilment reference is shown as the tracking reference. */
export function sendOrderShipped(
	platform: App.Platform | undefined,
	order: Order
): Promise<SendResult> {
	const rendered = orderShipped(order, { reference: order.fulfillmentReference });
	return sendEmailAfterResponse(platform, {
		to: order.email,
		...rendered,
		template: 'order-shipped',
		relatedType: 'order',
		relatedId: order.id
	});
}
