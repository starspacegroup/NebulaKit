import { getOrder, isOrderStatus, transitionOrder } from '@nebulakit/commerce';
import { sendOrderReceipt, sendOrderShipped } from '$lib/server/order-emails';
import { apiJson, invalid, notFound, readJson, siteApi } from '$lib/server/site-api';

/** GET /api/v1/orders/:id — one order with its lines. */
export const GET = siteApi('orders:read', async ({ db, event }) => {
	const order = await getOrder(db, event.params.id as string);
	if (!order) throw notFound('Order');
	return apiJson({ order });
});

function optionalRef(value: unknown): string | undefined | false {
	if (value === undefined) return undefined;
	return typeof value === 'string' && value.length > 0 && value.length <= 200 ? value : false;
}

/**
 * PATCH /api/v1/orders/:id — `{ status, paymentReference?, fulfillmentReference? }`.
 * Only the moves in packages/commerce/src/orders.ts are allowed (409 otherwise).
 */
export const PATCH = siteApi('orders:write', async ({ db, event }) => {
	const body = (await readJson(event)) as Record<string, unknown> | null;
	const status = body?.status;
	const paymentReference = optionalRef(body?.paymentReference);
	const fulfillmentReference = optionalRef(body?.fulfillmentReference);
	const errors: string[] = [];
	if (!isOrderStatus(status)) errors.push('status must be an order status');
	if (paymentReference === false) errors.push('paymentReference must be text');
	if (fulfillmentReference === false) errors.push('fulfillmentReference must be text');
	if (errors.length) throw invalid(errors);
	const order = await transitionOrder(db, event.params.id as string, status as never, {
		paymentReference: paymentReference || undefined,
		fulfillmentReference: fulfillmentReference || undefined
	});
	if (!order) throw notFound('Order');
	// A legal move happens once (shipped cannot be re-entered), and email_log
	// refuses a repeat regardless. Manual-payment shops get their receipt here.
	if (order.status === 'paid') void sendOrderReceipt(event.platform, order);
	if (order.status === 'shipped') void sendOrderShipped(event.platform, order);
	return apiJson({ order });
});
