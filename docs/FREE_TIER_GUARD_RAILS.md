# Free-tier guard rails

NebulaKit sites start on a Cloudflare **free** account. The limits are hard walls: when one is reached
the call fails until 00:00 UTC. This page is the short version of what to do about it. The long
account of one site that hit the wall is `docs/LESSONS_FROM_PINFOOL.md`.

## What happened (PinFool, 2026-11-15 and 2026-11-16)

PinFool is a shop of about 1,900 products on the free plan. Its D1 database read 7.49M rows on
2026-11-15 and 5.89M on 2026-11-16, against a cap of 5M rows read a day, so every D1 query failed with
code 7500 until midnight UTC. Most of the reads came from three things: the shop list sorted the whole
products table on every page view (no index, about 2,800 rows read per call), a page-count query
scanned all products on every view, and crawlers multiplied both. A first fix cached data in KV with
one key per product, which spent KV's 1,000 writes a day within hours, after which nothing was cached.

The fix that held has four parts. An index that matches the list's `WHERE` and `ORDER BY`. A cache in
memory plus the Cloudflare Cache API (no daily quota), keyed on a few shared keys, that serves the last
good copy if D1 fails. One shared counts query instead of a `COUNT(*)` per page. And no KV writes on
any request path. (The PinFool fixes are commits 4505f0d, 265e46e and fbdd297 in its repo; this page was
written without checking that they are deployed.) This kit now ships the pieces so a new site does not
have to learn it again.

## The limits (Workers Free)

| Limit                   | Number    | Resets    | When reached           |
| ----------------------- | --------- | --------- | ---------------------- |
| D1 rows read per day    | 5,000,000 | 00:00 UTC | every D1 read fails    |
| D1 rows written per day | 100,000   | 00:00 UTC | every D1 write fails   |
| KV reads per day        | 100,000   | 00:00 UTC | reads fail             |
| KV writes per day       | 1,000     | 00:00 UTC | `put` fails            |
| Worker requests per day | 100,000   | 00:00 UTC | the site stops serving |

"Rows read" counts rows **scanned**, not rows returned. 00:00 UTC is 7 PM Eastern.

## Rules

1. **Index every list.** A query with `ORDER BY ... LIMIT` needs an index on its `WHERE` columns then
   its `ORDER BY` columns, or it sorts the whole table. Check with `EXPLAIN QUERY PLAN`: you want
   `SEARCH ... USING INDEX`, not `SCAN` plus `USE TEMP B-TREE FOR ORDER BY`. `migrations/0029_product_list_index.sql`
   is the pattern. If you add a filter (`draft`, `unlisted`, `nsfw`), the index must include it.
2. **No `OFFSET` on a big table.** Every skipped row is a row read. Use keyset pagination
   (`WHERE (created_at, slug) < (?, ?)`) or cap the page depth.
3. **No leading-wildcard `LIKE '%x%'` over a growing table.** It cannot use an index.
4. **Cache public reads.** Use `cached()` from `$lib/server/read-cache`. It uses memory plus the Cache
   API, serves stale if D1 fails, and has a bounded memory footprint. Use a few shared keys (one list,
   one counts row), never one key per item.
5. **No KV writes on a request path, and no per-key KV caches.** KV is for a few rarely written
   settings.
6. **No per-request D1 writes you can batch.** Page-view counters go through
   `$lib/utils/page-view-buffer` (coalesced, one upsert per counter per flush).
7. **Fail loudly, or serve stale.** A `catch` that returns an empty page with a 200 hides an outage.
8. **Do not audit production with scripted browsers.** Use a local dev server or a preview deployment.

## Measure

- Per query: `wrangler d1 insights <db> --timePeriod 1d --sort-type sum --sort-by reads --limit 8`.
  Compare `avgRowsRead` with `numberOfTimesRun`. A page query averaging thousands of rows is the problem.
- Per day: Cloudflare dashboard, D1 database, Metrics, rows read and written. Days reset at 00:00 UTC.
- Locally: apply the migrations to a scratch SQLite file, load a realistic number of rows, then
  `EXPLAIN QUERY PLAN <your query>`. For the scan, `SCAN <table>` means every row is read.
- Before shipping a list query: `bun run check:queries` (below).

## Tools in this repo

- `src/lib/server/read-cache.ts`: `cached(key, fn, seconds?)`. Property-tested (never more than one
  read per key per window, stale on failure, bounded memory). Without the Cache API (tests, plain dev) it
  just runs `fn`.
- `src/lib/utils/page-view-buffer.ts`: used by the page-views hook. A quiet site still writes every
  view; a busy one writes at most one batch every 5 seconds per isolate. Property-tested: the increments
  written equal the views recorded. Counts can be lost only if an isolate is evicted holding a remainder.
- `bun run check:queries` (`scripts/check-queries.mjs`): flags `OFFSET`, leading-wildcard `LIKE` and
  `kv.put` in `src/`. It cannot prove a query is cheap; it makes the risky shapes visible. Mark an
  accepted one with `cost-guard: ok <reason>` on the line or the line above. Existing findings are in
  `scripts/check-queries.baseline.json`; new ones fail the check. `--update` rewrites the baseline.
  It is not part of `validate:all`; add it to CI when you want it to gate.
- `migrations/0029_product_list_index.sql`: the product list indexes.

## Known gaps

- `login-throttle.ts` writes KV on each failed login attempt, and a few setup and admin routes write KV
  (all listed in the baseline). A bot hammering the login route could spend the 1,000 daily KV writes.
- The settings and CMS lookups that run on every request are cheap but unbounded in count. Wrap them in
  `cached()` when a site gets traffic.
- There is no usage readout in the admin yet. `docs/LESSONS_FROM_PINFOOL.md` has the GraphQL query.
