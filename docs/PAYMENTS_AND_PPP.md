# Payments & Purchasing-Power Pricing

> **Status: two layers, one built.**
> **Built (2026-10-25): regional pricing as a multiplier on the shop's own prices**,
> described first below. **Still a plan: Stripe `currency_options` (local-currency
> charging)**, the long design that follows it. They answer different questions and
> do not conflict. Companion to the "Payments: Stripe integration" and "Credits /
> points ledger" entries in [ROADMAP.md](../ROADMAP.md).

## What is built: regional pricing as a multiplier

Code: `packages/commerce/src/regional.ts` (pure logic), `price-level-index.ts`
(static World Bank table, 196 countries), `store.ts` (settings and audit),
`src/lib/server/checkout-pricing.ts` (shared by checkout and quote). Admin screen:
`/admin/settings/pricing`. Site API: `GET/PUT /api/v1/pricing`,
`GET /api/v1/pricing/preview`, public `POST /api/v1/checkout/quote`. Migration
`0022_commerce_settings.sql`. Ported from Ammoura's regional pricing.

How it works:

1. **The index.** Each country has a price level ratio (what the same basket costs
   there against the US, World Bank `PA.NUS.PPP / PA.NUS.FCRF`). It ships as a
   checked-in table and is refreshed by hand with `bun run update:price-index`, then
   reviewed as a diff. Nothing is fetched at runtime.
2. **The multiplier.** `1 - strength * (1 - level)`, rounded to steps of 5%, held
   between `1 - maxDiscount` and 1. A per-country override replaces the index figure
   and is still held to the cap; `1` pins a country to full price.
3. **It only ever lowers.** A country priced above the US, a country with no data and
   an unusable code all pay the base price. `regionalPriceCents` returns the base
   price for any multiplier of 1 or more.
4. **Least generous country wins.** An order is priced at the highest multiplier
   among the country Cloudflare sees (`request.cf.country`, else `cf-ipcountry`) and
   the shipping address country. A VPN into a cheap country does not beat a US
   shipping address, and a US IP does not beat a cheap shipping address. A source
   that cannot be placed (`XX`, `T1`, no header) counts as full price; a source that
   does not exist for the order (no shipping address on a digital order) is left out.
   The pure `orderMultiplier` accepts a billing country too, but the checkout has no
   billing field of its own: the card's billing country lives in the Stripe-hosted
   page (see Not built).
