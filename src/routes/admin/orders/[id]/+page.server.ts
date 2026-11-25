import { error } from '@sveltejs/kit';
import { formatMoney, getOrder, listOrderPaymentEvents } from '@nebulakit/commerce';
import { requirePermission } from '$lib/server/auth-guards';
import {
	isPiiRevealed,
	maskEmail,
	maskGeneric,
	maskName,
	PII_REVEAL_COOKIE
} from '$lib/server/pii-mask';
import type { PageServerLoad } from './$types';

/**
 * /admin/orders/[id]: one order — its lines, the server's totals, the regional pricing audit, and
 * its payment history as Stripe reported it (payments, declines, cancellations, refunds). Read-only:
 * status moves go through /api/v1/orders/[id], refunds are made in Stripe (the link opens its
 * search on the payment reference). Email and address are masked unless PII is revealed.
 */
export const load: PageServerLoad = async ({ params, locals, platform, cookies }) => {
	requirePermission(locals, 'shop');
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'The site database is not available');
	const order = await getOrder(db, params.id);
	if (!order) throw error(404, 'Order not found');
	const reveal = isPiiRevealed(locals.user, cookies.get(PII_REVEAL_COOKIE));
	const money = (minor: number, currency = order.currency) => formatMoney(minor, currency);
	const events = await listOrderPaymentEvents(db, order.id);
	const address = order.shippingAddress;
	return {
		order: {
			id: order.id,
			ref: order.id.slice(0, 8),
			status: order.status,
			email: reveal ? order.email : maskEmail(order.email),
			created: order.createdAt,
			updated: order.updatedAt,
			address: address
				? {
						name: reveal ? address.name : maskName(address.name),
						lines: reveal
							? [address.line1, address.line2, address.city, address.state, address.postalCode]
									.filter(Boolean)
									.join(', ')
							: maskGeneric(address.line1),
						country: address.country
					}
				: null,
			items: order.items.map((i) => ({
				id: i.id,
				name: i.name,
				quantity: i.quantity,
				unit: money(i.unitPriceCents),
				total: money(i.lineTotalCents)
			})),
			subtotal: money(order.subtotalCents),
			shipping: money(order.shippingCents),
			tax: money(order.taxCents),
			total: money(order.totalCents),
			regional: order.regional
				? {
						percent: Math.round(order.regional.multiplier * 100),
						base: money(order.regional.baseSubtotalCents),
						countries: Object.entries(order.regional.countries)
							.map(([source, country]) => `${source}: ${country ?? 'unknown'}`)
							.join(', ')
					}
				: null,
			paymentProvider: order.paymentProvider,
			paymentReference: order.paymentReference,
			stripeUrl:
				order.paymentProvider === 'stripe' && order.paymentReference
					? `https://dashboard.stripe.com/search?query=${encodeURIComponent(order.paymentReference)}`
					: null
		},
		events: events.map((e) => ({
			id: e.eventId,
			type: e.type,
			outcome: e.outcome,
			amount: e.amountMinor !== null && e.currency ? formatMoney(e.amountMinor, e.currency) : null,
			received: e.receivedAt
		}))
	};
};
