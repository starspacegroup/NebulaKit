# Lessons from PinFool (a NebulaKit fork in production)

Written 2026-11-16 from the PinFool build (`~/_Projects/client/RobbieSchroeder/Pinfool/nebulakit-pinfool-site`,
github.com/pinfool/pinfool-site). PinFool is a shop of about 1,900 products on a Cloudflare **free**
account. It took the shop down for hours on launch week. Most of this applies to any NebulaKit site on
the free plan, and some of it is in the base kit. Items marked **verify in base** were seen in PinFool,
which carries the same hooks and layout; check them in this repo before changing anything.

## 1. The outage: free-plan limits are hard walls

On 2026-11-15/16 every D1 query failed with `exceeded D1's free tier daily row read limit` (code 7500).
Every page that reads D1 returned 500 until 00:00 UTC. The home page caught the error and showed an
empty wall with a 200, which is worse than an error: nothing alerts anyone.

| Free-plan limit          | Number    | What breaks                                        |
| ------------------------ | --------- | -------------------------------------------------- |
| D1 rows read per day     | 5,000,000 | All D1 reads fail until 00:00 UTC                  |
| D1 rows written per day  | 100,000   | All D1 writes fail until 00:00 UTC                 |
| KV writes per day        | **1,000** | `kv.put` fails; reads still work                   |
| KV reads per day         | 100,000   | Reads fail                                         |
| Workers requests per day | 100,000   | See `src/lib/utils/usage.ts` `FREE_DAILY_REQUESTS` |

"Rows read" counts rows **scanned**, not rows returned. A `COUNT(*)` over 1,871 rows costs 1,871. An
`ORDER BY created_at DESC LIMIT 48` with no index sorts the whole table, so it also costs the whole table.

### What actually burned the reads (from `wrangler d1 insights`)

- Shop list query, no index: 664 runs a day at about 3,600 rows each.
- Home and "More pins" list query: 954 runs at about 2,400 rows each.
- Page count query: 743 runs at 1,871 rows each.
- Crawlers walking every product page made the per-product work multiply by the catalogue size.
- Audit screenshots run against production added to it. Do not run audits against production.

### The first fix failed, and why

A KV cache was added (5-minute TTL). It had one key **per product page** (about 1,870 keys). Each miss
wrote a key. KV allows 1,000 writes a day, so the quota ran out within hours, `put` started failing
silently (the helper swallowed errors, as it should), and from then on nothing was cached. D1 reads
went back to full speed. Lesson: **never use KV as a per-key cache on the free plan.** KV is for a few
rarely written settings.

### The fix that works

`src/lib/server/kv-cache.ts` in PinFool (copy it, see section 5):

- Layer 1, in-memory `Map` per running instance. Free, instant.
- Layer 2, the Cloudflare **Cache API** (`caches.default`) with a synthetic request URL. No daily
  quota, per data centre.
- **Stale on error:** if the database call throws (limit reached, outage), serve the last good copy
  from memory instead of a 500.
- Outside Workers (vitest, plain dev) `caches` is undefined and the helper just runs the function, so
  tests need no setup.
- Shared **counts**: one query (`categoryCounts`, a single `SUM(...)` row) feeds the home page, shop,
  category pages and product pages. Page totals come from it, so there is no `COUNT(*)` per request.
- Bucketed lists: "More pins" uses 40 shared starting points kept for an hour, not one query per
  product. A crawler costs 40 queries, not 1,870.
- An index matching the list's `WHERE` and `ORDER BY`: `(active, nsfw, created_at DESC, slug)`.
  Migration `0031_product_list_index.sql` in PinFool.

## 2. Rules to apply across NebulaKit

1. **Budget reads and writes per page view.** A public page should cost a handful of rows, not a table
   scan. Anything that scans a growing table (counts, search, sort) needs an index or a cache.
2. **No per-key KV caches, no per-request KV writes.** Use memory plus the Cache API for derived data.
3. **Serve stale on failure** for any public page whose data changes slowly.
4. **A catch that returns an empty 200 hides outages.** Log it, or return the stale copy, or fail
   loudly. Do not show a blank page as healthy.
5. **OFFSET reads every skipped row.** Deep pages are expensive; cap the page depth or use keyset
   pagination for big tables.
6. **Cache TTLs are a product decision.** PinFool uses 5 minutes for shop data, 1 hour for "More pins".
   Admin edits show within the TTL; say so in the admin UI if it matters.
7. **Do not audit production with scripted browsers.** Use a local dev server (the dev auth simulation
   works) or a preview deployment with its own D1.
8. **Check for the paid plan early.** Workers Paid is $5 a month and lifts D1 to 25 billion reads a day
   and KV to a million writes. For a client with real orders, the free plan is a launch risk. This is a
   billing decision for the account owner, not for the agent.

## 3. Things in the base kit to review (verify in base)

- **Per-request D1 writes in the hooks.** PinFool's day showed 2,924 single-row upserts into
  `platform_usage_daily` plus page-view tables (`page_view_daily`, `view_dimension_daily`,
  `page_view_hourly`, `country_view_daily`, `referrer_daily`). That is a large share of the 100,000
  daily write allowance on a quiet site; a crawler burst could exhaust it. Buffer and flush in
  batches (there is a `_resetUsageBuffer` in `src/lib/utils/usage.ts`, so a buffer may already
  exist; check it flushes per batch rather than per request), or sample bot traffic.
