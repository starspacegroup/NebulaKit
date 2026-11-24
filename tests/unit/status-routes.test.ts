import { describe, expect, it, vi } from 'vitest';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import { COMPONENT_IDS } from '../../src/lib/status/logic';
import { STATUS_CHECKS } from '../../src/lib/server/status-checks';
import { createIncident, getStatusSnapshot, recordStatus } from '../../src/lib/server/status';
import { GET as feed } from '../../src/routes/api/status/+server';
import { GET as ping } from '../../src/routes/api/status/ping/+server';
import { load as publicLoad } from '../../src/routes/status/+page.server';
import { actions, load as adminLoad } from '../../src/routes/admin/status/+page.server';
import {
	STATUS_CHECK_JOB,
	websiteProbeFrom
} from '../../src/lib/server/scheduler/jobs/status-check';
import { POST as cronPost } from '../../src/routes/api/cron/status-check/+server';
import { SCHEDULED_JOBS } from '../../src/lib/server/scheduler/registry';
import { SITEMAP_ROUTES, CRAWLER_ALLOW } from '../../src/lib/agent-discovery';

const up = { ok: true, ms: 80 };
const owner = { id: 'u-owner', email: 'o@x.test', isOwner: true } as never;
const superAdmin = { id: 'u-sa', email: 's@x.test', isSuperAdmin: true } as never;

async function seeded() {
	const db = createSqliteD1();
	for (let i = 0; i < 3; i++) await recordStatus(db, { website: up });
	return db;
}

describe('every listed component is measured', () => {
	it('has a check for each, and nothing measured that is not listed', () => {
		expect(Object.keys(STATUS_CHECKS).sort()).toEqual([...COMPONENT_IDS].sort());
	});
});

describe('GET /api/status', () => {
	it('serves the snapshot as public, cacheable JSON without latencies', async () => {
		const db = await seeded();
		const response = await feed({ platform: { env: { DB: db } } } as never);
		expect(response.status).toBe(200);
		expect(response.headers.get('access-control-allow-origin')).toBe('*');
		expect(response.headers.get('cache-control')).toBe('public, max-age=30');
		const body = await response.json();
		expect(body).toMatchObject({
			overall: 'operational',
			stale: false,
			headline: 'All systems operational'
		});
		expect(body.components.map((c: { id: string }) => c.id)).toEqual(COMPONENT_IDS);
		expect(body.components[0]).not.toHaveProperty('latencyMs');
		expect(body.components[0].days).toHaveLength(90);
	});

	it('says 503, never an empty all-clear, without a database or when it cannot be read', async () => {
		const none = await feed({ platform: undefined } as never);
		expect(none.status).toBe(503);
		expect(none.headers.get('cache-control')).toBe('no-store');
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const broken = await feed({
			platform: {
				env: {
					DB: {
						prepare: () => {
							throw new Error('nope');
						}
					}
				}
			}
		} as never);
		expect(broken.status).toBe(503);
		expect(await broken.json()).toEqual({ error: 'Status is not available right now.' });
		spy.mockRestore();
	});

	it('is allowed to crawlers and listed in the sitemap', () => {
		expect(CRAWLER_ALLOW).toContain('/api/status');
		expect(SITEMAP_ROUTES.map((r) => r.path)).toContain('/status');
	});
});

describe('GET /api/status/ping', () => {
	it('answers without touching a database', async () => {
		const response = await ping({} as never);
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({ ok: true });
	});
});

describe('/status', () => {
	const run = (platform: unknown) =>
		publicLoad({ platform, setHeaders: () => {} } as never) as Promise<{ snapshot: unknown }>;
	it('loads the snapshot', async () => {
		const result = await run({ env: { DB: await seeded() } });
		expect(result.snapshot).toMatchObject({ overall: 'operational' });
	});
	it('loads null, which the page shows as "not available", when it cannot read', async () => {
		expect((await run(undefined)).snapshot).toBeNull();
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(
			(
				await run({
					env: {
						DB: {
							prepare: () => {
								throw new Error('x');
							}
						}
					}
				})
			).snapshot
		).toBeNull();
		spy.mockRestore();
	});
});

