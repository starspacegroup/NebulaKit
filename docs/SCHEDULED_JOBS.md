# Scheduled jobs

Cloudflare Pages cannot run Cron Triggers, so a small separate Worker in
`cron-worker/` does it. It wakes on a schedule and POSTs to the app's
`/api/cron/*` routes with a shared secret. The app runs the job, keeps the
record and refuses duplicates.

```
Cron Trigger -> cron-worker (Worker) -- POST + Bearer CRON_SECRET --> /api/cron/<job> (Pages)
```

## Deploy it

1. Set `CRON_SECRET` on the Pages project to a long random value.
2. In `cron-worker/wrangler.toml`, set `TARGET_URL` to your site's origin and
   rename `name` if `nebulakit-cron` is taken on your account.
3. Deploy and set the same secret on the Worker:

   ```bash
   cd cron-worker
   bunx wrangler deploy
   bunx wrangler secret put CRON_SECRET
   ```

4. Apply migration `0023_scheduled_job_runs.sql` (`bun run db:migrate`).
5. Open `/admin/scheduled-jobs` and press **Run now** to check the path works
   end to end. A real scheduled run shows up there after its first tick.

The Worker has no bindings, no route and no `fetch` handler. It takes its
account from `wrangler login` or `CLOUDFLARE_ACCOUNT_ID`; nothing in the folder
names an account or a domain. It is not part of the app build: `bun run build`
and `bun run check` do not look at it.

## The jobs

| Job id             | Cron (UTC)   | Route                        | What it does                                                            |
| ------------------ | ------------ | ---------------------------- | ----------------------------------------------------------------------- |
| `prune-view-stats` | `17 3 * * *` | `/api/cron/prune-view-stats` | Deletes counters older than 400 days                                    |
| `lighthouse`       | `43 4 * * *` | `/api/cron/lighthouse`       | PageSpeed Insights sweep (see below)                                    |
| `prune-audit`      | `29 5 * * *` | `/api/cron/prune-audit`      | Deletes audit rows older than 365 days and sign-in events older than 90 |

See [LIGHTHOUSE_MONITORING.md](./LIGHTHOUSE_MONITORING.md) and
[ADMIN_STATS.md](./ADMIN_STATS.md).

## Add a job

1. A job file in `src/lib/server/scheduler/jobs/` and an entry in
   `src/lib/server/scheduler/registry.ts`: `id`, `cron`, `path`, `description`,
   `timeoutMs`, `run`.
2. A route at that `path` whose `POST` is
   `(event) => handleCronRequest(event, '<id>')`.
3. The cron in `[triggers] crons` of `cron-worker/wrangler.toml` and in
   `CRON_PATHS` of `cron-worker/src/index.ts`. One job per cron expression.

`tests/unit/scheduler-registry.test.ts` reads all of these and fails if they
disagree, or if a registered path has no route file. Redeploy the Worker after
changing its triggers.

## What the app guarantees

- **Authorization.** Every cron route calls `authorizeCronRequest`: constant-time
  compare of `Authorization: Bearer <CRON_SECRET>`; 503 if the secret is unset,
  401 if it is wrong. Never open.
- **One run per tick.** Each run claims `(job, trigger, scheduled minute)` in
  `scheduled_job_runs`. A duplicate delivery of a finished or running tick is
  answered `200 {"outcome":"skipped"}`. A failed or timed-out tick can be claimed
  again, so the Worker's retries do work. A run that dies mid-flight frees its
  slot when its lease (timeout + 30 s) passes. A job also will not start while
  another run of the same job holds a live lease.
- **Status codes drive retries.** 200 = succeeded or skipped, 500 = failed,
  504 = timed out. The Worker retries 5xx, 408, 429 and network errors three
  times at 1 s, 2 s, 4 s, and never retries other 4xx. It carries the tick in
  `X-Cron-Scheduled-Time` so every retry hits the same claim.
- **History.** Every run is a row: status, attempts, times, error, detail.
  Rows older than 30 days are deleted at the end of each run, in batches on the
  primary key under a 500-row budget. `pruneViewStats` is bounded the same way
  (5000 rows per run, shared across its tables), so a big backlog drains over
  several nights instead of spending a day of D1 writes in one statement.

## Admin page

`/admin/scheduled-jobs` (admin only) lists each job with its schedule, last run,
status and next expected run, and the 25 most recent runs. **Run now** posts JSON
to `POST /api/admin/scheduled-jobs/run` with an admin session. It runs the same
job through the same claim, so pressing it during a scheduled run is skipped, and
pressing it twice in a minute runs once. It is JSON-only, like the site API. The
bearer secret never reaches the browser.

"Next expected" is computed from the cron expression by a small parser in
`scheduler/cron.ts` (UTC, numeric fields only). It is a display aid; Cloudflare
decides when the Worker really fires.

## Gotchas

- A trigger edit only takes effect after `wrangler deploy` in `cron-worker/`.
- Cron triggers can fire a minute or so late, and more than once on rare
  occasions. The claim is why that is safe.
- With the Worker undeployed, nothing runs and `/admin/scheduled-jobs` shows
  "Never run". Any other scheduler that can POST with the bearer still works.
- The `lighthouse` job can take minutes (it audits pages one at a time), so its
  timeout is 5 minutes and the Worker waits up to 6 for the response.
