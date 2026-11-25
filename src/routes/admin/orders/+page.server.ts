import { error } from '@sveltejs/kit';
import { formatMoney, isOrderStatus, listOrders, ORDER_STATUSES } from '@nebulakit/commerce';
import { requirePermission } from '$lib/server/auth-guards';
import { isPiiRevealed, maskEmail, PII_REVEAL_COOKIE } from '$lib/server/pii-mask';
import type { PageServerLoad } from './$types';

/**
 * /admin/orders: the shop's orders, newest first, optionally one status. Read-only: an order is
 * marked paid by Stripe's signed webhook, and refunds are made in Stripe. Emails are masked unless
 * this admin may reveal PII and has switched it on.
 */
export const load: PageServerLoad = async ({ locals, platform, url, cookies }) => {
	requirePermission(locals, 'shop');
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'The site database is not available');
	const wanted = url.searchParams.get('status');
	const status = isOrderStatus(wanted) ? wanted : null;
	const reveal = isPiiRevealed(locals.user, cookies.get(PII_REVEAL_COOKIE));
	const orders = await listOrders(db, { status: status ?? undefined, limit: 200 });
	return {
		status,
		statuses: [...ORDER_STATUSES],
		orders: orders.map((o) => ({
			id: o.id,
			ref: o.id.slice(0, 8),
			status: o.status,
			email: reveal ? o.email : maskEmail(o.email),
			total: formatMoney(o.totalCents, o.currency),
			provider: o.paymentProvider ?? '—',
			created: o.createdAt
		}))
	};
};
