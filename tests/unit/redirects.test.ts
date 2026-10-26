import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import {
	REDIRECT_STATUSES,
	allowedRedirectHosts,
	createRedirect,
	deleteRedirect,
	getRedirectByFromPath,
	isSafeRedirectTarget,
	isSameSitePath,
	listRedirects,
	normalizeFromPath,
	recordRedirectHit,
	redirectLocation,
	updateRedirect,
	validateRedirect,
	wouldLoop
} from '../../src/lib/server/redirects';
import { actions, load } from '../../src/routes/admin/redirects/+page.server';
import { redirectsHandler } from '../../src/hooks.server';
import { site } from '../../src/lib/site.config';

const HOSTS = allowedRedirectHosts('docs.example.org, bad host, ');
const own = new URL(site.url).hostname;

describe('target safety', () => {
	it('accepts same-site paths and allowlisted https URLs', () => {
		expect(isSafeRedirectTarget('/new', HOSTS)).toBe(true);
		expect(isSafeRedirectTarget('/a/b?x=1#y', HOSTS)).toBe(true);
		expect(isSafeRedirectTarget(`https://${own}/x`, HOSTS)).toBe(true);
		expect(isSafeRedirectTarget('https://docs.example.org/x', HOSTS)).toBe(true);
		expect(isSafeRedirectTarget('HTTPS://DOCS.EXAMPLE.ORG/x', HOSTS)).toBe(true);
	});
	it.each([
		'javascript:alert(1)',
		'JaVaScRiPt:alert(1)',
		'data:text/html,x',
		'//evil.example/x',
		'/\\evil.example',
		'\\\\evil.example',
		'http://docs.example.org/x',
		'https://evil.example/x',
		'https://docs.example.org.evil.example/x',
		`https://${own}@evil.example/x`,
		'https://user:pw@docs.example.org/x',
		'/new\r\nSet-Cookie: a=b',
		'/with space',
		'https://',
		'new',
		''
	])('rejects %j', (target) => {
		expect(isSafeRedirectTarget(target, HOSTS)).toBe(false);
	});
	it('ignores malformed extra hosts and adds the www twin of the site host', () => {
		expect(HOSTS.has('bad host')).toBe(false);
		expect(HOSTS.has('docs.example.org')).toBe(true);
		expect(HOSTS.has(`www.${own}`)).toBe(true);
		expect(allowedRedirectHosts().has(own)).toBe(true);
	});
	it('rejects over-long paths', () => {
		expect(isSameSitePath(`/${'a'.repeat(600)}`)).toBe(false);
	});
});

describe('validateRedirect', () => {
	const ok = (fromPath: string, toPath: string, status = 301) =>
		validateRedirect({ fromPath, toPath, status }, HOSTS);
	it('normalizes the old address', () => {
		expect(normalizeFromPath('old/')).toBe('/old');
		expect(ok('/old///', '/new')).toMatchObject({ ok: true, value: { fromPath: '/old' } });
	});
	it('refuses bad input with a reason', () => {
		const err = (r: ReturnType<typeof ok>) => (r.ok ? '' : r.error);
		expect(err(ok('old', '/new'))).toMatch(/start with/);
		expect(err(ok('//evil.example', '/new'))).toMatch(/start with/);
		expect(err(ok('/old?x=1', '/new'))).toMatch(/path only/);
		expect(err(ok('/old page', '/new'))).toMatch(/characters/);
		expect(err(ok('/', '/new'))).toMatch(/home page/);
		expect(err(ok('/old', ''))).toMatch(/new address/);
		expect(err(ok('/old', 'javascript:alert(1)'))).toMatch(/path on this site/);
		expect(err(ok('/old', '/new', 200))).toMatch(/Status/);
		expect(err(ok('/old', '/old/'))).toMatch(/loop/);
		expect(err(ok('/old', `https://${own}/old`))).toMatch(/loop/);
		expect(err(ok('/old', '/old?x=1'))).toMatch(/loop/);
	});
	it('accepts every redirect status', () => {
		for (const status of REDIRECT_STATUSES) expect(ok('/old', '/new', status).ok).toBe(true);
	});
});

