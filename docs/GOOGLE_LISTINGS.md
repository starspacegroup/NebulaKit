# Google product listings

A NebulaKit shop is eligible for free listings and Shopping ads in Google Merchant Center with no
spreadsheets: it publishes a product feed, puts matching structured data on every product page, and
tells the admin what Google would reject before Google does.

Everything that decides what Google sees is in one pure module,
`packages/commerce/src/google-listing.ts` (no database, no clock, no framework). The feed, the page
markup, the cart, the admin health page and the optional API sync all call it, so they cannot
disagree about a product.

## Sources

Fetched on 2026-11-25. Where a claim could not be read in the fetched copy it is marked
**unverified** here and in the code.

- Product data specification: <https://support.google.com/merchants/answer/7052112>. Read for
  `id` (50), `title` (150), `description` (5000), `link`, `image_link`, `additional_image_link`
  (up to 10), `availability` values, `price` format (`15.00 USD`), `sale_price` and
  `sale_price_effective_date`, `brand` (70, required for new products), `gtin`, `mpn`,
  `identifier_exists`, `condition`, `adult`, `color`, `size`, `gender`, `age_group`, `material`,
  `item_group_id`, `product_weight`, `product_length/width/height`, `product_type` (750),
  `google_product_category`, `shipping` (colon form `US:CA:Overnight:16.00 USD:1:1:2:3`),
  `custom_label_0-4` (100). The last ~39,000 characters of that page were not read.
- Feed format, RSS 2.0 with the `g:` namespace (`http://base.google.com/ns/1.0`), nested
  `g:shipping`: <https://support.google.com/merchants/answer/160589>. That page says nothing about
  TSV, UTF-8 or escaping; the TSV layout and the escaping here are this kit's reading of the
  specification and are **unverified** against Google's own TSV page.
- Merchant listing structured data, `Product`, `Offer`, `OfferShippingDetails`,
  `MerchantReturnPolicy`, `priceValidUntil`, strikethrough price:
  <https://developers.google.com/search/docs/appearance/structured-data/merchant-listing>. The last
  ~4,700 characters were not read.
