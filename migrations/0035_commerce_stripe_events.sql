-- Stripe webhook events this site has acted on, by Stripe's event id (`evt_…`). A delivery whose id
-- is already here is answered 200 and not applied again, so a replayed event cannot send a second
-- receipt or move an order twice. Written only after the event was applied, so an event that failed
-- half way is retried by Stripe rather than remembered as done.
--
-- Also the order's payment history for the admin: declined cards and refunds do not change an
-- order's status (dafny/PaymentCore.dfy, RecordOnly), they are rows here. No PII: ids and amounts.
CREATE TABLE IF NOT EXISTS commerce_stripe_events (
	event_id TEXT PRIMARY KEY,
	type TEXT NOT NULL,
	order_id TEXT,
	-- The Stripe object the event is about: a Checkout Session, PaymentIntent or Charge id.
	object_id TEXT,
	-- The PaymentIntent behind it, when the event names one (a refund is matched to its order by it).
	payment_intent TEXT,
	-- Minor units: the amount taken, or for a refund the total refunded so far.
	amount_minor INTEGER,
	currency TEXT,
	-- What the site decided (packages/commerce/src/payment-core.ts PAYMENT_DECISIONS).
	outcome TEXT NOT NULL,
	received_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_commerce_stripe_events_order ON commerce_stripe_events (order_id);
CREATE INDEX IF NOT EXISTS idx_commerce_stripe_events_intent ON commerce_stripe_events (payment_intent);
