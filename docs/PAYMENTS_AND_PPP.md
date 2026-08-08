# Payments & Purchasing-Power Pricing — design plan

> **Status: plan (not yet built).** This is the design for bringing Stripe payments
> into the kit with **purchasing-power parity (PPP) region pricing as a first-class
> concept, not a bolt-on.** It is the detailed companion to the "Payments: Stripe
> integration" and "Credits / points ledger" entries in
> [ROADMAP.md](../ROADMAP.md). Paths below name the modules this design adds.

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

## Decisions (resolved 2026-07-16)

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
