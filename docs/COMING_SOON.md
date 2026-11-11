# Coming-soon mode

Status: the gate is built (issue #11, first slice). The admin interface, preview token, CMS-backed copy, maintenance mode and discovery-surface changes are not built yet.

## What it does

KV key `site_mode` holds `{ "mode": "off" | "coming-soon", "updatedAt": "<ISO>" }`. When the mode is `coming-soon`, `siteModeHandler` (`src/hooks.server.ts`) answers a signed-out visitor with a holding page built from `site.name` and `site.tagline`.

- A page read (GET, HEAD) gets `200` with `Cache-Control: no-store`. Before launch, the holding page is the site.
- Any other method gets `503` with `Retry-After`.
- An admin (any role above user) passes through on their session.
- A missing binding, a KV error, or an unreadable value means `off`. A bad row never takes a site down.

Until the interface ships, set the value by hand in KV, or with `writeSiteMode` in `src/lib/server/site-mode.ts`.

## Reachable while gated

`GATE_ALLOWLIST` in `site-mode.ts` is the contract, and `tests/unit/site-mode.test.ts` holds it: `/setup`, `/auth/*`, `/api/auth/*`, `/api/setup`, webhooks, cron, health, `/robots.txt`, favicons, the manifest and `/_app/*`. A prefix matches a whole path segment.

## Order and cost

The handler runs after `authHandler`, so `locals.user` is known, and before `pageViewsHandler`, so a gated visit is not counted as a page view. Whether to count them is an open question in the issue.

Each isolate caches the mode for 30 seconds, including the `off` state, so a launched site pays almost no KV reads.

## Not yet true

`sitemap.xml`, the API catalog and `/auth.md` still advertise routes that return the holding page while the gate is on. Shrinking them is the next slice.
