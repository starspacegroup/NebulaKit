import { getOrderStatus } from '@nebulakit/commerce';
import { apiJson, notFound, siteApi } from '$lib/server/site-api';

const ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/v1/orders/:id/status — public: `{ status }` and nothing else.
 *
 * The shopper's browser polls this after returning from the payment page,
 * because the webhook that marks the order paid can land after the redirect.
 * An order id is a random UUID, but it also sits in the return URL, so it must
 * not be a key to anything: this returns the status word only, never the
 * email, address, lines or totals. Those stay behind `orders:read`.
 */
export const GET = siteApi(null, async ({ db, event }) => {
	const id = event.params.id as string;
	// A malformed id is a 404 without touching the database.
	const status = ORDER_ID.test(id) ? await getOrderStatus(db, id) : null;
	if (!status) throw notFound('Order');
	return apiJson({ status });
});
