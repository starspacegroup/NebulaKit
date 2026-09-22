# Lighthouse monitoring

Scores for this app's own public pages, refreshed on a schedule and shown at
`/admin/lighthouse` with the specific audits that failed.

## Why PageSpeed Insights, not Lighthouse

Lighthouse drives a real Chrome. A Cloudflare Worker has no browser and could
not afford the CPU if it did — and this project deploys to Cloudflare **Pages**,
which, unlike Workers, has **no Cron Triggers** to run one on.

Google's PageSpeed Insights API runs Lighthouse on Google's infrastructure and
returns the whole report over plain HTTP, so the audit becomes a `fetch`. No
browser, no CI, no build step, and it works for an app generated from this
template on the day it is first deployed.

**The cost, stated plainly:** PSI can only reach a public URL. It cannot audit
`localhost`, a preview behind Cloudflare Access, or anything before the first
deploy. `site.url` has to be real. Until it is, `/admin/lighthouse` says so
rather than showing an empty table.

## Scheduling

There is no cron in a Pages deployment, so something external has to call the
endpoint. It uses the same shared-secret convention as every other
`/api/cron/*` route:

```bash
curl -X POST https://your-app.example/api/cron/lighthouse \
  -H "Authorization: Bearer $CRON_SECRET"
```

Set `CRON_SECRET` in your Pages environment. Any scheduler works — a one-line
Cloudflare Worker with a Cron Trigger, a GitHub Actions `schedule:`, or any
host that can make an authenticated POST.

**Daily is plenty.** PSI's keyless rate limit will not tolerate much more, and
these scores do not move hourly. `?strategy=desktop` audits the desktop form
factor; the default is mobile, which is what Google ranks on. The two are
stored separately because PSI scores them very differently.

`PAGESPEED_API_KEY` is optional and only raises the rate limit.

## What is stored

Two tables (`migrations/0015_lighthouse_audits.sql`):

- `lighthouse_audits` — one row per `(path, strategy)`: the four category
  scores, when it ran, and an `error` when the run failed.
- `lighthouse_findings` — the audits that scored below Lighthouse's own 0.9
  "good" boundary, with the title, description and display value.

**Latest only, not history.** Both tables are keyed on `(path, strategy)` and
each run replaces its own rows, so the table size is bounded by the number of
public pages forever. The trade is deliberate: no trend chart, and in exchange
no retention cron to forget and no table that grows with time. Add history by
dropping the unique constraint and stamping a run id.

A failed run stores `NULL` scores and a reason, never zeros — a zero is a real
score and would read as a catastrophic page.

## What is audited

`auditablePaths()` returns whatever `SITEMAP_ROUTES` in
`src/lib/agent-discovery.ts` already calls public. Derived rather than listed,
so a new public page is audited without anyone remembering — and a page
deliberately kept out of the sitemap is not quietly sent to Google either.

## Two doors, on purpose

| Route                        | Authenticates               | Caller                      |
| ---------------------------- | --------------------------- | --------------------------- |
| `POST /api/cron/lighthouse`  | `CRON_SECRET` bearer        | a scheduler                 |
| `POST /api/admin/lighthouse` | the session, `requireAdmin` | a person pressing "Run now" |

They do not accept each other's credential, and a test pins that. A bearer
secret that works from a browser is a secret in a browser.

## Gotchas

- The sweep is **sequential**. PSI rate limits hard without a key, and a burst
  of parallel requests is the reliable way to get 429s on all of them. On a
  schedule, finishing slowly beats failing quickly.
- `auditPath` **never throws**. One unreachable page must not abandon the rest
  of the sweep, and "PSI could not reach /contact" is something the admin page
  has to be able to show.
- An audit scored `null` is Lighthouse's marker for informative, manual and
  not-applicable checks. It is neither a pass nor a failure, and listing them
  would bury the real findings.
