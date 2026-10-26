/**
 * What a verified Stripe Checkout event does to an order.
 *
 * Kept apart from the route so it is testable against a real database and
 * free of SvelteKit. The route verifies the signature and parses the body;
 * this decides what the event means.
 *
 * Rules, each of which is a way money or trust goes wrong if dropped:
 * - The order is found by `metadata.orderId`, but only acted on when the
 *   session id is the one this site recorded for it. Metadata alone is not trusted.
 * - Paid means `payment_status === 'paid'`. A delayed method (bank debit)
 *   completes unpaid and pays later, which arrives as
 *   `async_payment_succeeded`; `completed` while unpaid changes nothing.
 * - A failed or expired session cancels an order only while it is `pending`.
 *   A paid order is never cancelled by a late failure event.
 * - The amount taken (`amount_total`) must cover the order total in the
 *   order's currency, otherwise the order is left `pending` for a person to
 *   look at rather than shipped on an underpayment.
 * - Replays are no-ops: only the delivery that actually moves the order
 *   reports `changed: true`, so only that one sends the receipt.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { CommerceConflictError, getOrder, transitionOrder } from './store';
import type { Order } from './types';

export interface StripeCheckoutSession {
	id?: string;
	payment_status?: string;
	amount_total?: number | null;
	currency?: string | null;
	metadata?: { orderId?: string } | null;
	customer_details?: { email?: string | null } | null;
}

export interface StripeEventLike {
	type?: string;
	data?: { object?: StripeCheckoutSession };
}

export type StripeEventResult =
	| { outcome: 'paid'; changed: boolean; order: Order; amountTakenCents: number | null }
	| { outcome: 'cancelled'; changed: boolean; order: Order }
	| { outcome: 'ignored'; reason: string };

export const PAYING_EVENTS = [
	'checkout.session.completed',
	'checkout.session.async_payment_succeeded'
] as const;
export const CANCELLING_EVENTS = [
	'checkout.session.async_payment_failed',
	'checkout.session.expired'
] as const;

/** The address Stripe verified at the card, when it sent one. */
export function verifiedStripeEmail(event: StripeEventLike): string | null {
	const email = event.data?.object?.customer_details?.email;
	return typeof email === 'string' && email.length > 0 ? email : null;
}

async function moveOrder(db: D1Database, order: Order, to: 'paid' | 'cancelled') {
	try {
		const updated = await transitionOrder(db, order.id, to);
		return { order: updated ?? order, changed: true };
	} catch (err) {
		if (!(err instanceof CommerceConflictError)) throw err;
		// Another delivery (or a person) moved the order first. Report what it is now.
		return { order: (await getOrder(db, order.id)) ?? order, changed: false };
	}
}

export async function applyStripeEvent(
	db: D1Database,
	event: StripeEventLike
): Promise<StripeEventResult> {
	const type = event.type ?? '';
	const paying = (PAYING_EVENTS as readonly string[]).includes(type);
	const cancelling = (CANCELLING_EVENTS as readonly string[]).includes(type);
	if (!paying && !cancelling) return { outcome: 'ignored', reason: 'event-type' };

	const session = event.data?.object;
	if (paying && session?.payment_status !== 'paid') {
		return { outcome: 'ignored', reason: 'not-paid' };
	}
	const orderId = session?.metadata?.orderId;
	const order = orderId ? await getOrder(db, orderId) : null;
	if (!order || !session?.id || order.paymentReference !== session.id) {
		return { outcome: 'ignored', reason: 'unknown-order' };
	}

	if (cancelling) {
		if (order.status === 'cancelled') return { outcome: 'cancelled', changed: false, order };
		if (order.status !== 'pending') return { outcome: 'ignored', reason: 'order-not-pending' };
		const moved = await moveOrder(db, order, 'cancelled');
		return { outcome: 'cancelled', ...moved };
	}

	const taken = typeof session.amount_total === 'number' ? session.amount_total : null;
	const sameCurrency = !session.currency || session.currency.toLowerCase() === order.currency;
	if (taken !== null && (!sameCurrency || taken < order.totalCents)) {
		return { outcome: 'ignored', reason: 'amount-mismatch' };
	}
	if (order.status === 'cancelled') {
		// Money arrived for an order this site already gave up on. It cannot be
		// revived (orders.ts forbids it); a person has to refund or recreate it.
		return { outcome: 'ignored', reason: 'order-cancelled' };
	}
	if (order.status !== 'pending') {
		return { outcome: 'paid', changed: false, order, amountTakenCents: taken };
	}
	const moved = await moveOrder(db, order, 'paid');
	if (moved.order.status === 'cancelled') return { outcome: 'ignored', reason: 'order-cancelled' };
	return { outcome: 'paid', ...moved, amountTakenCents: taken };
}
