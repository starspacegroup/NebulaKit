/**
 * Stripe webhook deliveries, deduplicated by event id and kept as the order's payment history
 * (`commerce_stripe_events`, migration 0035).
 *
 * Stripe delivers at least once, and the same event can arrive twice at the same moment. The
 * state machine already makes a replay change nothing (stripe-events.ts); the id check here makes
 * a replay not even run it. The row is written only after the event was applied, so an event that
 * threw half way is retried by Stripe instead of being remembered as done. Two deliveries racing
 * past the check both apply; the order's compare-and-set lets only one of them move it.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { applyStripeEvent, type StripeEventLike, type StripeEventResult } from './stripe-events';

/** Stripe event ids look like `evt_…`. Anything else is not an event this site will remember. */
export const STRIPE_EVENT_ID = /^evt_[A-Za-z0-9_]{1,255}$/;

export type ProcessedStripeEvent = StripeEventResult | { outcome: 'duplicate' };

export async function hasStripeEvent(db: D1Database, eventId: string): Promise<boolean> {
	const row = await db
		.prepare('SELECT 1 AS seen FROM commerce_stripe_events WHERE event_id = ?')
		.bind(eventId)
		.first();
	return !!row;
}

/** Apply a verified event once per event id, and record what it did. */
export async function processStripeEvent(
	db: D1Database,
	event: StripeEventLike & { id: string }
): Promise<ProcessedStripeEvent> {
	if (await hasStripeEvent(db, event.id)) return { outcome: 'duplicate' };
	const result = await applyStripeEvent(db, event);
	// A retry is not done: Stripe must deliver it again, so it is not remembered.
	if (result.outcome === 'retry') return result;
	const facts = result.facts;
	const orderId = 'order' in result ? result.order.id : (facts?.orderId ?? null);
	await db
		.prepare(
			`INSERT INTO commerce_stripe_events
			 (event_id, type, order_id, object_id, payment_intent, amount_minor, currency, outcome)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT (event_id) DO NOTHING`
		)
		.bind(
			event.id,
			String(event.type ?? '').slice(0, 100),
			orderId,
			facts?.objectId ?? null,
			facts?.paymentIntent ?? null,
			facts?.amountMinor ?? null,
			facts?.currency?.toLowerCase() ?? null,
			result.decision ?? (result.outcome === 'ignored' ? result.reason : result.outcome)
		)
		.run();
	return result;
}

export interface PaymentEventRow {
	eventId: string;
	type: string;
	objectId: string | null;
	amountMinor: number | null;
	currency: string | null;
	outcome: string;
	receivedAt: string;
}

/** An order's payment history, oldest first: payments, declines, cancellations, refunds. */
export async function listOrderPaymentEvents(
	db: D1Database,
	orderId: string
): Promise<PaymentEventRow[]> {
	const { results } = await db
		.prepare(
			`SELECT event_id, type, object_id, amount_minor, currency, outcome, received_at
			 FROM commerce_stripe_events WHERE order_id = ? ORDER BY received_at, rowid LIMIT 100`
		)
		.bind(orderId)
		.all<Record<string, unknown>>();
	return results.map((row) => ({
		eventId: row.event_id as string,
		type: row.type as string,
		objectId: (row.object_id as string | null) ?? null,
		amountMinor: row.amount_minor == null ? null : Number(row.amount_minor),
		currency: (row.currency as string | null) ?? null,
		outcome: row.outcome as string,
		receivedAt: row.received_at as string
	}));
}
