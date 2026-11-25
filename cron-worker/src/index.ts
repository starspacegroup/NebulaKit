/**
 * Scheduler Worker for a Cloudflare Pages deployment.
 *
 * Pages has no Cron Triggers, so this Worker wakes on the crons in
 * `wrangler.toml`, maps the expression that fired to an app route, and POSTs to
 * it with the shared `CRON_SECRET`. The app does the work and keeps the record;
 * this only delivers the tick.
 *
 * Delivery is at-least-once: a failed call is retried with exponential backoff.
 * That is safe because the app claims each (job, scheduled minute) once, and
 * every retry carries the same scheduled time. `scheduled()` never throws: an
 * uncaught error here would only be a line in a dashboard nobody reads, while a
 * logged one at least names the job.
 *
 * Types are declared locally so this file needs no @cloudflare/workers-types and
 * can be type-checked by the app's own tsconfig when the tests import it.
 */

export interface Env {
	/** The app's origin, e.g. https://www.example.com. A var, not a secret. */
	TARGET_URL: string;
	/** Shared bearer secret. Must equal CRON_SECRET on the Pages project. */
	CRON_SECRET: string;
}

interface ScheduledEventLike {
	cron: string;
	scheduledTime: number;
}

interface ExecutionContextLike {
	waitUntil(promise: Promise<unknown>): void;
}

/**
 * Which route each cron expression drives. Keep in step with `[triggers]` in
 * `wrangler.toml` and with the app's job registry; a test fails on drift.
 */
export const CRON_PATHS: Readonly<Record<string, string>> = {
	'17 3 * * *': '/api/cron/prune-view-stats',
	'43 4 * * *': '/api/cron/lighthouse',
	'29 5 * * *': '/api/cron/prune-audit',
	'37 * * * *': '/api/cron/publish-scheduled',
	'*/5 * * * *': '/api/cron/settle-auctions',
	'* * * * *': '/api/cron/status-check',
	'*/10 * * * *': '/api/cron/google-merchant-sync'
};

/** The route that takes the outside view of the website along with its tick. */
export const STATUS_CHECK_PATH = '/api/cron/status-check';
/** What the outside probe fetches: the app serving, no database behind it. */
export const STATUS_PING_PATH = '/api/status/ping';
/** A website that has not answered by now is down for the status page. */
export const PROBE_TIMEOUT_MS = 8000;

/** Retries after the first attempt. */
export const MAX_RETRIES = 3;
/** First backoff; doubles each retry (1s, 2s, 4s). */
export const BASE_DELAY_MS = 1000;
/** Longer than the slowest job, so a slow sweep is not cut off by the caller. */
export const REQUEST_TIMEOUT_MS = 6 * 60 * 1000;

/** Header carrying the tick being delivered, so retries share one claim in the app. */
export const SCHEDULED_TIME_HEADER = 'x-cron-scheduled-time';

export interface Dependencies {
	fetch: typeof fetch;
	sleep: (ms: number) => Promise<void>;
}

const realDependencies: Dependencies = {
	fetch: (input, init) => fetch(input, init),
	sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms))
};

export interface DeliveryResult {
	ok: boolean;
	/** HTTP status of the last attempt, or 0 when it never got a response. */
	status: number;
	attempts: number;
	error?: string;
}

/** A 4xx other than these will not fix itself (bad secret, unknown route), so it is not retried. */
function isRetryable(status: number): boolean {
	return status >= 500 || status === 408 || status === 429;
}

function targetFor(env: Env, path: string): URL | string {
	if (!env.CRON_SECRET) return 'CRON_SECRET is not set';
	if (!env.TARGET_URL || env.TARGET_URL.includes('REPLACE_ME')) return 'TARGET_URL is not set';
	try {
		return new URL(path, env.TARGET_URL);
	} catch {
		return 'TARGET_URL is not a valid URL';
	}
}

/**
 * POST to one app route, retrying transient failures. Never throws.
 */
export async function deliver(
	env: Env,
	path: string,
	scheduledTime: number,
	deps: Dependencies = realDependencies
): Promise<DeliveryResult> {
	const target = targetFor(env, path);
	if (typeof target === 'string') return { ok: false, status: 0, attempts: 0, error: target };

	let last: DeliveryResult = { ok: false, status: 0, attempts: 0 };
	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		if (attempt > 0) await deps.sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
		try {
			const response = await deps.fetch(target, {
				method: 'POST',
				headers: {
					authorization: `Bearer ${env.CRON_SECRET}`,
					[SCHEDULED_TIME_HEADER]: String(scheduledTime)
				},
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
			});
			// Drain the body so the connection is released.
			await response.text().catch(() => '');
			last = { ok: response.ok, status: response.status, attempts: attempt + 1 };
			if (response.ok || !isRetryable(response.status)) return last;
		} catch (thrown) {
			last = {
				ok: false,
				status: 0,
				attempts: attempt + 1,
				error: thrown instanceof Error ? thrown.message : String(thrown)
			};
		}
	}
	return last;
}

/**
 * Fetch the site's ping route from here, outside the app, and describe what came back as the
 * query string the status check reads (`?web=ok&ms=120&http=200`). Never throws: a site that
 * does not answer is a `web=fail` observation, which is exactly the thing worth reporting.
 * If the site is down far enough that the check itself cannot be delivered, nothing is
 * recorded, and the public page says its checks are delayed instead of showing an all-clear.
 */
export async function probeWebsite(
	env: Env,
	deps: Dependencies = realDependencies
): Promise<string> {
	const target = targetFor(env, STATUS_PING_PATH);
	if (typeof target === 'string') return '';
	const started = Date.now();
	try {
		const response = await deps.fetch(target, {
			headers: { 'user-agent': 'NebulaKit status probe' },
			signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
		});
		await response.text().catch(() => '');
		const ms = Date.now() - started;
		return `?web=${response.ok ? 'ok' : 'fail'}&ms=${ms}&http=${response.status}`;
	} catch {
		return '?web=fail';
	}
}

export async function runScheduled(
	event: ScheduledEventLike,
	env: Env,
	deps?: Dependencies
): Promise<DeliveryResult | null> {
	const path = CRON_PATHS[event.cron];
	if (!path) {
		console.error(`No route is mapped to cron "${event.cron}"; add it to CRON_PATHS.`);
		return null;
	}
	const route = path === STATUS_CHECK_PATH ? path + (await probeWebsite(env, deps)) : path;
	const result = await deliver(env, route, event.scheduledTime, deps);
	if (result.ok) {
		console.log(`${path} ok (${result.status}) after ${result.attempts} attempt(s)`);
	} else {
		console.error(
			`${path} failed after ${result.attempts} attempt(s): ` +
				`status ${result.status}${result.error ? `, ${result.error}` : ''}`
		);
	}
	return result;
}

export default {
	async scheduled(event: ScheduledEventLike, env: Env, ctx: ExecutionContextLike): Promise<void> {
		// waitUntil keeps the isolate alive through the retries; the promise is
		// already guarded, but the catch makes "never throws" structural.
		ctx.waitUntil(
			runScheduled(event, env).catch((thrown) => {
				console.error('Scheduler failed unexpectedly:', thrown);
			})
		);
	}
};