describe('store', () => {
	let db: ReturnType<typeof createSqliteD1>;
	beforeEach(() => {
		db = createSqliteD1();
	});

	it('creates, lists, updates, hits and deletes', async () => {
		const row = await createRedirect(db, { fromPath: '/old', toPath: '/new', status: 301 });
		expect(row).toMatchObject({ fromPath: '/old', toPath: '/new', status: 301, hits: 0 });
		await recordRedirectHit(db, row.id);
		await recordRedirectHit(db, row.id);
		expect((await getRedirectByFromPath(db, '/old/'))?.hits).toBe(2);
		await updateRedirect(db, row.id, { fromPath: '/older', toPath: '/newer', status: 308 });
		expect((await listRedirects(db))[0]).toMatchObject({ fromPath: '/older', status: 308 });
		await deleteRedirect(db, row.id);
		expect(await listRedirects(db)).toEqual([]);
		expect(await getRedirectByFromPath(db, '/older')).toBeNull();
	});
	it('enforces unique from_path and the status check in the schema', async () => {
		await createRedirect(db, { fromPath: '/old', toPath: '/new', status: 301 });
		await expect(
			createRedirect(db, { fromPath: '/old', toPath: '/x', status: 301 })
		).rejects.toThrow();
		await expect(
			createRedirect(db, { fromPath: '/b', toPath: '/x', status: 200 })
		).rejects.toThrow();
	});
	it('createRedirect throws when the insert returns no row', async () => {
		const empty = { prepare: () => ({ bind: () => ({ first: async () => null }) }) };
		await expect(
			createRedirect(empty as never, { fromPath: '/a', toPath: '/b', status: 301 })
		).rejects.toThrow('Failed to create redirect');
	});
	it('listRedirects tolerates an empty result', async () => {
		const empty = { prepare: () => ({ all: async () => ({}) }) };
		expect(await listRedirects(empty as never)).toEqual([]);
	});

	it('detects direct and chained loops, and ignores the row being edited', async () => {
		const a = await createRedirect(db, { fromPath: '/a', toPath: '/b', status: 301 });
		await createRedirect(db, { fromPath: '/b', toPath: '/c', status: 301 });
		expect(await wouldLoop(db, '/c', '/a')).toBe(true);
		expect(await wouldLoop(db, '/c', '/d')).toBe(false);
		expect(await wouldLoop(db, '/x', `https://docs.example.org/a`)).toBe(false);
		expect(await wouldLoop(db, '/c', `https://${own}/a`)).toBe(true);
		// Editing /a to point at /d: the old a->b row must not count.
		expect(await wouldLoop(db, '/d', '/a', a.id)).toBe(false);
	});
	it('treats a pre-existing cycle and an over-long chain as loops', async () => {
		const x = await createRedirect(db, { fromPath: '/x', toPath: '/y', status: 301 });
		await createRedirect(db, { fromPath: '/y', toPath: '/x', status: 301 });
		expect(await wouldLoop(db, '/new', '/x')).toBe(true);
		await deleteRedirect(db, x.id);
		for (let i = 0; i < 12; i++) {
			await createRedirect(db, { fromPath: `/h${i}`, toPath: `/h${i + 1}`, status: 301 });
		}
		expect(await wouldLoop(db, '/z', '/h0')).toBe(true);
	});
});

describe('redirectLocation', () => {
	const row = (toPath: string) => ({
		id: 1,
		fromPath: '/old',
		toPath,
		status: 301 as const,
		hits: 0,
		createdAt: ''
	});
	const url = new URL('https://site.test/old?utm=1');
	it('carries the query over unless the target has its own', () => {
		expect(redirectLocation(row('/new'), url, HOSTS)).toBe('https://site.test/new?utm=1');
		expect(redirectLocation(row('/new?a=b'), url, HOSTS)).toBe('https://site.test/new?a=b');
		expect(redirectLocation(row('https://docs.example.org/x'), url, HOSTS)).toBe(
			'https://docs.example.org/x?utm=1'
		);
		expect(redirectLocation(row('/new'), new URL('https://site.test/old'), HOSTS)).toBe(
			'https://site.test/new'
		);
	});
	it('refuses an unsafe stored target and a self-redirect', () => {
		expect(redirectLocation(row('//evil.example'), url, HOSTS)).toBeNull();
		expect(redirectLocation(row('https://evil.example/'), url, HOSTS)).toBeNull();
		expect(redirectLocation(row('/old'), url, HOSTS)).toBeNull();
	});
});