5. **Rounding and floor.** Whole cents, round half up, in integer arithmetic. A unit
   is never charged less than 50 cents (Stripe's USD minimum) because of a discount,
   and a product already cheaper than that is left at its own price, never raised.
6. **Scope.** `digital` (default) or `all`. A printed shirt costs the owner the same
   anywhere, so physical products are not discounted unless the owner chooses.
7. **Off by default.** The settings row is absent until the owner saves it, and an
   absent, corrupt or disabled row reads as "off", which charges exactly the catalog
   price and writes no audit row.

Where it is stored and why:

- **Settings:** new key/value table `commerce_settings`, key `regional_pricing`,
  JSON value. Key/value because the next shop setting then needs no migration.
- **Order audit:** new table `commerce_order_regional` (multiplier as a whole
  percent, the countries considered as JSON, the catalog subtotal), written in the
  same batch as the order. A table rather than columns on `commerce_orders`: the
  orders table is untouched, orders placed with the feature off carry no row, and the
  discount stays auditable after the settings change. The order's own lines and totals
  already hold what was charged. The order API returns it as `order.regional`.

What the shopper sees: the cart asks `POST /api/v1/checkout/quote` (the same code
path as checkout) and shows the server's subtotal, shipping, tax and total, with a
plain notice and the undiscounted subtotal when a discount applies. The browser's
own figures are shown only until the server answers, and are never sent as prices.
The quote knows the request country and, once the shopper types one, the shipping
country; a less generous country that appears only at checkout can raise the price
from the quote, which is the safe direction.

### Why this and not `currency_options`, for now

The Stripe design below charges in the visitor's currency at a hand-tuned local
amount. It is the better experience for a shop with a few fixed prices and a Stripe
account, but it needs Stripe-side setup per price, only suits Stripe, and cannot
express "give this shopper 30% off a catalog the owner edits daily". The multiplier
works for any payment provider (including the manual one), any product the owner
creates, takes effect the moment the owner saves, and is checked end to end in tests
against real SQLite without Stripe. It charges in the product's currency, so a shopper
in India pays a lower dollar amount rather than a rupee amount. The two compose:
`currency_options` would later change the currency, the multiplier the amount.

Decisions that differ from the plan below: PPP is **off by default** here (the plan
said on-by-default; charging less than the catalog on a fresh template is a pricing
decision the owner must make, and the index only fits shops whose margin it fits), and
it adds a small amount of schema (two tables) where the Stripe design needed none.

### Not built

- Billing country as an input: needs the card/billing country back from Stripe
  (webhook) and a re-check before fulfilment.
- Local-currency charging and `currency_options` (everything below).
- Showing the regional price on `/shop` product cards (the cart and checkout are
  honest; listing pages show catalog prices).
- Coupons, per-product exemptions, and a USD-equivalent subscription floor.

---

# The Stripe `currency_options` design (not built)

## Why PPP is a core concept, not a feature flag

A dollar is not a dollar everywhere. A $9.99/mo subscription is a rounding error in
Zurich and a serious sum in Lagos or Manila. [Purchasing power
parity](https://en.wikipedia.org/wiki/Purchasing_power_parity) says the same basket
of goods costs different nominal amounts across economies; priced in USD-at-FX, a
kit-built product is effectively **several times more expensive** in low-income
markets, which suppresses conversion far more than it protects margin.

The decision this plan bakes in: **the kit charges in the visitor's local currency,
at a locally-appropriate (purchasing-power-adjusted) amount** — not an FX conversion
of the USD price. PPP is a property of the pricing layer that every payment path
inherits, the same way auth or theming is ambient. Downstream apps get it for free;
opting _out_ (USD-everywhere) is the special case, not opting in.

Crucially, this is **cheap to make core** because of the architecture below: it adds
**no database schema, no new price IDs, and no change to checkout/webhook/entitlement
logic.** That's the whole reason it can be a default rather than a fork.

## The one architectural insight to carry over

PPP lives **entirely on Stripe**, as per-currency `currency_options` attached to the
**existing** prices — never as new Price objects.

```
Product: "Premium"  (unchanged)
  └─ Price price_ABC  unit_amount = 999 usd     ← the ID everything keys on
        currency_options:
          inr → 47900     (≈ ₹479, a PPP discount, NOT 999×FX)
          brl → 2599
          ngn → 689900
          … 45 currencies
```

Consequences, all good:

- **Price IDs never change.** Tier resolution, webhooks, entitlement grants, and the
  credits ledger all key on price/product IDs and stay untouched. PPP is invisible to
  them.
- **`currency_options` is additive and updatable** on a live price, but a currency's
  `unit_amount` is **immutable once set** — changing an already-set amount requires a
  brand-new price. The setup script (below) is therefore add-only and reports (never
  silently rewrites) drift.
- **No migration.** Nothing about PPP touches D1. The source of truth for _what to
  charge_ is a code table (`REGION_PRICE_AMOUNTS`); the runtime source of truth is
  Stripe, read back via `expand[]=currency_options`.

This is the single most important thing to preserve when generalizing into the kit.

## Module map

| Concern                                                                                                                                                                     | Module                                                                    | Role                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Country→currency map, currency list, zero-decimal / whole-unit display rules, `formatMoney`, `toMajorUnits`, preview-override resolution, **PPP amount table**              | `src/lib/utils/region-pricing.ts`                                         | Core of the kit `region-pricing` module — the domain-specific amount table splits out (see "Generalizing") |
| Read the visitor's currency-option amount at request time (`amountForCurrency`), fetch prices with `expand[]=data.currency_options`, pass `currency` into checkout sessions | `src/lib/utils/stripe.ts`                                                 | Kit `stripe` util                                                                                          |
| One-time script that writes `currency_options` onto existing prices from the amount table; add-only; **refuses live keys without `--live`**; `--dry-run`                    | `scripts/setup-region-prices.ts`                                          | Kit script + documented runbook                                                                            |
| Live-FX USD reference for the admin preview (sanity-check that ₹479 lands near $5.7 PPP against the $9.99 base)                                                             | `src/lib/utils/fx.ts` (key-less open.er-api.com, KV-cached, preview-only) | Kit util, optional                                                                                         |
| Pricing page consuming all of the above, incl. superadmin locale preview + USD-equivalent                                                                                   | `src/routes/pricing/+page.server.ts`                                      | Kit reference route                                                                                        |

Runtime flow (unchanged surface, PPP threaded through):

1. **Geo.** `cf-ipcountry` request header (free + reliable on Workers) →
   `currencyForCountry()` → presentation currency. Unknown/anonymized (`XX`,`T1`) →
   USD fallback. No IP database, no third-party call.
2. **Resolve.** `resolveRegionCurrency()` picks the currency, honoring a **dev/admin
   preview override** (`?currency=`, `?region=`, or a `region_preview` cookie) that is
   **gated to Stripe test mode** (`canPreviewRegions`) so it is inert for real
   production visitors — geo-IP always wins on live keys.
3. **Price.** `amountForCurrency(price, currency)` reads the matching
   `currency_options` entry, falling back to the base currency so checkout is _always_
   chargeable even for an unmapped currency.
4. **Display.** `formatMoney()` handles the messy tail: zero-decimal currencies
   (¥/₩ — don't ÷100), whole-unit-display currencies (₹/₱ shown without decimals),
   comma-decimal locales (€2.499,00), and symbol placement.
5. **Charge.** The resolved `currency` is passed straight into the Checkout Session
   (`createSubscriptionCheckoutSession` / `createCreditsCheckoutSession`). Stripe
   charges the `currency_options` amount. Webhooks and entitlements never see it.

## Generalizing for the kit (the real work)

An app's amount table is domain-specific: its `PriceRole` union names that app's own
subscription and credit-pack roles, and the two kinds of role want different PPP
treatment — packs scale by the full PPP tier, while subscriptions are floored at a
USD-equivalent minimum (because a subscriber's included allowance costs real money to
serve). The kit can't ship any one app's product roles as the pricing table.

Plan to split it into two layers:

1. **Currency & formatting infrastructure — the kit's own layer.** The country map,
   `SUPPORTED_CURRENCIES`, zero-decimal/whole-unit sets, `formatMoney`, `toMajorUnits`,
   preview-override resolution, `cf-ipcountry` plumbing. This is app-agnostic and is
   the bulk of the module; no downstream app should have to redefine any of it.
2. **The PPP amount table — make it the downstream app's config.** Replace the fixed
   `PriceRole` union + `REGION_PRICE_AMOUNTS` with a **role-keyed config the app
   defines** (its own product roles: `pro_monthly`, `credits_1000`, whatever), plus a
   documented method for _deriving_ amounts (live FX × PPP tier, rounded to
   locally-natural numbers; re-derive when FX drifts, especially high-inflation
   currencies like TRY/NGN). Ship a filled-in table as a **worked example**, not as
   the kit's prices.
   - Consider a small helper that _suggests_ PPP amounts from a base USD price ×
     per-country PPP index (World Bank ICP factor) so an app author gets a sane
     starting table to hand-tune, rather than filling 45×N cells by hand.

The credits/points ledger is a **separate** roadmap module. It _consumes_ this pricing
layer (its packs are just price roles) but PPP must not depend on it — keep the
dependency one-directional.

## Where this sits in the larger payments plan

PPP is layer 0. Sequencing:

1. **Region-pricing infra** (this doc, layer 1 & 2 above) — currency/format core +
   app-config amount table + setup script + geo resolution. Buildable and testable with
   Stripe test keys, no ledger, no admin UI.
2. **Stripe core module** — client factory, `expand[]=currency_options` on all price
   reads, checkout session creation threading `currency`, webhook handler, the
   idempotent `stripe-bootstrap` first-run product/price setup (fits the kit's
   zero-env-setup philosophy, `docs/ZERO_ENV_SETUP.md`). PPP is wired in from the start
   here, not retrofitted.
3. **Entitlements / subscription tiers** — product/price → tier → capability grants.
   Keyed on IDs, so PPP-transparent.
4. **Credits ledger** (optional module) — balance + append-only transactions + purchase
   via the Stripe module + allowance cron. Packs are price roles in the PPP table.
5. **Admin surface** — the `admin/stripe/*` views (products, prices, discounts,
   refunds, disputes, webhooks) and a **region-price preview switcher** so an operator
   can see every locale's presented price on the live site without changing what real
   visitors see.

Layers 1–2 are the minimum for "the kit can take a payment, correctly, anywhere."

## Risks & sharp edges to document in the kit

- **Immutable `currency_options`.** Once a currency amount is set on a price you can't
  change it — only add currencies or make a new price. The setup script must stay
  add-only and _report_ desired-vs-existing drift rather than pretend to update. Bake a
  "prices are cheap, make a new one to re-price" note into the runbook.
- **Live-key safety.** The setup script refuses live-mode keys without an explicit
  `--live` flag and defaults to `--dry-run` discipline. Keep this. Downstream apps that
  share a Stripe account across projects need the freeze to be loud.
- **Currency the card can't pay.** Only map countries to a currency their cards
  actually support (home countries + official-use states, e.g. Liechtenstein→CHF, EUR
  micro-states). Everything else → USD. Presenting a currency the visitor can't be
  charged in is worse than USD.
- **FX drift on high-inflation currencies.** The amounts are hand-derived PPP numbers,
  not live conversions, so they _stale_. Document the re-derivation cadence and which
  currencies drift fastest (TRY, NGN, ARS-if-added).
- **Zero-decimal & whole-unit correctness.** ¥1500 means 1500, not 150000; HUF/TWD
  require multiples of 100 minor units. These are silent money bugs if wrong —
  `formatMoney`/`toMajorUnits` and their tests (`region-pricing.test.ts`) must ship
  together.
- **Preview override must be inert in production.** The `?region=`/cookie override is
  gated to test mode / admins. Verify the gate; a leak lets anyone pick their own
  price.

## Decisions (resolved 2026-07-16, for the Stripe design above)

- **Default posture — PPP on-by-default.** The kit ships with region pricing active and
  a USD fallback for unmapped countries. It's nearly free (rides on `currency_options`,
  no schema, no ID churn), so opting _out_ (USD-everywhere) is the special case a
  downstream app configures, not the default it opts into. This is the whole point of
  treating PPP as core.
- **Amount-derivation helper — documented manual method + a filled-in table as a
  worked example for v1; the "USD base × PPP index → suggested table" generator is a
  fast-follow (v1.1), not a v1 blocker.** Shipping the example table + a re-derivation
  runbook is enough to be turnkey; the generator is a convenience that turns hand-tuning
  into review-and-tweak and can land once the core module is proven.
- **Currency breadth — the full 46-currency list is the kit default.** It covers the
  markets where PPP actually matters; trimming to a "core 15" would weaken the default
  for no real saving. Document the country→currency map as the trim/extend point for
  apps that want fewer.
