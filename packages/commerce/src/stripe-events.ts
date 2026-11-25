/**
 * What a verified Stripe event does to an order: a Checkout Session's (paid on Stripe's hosted
 * page) or a PaymentIntent's (paid in the card form on the site's own cart).
 *
 * Kept apart from the route so it is testable against a real database and free of SvelteKit. The
 * route verifies the signature and parses the body; this decides what the event means. The
 * decision itself is the proved state machine in dafny/PaymentCore.dfy (via payment-core.ts):
 *
 * - The order is found by `metadata.orderId`, but only acted on when the session or PaymentIntent
 *   id is the one this site recorded for it. Metadata alone is not trusted.
 * - Paid means Stripe says the money was taken (`payment_status: 'paid'`, or a PaymentIntent whose
 *   `status` is `succeeded`), in the order's currency, at least the order's total. An event that
 *   does not say how much or in what currency pays nothing. A short or foreign payment leaves the
 *   order `pending` for a person to look at rather than shipped on an underpayment.
 * - A cancelling event (expired session, canceled PaymentIntent) cancels only a `pending` order.
 *   A paid order is never cancelled, and a cancelled one is never revived, by any event.
 * - `payment_intent.payment_failed` and `charge.refunded` never change an order's status: a
 *   declined card is retried on the same PaymentIntent, and a refund is a person's decision made
 *   in Stripe. They are recorded (payment-events.ts) for the admin's order page.
 * - A PaymentIntent carries the order's `payment_revision` in its metadata. A payment for a
 *   revision the order has not reached yet means the cart's repricing is still being written:
 *   the answer is `retry` (the route says 503, Stripe redelivers). One for an older revision is
 *   not trusted to match the order's lines and is left for a person.
 * - Replays are no-ops: only the delivery that actually moves the order reports `changed: true`,
 *   so only that one sends the receipt. Deliveries are also deduplicated by event id upstream.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { decidePaymentEvent, type PaymentDecision, type PaymentEventKind } from './payment-core';
import { CommerceConflictError, getOrder, getPaymentRevision, transitionOrder } from './store';
import type { Order } from './types';

export interface StripeCheckoutSession {
	id?: string;
	payment_status?: string;
	amount_total?: number | null;
	currency?: string | null;
	payment_intent?: string | null;
	metadata?: { orderId?: string; revision?: string } | null;
	customer_details?: { email?: string | null } | null;
}

export interface StripePaymentIntent {
	id?: string;
	status?: string;
	amount_received?: number | null;
	currency?: string | null;
	metadata?: { orderId?: string; revision?: string } | null;
}

export interface StripeCharge {
	id?: string;
	payment_intent?: string | null;
	amount_refunded?: number | null;
	currency?: string | null;
}

export interface StripeEventLike {
	id?: string;
	type?: string;
	data?: { object?: Record<string, unknown> & StripeCheckoutSession };
}

export type StripeEventResult =
	| { outcome: 'paid'; changed: boolean; order: Order; amountTakenCents: number | null }
	| { outcome: 'cancelled'; changed: boolean; order: Order }
	| { outcome: 'recorded'; order: Order }
	/** The repricing this payment was made for is still being written; ask Stripe to redeliver. */
	| { outcome: 'retry'; reason: string }
	| { outcome: 'ignored'; reason: string };

export const PAYING_EVENTS = [
	'checkout.session.completed',
	'checkout.session.async_payment_succeeded',
	'payment_intent.succeeded'
] as const;
export const CANCELLING_EVENTS = [
	'checkout.session.async_payment_failed',
	'checkout.session.expired',
	'payment_intent.canceled'
] as const;
/** Noted beside the order, never a change of status (dafny/PaymentCore.dfy `RecordOnly`). */
export const RECORDED_EVENTS = ['payment_intent.payment_failed', 'charge.refunded'] as const;

/** The events the Stripe webhook endpoint must be subscribed to (docs/CHECKOUT.md). */
export const STRIPE_WEBHOOK_EVENTS = [
	...PAYING_EVENTS,
	...CANCELLING_EVENTS,
	...RECORDED_EVENTS
] as const;

export function eventKind(type: string): PaymentEventKind {
	if ((PAYING_EVENTS as readonly string[]).includes(type)) return 'paying';
	if ((CANCELLING_EVENTS as readonly string[]).includes(type)) return 'cancelling';
	if (type === 'payment_intent.payment_failed') return 'failed';
	if (type === 'charge.refunded') return 'refunded';
	return 'other';
}

/** The address Stripe verified at the card, when it sent one. */
export function verifiedStripeEmail(event: StripeEventLike): string | null {
	const email = event.data?.object?.customer_details?.email;
	return typeof email === 'string' && email.length > 0 ? email : null;
}

/** What an event says, whatever kind of Stripe object it is about. */
export interface EventFacts {
	objectId: string | null;
	orderId: string | null;
	paymentIntent: string | null;
	moneyIn: boolean;
	amountMinor: number | null;
	currency: string | null;
	/** The PaymentIntent's `metadata.revision`; null when absent (hosted sessions, older intents). */
	revision: number | null;
}

const str = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : null);
const minor = (v: unknown) =>
	typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null;