- **Settings and CMS lookups on every request.** `SELECT value FROM commerce_settings WHERE key = ?`
  ran 5,192 times and `SELECT ... FROM builder_pages WHERE published = 1 ORDER BY slug` 2,278 times in
  a day. Each is cheap, but they are pure per-request overhead; wrap them in `cached()`.
- **`login-throttle.ts` writes KV on each failed attempt** (`kv.put` with `expirationTtl`). Fine for
  admin logins, but a bot hammering login can use the 1,000 daily writes. Consider D1 or a hard
  attempt ceiling before writing.
- **Sitemap and any "list everything" route** should read from the cached counts and cached lists, and
  read the cache age before other queries (the mock D1 test helper dequeues `_first` results in call
  order, so an extra `.first()` breaks tests).
- **Add a usage readout.** The admin stats could show D1 rows read and written today from the
  Cloudflare GraphQL analytics (query below), with a warning at 70%. Nobody saw this coming because
  nothing showed it.

## 4. How to diagnose D1 usage (copy these)

Daily totals per database (account token needs Analytics read):

```graphql
query {
	viewer {
		accounts(filter: { accountTag: "<ACCOUNT_ID>" }) {
			d1AnalyticsAdaptiveGroups(
				limit: 20
				filter: { date_geq: "YYYY-MM-DD", date_leq: "YYYY-MM-DD" }
				orderBy: [date_ASC]
			) {
				dimensions {
					date
					databaseId
				}
				sum {
					readQueries
					writeQueries
					rowsRead
					rowsWritten
				}
			}
		}
	}
}
```

POST it to `https://api.cloudflare.com/client/v4/graphql` with `Authorization: Bearer <token>`.

Top queries by rows read:

```
wrangler d1 insights <db> --timePeriod 1d --sort-type sum --sort-by reads --limit 8
```

Look at `avgRowsRead` against `numberOfTimesRun`. A page query averaging thousands of rows is the
culprit. The same command with `--sort-by writes` shows the write budget.

Test whether KV writes are exhausted: `wrangler kv key put --namespace-id <id> --remote probe 1 --ttl 60`
fails with code 10048 when the daily quota is gone.

## 5. Code to port from PinFool

All paths are in `nebulakit-pinfool-site`.

- `src/lib/server/kv-cache.ts` and `tests/unit/kv-cache.test.ts`: the cache helper and its tests
  (passthrough without a cache, reuse within the window, stale on error, failure with nothing to fall
  back on).
- `src/lib/server/shop-counts.ts`: one shared counts query, cached.
- `packages/commerce/src/store.ts` `categoryCounts`: all counts in one `SELECT SUM(...)` row.
- `migrations/0031_product_list_index.sql`: the index pattern.
- `src/lib/server/shop-load.ts`, `src/routes/+page.server.ts`, `src/routes/shop/[slug]/+page.server.ts`:
  how the cache wraps each loader, and the 40-bucket "More pins".

## 6. Other lessons worth keeping

- **Route files cannot export helpers.** SvelteKit fails the build with "Invalid export" for any export
  that is not a verb or `load`/`actions` etc. Shared loaders belong in `$lib/server`. A failed build
  deploys nothing, so the previous build stays live.
- **The OpenAPI test is a real guard.** It failed because `/api/v1/products/bulk` was undocumented.
  When adding an API route, add it to `src/lib/server/site-openapi.ts` in the same change.
- **After changing route load return types, run `bunx svelte-kit sync`.** Stale generated types gave
  15 false errors.
- **Prettier reformatting breaks exact-string patch scripts.** Format first, then patch, or use Edit.
- **Scroll-snap rows need `scroll-padding-inline`,** or the first item sits flush against the edge.
- **Dark mode on custom palettes:** UI that sits on a coloured board needs its own palette variables
  (`--board`, `--board-ink`, `--board-paper`, `--board-chip`); reusing `--color-text/--color-bg` made
  chips unreadable in dark mode.
- **Brick-pattern grids** (`repeat(calc(var(--cols)*2+1), 1fr)`, each item spans 2, offset rows start
  at column 2) behave well at any width; PinFool uses 2 columns under 24rem up to 8 wide.
- **Resend:** a restricted key can only send. Creating domains needs a full-access key. Make a
  domain-scoped sending key for production and keep the admin key out of the app.
- **Mobile first, verified by looking.** The shop only became good after screenshots at 390px in both
  themes. Passing tests did not catch the cut-off home wall or the low-contrast chips.
- **Stripe:** checkout used the hosted page, so no card data touches the app. A client's Stripe account
  can be shared with another product; never touch the other product's key.

## 7. Suggested tasks for NebulaKit

1. Port `cached()` and its tests into `src/lib/server/`, and use it for settings, CMS pages and
   sitemap data.
2. Audit the hooks for per-request writes; batch or sample them.
3. Add a "Cloudflare usage today" panel to admin stats (D1 reads and writes, KV writes) with a warning
   threshold.
4. Add a `docs/CLOUDFLARE_SETUP.md` section on free-plan limits and when to move to Workers Paid.
5. Add a lint or test that flags `kv.put` inside a request path that is not admin-only.
6. Make the home page and other public pages fail loudly (or serve stale) when D1 errors, instead of
   rendering empty with a 200.