- Merchant API: <https://developers.google.com/merchant/api/guides/products/overview>,
  `accounts.productInputs.insert`, `.delete`, the `ProductInput` and `ProductAttributes`
  references (all under <https://developers.google.com/merchant/api/reference/rest/products_v1/>).
- Service-account JWT flow (RS256, `aud` `https://oauth2.googleapis.com/token`, one hour at most):
  <https://developers.google.com/identity/protocols/oauth2/service-account>.
- The `tax` attribute page (<https://support.google.com/merchants/answer/6324454>) returned 404, so
  **the feed does not emit `g:tax`**; see "Tax" below.
- **Unverified:** the exact `Price` (`amountMicros`, `currencyCode`) and `Interval`
  (`startTime`, `endTime`) shapes for the Merchant API (the reference text did not include them);
  that `Googlebot-Image` and `Storebot-Google` are the user agents that fetch product images; and
  Google's current rule on where a taxonomy id is required. Nothing here was run against Google.

## What the kit does

### Data model (migration 0037)

Nullable columns on `commerce_products`: `brand`, `gtin`, `mpn`, `condition`,
`google_product_category`, `product_type`, `availability` (override), `availability_date`,
`sale_price_cents`, `sale_starts_at`, `sale_ends_at`, `additional_images` (JSON, at most 10),
`color`, `size`, `material`, `gender`, `age_group`, `item_group_id`, `identifier_exists`,
`weight_grams`, `length_mm`, `width_mm`, `height_mm`, `adult`, `custom_label_0..4`, and
`google_excluded`. Plus an index `(active, id)` for the feed and a small `commerce_google_sync`
table for the optional sync. Settings (return policy, ship-to countries, delivery times, default
brand, sync switch) live in the existing `commerce_settings` key/value table.

Admin: **Google listing** section of each product form in `/admin/products`. API:
`products:write` accepts a `google` object (`GoogleAttributes` in `/api/v1/openapi.json`).

### Validation

Writes are checked for shape and vocabulary (a GTIN with a wrong check digit is refused as it is
typed). The rules that need the whole product are reported by `buildListing`:

| Attribute    | Rule (error leaves the product out of the feed)                                       |
| ------------ | ------------------------------------------------------------------------------------- |
| id           | at most 50 characters                                                                 |
| title        | 1 to 150 characters, no HTML                                                          |
| description  | 1 to 5000 characters, no HTML                                                         |
| image_link   | present, absolute https (a `/media/...` path is made absolute against `site.url`)     |
| additional   | at most 10, each absolute https                                                       |
| price        | greater than zero, currency a real ISO 4217 code                                      |
| sale         | below the regular price; a window needs both ends and start before end                |
| availability | preorder and backorder need a date up to one year ahead                               |
| gtin         | 8, 12, 13 or 14 digits and the mod-10 check digit (a guess is never sent)             |
| brand        | required for new products unless `identifier_exists` is no; falls back to the default |
| apparel      | color, size, gender, age group required when the category is apparel                  |

Warnings (still listed): no GTIN or MPN, no category, no weight, no ship-to country, an ended sale.

### The feed

`GET /feeds/google-products.xml` (RSS 2.0, `g:` namespace) and `GET /feeds/google-products.tsv`.

- Active products only. Auctions (a product with an open auction), products marked "keep out of the
  Google feed", and products with an error are left out; the admin page says why.
- Links and images use `site.url` (the canonical host), never the request host.
- `price` is `12.99 USD`. With a sale the feed states the regular `price`, the `sale_price` and the
  `sale_price_effective_date`, and the shop charges the sale price while the window is open.
- `availability` is `in_stock` unless the product says otherwise. The template keeps no stock count,
  so "in stock" is the owner's statement, not a measurement.
- Shipping: one `g:shipping` per ship-to country from the Google settings, priced at
  `COMMERCE_FLAT_SHIPPING_CENTS` (what checkout charges), with handling and transit days when set.
- XML: every value is escaped, characters XML 1.0 forbids are dropped, element names are fixed in
  code. TSV: tabs, line breaks and control characters in a value become spaces.
- Streamed, one page of 250 rows at a time by `id` (keyset, no OFFSET), through the
  `(active, id)` index. A read error aborts the response, so Google keeps yesterday's feed instead
  of accepting a short one. Cached in the Workers Cache API for 15 minutes (a cache write is not a
  KV write; see [LESSONS_FROM_PINFOOL.md](./LESSONS_FROM_PINFOOL.md)). The only D1 write a fetch
  can cause is the "last fetched" marker, at most once an hour.
- `X-Robots-Tag: noindex`, not in the sitemap (`feeds` is in `SITEMAP_EXCLUDED_ROUTES`).
  `robots.txt` lets `Googlebot-Image` and `Storebot-Google` fetch `/media/`, because a product image
  is often a `/media/` file and an image Google may not fetch is disapproved.

### Which price Google sees

The catalog price, in the product's own currency, from `priceNow` (`google-listing.ts`): the sale
price while a sale window is open, otherwise the regular price. The product page, the JSON-LD
offer, the feed, and the cart/checkout all call it. **Regional (purchasing-power) pricing is not
applied** to the feed or the markup: it is decided per shopper at checkout, and Google cannot see
it. `tests/unit/google-markup.test.ts` fails if the page, the markup, the feed or checkout name
different prices.

### Product page markup

`/shop/[slug]` emits `Product` and one `Offer` in the page's single `@graph` (one Organization, one
WebSite, no duplicate nodes): price, `priceCurrency`, `availability`, `itemCondition`, `seller`,
`brand`, `gtin8/12/13/14`, `mpn`, `sku` (the product id, the same as the feed's `g:id`), an
`image` array, `color`, `size`, `material`, `audience`, `inProductGroupWithID`. A sale adds a
`StrikethroughPrice` `priceSpecification` and `priceValidUntil` (the sale's end). `shippingDetails`
and `hasMerchantReturnPolicy` come from the Google settings and are left out when not set (a
shipping destination with no delivery time is left out, because Google requires one).
`aggregateRating` is emitted only when `reviewCount` is above zero; the template has no reviews,
so none are emitted. A regular price carries no `priceValidUntil`: the shop does not promise one.

### Tax

Google wants US and Canadian prices **without** tax, and prices **with** VAT/GST elsewhere. The
health page checks `COMMERCE_TAX_RATE_PERCENT` and `COMMERCE_PRICES_INCLUDE_TAX` against the
ship-to countries and reports an error when they contradict that. US sales tax is state by state,
so the feed does not claim a flat `g:tax`; set tax in Merchant Center account settings.

### Merchant API sync (optional, off)

For shops that want changes in Merchant Center within minutes. Off by default; the feed needs no
credentials. Owner only, in `/admin/products/google`: store a service-account key (encrypted in KV
by `secret-store.ts`, never in D1, never shown again), enter the account id, an API data source id
and the feed label, switch it on. The `google-merchant-sync` job (`*/10 * * * *`,
`/api/cron/google-merchant-sync`) then sends at most 100 changes per run from a cursor, skips what
did not change (a hash of the payload), and deletes what should no longer be listed. While it is
off a tick is one settings read. `fetch` is injected; **no test and no code path has ever called
Google.**

## Set up Merchant Center, step by step

1. Create a Merchant Center account for the shop. Business information must match the site.
2. Verify and claim the website (Settings, Business info, Website). The feed's links use
   `site.url`, so run `bun run customize` first and make sure it is the live, https address.
3. Make sure the site states what Google checks for: a contact page (`/contact`), a privacy policy
   (`/privacy`), terms (`/terms`), and the return policy in `/admin/products/google`.
4. In `/admin/products/google` set the ship-to countries, handling and transit days, the return
   policy and a default brand (only if you really are the brand).
5. Fill the Google listing section for each product, then open `/admin/products/google` and clear
   the red items.
6. In Merchant Center: Products, Data sources, Add a product source, Scheduled fetch. Paste the XML
   feed address from the admin page, pick the country and language, set a daily fetch. The admin page
   shows when it was last fetched.
7. In Merchant Center, Shipping and returns and Tax: set them if the account asks. Opt in to free
   listings (Growth, Manage programs, Free listings).
8. Wait for review; fix the diagnostics. The admin page lists the same problems earlier.

## Common disapprovals and how the kit prevents them

| Google says                                 | Prevented by                                                          |
| ------------------------------------------- | --------------------------------------------------------------------- |
| Missing image / image not crawlable         | image is required; `/media/` is open to Google's image fetchers       |
| Invalid or wrong GTIN                       | check digit refused at write time and in the feed; a guess never sent |
| Missing brand (new products)                | error on the health page until a brand or default brand exists        |
| Price mismatch between page and feed        | one `priceNow`; a test fails if page, markup, feed or cart disagree   |
| Sale price not valid / expired              | below price, both dates, start before end; stale sale warned          |
| Title or description too long, HTML         | 150 / 5000 limits and no-markup rule                                  |
| Missing apparel attributes                  | color, size, gender, age group required for apparel categories        |
| Availability mismatch with the landing page | feed and markup both take the product's availability                  |
| Missing shipping or return information      | settings feed both the `g:shipping` and the JSON-LD                   |
| Tax settings contradict the destination     | site-level check on the health page                                   |
| Malformed feed                              | escaping, illegal-character stripping, aborted (not short) responses  |

## Could not be verified

Real Merchant Center acceptance; Google's Rich Results Test; the Merchant API (no credentials
exist); the TSV format and the `tax` attribute (page not readable); the image fetcher user agents;
the end of two of the pages above (see Sources). The checks here are the specification as read.

## Files

`packages/commerce/src/google-listing.ts` (rules, renderers), `google-store.ts` (D1),
`src/lib/server/google-feed.ts` and `google-feed-http.ts`, `src/lib/shop/listing.ts`,
`src/lib/seo/structured-data.ts`, `src/lib/server/google-merchant.ts`,
`src/lib/server/scheduler/jobs/google-merchant-sync.ts`,
`src/routes/admin/products/google/`, `src/routes/feeds/`.
