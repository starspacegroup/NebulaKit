# Admin Stats — first-party, cookie-free analytics

NebulaKit ships its own analytics rather than a third-party tag. Everything is a
**daily aggregate counter in D1**: no raw request rows, no cookies, no
identifiers, no IP addresses, and therefore nothing to put a consent banner in
front of.

Live at **`/admin/stats`**, gated on the per-admin `can_view_stats` grant.

| Panel                 | Answers                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| **Overview**          | Users, admins, content items, contact forms, chat messages                                        |
| **Growth over time**  | New users and new content per month, gap-filled, with cumulative totals                           |
| **Platform usage**    | How close you are to Cloudflare's plan limits, and whether today is on track to blow through them |
| **Traffic**           | Views over time, by route, by referrer, by country                                                |
| **Audience**          | OS, browser, device, language, viewport — coarse buckets only                                     |
| **Content by status** | Published / draft / archived                                                                      |

---

## Setup

1. **Apply the migrations** (`0007`–`0009`):

   ```bash
   bun run db:migrate:local     # or db:migrate for remote
   ```

2. **Grant yourself access.** The owner sees Stats automatically. Any other admin
   needs `can_view_stats`:

   ```sql
   UPDATE users SET can_view_stats = 1 WHERE email = 'someone@example.com';
   ```

3. **Schedule the retention prune** (optional but recommended — without it the
   counter tables grow one row per day forever). Set `CRON_SECRET` and POST to
   the endpoint from any scheduler:

   ```bash
   curl -X POST https://your-app.example.com/api/cron/prune-view-stats \
        -H "Authorization: Bearer $CRON_SECRET"
   ```

   Retention is 400 days — roughly 13 months, so year-over-year comparisons still
   have last year to compare against. The prune covers all six counter tables,
   including `platform_usage_daily`; nothing else deletes from any of them.

That's it. Collection starts on the next request; no client-side script, no
account, no API key.

---

## What gets collected, and what doesn't

Two server hooks in `src/hooks.server.ts` do all the writing, both **after**
`resolve()` and both fire-and-forget via `waitUntil` — no visitor ever waits on a
counter, and a stats failure never breaks a page.

**`pageViewsHandler`** records a _human page view_. It is deliberately narrow: a
matched route id, `GET`, status 200, `text/html`, not an `/admin`, `/api` or
`/setup` route, and not a bot UA. It runs last in the sequence so `locals.user`
is populated and the signed-in count is accurate.

**`usageHandler`** records a _billable Function invocation_ — a strictly larger
set including bots, `/api/*`, redirects, 404s and non-GET. It runs first so
nothing that returns early goes uncounted.

The two numbers are _supposed_ to disagree. The gap between them is diagnostic,
and it is usually bot traffic.

### Privacy specifics

- **The raw User-Agent is never stored.** It is read in the hook, mapped to a
  small closed vocabulary (`'Windows'`, `'Chrome'`, `'mobile'`, …), and dropped. A
  full UA string is quasi-identifying; a value from a fixed list is not.
- **Country comes from the Cloudflare edge** (`platform.cf.country`). No IP is
  read or stored. It stays `(unknown)` in local dev.
- **`path_key` is the SvelteKit route id** (`/blog/[slug]`), never the resolved
  URL — so a million posts are one row, and slugs and query strings cannot leak
  into the analytics table.
- **Referrers are stored host-only**, bucketed to `(direct)` when absent or
  same-site.
- **Viewport** is the one dimension headers cannot supply, so the root layout
  beacons the bucketed `innerWidth` once per session to `/api/stats/viewport`.
  Only the breakpoint bucket is stored; the raw width is validated and discarded.

---

## Schema

Five page-view counter tables plus the usage meter, all upserted on
`PRIMARY KEY (day, …)`:

```yaml
page_view_daily: { day, path_key, views, signed_in } # route-level, the spine
page_view_hourly: { day, hour, views, signed_in } # totals only — 24 rows/day
referrer_daily: { day, referrer_host, views }
country_view_daily: { day, country, views }
view_dimension_daily: { day, dimension, value, views } # os|browser|device|language|viewport
platform_usage_daily: { day, requests, not_found, bot, updated_at }
```

`view_dimension_daily` is one generic table for every low-cardinality dimension,
so adding a dimension is a new `dimension` value rather than a migration.

`page_view_hourly` carries no path/referrer/country breakdown on purpose — that
is what keeps it at 24 rows per day instead of 24× the daily table. It exists
because the 1-day traffic window would otherwise render as two fat bars
(yesterday and today-so-far).

---

## The platform-usage meter

