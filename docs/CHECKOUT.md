# Checkout

How a shopper pays on a NebulaKit site. Ported on 2026-11-23 from PinFool's on-page
checkout (itself modelled on davis9001.com's shop), then hardened: one PaymentIntent per
checkout that is updated instead of replaced, event-id deduplication, and a proved money
core. Regional (PPP) pricing is in [PAYMENTS_AND_PPP.md](PAYMENTS_AND_PPP.md).

## The rule that matters

**The server decides every amount.** The browser sends product ids, quantities, an email
and an address. Prices, regional discount, tax, shipping, the total and the currency are
computed on the server from the catalog and the site's own settings
(`src/lib/server/checkout-pricing.ts` → `priceCart`). Any price, total or amount field in a
request body is ignored. The PaymentIntent's amount is the order's total and nothing else.

**Only the signed webhook marks an order paid.** Not the checkout route, not the card
form's "succeeded", not the shopper's return to `/cart?order=…`.

## Modes

| `CHECKOUT_MODE`    | Needs                                         | What the shopper sees                                |
| ------------------ | --------------------------------------------- | ---------------------------------------------------- |
| `onpage` (default) | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` | Stripe's Payment Element (cards only) inside `/cart` |
| `hosted`           | `STRIPE_SECRET_KEY`                           | Redirect to Stripe Checkout, back to `/cart?order=…` |
| — (no secret key)  | nothing                                       | The order waits for a manual payment                 |

The mode is `CHECKOUT_MODE` when it is a known value, else the `checkout_mode` row in
`commerce_settings`, else `onpage` (`src/lib/server/checkout-mode.ts`). On-page mode
without a valid `pk_test_…`/`pk_live_…` key falls back to hosted. API callers that do not
send `onSite: true` always get hosted Checkout, as before. Auctions pay through hosted
Checkout in either mode.

## Flow (on-page)

```
Browser (/cart)                     Site (Worker + D1)                        Stripe
---------------                     ------------------                        ------
card form mounts ── lazy load ─────────────────────────────────────────────▶ js.stripe.com/…/stripe.js
elements.submit() (checks the card; no order yet)
POST /api/v1/checkout ────────────▶ request limit (per address)
 {email, lines:[{productId,qty}],    priceCheckout(): catalog × regional, tax, shipping
  shippingAddress, onSite:true,      find order by checkoutKey
  checkoutKey}                        ├─ none:   createOrder ─▶ POST /v1/payment_intents ──▶ (Idempotency-Key
                                      │                         amount = order.total          order-intent-<id>)
                                      ├─ same pricing: GET the intent (no write)
                                      └─ changed: POST /v1/payment_intents/<pi> ───────────▶ (key …-r<rev+1>)
                                                   then repriceOrder (one guarded batch)
                    ◀──────────────── {order.totalCents, payment.clientSecret}
total ≠ quote shown? → stop, re-quote, ask again (never charge an unseen total)
stripe.confirmPayment(clientSecret) ───────────────────────────────────────▶ charge (3-D Secure via
                                                                               hooks.stripe.com frame)
location → /cart?order=<id> (polls GET /api/v1/orders/<id>/status)
                                    POST /api/v1/webhooks/stripe ◀────────── payment_intent.succeeded
                                     verify HMAC (constant time, ±5 min)
                                     dedupe by event id
                                     PaymentCore.Decide → pending → paid
                                     receipt email (once)
```

Backing out: **Cancel order** posts `POST /api/v1/checkout/cancel {orderId}`. Stripe is
asked to close the payment first (`/cancel` on a PaymentIntent, `/expire` on a session);
only when Stripe says it is closed is the order cancelled. The template keeps no stock
counts, so the one hold released is an auction's: a winner who backs out lapses the auction
(the owner can relist it). Unfinished on-page payments older than two hours are closed a
few at a time on each new order.

## What the webhook does

Subscribe the endpoint `https://<site>/api/v1/webhooks/stripe` to:

- `payment_intent.succeeded`, `checkout.session.completed`,
  `checkout.session.async_payment_succeeded` → a pending order becomes **paid**, if the
  event names the payment this site recorded, the money was taken, in the order's
  currency, and at least the order total. Otherwise the order stays pending and the log
  says `stripe webhook: needs attention`.
- `payment_intent.canceled`, `checkout.session.expired`,
  `checkout.session.async_payment_failed` → a pending order becomes **cancelled**.
- `payment_intent.payment_failed`, `charge.refunded` → recorded on the order's payment
  history (`/admin/orders/<id>`); the status does not change. A declined card is retried on
  the same PaymentIntent. Refunds are made in Stripe's dashboard (the admin page links to
  it); the template has no refund button.

