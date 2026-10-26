/**
 * The claim, the record and the retention, against the real migration on real
 * SQLite. What matters here is the behaviour of overlapping and repeated runs.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import {
	claimRun,
	finishRun,
	latestRun,
	pruneRunHistory,
	recentRuns,
	RUN_HISTORY_BUDGET,
	RUN_HISTORY_DAYS
} from '../../src/lib/server/scheduler/store';
import { executeJob, LEASE_GRACE_MS } from '../../src/lib/server/scheduler/runner';
import type { ScheduledJob } from '../../src/lib/server/scheduler/types';

const env = {} as never;
const NOW_MS = Date.parse('2026-10-25T12:00:30Z');
const NOW = Math.floor(NOW_MS / 1000);
const SLOT = Math.floor(NOW_MS / 60_000);

function job(run: ScheduledJob['run'], timeoutMs = 1000): ScheduledJob {
	return {
		id: 'demo',
		cron: '* * * * *',
		path: '/api/cron/demo',
		description: 'd',
		timeoutMs,
		run
	};
}

const claim = (db: any, over: Record<string, unknown> = {}) =>
	claimRun(db, {
		jobId: 'demo',
		trigger: 'cron',
		slot: SLOT,
		now: NOW,
		leaseUntil: NOW + 60,
		...over
	} as never);

afterEach(() => vi.restoreAllMocks());

describe('claimRun', () => {
	it('gives the first caller the slot and refuses the second', async () => {
		const db = createSqliteD1();
		expect(await claim(db)).toBeTruthy();
		expect(await claim(db)).toBeNull();
	});

	it('does not conflict across jobs, triggers or time once nothing is running', async () => {
		const db = createSqliteD1();
		const a = await claim(db);
		await finishRun(db, a!, 'succeeded', { finishedAt: NOW });
		expect(await claim(db, { jobId: 'other' })).toBeTruthy();
		expect(await claim(db, { slot: SLOT + 1 })).toBeTruthy();
	});

	it('refuses a new slot while another slot of the same job holds a live lease', async () => {
		const db = createSqliteD1();
		await claim(db);
		expect(await claim(db, { slot: SLOT + 1 })).toBeNull();
		// A manual run is an overlap too.
		expect(await claim(db, { trigger: 'manual' })).toBeNull();
		// A different job is unaffected.
		expect(await claim(db, { jobId: 'other' })).toBeTruthy();
	});

	it('lets a new slot start once the old lease has expired', async () => {
		const db = createSqliteD1();
		await claim(db);
		expect(await claim(db, { slot: SLOT + 1, now: NOW + 61, leaseUntil: NOW + 120 })).toBeTruthy();
	});

	it('takes over a failed slot, counting the attempt, and never a succeeded one', async () => {
		const db = createSqliteD1();
		const first = await claim(db);
		await finishRun(db, first!, 'failed', { finishedAt: NOW, error: 'boom' });
		const second = await claim(db);
		expect(second).toBeTruthy();
		expect(second).not.toBe(first);
		const row = await latestRun(db, 'demo');
		expect(row).toMatchObject({ attempts: 2, status: 'running', error: null, finished_at: null });

		await finishRun(db, second!, 'succeeded', { finishedAt: NOW });
		expect(await claim(db)).toBeNull();
		expect((await latestRun(db, 'demo'))!.status).toBe('succeeded');
	});

	it('takes over a slot whose run died mid-flight once its lease has passed', async () => {
		const db = createSqliteD1();
		await claim(db);
		expect(await claim(db, { now: NOW + 10 })).toBeNull();
		expect(await claim(db, { now: NOW + 60, leaseUntil: NOW + 120 })).toBeTruthy();
	});

	it('only one of two simultaneous claims wins', async () => {
		const db = createSqliteD1();
		const results = await Promise.all([claim(db), claim(db), claim(db)]);
		expect(results.filter(Boolean)).toHaveLength(1);
	});
});

describe('finishRun', () => {
	it('is scoped to the run id, so a run that lost its lease cannot clobber its successor', async () => {
		const db = createSqliteD1();
		const stale = await claim(db);
		const fresh = await claim(db, { now: NOW + 60, leaseUntil: NOW + 120 });
		expect(await finishRun(db, stale!, 'failed', { finishedAt: NOW + 61 })).toBe(false);
		expect((await latestRun(db, 'demo'))!.status).toBe('running');
		expect(await finishRun(db, fresh!, 'succeeded', { finishedAt: NOW + 62, detail: '{}' })).toBe(
			true
		);
		// And a finished run cannot be re-finished.
		expect(await finishRun(db, fresh!, 'failed', { finishedAt: NOW + 63 })).toBe(false);
	});
});

describe('executeJob', () => {
	it('records a successful run with its detail', async () => {
		const db = createSqliteD1();
		const result = await executeJob(
			db,
			env,
			job(async ({ params, now }) => ({ n: params.get('n'), now })),
			{ trigger: 'cron', params: new URLSearchParams('n=7'), clock: () => NOW_MS }
		);
		expect(result).toMatchObject({
			job: 'demo',
			outcome: 'succeeded',
			detail: { n: '7', now: NOW }
		});
		const row = await latestRun(db, 'demo');
		expect(row).toMatchObject({ status: 'succeeded', trigger: 'cron', slot: SLOT, attempts: 1 });
		expect(JSON.parse(row!.detail!)).toEqual({ n: '7', now: NOW });
		expect(row!.lease_until).toBe(NOW + Math.ceil((1000 + LEASE_GRACE_MS) / 1000));
	});

	it('uses the scheduled time for the slot so retries share a claim', async () => {
		const db = createSqliteD1();
		const run = vi.fn().mockResolvedValue({});
		const scheduledAtMs = Date.parse('2026-10-25T03:17:00Z');
		await executeJob(db, env, job(run), { trigger: 'cron', scheduledAtMs, clock: () => NOW_MS });
		const again = await executeJob(db, env, job(run), {
			trigger: 'cron',
			scheduledAtMs,
			clock: () => NOW_MS + 5000
		});
		expect(again.outcome).toBe('skipped');
		expect(run).toHaveBeenCalledTimes(1);
		expect((await latestRun(db, 'demo'))!.slot).toBe(Math.floor(scheduledAtMs / 60_000));
	});

	it('records a failure, truncating a long message, and a retry of that slot runs again', async () => {
		const db = createSqliteD1();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const run = vi
			.fn()
			.mockRejectedValueOnce(new Error('x'.repeat(900)))
			.mockResolvedValueOnce({ ok: true });
		const first = await executeJob(db, env, job(run), { trigger: 'cron', clock: () => NOW_MS });
		expect(first.outcome).toBe('failed');
		expect(first.error).toHaveLength(500);
		expect((await latestRun(db, 'demo'))!.status).toBe('failed');

		const second = await executeJob(db, env, job(run), { trigger: 'cron', clock: () => NOW_MS });
		expect(second.outcome).toBe('succeeded');
		expect(await latestRun(db, 'demo')).toMatchObject({ status: 'succeeded', attempts: 2 });
	});

	it('describes a thrown non-Error', async () => {
		const db = createSqliteD1();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const result = await executeJob(
			db,
			env,
			job(async () => {
				throw 'plain string';
			}),
			{ trigger: 'manual' }
		);
		expect(result).toMatchObject({ outcome: 'failed', error: 'plain string' });
	});

	it('times out a job that hangs, aborts its signal, and releases the slot', async () => {
		vi.useFakeTimers();
		const db = createSqliteD1();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		let signal: AbortSignal | undefined;
		const pending = executeJob(
			db,
			env,
			job(({ signal: s }) => {
				signal = s;
				return new Promise(() => {});
			}, 50),
			{ trigger: 'manual' }
		);
		await vi.advanceTimersByTimeAsync(60);
		const result = await pending;
		vi.useRealTimers();
		expect(result).toMatchObject({ outcome: 'timed_out' });
		expect(result.error).toMatch(/50ms timeout/);
		expect(signal?.aborted).toBe(true);
		expect((await latestRun(db, 'demo'))!.status).toBe('timed_out');
	});

	it('skips a job that is already running instead of doubling it', async () => {
		const db = createSqliteD1();
		let release!: () => void;
		const gate = new Promise<void>((resolve) => (release = resolve));
		const run = vi.fn().mockImplementation(() => gate.then(() => ({})));
		const slow = executeJob(db, env, job(run), { trigger: 'cron', clock: () => NOW_MS });
		await vi.waitFor(() => expect(run).toHaveBeenCalled());
		const overlapping = await executeJob(db, env, job(run), {
			trigger: 'manual',
			clock: () => NOW_MS
		});
		expect(overlapping.outcome).toBe('skipped');
		release();
		expect((await slow).outcome).toBe('succeeded');
		expect(run).toHaveBeenCalledTimes(1);
	});

	it('fails loudly, without running the job, when the claim cannot be made', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const run = vi.fn();
		const broken = {
			prepare: () => {
				throw new Error('no such table: scheduled_job_runs');
			}
		} as never;
		const result = await executeJob(broken, env, job(run), { trigger: 'cron' });
		expect(result).toMatchObject({ outcome: 'failed', error: 'no such table: scheduled_job_runs' });
		expect(run).not.toHaveBeenCalled();
	});

	it('still returns the result when the outcome or the history cannot be written', async () => {
		const db = createSqliteD1();
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		let calls = 0;
		const flaky = {
			prepare: (sql: string) => {
				calls++;
				// 1 = claim; every statement after it fails.
				if (calls > 1) throw new Error('d1 down');
				return db.prepare(sql);
			}
		} as never;
		const result = await executeJob(
			flaky,
			env,
			job(async () => ({ done: true })),
			{
				trigger: 'cron'
			}
		);
		expect(result).toMatchObject({ outcome: 'succeeded', detail: { done: true } });
		expect(spy).toHaveBeenCalledWith(
			expect.stringContaining('Could not record'),
			expect.anything()
		);
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('Could not prune'), expect.anything());
	});

	it('trims run history older than the retention window on every run', async () => {
		const db = createSqliteD1();
		const old = NOW - (RUN_HISTORY_DAYS + 1) * 86400;
		const recent = NOW - (RUN_HISTORY_DAYS - 1) * 86400;
		for (const [id, started] of [
			['old', old],
			['recent', recent]
		] as const) {
			await db
				.prepare(
					`INSERT INTO scheduled_job_runs (id, job_id, trigger, slot, started_at, status, lease_until)
					 VALUES (?, 'demo', 'cron', ?, ?, 'succeeded', ?)`
				)
				.bind(id, started / 60, started, started)
				.run();
		}
		await executeJob(
			db,
			env,
			job(async () => ({})),
			{ trigger: 'cron', clock: () => NOW_MS }
		);
		const ids = (await recentRuns(db)).map((r) => r.id);
		expect(ids).not.toContain('old');
		expect(ids).toContain('recent');
		expect(ids).toHaveLength(2);
	});
});

describe('run history', () => {
	it('prunes in bounded batches and reports what it removed', async () => {
		const db = createSqliteD1();
		const old = NOW - (RUN_HISTORY_DAYS + 5) * 86400;
		const total = RUN_HISTORY_BUDGET + 20;
		await db.batch(
			Array.from({ length: total }, (_, i) =>
				db
					.prepare(
						`INSERT INTO scheduled_job_runs (id, job_id, trigger, slot, started_at, status, lease_until)
						 VALUES (?, 'demo', 'cron', ?, ?, 'failed', 0)`
					)
					.bind(`r${String(i).padStart(5, '0')}`, i, old)
			)
		);
		expect(await pruneRunHistory(db, NOW)).toBe(RUN_HISTORY_BUDGET);
		expect(await pruneRunHistory(db, NOW)).toBe(20);
		expect(await pruneRunHistory(db, NOW)).toBe(0);
	});

	it('lists recent runs newest first and clamps the limit', async () => {
		const db = createSqliteD1();
		for (let i = 0; i < 3; i++) {
			await claim(db, { slot: SLOT + i, now: NOW + i * 100, leaseUntil: NOW + i * 100 + 10 });
		}
		const runs = await recentRuns(db, 2);
		expect(runs.map((r) => r.slot)).toEqual([SLOT + 2, SLOT + 1]);
		expect(await recentRuns(db, 0)).toHaveLength(1);
		expect(await recentRuns(db, 10_000)).toHaveLength(3);
		expect(await latestRun(db, 'nothing')).toBeNull();
	});
});
