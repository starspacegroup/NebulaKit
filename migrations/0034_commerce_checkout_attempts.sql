-- On-page checkout (docs/CHECKOUT.md). One cart checkout is one order and one Stripe PaymentIntent,
-- however often the shopper presses "Pay" or edits the cart before paying.
--
-- `checkout_key` is a random id the cart page makes once per checkout. A second submit with the same
-- key finds the order the first one made (and its PaymentIntent) instead of making another. NULL for
-- orders placed any other way (API, auctions, hosted checkout), which the partial index ignores.
--
-- `payment_revision` counts the times a pending order was repriced (the cart changed before
-- payment). Each repricing updates the PaymentIntent's amount under an idempotency key that names
-- the revision, so a retried update is one update and a later one is not mistaken for it. The
-- PaymentIntent carries the revision in its metadata, and the webhook marks an order paid only for
-- the revision the order is at (packages/commerce/src/stripe-events.ts).
ALTER TABLE commerce_orders ADD COLUMN checkout_key TEXT;
ALTER TABLE commerce_orders ADD COLUMN payment_revision INTEGER NOT NULL DEFAULT 0;
-- Stamped by each repricing so the batch's later statements act only on the row it just claimed.
ALTER TABLE commerce_orders ADD COLUMN payment_nonce TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_commerce_orders_checkout_key
	ON commerce_orders (checkout_key) WHERE checkout_key IS NOT NULL;