describe('/admin/status', () => {
	const ev = (db: unknown, user: unknown, fields: Record<string, string | string[]> = {}) => {
		const body = new FormData();
		for (const [k, v] of Object.entries(fields)) {
			for (const one of Array.isArray(v) ? v : [v]) body.append(k, one);
		}
		return {
			locals: user ? { user } : {},
			platform: db ? { env: { DB: db } } : undefined,
			request: new Request('https://site.test/admin/status', { method: 'POST', body })
		} as never;
	};
	const act = (name: 'create' | 'update') =>
		actions[name] as (e: never) => Promise<Record<string, unknown>>;

	it('is for the owner and superadmins only, in the load and in every action', async () => {
		const db = await seeded();
		const admin = { id: 'u-a', isAdmin: true, permissions: ['shop', 'pages'] };
		await expect(adminLoad(ev(db, null))).rejects.toMatchObject({ status: 401 });
		await expect(adminLoad(ev(db, admin))).rejects.toMatchObject({ status: 403 });
		for (const name of ['create', 'update'] as const) {
			await expect(act(name)(ev(db, null))).rejects.toMatchObject({ status: 401 });
			await expect(act(name)(ev(db, admin))).rejects.toMatchObject({ status: 403 });
		}
		await expect(adminLoad(ev(db, owner))).resolves.toBeTruthy();
		await expect(adminLoad(ev(db, superAdmin))).resolves.toBeTruthy();
	});

	it('reports a missing database', async () => {
		await expect(adminLoad(ev(null, owner))).rejects.toMatchObject({ status: 503 });
		await expect(act('create')(ev(null, owner, { title: 'x' }))).rejects.toMatchObject({
			status: 503
		});
	});

	it('posts an incident, and the public page has it', async () => {
		const db = await seeded();
		expect(
			await act('create')(
				ev(db, owner, {
					title: 'Provider outage',
					impact: 'major',
					status: 'identified',
					components: ['website', 'database'],
					message: 'Our host is having trouble.'
				})
			)
		).toMatchObject({ action: 'create', message: expect.stringContaining('public status page') });
		const snap = await getStatusSnapshot(db);
		expect(snap.openIncidents[0]).toMatchObject({
			title: 'Provider outage',
			components: ['website', 'database'],
			auto: false
		});
	});

	it('shows a refused post back with the reason', async () => {
		const db = await seeded();
		expect(await act('create')(ev(db, owner, { title: ' ' }))).toMatchObject({
			status: 400,
			data: { action: 'create', problems: ['Give the incident a title.'] }
		});
	});

	it('updates an incident, and refuses a missing message or incident', async () => {
		const db = await seeded();
		const made = await createIncident(db, { title: 'Provider outage' });
		const id = made.ok ? made.id : 0;
		expect(
			await act('update')(
				ev(db, owner, { incident_id: String(id), status: 'resolved', message: 'Fixed.' })
			)
		).toMatchObject({ action: 'update', incident: id });
		expect((await getStatusSnapshot(db)).openIncidents).toEqual([]);
		expect(
			await act('update')(ev(db, owner, { incident_id: String(id), message: '' }))
		).toMatchObject({
			status: 400,
			data: { problems: ['Write what changed.'], incident: id }
		});
		expect(await act('update')(ev(db, owner, { incident_id: '999', message: 'x' }))).toMatchObject({
			status: 400,
			data: { problems: ['That incident does not exist.'] }
		});
	});

	it('records who posted it', async () => {
		const db = await seeded();
		await act('create')(ev(db, owner, { title: 'Posted by a person', message: 'hi' }));
		const row = await db
			.prepare("SELECT created_by FROM status_incidents WHERE title = 'Posted by a person'")
			.first();
		expect(row).toEqual({ created_by: 'u-owner' });
	});
});

describe('the status-check job', () => {
	it('is registered, every minute, with a route', () => {
		const job = SCHEDULED_JOBS.find((j) => j.id === 'status-check');
		expect(job).toMatchObject({ cron: '* * * * *', path: '/api/cron/status-check' });
	});

	it('reads what the outside probe saw from the query string', () => {
		const p = (q: string) => websiteProbeFrom(new URLSearchParams(q));
		expect(p('web=ok&ms=120&http=200')).toEqual({ ok: true, ms: 120, httpStatus: 200 });
		expect(p('web=fail')).toEqual({ ok: false, ms: null, httpStatus: null });
		expect(p('web=fail&ms=8000&http=503')).toEqual({ ok: false, ms: 8000, httpStatus: 503 });
		for (const bad of ['', 'web=maybe', 'ms=5', 'web=OK']) expect(p(bad)).toBeNull();
		expect(p('web=ok&ms=abc&http=-1')).toEqual({ ok: true, ms: null, httpStatus: null });
	});

	it('records a round with the probe, and an outage the probe saw becomes an incident', async () => {
		const db = createSqliteD1();
		const run = (q: string, now: number) =>
			STATUS_CHECK_JOB.run({
				db,
				env: {},
				now,
				signal: new AbortController().signal,
				params: new URLSearchParams(q)
			} as never);
		const t0 = Math.floor(Date.parse('2026-11-17T10:00:00Z') / 1000);
		expect(await run('web=ok&ms=100&http=200', t0)).toEqual({
			components: { website: 'operational', database: 'operational' }
		});
		await run('web=fail', t0 + 60);
		const detail = await run('web=fail', t0 + 120);
		expect(detail).toEqual({ components: { website: 'down', database: 'operational' } });
		const snap = await getStatusSnapshot(db, new Date((t0 + 120) * 1000));
		expect(snap.openIncidents[0].title).toBe('Website is unavailable');
	});

	it('needs the cron secret to run through its route', async () => {
		const db = createSqliteD1();
		const request = new Request('https://site.test/api/cron/status-check', { method: 'POST' });
		await expect(
			cronPost({
				request,
				url: new URL(request.url),
				platform: { env: { DB: db, CRON_SECRET: 's3' } }
			} as never)
		).rejects.toMatchObject({ status: 401 });
		const ok = new Request('https://site.test/api/cron/status-check?web=ok&ms=50&http=200', {
			method: 'POST',
			headers: { authorization: 'Bearer s3' }
		});
		const response = await cronPost({
			request: ok,
			url: new URL(ok.url),
			platform: { env: { DB: db, CRON_SECRET: 's3' } }
		} as never);
		expect(response.status).toBe(200);
		expect((await getStatusSnapshot(db)).components[0].status).toBe('operational');
	});
});