Workers Free is **100,000 requests per UTC day, shared account-wide**, and the
site simply stops serving when it runs out. `projectUsage()` answers the only two
questions that matter: how much of today's allowance is gone, and — at the
current rate — do you run out before the UTC reset (`willExhaustToday`). Past the
paid plan's 10M included monthly requests it also estimates overage in USD.

### Why it's buffered

A D1 write per request would roughly double write volume and eat the free-tier
write allowance at exactly the traffic level where you can least afford it. Each
isolate counts in memory and flushes on a **rate limit, not a batch size**:

```
flush if:  pending >= 25              (hard cap)
        or lastFlush === null         (first request this isolate has seen)
        or now - lastFlush >= 1000ms
```

Batching by count alone breaks at _low_ traffic — the common case — because an
isolate holding 1–3 counts may never receive another request to trigger the
flush, and those counts die with it. Rate-limiting inverts that: a quiet site
writes on essentially every request (cheap, and accurate), a busy one is capped
at ~1 write/second/isolate. A day rollover flushes the old day's remainder under
the old key first, so counts never fold into the wrong day.

Counts can be lost when an isolate is evicted holding an unflushed remainder, so
this is a slight **under-count and a floor, not a billing-grade figure**.
Cloudflare's dashboard stays the source of truth; this exists for early warning.

---

## Access control

```
canViewStats             = isOwner || isSuperAdmin || can_view_stats grant
canManageStatsConnection = isOwner || isSuperAdmin
```

`assertCanViewStats()` throws 403 on the route itself as defence in depth — the
admin layout guard already blocks non-admins, so this only ever _narrows_. The
sidebar hides the Stats link for admins without the grant, but the route is what
enforces it.

`can_view_stats` defaults to 0 so existing admins don't silently gain access on
upgrade. It is refreshed from the database on every request by the auth hook, so
revoking it takes effect without waiting for a re-login.

---

## Fail-soft rules

The load function holds three rules, and they're worth preserving if you extend
it:

1. **Fail-soft per block.** Every optional query carries `.catch(() => [])` and
   each panel degrades as a unit. A database missing a migration loses one panel,
   not the dashboard.
2. **No `platform.env.DB`** (local dev without D1) returns a fully-shaped empty
   payload rather than throwing.
3. **The clock is server-authoritative.** `trafficNowHour` is computed once on the
   server and passed down. If the client re-derived it, SSR and hydration would
   disagree across an hour boundary and the chart would flicker.

Chart geometry lives in pure functions in `src/lib/utils/stats-timeseries.ts`
(`fillDailySeries`, `fillHourlySeries`, `buildBarChartGeometry`, …), so
`StatBarChart.svelte` only renders what it is handed and the maths is unit-tested
without a browser. Sparse rows are gap-filled into dense series first — a month
with no rows renders as a zero bar, not a missing one.

### Chart colors

Series colors are `--chart-views`, `--chart-users`, `--chart-content` and
`--chart-usage` in `src/app.css`. Light and dark are **stepped independently
against their own surface**, not flipped, and both were validated for
colorblind separation (deutan/protan/tritan ΔE), lightness band, chroma floor and
contrast. Re-validate if you change one.

---

## Files

| Path                                      | What                                   |
| ----------------------------------------- | -------------------------------------- |
| `migrations/0007_page_view_stats.sql`     | The five page-view counter tables      |
| `migrations/0008_platform_usage.sql`      | The usage meter table                  |
| `migrations/0009_user_can_view_stats.sql` | The per-admin grant                    |
| `src/hooks.server.ts`                     | `pageViewsHandler`, `usageHandler`     |
| `src/lib/utils/page-views.ts`             | Bucketing + counter reads/writes       |
| `src/lib/utils/usage.ts`                  | Buffered request counting + projection |
| `src/lib/utils/stats-timeseries.ts`       | Gap-filling + SVG chart geometry       |
| `src/lib/server/stats-guard.ts`           | Access policy                          |
| `src/lib/components/StatBarChart.svelte`  | The bar chart                          |
| `src/routes/admin/stats/`                 | The page                               |
| `src/routes/api/stats/viewport/`          | Viewport beacon                        |
| `src/routes/api/cron/prune-view-stats/`   | Retention                              |

---

## Known limits

- **`signed_in` counts signed-in _views_, not signed-in _visitors_.** There are no
  visitors to count, by design.
- **Bot detection is a UA regex.** Cheap, and good enough to keep the human number
  honest; it is not adversarial.
- **Viewport needs JavaScript.** The other four audience dimensions come from
  headers and work without it.
