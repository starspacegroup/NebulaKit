# Admin time zone

Every date and time in `/admin/**`, and the day and hour buckets on the Dashboard charts, are shown
in one zone. Public and customer-facing pages are not affected.

## Which zone

1. The user's own zone, when set (`/profile#time-zone`, any signed-in user, their own only).
   Stored in `users.time_zone` (migration `0033`; NULL means no personal choice). A column rather
   than a per-user row in `site_settings`: it is one value owned by one user, it goes away with the
   user, and it needs no key-naming convention. `PUT /api/profile/timezone` takes the user from the
   session, never from the body or URL, validates with `Intl`, and clears on `auto`. It is audited as
   `user.timezone`, but the audit hook only records admins and owners, so a plain user's change is
   not logged.
2. The site setting, when it is an IANA zone (`/admin/settings`, owner only). Stored in
   `site_settings` under `admin_timezone` (migration `0032`; a generic key/value table, because
   `commerce_settings` is shop-specific). Audited as `settings.admin_timezone`.
3. Otherwise the browser's zone, from the `tz` cookie.
4. Otherwise UTC.

The default setting is `auto`, which means step 2. `resolveTimeZone(setting, cookie, personal)` in
`src/lib/utils/timezone.ts` is the only place that decides, and it never returns a zone
`Intl.DateTimeFormat` rejects.

## The cookie

`src/routes/admin/+layout.svelte` reads the browser's zone with
`Intl.DateTimeFormat().resolvedOptions().timeZone`. No permission prompt: it is not geolocation. It
writes `tz` (`Path=/`, `SameSite=Lax`, one year, `Secure` on https, not HttpOnly because script
writes it) only when it differs from what is there. It is never put in a URL.

The server treats the cookie as untrusted input. It is validated by shape and then by `Intl`, and
anything else is ignored (UTC). A hostile value cannot reach SQL, HTML or a header: the layout hands
pages a validated canonical name, not the cookie.

First visit only: no cookie exists yet, so the server renders UTC, the client sets the cookie and
re-runs the loads once (`invalidateAll`), and the page re-renders in the browser's zone. Every later
request renders in it on the server, so there is no flicker and no hydration mismatch. Server and
client format with the same zone and a fixed `en-US` locale. A bare `toLocaleString()` would use the
machine's locale instead, which is why admin numbers use `formatNumber`.

## Where it flows

The admin layout load returns `timeZone`, `timeZoneSetting`, `timeZoneSource` and `timeZoneLabel`.
Every admin page reads `data.timeZone` (layout data merges into page data) and formats with
`formatDate` / `formatTime` / `formatDateTime`. The zone is named in the sidebar and under the
Dashboard title, and in Settings and the profile. The sidebar says where the zone comes from (your preference, site
setting, browser) and links to the control.

Rule, enforced by `tests/unit/admin-timezone.test.ts`: no bare `toLocale*String()` in
`src/routes/admin` or `src/lib/components/admin`.

## What stats bucketing can and cannot do

Counters are written per UTC day and per UTC hour. Nothing finer is stored, so a UTC day cannot be
split into zone days, but UTC hours can be regrouped.

| Thing                                                                     | Behaviour                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 24-hour views chart                                                       | The 24 buckets stay UTC hours. Only the labels move to the zone. In a :30 or :45 zone a bucket starts at :30 or :45 and is labelled so.                                                                                                                                                                                                                                    |
| 7, 30, 90-day views chart                                                 | Outside UTC, rebuilt from `page_view_hourly` into days of the zone. Each UTC hour goes to the zone day in which it starts, so in a half-hour zone at most the one hour that straddles local midnight is misplaced; nothing is lost or counted twice. The window is the last N zone days plus today. With no hourly rows it falls back to UTC days and the caption says so. |
| Views by page, referrers, countries, audience, traffic split, top content | Stored per UTC day with a dimension, so they cannot be re-bucketed. Their window is whole UTC days, and the page says so.                                                                                                                                                                                                                                                  |
| Platform usage meter                                                      | Stays on UTC days and the UTC month: Cloudflare's limits reset at 00:00 UTC.                                                                                                                                                                                                                                                                                               |
| Users and content by month                                                | Rebuilt in the zone from per-minute counts of `created_at` (UTC), so DST is respected.                                                                                                                                                                                                                                                                                     |

The Dashboard load reads the layout's zone on every request, so two admins with different zones
get different buckets and "today" from the same counters (`tests/unit/admin-timezone.test.ts`).

`/api/stats/summary` (external dashboards) is unchanged: it buckets in UTC.

## Tests

`tests/unit/timezone.test.ts` (property tests: resolution never returns an invalid zone, formatting
never throws, day keys are stable and monotone, DST in New York, Lord Howe and a +5:45 zone neither
loses nor duplicates an hour or day), `tests/unit/admin-timezone.test.ts` (layout precedence and
hostile cookies, the settings endpoint, stats bucketing, the no-bare-`toLocale` guard) and
`tests/e2e/admin-timezone.test.ts` (headless; emulates `Asia/Kolkata`).