export function eventFacts(type: string, object: Record<string, unknown> | undefined): EventFacts {
	const o = object ?? {};
	const metadata = (o.metadata && typeof o.metadata === 'object' ? o.metadata : {}) as Record<
		string,
		unknown
	>;
	if (type.startsWith('payment_intent.')) {
		const rev = str(metadata.revision);
		return {
			objectId: str(o.id),
			orderId: str(metadata.orderId),
			paymentIntent: str(o.id),
			// Paid only when Stripe says the money was taken, whatever the event is called.
			moneyIn: type === 'payment_intent.succeeded' && o.status === 'succeeded',
			amountMinor: minor(o.amount_received),
			currency: str(o.currency),
			revision: rev !== null && /^\d{1,9}$/.test(rev) ? Number(rev) : null
		};
	}
	if (type === 'charge.refunded') {
		return {
			objectId: str(o.id),
			orderId: null,
			paymentIntent: str(o.payment_intent),
			moneyIn: false,
			amountMinor: minor(o.amount_refunded),
			currency: str(o.currency),
			revision: null
		};
	}
	return {
		objectId: str(o.id),
		orderId: str(metadata.orderId),
		paymentIntent: str(o.payment_intent),
		moneyIn: o.payment_status === 'paid',
		amountMinor: minor(o.amount_total),
		currency: str(o.currency),
		revision: null
	};
}

/**
 * The order a PaymentIntent paid for: the order whose reference it is (on-page checkout), or the
 * one a recorded hosted-checkout event tied it to.
 */
export async function findOrderIdByPaymentIntent(
	db: D1Database,
	paymentIntent: string
): Promise<string | null> {
	const direct = await db
		.prepare('SELECT id FROM commerce_orders WHERE payment_reference = ?')
		.bind(paymentIntent)
		.first<{ id: string }>();
	if (direct) return direct.id;
	const viaEvent = await db
		.prepare(
			`SELECT order_id FROM commerce_stripe_events
			 WHERE payment_intent = ? AND order_id IS NOT NULL LIMIT 1`
		)
		.bind(paymentIntent)
		.first<{ order_id: string }>();
	return viaEvent?.order_id ?? null;
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

const IGNORE_REASON: Partial<Record<PaymentDecision, string>> = {
	ignore: 'unknown-order',
	'not-pending': 'order-not-pending',
	'not-paid': 'not-paid',
	'amount-mismatch': 'amount-mismatch',
	'paid-but-cancelled': 'order-cancelled'
};

export async function applyStripeEvent(
	db: D1Database,
	event: StripeEventLike
): Promise<StripeEventResult & { decision?: PaymentDecision; facts?: EventFacts }> {
	const type = event.type ?? '';
	const kind = eventKind(type);
	if (kind === 'other') return { outcome: 'ignored', reason: 'event-type' };
	const facts = eventFacts(type, event.data?.object);

	const orderId =
		kind === 'refunded'
			? facts.paymentIntent && (await findOrderIdByPaymentIntent(db, facts.paymentIntent))
			: facts.orderId;
	const order = orderId ? await getOrder(db, orderId) : null;
	// A refund is matched through its PaymentIntent above; everything else must name the payment
	// this site recorded for the order.
	const known =
		!!order &&
		!!facts.objectId &&
		(kind === 'refunded' || order.paymentReference === facts.objectId);

	if (known && kind === 'paying' && type.startsWith('payment_intent.')) {
		const current = (await getPaymentRevision(db, order.id)) ?? 0;
		const paidFor = facts.revision ?? 0;
		if (paidFor > current) return { outcome: 'retry', reason: 'revision-ahead', facts };
		if (paidFor < current) return { outcome: 'ignored', reason: 'stale-revision', facts };
	}

	const decision = decidePaymentEvent({
		status: order?.status ?? 'pending',
		kind,
		known,
		moneyIn: facts.moneyIn,
		takenMinor: facts.amountMinor,
		dueMinor: order?.totalCents ?? 0,
		currencyMatches:
			!!order && !!facts.currency && facts.currency.toLowerCase() === order.currency.toLowerCase()
	});
	const base = { decision, facts };

	switch (decision) {
		case 'mark-paid': {
			const moved = await moveOrder(db, order as Order, 'paid');
			if (moved.order.status === 'cancelled') {
				return { outcome: 'ignored', reason: 'order-cancelled', ...base };
			}
			return { outcome: 'paid', ...moved, amountTakenCents: facts.amountMinor, ...base };
		}
		case 'already-paid':
			return {
				outcome: 'paid',
				changed: false,
				order: order as Order,
				amountTakenCents: facts.amountMinor,
				...base
			};
		case 'cancel': {
			const moved = await moveOrder(db, order as Order, 'cancelled');
			if (moved.order.status !== 'cancelled') {
				return { outcome: 'ignored', reason: 'order-not-pending', ...base };
			}
			return { outcome: 'cancelled', ...moved, ...base };
		}
		case 'already-cancelled':
			return { outcome: 'cancelled', changed: false, order: order as Order, ...base };
		case 'record':
			return { outcome: 'recorded', order: order as Order, ...base };
		default:
			return { outcome: 'ignored', reason: IGNORE_REASON[decision] ?? decision, ...base };
	}
}
