# Status page

Every NebulaKit site has a public status page at `/status`, and the same data as JSON at
`/api/status`. It needs no sign-in. An owner or superadmin posts and updates incidents at
`/admin/status`. It is the page a customer opens when something looks wrong, so it has one
rule above the rest: **it never says "all clear" unless it checked.**

Designed and run first on SpaceBot's status page; this is the same logic for a NebulaKit site.

## What it measures

Only things that are really checked. Each is operational, slow (degraded) or down.

| Component | How it is checked                                                              | Down when                     | Slow when     |
| --------- | ------------------------------------------------------------------------------ | ----------------------------- | ------------- |
| Website   | The cron Worker fetches `/api/status/ping` from outside the app, once a minute | No answer, or an error status | 3 s or more   |
| Database  | `SELECT 1` on D1, timed                                                        | The query fails               | 1.5 s or more |

The ping route touches no database on purpose. `/api/health` checks D1 and answers 503 when it is
down; if the probe used it, one database outage would also read as the website being down.

## How a status changes

A change is shown only after **two checks in a row** agree (`CONFIRM_WORSE`, `CONFIRM_BETTER` in
`src/lib/status/logic.ts`), so one failed probe never reaches the page. A worsening is dated to its
first bad check, a recovery to the check that confirmed it.

## Incidents

- **Opened by the checks.** When a component is confirmed slow or down, an incident opens by itself
  ("Website is unavailable"), with a first update saying it came from the checks. One per
  component: a slow site that goes down changes the same incident (minor to major) and adds an
  update. When the component is confirmed operational again, the incident is resolved.
- **Posted by a person** at `/admin/status`: title, impact (minor, major, critical or planned
  maintenance), stage, which components, and a message. Updates move the stage (investigating,
  identified, monitoring, resolved). Posting is public at once. Plain text only, 120 characters for
  a title and 2,000 for a message.
- Checks never close an incident a person opened, and a person's incident never stops the checks
  from opening their own.

## History

`status_daily` counts checks per component per UTC day. The page shows 90 days as bars (red after
five checks down in a day, amber for any other trouble, grey for no data) and an uptime figure cut
to two decimals, never rounded up, so a day with an outage cannot read 100.00%. Rows older than 400
days are deleted at 03:00 UTC, in bounded batches.

## When the checks stop

If the newest check is older than five minutes, or no check has ever run, the page says **"Status
checks are delayed"** and does not claim all is well. If the data cannot be read, it says so, and
`/api/status` answers 503. The page runs on the same Cloudflare Pages app as the site, so a full
Pages outage takes it down too: the probe cannot deliver its result to a site that is not there,
and a stale page is the honest consequence.

## Turning it on

It is on in the template, but the checks run from the cron Worker, so after `bun run db:migrate`
(migration `0028`):

1. Deploy `cron-worker/` (`cd cron-worker && bunx wrangler deploy`). It now has a `* * * * *`
   trigger. `CRON_SECRET` and `TARGET_URL` are the same ones the other jobs use
   (`docs/SCHEDULED_JOBS.md`).
2. Open `/status` after a couple of minutes. Until the first checks arrive it shows "Status checks
   are delayed", which is correct.

`/admin/status` says when the newest check is late, and the job's runs are on `/admin/scheduled-jobs`.

The job runs every minute: about 1,440 runs a day, and a handful of D1 writes each. Run history is
trimmed automatically. To check less often, change the cron in three places (`cron-worker/wrangler.toml`,
`CRON_PATHS` in `cron-worker/src/index.ts`, and `cron` in
`src/lib/server/scheduler/jobs/status-check.ts`; a test fails if they disagree) and note that "two
checks in a row" then takes twice as many minutes, and five checks down in a day is no longer
five minutes.

## Adding a component

1. Add it to `COMPONENTS` in `src/lib/status/logic.ts` (id, name, one plain description).
2. Add its check to `STATUS_CHECKS` in `src/lib/server/status-checks.ts`: a function returning a
   `Reading` (status, latency, one public sentence). `tests/unit/status-routes.test.ts` fails if a
   listed component has no check.
3. Say what "down" means in the table above.

Never put an address, a key or an error message in the sentence: it is shown to everyone. A listed
component with no check behind it is a promise nobody is keeping, so do not list one.

## Moving parts

- `migrations/0028_status_page.sql`: `status_components`, `status_daily`, `status_incidents`,
  `status_incident_updates`.
- `src/lib/status/logic.ts`: the rules, pure.
- `src/lib/server/status.ts`: recording, incidents, the snapshot. `status-checks.ts`: what is measured.
- `src/lib/server/scheduler/jobs/status-check.ts` and `POST /api/cron/status-check`: one round.
  The cron Worker adds what it saw of the website as `?web=ok&ms=120&http=200`.
- `GET /api/status`, `GET /api/status/ping`, `/status`, `/admin/status`.
- Tests: `status-logic`, `status-db`, `status-routes`, `status-pages`, `cron-worker`.

## What it does not do

No email or chat alerts to subscribers, no per-region status, no check of individual features. It
shows whether the site and its database are reachable and quick, not whether every page works.