The state machine is `dafny/PaymentCore.dfy` (`Decide`, `Step`), proved: a paid order is
never moved back, a cancelled order is never revived, only pending moves, paying needs
money ≥ total in the right currency, replay is a no-op, declines and refunds never move
the status. Every event is applied once per `evt_…` id (`commerce_stripe_events`,
migration 0035), recorded only after it was applied so a failure is retried by Stripe.

A PaymentIntent carries the order's `payment_revision`. If a payment arrives for a
revision the order has not reached (the cart's repricing is still being written) the
webhook answers 503 and Stripe redelivers; one for an older revision is left for a person.

## Environment and secrets

| Name                             | Where            | Notes                                                              |
| -------------------------------- | ---------------- | ------------------------------------------------------------------ |
| `STRIPE_SECRET_KEY`              | secret           | `sk_test_…` locally. Server only.                                  |
| `STRIPE_PUBLISHABLE_KEY`         | var or secret    | `pk_test_…`. Public by design: sent to the cart page.              |
| `STRIPE_WEBHOOK_SECRET`          | secret           | `whsec_…`. Without it the webhook answers 503 and applies nothing. |
| `STRIPE_WEBHOOK_SECRET_PREVIOUS` | secret, optional | The old secret while rolling it; remove when quiet.                |
| `CHECKOUT_MODE`                  | var, optional    | `onpage` (default) or `hosted`.                                    |

Set them with `bunx wrangler pages secret put STRIPE_SECRET_KEY` (and so on), and locally
in `.dev.vars` (see `.dev.vars.example`). Apply migrations `0034`–`0036` before deploying:
`createOrder` writes the new `checkout_key` column.

Content-Security-Policy (`svelte.config.js`): `frame-src 'self' https://js.stripe.com
https://hooks.stripe.com`. `script-src` and `connect-src` are not set by the template; a
site that sets them must add `https://js.stripe.com` (script) and `https://api.stripe.com`
(connect).

## Testing with Stripe test mode

Use test keys only (`sk_test_…`, `pk_test_…`). Never put live keys in `.dev.vars`.

1. `bun run db:migrate:local`, then `bun run dev`.
2. Forward webhooks with the Stripe CLI and copy the `whsec_…` it prints into
   `STRIPE_WEBHOOK_SECRET` in `.dev.vars`:

   ```sh
   stripe listen --forward-to localhost:<devPort>/api/v1/webhooks/stripe \
     --events payment_intent.succeeded,payment_intent.canceled,payment_intent.payment_failed,charge.refunded,checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired
   ```

3. Pay at `/cart` with Stripe's test cards (any future expiry, any CVC, any postcode):
   - `4242 4242 4242 4242` succeeds;
   - `4000 0025 0000 3155` asks for 3-D Secure (the frame comes from `hooks.stripe.com`);
   - `4000 0000 0000 9995` is declined (insufficient funds): the order stays pending and
     the same PaymentIntent is retried with another card;
   - `4000 0000 0000 0002` is a generic decline.
4. Watch `/admin/orders`: the order is pending until `stripe listen` delivers
   `payment_intent.succeeded`, then paid. Refund it in the Stripe test dashboard and the
   `charge.refunded` row appears on the order page.
5. Replays: `stripe events resend evt_…` is answered `{ duplicate: true }`.

Automated tests never reach Stripe: `tests/helpers/fake-stripe.ts` stands in for its HTTP
API (with its idempotency rule), and the Playwright test `tests/e2e/checkout.test.ts`
stubs Stripe.js.

## Where things are

- Money core (proved): `dafny/PaymentCore.dfy` → `packages/commerce/src/generated/payment-core.js`,
  wrapped by `packages/commerce/src/payment-core.ts`.
- Stripe HTTP: `packages/commerce/src/payments.ts` (no SDK; injectable `fetch`).
- Events: `packages/commerce/src/stripe-events.ts`, `payment-events.ts`.
- One checkout, one PaymentIntent: `src/lib/server/onpage-checkout.ts`.
- Routes: `src/routes/api/v1/checkout/+server.ts`, `checkout/cancel/+server.ts`,
  `webhooks/stripe/+server.ts`, `src/routes/cart/`.
- Browser: `src/lib/shop/stripe-js.ts` (lazy loader, appearance), `src/lib/components/CardField.svelte`.
- Admin: `src/routes/admin/orders/` (read-only list and detail; PII masked by default).
- Request limits: `src/lib/server/request-limit.ts` (migration 0036).
