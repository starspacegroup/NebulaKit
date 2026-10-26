import type { D1Database } from '@cloudflare/workers-types';

/** Everything a job is given. Deliberately small. */
export interface JobContext {
	db: D1Database;
	/** Worker bindings and secrets, for jobs that need a provider key. */
	env: NonNullable<App.Platform['env']>;
	/** Unix seconds at which the run started. Take time from here, not `Date.now()`. */
	now: number;
	/** Aborted when the job outlives its timeout. A long job should check it between steps. */
	signal: AbortSignal;
	/** Query parameters of the cron request. Empty for a manual run. */
	params: URLSearchParams;
}

/** A JSON-serializable summary of what a run did. Stored on its run row. */
export type JobDetail = Record<string, unknown>;

export interface ScheduledJob {
	/** Stable identifier and the history key. Renaming a job orphans its history. */
	id: string;
	/**
	 * Five-field UTC cron expression. It must also appear in `[triggers] crons`
	 * in `cron-worker/wrangler.toml`; `tests/unit/scheduler-registry.test.ts`
	 * fails if the two drift.
	 */
	cron: string;
	/** The route the cron Worker POSTs to for this schedule. It must exist. */
	path: string;
	/** One line, shown on the admin page. */
	description: string;
	/** Give up on the job after this long and record `timed_out`. */
	timeoutMs: number;
	run(context: JobContext): Promise<JobDetail>;
}
