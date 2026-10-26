/**
 * The admin side: "Run now", the page's data, and the shared authorization
 * and HTTP helpers every /api/cron/* route sits on.
 */
import { describe, expect, it, vi } from 'vitest';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import { authorizeCronRequest } from '../../src/lib/server/scheduler/authorize';
import { handleCronRequest, scheduledTimeFrom } from '../../src/lib/server/scheduler/http';
import { getJobOverview, healthOf } from '../../src/lib/server/scheduler/overview';
import { SCHEDULED_JOBS } from '../../src/lib/server/scheduler/registry';
import { claimRun, finishRun, type JobRunRow } from '../../src/lib/server/scheduler/store';
import { POST } from '../../src/routes/api/admin/scheduled-jobs/run/+server';
import { load } from '../../src/routes/admin/scheduled-jobs/+page.server';

const pruneRoute = '/api/cron/prune-view-stats';

function runEvent(user: unknown, body: unknown, opts: { type?: string | null; db?: unknown } = {}) {
	const headers = new Headers();
	if (opts.type !== null) headers.set('content-type', opts.type ?? 'application/json');
	return {
		request: new Request('https://x.test/api/admin/scheduled-jobs/run', {
			method: 'POST',
			headers,
			body: typeof body === 'string' ? body : JSON.stringify(body)
		}),
		locals: { user },
		platform: { env: { DB: 'db' in opts ? opts.db : createSqliteD1() } }
	} as never;
}

describe('POST /api/admin/scheduled-jobs/run', () => {
	it('runs a registered job for an admin, as a manual run', async () => {
		const db = createSqliteD1();
		const response = await POST(
			runEvent(
				{ id: '1', isAdmin: true, isSuperAdmin: true },
				{ jobId: 'prune-view-stats' },
				{ db }
			)
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ job: 'prune-view-stats', outcome: 'succeeded' });
		const row = await db.prepare('SELECT trigger, status FROM scheduled_job_runs').first();
		expect(row).toEqual({ trigger: 'manual', status: 'succeeded' });
	});

	it('answers skipped when the same minute already ran, rather than running twice', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-10-25T12:00:10Z'));
		try {
			const db = createSqliteD1();
			const run = () =>
				POST(runEvent({ id: '1', isOwner: true }, { jobId: 'prune-view-stats' }, { db }));
			expect((await (await run()).json()).outcome).toBe('succeeded');
			expect((await (await run()).json()).outcome).toBe('skipped');
		} finally {
			vi.useRealTimers();
		}
	});

	it('refuses anonymous callers and non-admins before doing anything', async () => {
		const db = createSqliteD1();
		await expect(POST(runEvent(null, { jobId: 'lighthouse' }, { db }))).rejects.toMatchObject({
			status: 401
		});
		await expect(
			POST(runEvent({ id: '2' }, { jobId: 'lighthouse' }, { db }))
		).rejects.toMatchObject({ status: 403 });
		expect((await db.prepare('SELECT COUNT(*) n FROM scheduled_job_runs').first<any>()).n).toBe(0);
	});

	it('is JSON-only, so a cross-site form post cannot trigger it', async () => {
		const admin = { id: '1', isAdmin: true, isSuperAdmin: true };
		for (const type of ['application/x-www-form-urlencoded', 'text/plain', null]) {
			await expect(POST(runEvent(admin, { jobId: 'lighthouse' }, { type }))).rejects.toMatchObject({
				status: 415
			});
		}
	});

	it('rejects an unknown job, a missing id, and a body that is not JSON', async () => {
		const admin = { id: '1', isAdmin: true, isSuperAdmin: true };
		for (const body of [{ jobId: 'nope' }, {}, { jobId: 7 }, 'not json', 'null']) {
			await expect(POST(runEvent(admin, body))).rejects.toMatchObject({ status: 400 });
		}
	});

	it('needs a database', async () => {
		await expect(
			POST(
				runEvent(
					{ id: '1', isAdmin: true, isSuperAdmin: true },
					{ jobId: 'lighthouse' },
					{ db: undefined }
				)
			)
		).rejects.toMatchObject({ status: 503 });
	});
});

