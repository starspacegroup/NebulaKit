-- Scheduled job runs: the record of what the cron Worker triggered, and the
-- claim that stops a job running twice.
--
-- Cloudflare Pages has no Cron Triggers, so a separate Worker (cron-worker/)
-- POSTs to /api/cron/* on a schedule. That delivery is at-least-once: the
-- Worker retries, and two deliveries can overlap. This table is how the app
-- tells "a retry of a run that failed" (do it again) from "a duplicate of a run
-- that is underway or done" (skip it).
--
-- One row per (job, trigger, scheduled minute). The unique key IS the claim: a
-- run inserts its row, or takes over an existing one only when that one failed,
-- timed out, or is `running` with an expired lease. A `succeeded` row is never
-- taken over, and a `running` row with a live lease is not either.
--
-- Times are unix seconds. `slot` is the scheduled time in whole minutes since
-- the epoch, so every retry of one scheduled tick lands on the same row.
--
-- Rollback: DROP TABLE scheduled_job_runs;
CREATE TABLE IF NOT EXISTS scheduled_job_runs (
	id TEXT PRIMARY KEY,
	job_id TEXT NOT NULL,
	-- 'cron' = fired by the Worker; 'manual' = an admin pressed "Run now".
	trigger TEXT NOT NULL CHECK (trigger IN ('cron', 'manual')),
	slot INTEGER NOT NULL,
	-- Times this slot was claimed. Above 1 means an earlier attempt failed.
	attempts INTEGER NOT NULL DEFAULT 1,
	started_at INTEGER NOT NULL,
	finished_at INTEGER,
	status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'timed_out')),
	error TEXT,
	-- JSON summary the job returned.
	detail TEXT,
	-- A run that died mid-flight (isolate evicted, deploy) cannot hold its slot
	-- past this moment.
	lease_until INTEGER NOT NULL,
	UNIQUE (job_id, trigger, slot)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_job_runs_job_started
	ON scheduled_job_runs (job_id, started_at DESC);

-- The retention delete filters on this.
CREATE INDEX IF NOT EXISTS idx_scheduled_job_runs_started
	ON scheduled_job_runs (started_at);
