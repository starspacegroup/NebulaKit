import { isOrderStatus, listOrders } from '@nebulakit/commerce';
import { ApiError, apiJson, siteApi } from '$lib/server/site-api';

/** GET /api/v1/orders?status=paid&limit=50 — newest first, totals only. */
export const GET = siteApi('orders:read', async ({ db, event }) => {
	const status = event.url.searchParams.get('status');
	if (status !== null && !isOrderStatus(status)) throw new ApiError(400, 'Unknown order status');
	const limit = Number(event.url.searchParams.get('limit') ?? 50) || 50;
	return apiJson({ orders: await listOrders(db, { status: status ?? undefined, limit }) });
});
