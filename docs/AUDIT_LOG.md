# Admin audit log

An after-the-fact record of who changed what, from the admin area or the site API. It exists so an
owner can answer "who deleted that?" and "who turned that on?" without guessing.

**What is recorded:** mutations only. Never a page view, never a read, never a failed request.

| Area              | Actions                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| Users             | `user.invite`, `user.role_change` (admin on or off), `user.delete`, `user.merge`                |
| Content (CMS)     | `cms.create`, `cms.update` (records the new `status`, so publishing shows), `cms.delete`, types |
| Settings and keys | `settings.*`, `ai_key.*`, `auth_key.*`, `api_key.create`, `api_key.revoke`                      |
| Pages (builder)   | `page.create`, `page.save`, `page.delete`, `page.restore`                                       |
| Shop (`/api/v1`)  | `product.create/update/delete`, `order.update`                                                  |
| Site              | `site.reset`, `settings.site_updates`, `contact.resolve`                                        |

**Secrets are never written.** A key, token or setting change records _that_ it changed, not the
value. Two layers enforce it: the row detail is built from an allowlist of body fields (never the
whole body), and `scrubDetail` redacts any key named like `token`, `secret`, `password`, `code`,
`key`, `authorization`, `cookie`, `signature`, `credential` or `hash` at any depth. Identifiers
such as `keyId` are kept. Detail is bounded (strings 200 characters, 20 array items, depth 4,
2,000 characters serialized, else `{"truncated":true}`).

**Recording never fails a request.** `recordAudit` catches everything (a full table, a database
without migration 0025) and logs to the console. The one cost is a single insert after a
successful mutation.

## Where it hooks in

Shared points, not scattered calls:

- `auditHandler` in `src/hooks.server.ts` (delegates to `auditAround` in `src/lib/server/audit.ts`)
  covers `/api/admin/*`, `/api/cms/*` and `/admin/*` form actions. It sits just before
  `authHandler`, so the documented order of the other handlers is unchanged. It reads
  `locals.user` after the response, records only a signed-in admin or owner, and only when the
  response succeeded (a form action's `failure` result does not count).
- `siteApi()` in `src/lib/server/site-api.ts` covers every `/api/v1` write with the API key
  (`key:<name>`), the orchestrator or the signed-in session that made it. Public endpoints
  (checkout, the Stripe webhook) are not audited.
- `mergeAccounts()` in `src/lib/services/account-merge.ts` records `user.merge`, because merges
  also happen from the OAuth link flow, not just an admin screen.

To audit a new mutation, add one entry to `AUDIT_RULES` in `src/lib/server/audit.ts`. Keys are
`METHOD /route/id` or `ACTION /route?/name` for a form action.

## Storage

Table `admin_actions` (migration `0025_audit_and_sign_ins.sql`). The actor and the target are
**snapshots** (id plus login), deliberately not foreign keys, so a row still names a user after
that user is deleted or merged away.

## Viewing

`/admin/audit`, any admin. Server-side filters `?actor=` and `?action=`, then the `AuditLog`
module for search, severity, paging and expandable detail. The newest 500 matching rows load.

## Retention

365 days. There is no scheduler in the template: `POST /api/cron/prune-audit` deletes older rows
and is authenticated exactly like `prune-view-stats`, with `Authorization: Bearer $CRON_SECRET`.
Call it from any scheduler.

```bash
curl -X POST https://your-app/api/cron/prune-audit -H "Authorization: Bearer $CRON_SECRET"
```