describe('redirectsHandler', () => {
	function call(
		db: unknown,
		path = '/old',
		status = 404,
		method = 'GET',
		extra: Record<string, unknown> = {}
	) {
		const notFound = new Response('nope', { status });
		const resolve = vi.fn(async () => notFound);
		return {
			notFound,
			resolve,
			run: () =>
				redirectsHandler({
					event: {
						url: new URL(`https://site.test${path}`),
						request: new Request(`https://site.test${path}`, { method }),
						platform: db ? { env: { DB: db }, ...extra } : undefined
					} as never,
					resolve
				})
		};
	}

	it('answers a 404 with the stored redirect and counts the hit', async () => {
		const db = createSqliteD1();
		await createRedirect(db, { fromPath: '/old', toPath: '/new', status: 308 });
		const { run } = call(db, '/old?a=1');
		const response = await run();
		expect(response.status).toBe(308);
		expect(response.headers.get('location')).toBe('https://site.test/new?a=1');
		expect((await getRedirectByFromPath(db, '/old'))?.hits).toBe(1);
	});
	it('uses waitUntil for the hit when the platform has it', async () => {
		const db = createSqliteD1();
		await createRedirect(db, { fromPath: '/old', toPath: '/new', status: 301 });
		const waitUntil = vi.fn();
		await call(db, '/old', 404, 'HEAD', { context: { waitUntil } }).run();
		expect(waitUntil).toHaveBeenCalledOnce();
		await waitUntil.mock.calls[0][0];
		expect((await getRedirectByFromPath(db, '/old'))?.hits).toBe(1);
	});
	it('never touches D1 for a healthy response', async () => {
		const prepare = vi.fn();
		const { run, notFound } = call({ prepare }, '/old', 200);
		expect(await run()).toBe(notFound);
		expect(prepare).not.toHaveBeenCalled();
		const redirectStatus = call({ prepare }, '/old', 301);
		await redirectStatus.run();
		expect(prepare).not.toHaveBeenCalled();
		expect(notFound.status).toBe(200);
	});
	it('leaves non-GET requests, missing DB and unknown paths alone', async () => {
		const db = createSqliteD1();
		await createRedirect(db, { fromPath: '/old', toPath: '/new', status: 301 });
		const post = call(db, '/old', 404, 'POST');
		expect(await post.run()).toBe(post.notFound);
		const noDb = call(null);
		expect(await noDb.run()).toBe(noDb.notFound);
		const unknown = call(db, '/elsewhere');
		expect(await unknown.run()).toBe(unknown.notFound);
	});
	it('serves the 404 when the stored target is unsafe, or the table is broken', async () => {
		const db = createSqliteD1();
		await db
			.prepare("INSERT INTO redirects (from_path, to_path) VALUES ('/evil', '//evil.example/x')")
			.run();
		const evil = call(db, '/evil');
		expect(await evil.run()).toBe(evil.notFound);
		const broken = call(
			{
				prepare: () => {
					throw new Error('no such table');
				}
			},
			'/old'
		);
		expect(await broken.run()).toBe(broken.notFound);
	});
	it('swallows a failing hit write', async () => {
		const real = createSqliteD1();
		await createRedirect(real, { fromPath: '/old', toPath: '/new', status: 301 });
		const db = {
			prepare: (sql: string) =>
				sql.startsWith('UPDATE')
					? { bind: () => ({ run: async () => Promise.reject(new Error('locked')) }) }
					: real.prepare(sql)
		};
		expect((await call(db).run()).status).toBe(301);
	});
});