describe('the admin page data', () => {
	it('lists every registered job with a next run and no history on a fresh database', async () => {
		const data = (await load({ platform: { env: { DB: createSqliteD1() } } } as never)) as any;
		expect(data.jobs.map((j: any) => j.id)).toEqual(SCHEDULED_JOBS.map((j) => j.id));
		for (const job of data.jobs) {
			expect(job).toMatchObject({ health: 'never-run', lastRun: null });
			expect(Date.parse(job.nextRunAt)).toBeGreaterThan(Date.now());
		}
		expect(data.history).toEqual([]);
	});

	it('needs a database', async () => {
		await expect(load({ platform: { env: {} } } as never)).rejects.toMatchObject({ status: 503 });
	});

	it('reports the last run and its status, newest first in history', async () => {
		const db = createSqliteD1();
		const now = new Date('2026-10-25T12:00:00Z');
		const sec = Math.floor(now.getTime() / 1000);
		const a = await claimRun(db, {
			jobId: 'lighthouse',
			trigger: 'cron',
			slot: 1,
			now: sec - 500,
			leaseUntil: sec - 400
		});
		await finishRun(db, a!, 'failed', { finishedAt: sec - 450, error: 'PSI down' });
		const b = await claimRun(db, {
			jobId: 'prune-view-stats',
			trigger: 'cron',
			slot: 2,
			now: sec - 100,
			leaseUntil: sec + 100
		});
		expect(b).toBeTruthy();

		const { jobs, history } = await getJobOverview(db, now);
		const byId = Object.fromEntries(jobs.map((j) => [j.id, j]));
		expect(byId['lighthouse']).toMatchObject({ health: 'failed', lastRun: { error: 'PSI down' } });
		expect(byId['prune-view-stats'].health).toBe('running');
		expect(byId['prune-view-stats'].nextRunAt).toBe('2026-10-26T03:17:00.000Z');
		expect(history.map((r) => r.job_id)).toEqual(['prune-view-stats', 'lighthouse']);
	});

	it('tells a stalled run (lease gone, never finished) from a running one', () => {
		const run = (status: JobRunRow['status'], lease: number) =>
			({ status, lease_until: lease }) as JobRunRow;
		expect(healthOf(null, 100)).toBe('never-run');
		expect(healthOf(run('running', 200), 100)).toBe('running');
		expect(healthOf(run('running', 100), 100)).toBe('stalled');
		expect(healthOf(run('succeeded', 0), 100)).toBe('succeeded');
		expect(healthOf(run('timed_out', 0), 100)).toBe('timed_out');
	});
});

describe('authorizeCronRequest', () => {
	const request = (auth?: string) =>
		new Request('https://x.test', { headers: auth ? { authorization: auth } : {} });

	it('passes the exact bearer secret', () => {
		expect(() =>
			authorizeCronRequest(request('Bearer s3cret'), { CRON_SECRET: 's3cret' })
		).not.toThrow();
	});

	it('is 503 with no secret configured, whatever the caller sends', () => {
		for (const env of [undefined, {}, { CRON_SECRET: '' }]) {
			expect(() => authorizeCronRequest(request('Bearer '), env)).toThrowError(
				expect.objectContaining({ status: 503 })
			);
		}
	});

	it('is 401 for a wrong, truncated, extended, differently-schemed or missing credential', () => {
		for (const auth of [
			'Bearer wrong',
			'Bearer s3cre',
			'Bearer s3cretX',
			'Basic s3cret',
			's3cret',
			undefined
		]) {
			expect(
				() => authorizeCronRequest(request(auth), { CRON_SECRET: 's3cret' }),
				String(auth)
			).toThrowError(expect.objectContaining({ status: 401 }));
		}
	});
});

describe('cron HTTP helpers', () => {
	it('trusts a scheduled time only if it is a number near now', () => {
		const now = Date.parse('2026-10-25T12:00:00Z');
		const at = (value?: string) =>
			scheduledTimeFrom(
				new Request('https://x.test', {
					headers: value === undefined ? {} : { 'x-cron-scheduled-time': value }
				}),
				now
			);
		expect(at(String(now - 5000))).toBe(now - 5000);
		expect(at(String(now + 60_000))).toBe(now + 60_000);
		expect(at()).toBeUndefined();
		expect(at('')).toBeUndefined();
		expect(at('soon')).toBeUndefined();
		expect(at('-5')).toBeUndefined();
		expect(at('1e9')).toBeUndefined();
		expect(at(String(now - 2 * 86_400_000))).toBeUndefined();
		expect(at('9'.repeat(16))).toBeUndefined();
	});

	it('answers 404 for a job that is not registered, after authorizing', async () => {
		const event = {
			request: new Request('https://x.test', {
				method: 'POST',
				headers: { authorization: 'Bearer s' }
			}),
			url: new URL('https://x.test' + pruneRoute),
			platform: { env: { CRON_SECRET: 's', DB: createSqliteD1() } }
		};
		await expect(handleCronRequest(event as never, 'nope')).rejects.toMatchObject({ status: 404 });
		await expect(
			handleCronRequest(
				{ ...event, request: new Request('https://x.test', { method: 'POST' }) } as never,
				'nope'
			)
		).rejects.toMatchObject({ status: 401 });
	});

	it('maps each outcome to a status the scheduler can act on', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const event = (db: unknown) =>
			({
				request: new Request('https://x.test', {
					method: 'POST',
					headers: { authorization: 'Bearer s' }
				}),
				url: new URL('https://x.test' + pruneRoute),
				platform: { env: { CRON_SECRET: 's', DB: db } }
			}) as never;
		// A database that cannot claim is a 500, which is what makes the Worker retry.
		const broken = {
			prepare: () => {
				throw new Error('no such table');
			}
		};
		const response = await handleCronRequest(event(broken), 'prune-view-stats');
		expect(response.status).toBe(500);
		expect(await response.json()).toMatchObject({ outcome: 'failed' });
	});
});
