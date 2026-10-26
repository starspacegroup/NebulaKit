import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import { POST } from '../../src/routes/api/cron/prune-view-stats/+server';

function createEvent(db: unknown, overrides: Record<string, any> = {}) {
	return {
		request: new Request('https://example.com/api/cron/prune-view-stats', {
			method: 'POST',
			headers: { authorization: 'Bearer test-secret' }
		}),
		url: new URL('https://example.com/api/cron/prune-view-stats'),
		platform: { env: { DB: db, CRON_SECRET: 'test-secret' } },
		...overrides
	} as any;
}

async function count(db: any, table: string) {
	return (await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).n as number;
}

describe('POST /api/cron/prune-view-stats', () => {
	afterEach(() => vi.useRealTimers());

	it('deletes counters past the window, keeps newer ones, and records the run', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-07-28T12:00:00.000Z'));
		const db = createSqliteD1();
		for (const day of ['2025-01-01', '2025-06-22', '2025-06-23', '2026-07-27']) {
			await db
				.prepare('INSERT INTO page_view_daily (day, path_key, views) VALUES (?, ?, 1)')
				.bind(day, '/')
				.run();
		}

		const response = await POST(createEvent(db));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.outcome).toBe('succeeded');
		// Roughly 13 months back, not today: 400 days before 2026-07-28.
		expect(body.detail.prunedBefore).toBe('2025-06-23');
		expect(body.detail.deleted).toBe(2);
		expect(body.detail.budgetExhausted).toBe(false);
		expect(await count(db, 'page_view_daily')).toBe(2);

		const run = await db.prepare('SELECT * FROM scheduled_job_runs').first<any>();
		expect(run).toMatchObject({ job_id: 'prune-view-stats', trigger: 'cron', status: 'succeeded' });
	});

	it('answers a duplicate delivery of the same tick without running twice', async () => {
		const db = createSqliteD1();
		const tick = String(Date.now());
		const event = () =>
			createEvent(db, {
				request: new Request('https://example.com/api/cron/prune-view-stats', {
					method: 'POST',
					headers: { authorization: 'Bearer test-secret', 'x-cron-scheduled-time': tick }
				})
			});
		expect((await (await POST(event())).json()).outcome).toBe('succeeded');
		const second = await POST(event());
		expect(second.status).toBe(200);
		expect((await second.json()).outcome).toBe('skipped');
		expect(await count(db, 'scheduled_job_runs')).toBe(1);
	});

	it('rejects a missing or wrong bearer token', async () => {
		const db = createSqliteD1();
		await expect(
			POST(
				createEvent(db, {
					request: new Request('https://example.com/x', {
						method: 'POST',
						headers: { authorization: 'Bearer wrong' }
					})
				})
			)
		).rejects.toHaveProperty('status', 401);
		await expect(
			POST(createEvent(db, { request: new Request('https://example.com/x', { method: 'POST' }) }))
		).rejects.toHaveProperty('status', 401);
		expect(await count(db, 'scheduled_job_runs')).toBe(0);
	});

	it('requires CRON_SECRET to be configured', async () => {
		await expect(POST(createEvent({}, { platform: { env: { DB: {} } } }))).rejects.toHaveProperty(
			'status',
			503
		);
	});

	it('requires a database', async () => {
		await expect(
			POST(createEvent(undefined, { platform: { env: { CRON_SECRET: 'test-secret' } } }))
		).rejects.toHaveProperty('status', 503);
	});
});