describe('/admin/redirects', () => {
	const admin = { isAdmin: true, permissions: ['pages'] } as never;
	const formData = (fields: Record<string, string>) => {
		const body = new FormData();
		for (const [k, v] of Object.entries(fields)) body.set(k, v);
		return { request: new Request('https://site.test/admin/redirects', { method: 'POST', body }) };
	};
	const base = (db: unknown, locals: unknown, fields: Record<string, string> = {}) =>
		({
			locals,
			platform: db ? { env: { DB: db } } : undefined,
			...formData(fields)
		}) as never;

	it('requires an admin for the load and every action', async () => {
		const db = createSqliteD1();
		await expect(load(base(db, {}))).rejects.toMatchObject({ status: 401 });
		await expect(load(base(db, { user: { isAdmin: false } }))).rejects.toMatchObject({
			status: 403
		});
		// An admin without the pages area is refused too.
		await expect(
			load(base(db, { user: { isAdmin: true, permissions: [] } }))
		).rejects.toMatchObject({
			status: 403
		});
		for (const name of ['create', 'update', 'delete'] as const) {
			await expect(
				(actions[name] as (e: never) => Promise<unknown>)(base(db, {}, {}))
			).rejects.toMatchObject({ status: 401 });
		}
	});
	it('reports a missing database', async () => {
		const locals = { user: admin };
		await expect(load(base(null, locals))).rejects.toMatchObject({ status: 503 });
		for (const name of ['create', 'update', 'delete'] as const) {
			await expect(
				(actions[name] as (e: never) => Promise<unknown>)(base(null, locals, { id: '1' }))
			).rejects.toMatchObject({ status: 503 });
		}
	});
	it('creates, lists, updates and deletes', async () => {
		const db = createSqliteD1();
		const locals = { user: admin };
		const create = actions.create as (e: never) => Promise<Record<string, unknown>>;
		const update = actions.update as (e: never) => Promise<Record<string, unknown>>;
		const del = actions.delete as (e: never) => Promise<Record<string, unknown>>;

		expect(
			await create(base(db, locals, { from_path: '/old', to_path: '/new', status: '302' }))
		).toMatchObject({ message: 'Redirect added.' });
		const loaded = (await load(base(db, locals))) as { redirects: Array<{ id: number }> };
		expect(loaded.redirects).toHaveLength(1);
		const id = String(loaded.redirects[0].id);

		expect(
			await update(base(db, locals, { id, from_path: '/old', to_path: '/newer', status: '301' }))
		).toMatchObject({ message: 'Redirect saved.' });
		expect((await getRedirectByFromPath(db, '/old'))?.toPath).toBe('/newer');
		expect(await del(base(db, locals, { id }))).toMatchObject({ message: 'Redirect removed.' });
		expect(await listRedirects(db)).toEqual([]);
	});
	it('refuses open redirects, loops, duplicates and bad ids', async () => {
		const db = createSqliteD1();
		const locals = { user: admin };
		const create = actions.create as unknown as (
			e: never
		) => Promise<{ data: { problem: string }; status: number }>;
		const update = actions.update as unknown as (
			e: never
		) => Promise<{ data: { problem: string }; status: number }>;
		const del = actions.delete as unknown as (
			e: never
		) => Promise<{ data: { problem: string }; status: number }>;

		const evil = await create(
			base(db, locals, { from_path: '/a', to_path: '//evil.example', status: '301' })
		);
		expect(evil.status).toBe(400);
		expect(evil.data.problem).toMatch(/path on this site/);

		await create(base(db, locals, { from_path: '/a', to_path: '/b' }));
		const circle = await create(base(db, locals, { from_path: '/b', to_path: '/a' }));
		expect(circle.data.problem).toMatch(/circle/);
		const dup = await create(base(db, locals, { from_path: '/a', to_path: '/z' }));
		expect(dup).toMatchObject({ status: 409 });

		await create(base(db, locals, { from_path: '/c', to_path: '/d' }));
		const id = String((await getRedirectByFromPath(db, '/c'))?.id);
		const clash = await update(
			base(db, locals, { id, from_path: '/a', to_path: '/d', status: '301' })
		);
		expect(clash.status).toBe(409);
		const bad = await update(
			base(db, locals, { id, from_path: '/c', to_path: 'javascript:x', status: '301' })
		);
		expect(bad.status).toBe(400);
		expect((await update(base(db, locals, { id: 'x' }))).status).toBe(400);
		expect((await del(base(db, locals, { id: 'x' }))).status).toBe(400);
	});
});
