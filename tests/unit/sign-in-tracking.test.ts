import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import { hashPassword } from '../../src/lib/utils/passwords';
import { createAuthSession, hashSessionToken } from '../../src/lib/utils/db';
import {
	SESSION_TOUCH_SECONDS,
	SIGN_IN_RETENTION_DAYS,
	SIGN_IN_TRACKING_KEY,
	clearSignIns,
	deviceLabel,
	listSessions,
	listSignIns,
	maskIp,
	pruneSignIns,
	readTracking,
	recordSignIn,
	requestOrigin,
	resetTouchCache,
	revokeSession,
	signInSummary,
	touchSession,
	trackSessionSeen,
	trackSignIn,
	writeTracking
} from '../../src/lib/server/sign-ins';
import { authHandler } from '../../src/hooks.server';
import { POST as login } from '../../src/routes/api/auth/login/+server';
import { POST as signup } from '../../src/routes/api/auth/signup/+server';
import { finalizeOAuthLogin } from '../../src/lib/server/oauth-finalization';
import { POST as pruneRoute } from '../../src/routes/api/cron/prune-audit/+server';
import * as page from '../../src/routes/admin/sign-ins/+page.server';

function kvStore(initial: Record<string, string> = {}) {
	const map = new Map(Object.entries(initial));
	return {
		get: vi.fn(async (k: string) => map.get(k) ?? null),
		put: vi.fn(async (k: string, v: string) => void map.set(k, v)),
		delete: vi.fn(async (k: string) => void map.delete(k)),
		map
	};
}

const ON = {
	[SIGN_IN_TRACKING_KEY]: JSON.stringify({ enabled: true, updatedAt: '2026-01-01T00:00:00Z' })
};
const UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

let db: D1Database;
beforeEach(() => {
	db = createSqliteD1();
	resetTouchCache();
	vi.restoreAllMocks();
});

const events = async () =>
	(await db.prepare('SELECT * FROM sign_in_events ORDER BY rowid').all<Record<string, unknown>>())
		.results;

function req(headers: Record<string, string> = {}, body?: unknown) {
	return new Request('https://x.test/api/auth/login', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'user-agent': UA,
			'cf-connecting-ip': '203.0.113.9',
			...headers
		},
		body: body === undefined ? undefined : JSON.stringify(body)
	});
}

const platform = (kv: ReturnType<typeof kvStore>, extra: Record<string, unknown> = {}) =>
	({ env: { DB: db, KV: kv, ...extra }, cf: { country: 'US' } }) as never;

describe('the switch', () => {
	it('is off unless the owner turned it on, and fails closed', async () => {
		expect((await readTracking(undefined)).enabled).toBe(false);
		expect((await readTracking(kvStore() as never)).enabled).toBe(false);
		expect((await readTracking(kvStore({ [SIGN_IN_TRACKING_KEY]: '{bad' }) as never)).enabled).toBe(
			false
		);
		expect(
			(await readTracking(kvStore({ [SIGN_IN_TRACKING_KEY]: '{"enabled":"yes"}' }) as never))
				.enabled
		).toBe(false);
		const broken = {
			get: async () => {
				throw new Error('kv down');
			}
		};
		expect((await readTracking(broken as never)).enabled).toBe(false);
		const kv = kvStore();
		const saved = await writeTracking(kv as never, true, new Date('2026-02-03T00:00:00Z'));
		expect(saved).toEqual({ enabled: true, updatedAt: '2026-02-03T00:00:00.000Z' });
		expect((await readTracking(kv as never)).enabled).toBe(true);
		expect(
			(await readTracking(kvStore({ [SIGN_IN_TRACKING_KEY]: '{"enabled":true}' }) as never))
				.updatedAt
		).toBe('');
	});
});

describe('opt-in: off means nothing is stored', () => {
	it('records no event and no last_seen_at while off, whatever happens', async () => {
		const kv = kvStore();
		const p = platform(kv);
		expect(await recordSignIn(p, req(), { method: 'password', success: false })).toBe(false);
		await trackSignIn(p, req(), { method: 'password', success: true, userId: 'u' });
		const token = await createAuthSession(db, {
			id: 'u',
			login: 'u',
			email: 'u@x.test'
		} as never).catch(() => null);
		expect(token).toBeNull(); // no such user yet; sessions need one
		expect(await events()).toHaveLength(0);
		expect(await touchSession(p, 'tok')).toBe(false);
	});

	it('stores nothing end to end through the login route while off', async () => {
		const kv = kvStore();
		const hash = await hashPassword('correct horse battery');
		await db
			.prepare('INSERT INTO users (id, email, name, password_hash) VALUES (?,?,?,?)')
			.bind('u1', 'a@x.test', 'A', hash)
			.run();
		const ok = await login({
			platform: platform(kv),
			request: req({}, { email: 'a@x.test', password: 'correct horse battery' }),
			url: new URL('https://x.test')
		} as never);
		expect(ok.status).toBe(200);
		await expect(
			login({
				platform: platform(kv),
				request: req({}, { email: 'a@x.test', password: 'wrong' }),
				url: new URL('https://x.test')
			} as never)
		).rejects.toMatchObject({ status: 401 });
		expect(await events()).toHaveLength(0);
		const row = await db
			.prepare('SELECT last_seen_at FROM sessions')
			.first<{ last_seen_at: string | null }>();
		expect(row?.last_seen_at).toBeNull();
	});
});

describe('recording while on', () => {
	it('stores the minimum: bucketed device, country, full ip, never the raw user agent', async () => {
		const kv = kvStore(ON);
		expect(
			await recordSignIn(platform(kv), req(), { method: 'github', success: true, userId: 'u1' })
		).toBe(true);
		const [row] = await events();
		expect(row).toMatchObject({
			method: 'github',
			success: 1,
			user_id: 'u1',
			device: 'Chrome on macOS',
			country: 'US',
			ip: '203.0.113.9'
		});
		expect(JSON.stringify(row)).not.toContain('Mozilla');
		expect(Object.keys(row).sort()).toEqual([
			'country',
			'created_at',
			'device',
			'id',
			'ip',
			'method',
			'reason',
			'success',
			'user_id'
		]);
	});

	it('records failures with a short reason, clipped', async () => {
		const kv = kvStore(ON);
		await recordSignIn(platform(kv), req(), {
			method: 'password',
			success: false,
			reason: 'x'.repeat(200)
		});
		const [row] = await events();
		expect(row.success).toBe(0);
		expect(String(row.reason)).toHaveLength(80);
	});

	it('handles a missing request, ip, unknown country and device', async () => {
		const kv = kvStore(ON);
		await recordSignIn({ env: { DB: db, KV: kv }, cf: { country: 'XX' } } as never, undefined, {
			method: 'signup',
			success: true
		});
		const [row] = await events();
		expect(row).toMatchObject({ ip: null, country: null, device: 'Unknown device' });
		expect(requestOrigin(req({ 'user-agent': 'curl/8' }), { country: 'zz' }).country).toBeNull();
		expect(requestOrigin(undefined, null)).toEqual({
			ip: null,
			device: 'Unknown device',
			country: null
		});
	});

	it('NEVER throws into a login: broken db, broken kv, missing table', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const brokenDb = {
			prepare: () => {
				throw new Error('boom');
			},
			batch: async () => {
				throw new Error('boom');
			}
		};
		const p = { env: { DB: brokenDb, KV: kvStore(ON) } } as never;
		expect(await recordSignIn(p, req(), { method: 'password', success: true })).toBe(false);
		await expect(
			trackSignIn(p, req(), { method: 'password', success: true })
		).resolves.toBeUndefined();
		const bare = createSqliteD1(['0001_initial_schema.sql']);
		expect(
			await recordSignIn({ env: { DB: bare, KV: kvStore(ON) } } as never, req(), {
				method: 'password',
				success: true
			})
		).toBe(false);
		expect(await recordSignIn(undefined, req(), { method: 'password', success: true })).toBe(false);
		expect(spy).toHaveBeenCalled();
	});

	it('hands the work to waitUntil when the platform has it', async () => {
		const waitUntil = vi.fn();
		const kv = kvStore(ON);
		await trackSignIn({ env: { DB: db, KV: kv }, context: { waitUntil } } as never, req(), {
			method: 'password',
			success: true
		});
		expect(waitUntil).toHaveBeenCalledOnce();
		await waitUntil.mock.calls[0][0];
		expect(await events()).toHaveLength(1);
		const seen = vi.fn();
		await trackSessionSeen(
			{ env: { DB: db, KV: kv }, context: { waitUntil: seen } } as never,
			'tok'
		);
		expect(seen).toHaveBeenCalledOnce();
	});
});

describe('login and signup routes', () => {
	async function user() {
		const hash = await hashPassword('correct horse battery');
		await db
			.prepare('INSERT INTO users (id, email, name, password_hash) VALUES (?,?,?,?)')
			.bind('u1', 'a@x.test', 'A', hash)
			.run();
	}
	const call = (kv: ReturnType<typeof kvStore>, body: unknown) =>
		login({
			platform: platform(kv),
			request: req({}, body),
			url: new URL('https://x.test')
		} as never);

	it('records success and each kind of failure, and still behaves the same', async () => {
		await user();
		const kv = kvStore(ON);
		await expect(
			call(kv, { email: 'nobody@x.test', password: 'whatever12' })
		).rejects.toMatchObject({ status: 401 });
		await expect(call(kv, { email: 'a@x.test', password: 'wrong' })).rejects.toMatchObject({
			status: 401
		});
		expect((await call(kv, { email: 'a@x.test', password: 'correct horse battery' })).status).toBe(
			200
		);
		const rows = await events();
		expect(rows.map((r) => [r.success, r.reason, r.user_id])).toEqual([
			[0, 'unknown account', null],
			[0, 'wrong password', 'u1'],
			[1, null, 'u1']
		]);
		// The typed email is never stored.
		expect(JSON.stringify(rows)).not.toContain('nobody@x.test');
	});

	it('records a throttled attempt', async () => {
		await user();
		const kv = kvStore({ ...ON });
		for (let i = 0; i < 12; i++)
			await Promise.resolve(call(kv, { email: 'a@x.test', password: 'nope' })).catch(() => {});
		const reasons = (await events()).map((r) => r.reason);
		expect(reasons).toContain('throttled');
	});

	it('does not refuse a correct login because recording failed', async () => {
		await user();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		// Tracking is on, but the events table is gone.
		await db.exec('DROP TABLE sign_in_events');
		const kv = kvStore(ON);
		expect((await call(kv, { email: 'a@x.test', password: 'correct horse battery' })).status).toBe(
			200
		);
	});

	it('records a signup', async () => {
		const kv = kvStore(ON);
		const res = await signup({
			platform: platform(kv),
			request: req(
				{},
				{
					email: 'new@x.test',
					password: 'correct horse battery',
					confirmPassword: 'correct horse battery',
					name: 'New'
				}
			),
			url: new URL('https://x.test')
		} as never);
		expect(res.status).toBe(201);
		expect((await events())[0]).toMatchObject({ method: 'signup', success: 1 });
	});
});

describe('OAuth', () => {
	it('records a provider sign-in but not a link flow, and nothing when off', async () => {
		await db
			.prepare('INSERT INTO users (id, email, name) VALUES (?,?,?)')
			.bind('g1', 'g@x.test', 'G')
			.run();
		const run = (kv: ReturnType<typeof kvStore>, linkedProvider?: 'github') =>
			finalizeOAuthLogin({
				db,
				platform: platform(kv),
				url: new URL('https://x.test/cb'),
				request: req(),
				method: 'github',
				userId: 'g1',
				linkedProvider
			});
		await run(kvStore());
		expect(await events()).toHaveLength(0);
		await run(kvStore(ON));
		expect(await events()).toHaveLength(1);
		await run(kvStore(ON), 'github');
		expect(await events()).toHaveLength(1);
		await finalizeOAuthLogin({
			db,
			platform: platform(kvStore(ON)),
			url: new URL('https://x.test/cb'),
			userId: 'g1'
		});
		expect(await events()).toHaveLength(1);
	});
});

describe('session last_seen_at throttling', () => {
	async function session() {
		await db.prepare('INSERT INTO users (id, email) VALUES (?,?)').bind('u1', 'a@x.test').run();
		const token = await createAuthSession(db, {
			id: 'u1',
			login: 'u1',
			email: 'a@x.test'
		} as never);
		return { token, id: await hashSessionToken(token) };
	}
	const seen = async (id: string) =>
		(
			await db
				.prepare('SELECT last_seen_at FROM sessions WHERE id = ?')
				.bind(id)
				.first<{ last_seen_at: string | null }>()
		)?.last_seen_at;

	it('writes at most once per five minutes', async () => {
		const { token, id } = await session();
		const p = platform(kvStore(ON));
		const t0 = new Date('2026-03-01T12:00:00Z');
		expect(await touchSession(p, token, t0)).toBe(true);
		expect(await seen(id)).toBe('2026-03-01T12:00:00Z');
		expect(await touchSession(p, token, new Date(t0.getTime() + 60_000))).toBe(false);
		expect(await seen(id)).toBe('2026-03-01T12:00:00Z');
		expect(
			await touchSession(p, token, new Date(t0.getTime() + (SESSION_TOUCH_SECONDS + 1) * 1000))
		).toBe(true);
		expect(await seen(id)).toBe('2026-03-01T12:05:01Z');
	});

	it('also holds across isolates, because the UPDATE has its own staleness test', async () => {
		const { token, id } = await session();
		const p = platform(kvStore(ON));
		const t0 = new Date('2026-03-01T12:00:00Z');
		await touchSession(p, token, t0);
		resetTouchCache(); // a different isolate
		expect(await touchSession(p, token, new Date(t0.getTime() + 30_000))).toBe(false);
		expect(await seen(id)).toBe('2026-03-01T12:00:00Z');
	});

	it('does not even read the setting when not due, and writes nothing when off', async () => {
		const { token, id } = await session();
		const kv = kvStore(ON);
		const p = platform(kv);
		await touchSession(p, token, new Date('2026-03-01T12:00:00Z'));
		const reads = kv.get.mock.calls.length;
		await touchSession(p, token, new Date('2026-03-01T12:01:00Z'));
		expect(kv.get.mock.calls.length).toBe(reads);
		resetTouchCache();
		await db.prepare('UPDATE sessions SET last_seen_at = NULL').run();
		expect(await touchSession(platform(kvStore()), token, new Date('2026-03-02T00:00:00Z'))).toBe(
			false
		);
		expect(await seen(id)).toBeNull();
	});

	it('bounds its memory and swallows failures', async () => {
		const p = platform(kvStore());
		for (let i = 0; i < 5001; i++) await touchSession(p, `t${i}`);
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const brokenPlatform = {
			env: {
				DB: {
					prepare: () => {
						throw new Error('x');
					}
				},
				KV: kvStore(ON)
			}
		} as never;
		expect(await touchSession(brokenPlatform, 'zzz')).toBe(false);
		expect(await touchSession(undefined, 'zzz')).toBe(false);
	});

	it('is driven by the auth hook for a real session and skips simulated ones', async () => {
		const { token, id } = await session();
		const kv = kvStore(ON);
		const run = (cookie: string) =>
			authHandler({
				event: {
					cookies: { get: () => cookie, delete: vi.fn() },
					locals: {},
					platform: platform(kv),
					url: new URL('https://x.test')
				},
				resolve: async () => new Response('ok')
			} as never);
		await run('not-a-session');
		expect(await seen(id)).toBeNull();
		await run(token);
		expect(await seen(id)).not.toBeNull();
	});
});

describe('retention', () => {
	const insert = (id: string, stamp: string) =>
		db
			.prepare(
				`INSERT INTO sign_in_events (id, method, success, created_at) VALUES (?, 'password', 1, ?)`
			)
			.bind(id, stamp)
			.run();
	const ago = (days: number) =>
		new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 19) + 'Z';

	it('is 90 days and enforced as rows are written', async () => {
		expect(SIGN_IN_RETENTION_DAYS).toBe(90);
		await insert('old', ago(120));
		await insert('fresh', ago(10));
		await recordSignIn(platform(kvStore(ON)), req(), { method: 'password', success: true });
		const ids = (await events()).map((r) => r.id);
		expect(ids).not.toContain('old');
		expect(ids).toContain('fresh');
		expect(ids).toHaveLength(2);
	});

	it('prunes on demand, through the cron route, and clears everything on request', async () => {
		await insert('old', ago(120));
		await insert('fresh', ago(10));
		expect(await pruneSignIns(db)).toBe(1);
		await insert('old2', ago(200));
		const res = await pruneRoute({
			request: new Request('https://x.test/c', {
				method: 'POST',
				headers: { authorization: 'Bearer s' }
			}),
			url: new URL('https://x.test/api/cron/prune-audit'),
			platform: { env: { DB: db, CRON_SECRET: 's' } }
		} as never);
		expect((await res.json()).detail.prunedSignIns).toBe(1);
		await db.prepare('INSERT INTO users (id, email) VALUES (?,?)').bind('u', 'u@x.test').run();
		await createAuthSession(db, { id: 'u' } as never);
		await db.prepare("UPDATE sessions SET last_seen_at = '2026-01-01T00:00:00Z'").run();
		expect(await clearSignIns(db)).toBe(1);
		expect(await events()).toHaveLength(0);
		expect(
			(
				await db
					.prepare('SELECT last_seen_at FROM sessions')
					.first<{ last_seen_at: string | null }>()
			)?.last_seen_at
		).toBeNull();
		expect(await pruneSignIns(db, 0)).toBe(0);
	});
});

describe('display helpers', () => {
	it('masks IPs and buckets devices', () => {
		expect(maskIp('203.0.113.9')).toBe('203.0.x.x');
		expect(maskIp('2001:db8:85a3::8a2e')).toBe('2001:db8:…');
		expect(maskIp('weird')).toBe('***');
		expect(maskIp(null)).toBe('—');
		expect(deviceLabel(UA)).toBe('Chrome on macOS');
		expect(deviceLabel('Mozilla/5.0 (Linux; Android 14) Firefox/120.0')).toBe('Firefox on Android');
		expect(deviceLabel('curl/8.0 (Windows NT 10.0)')).toBe('Windows');
		expect(deviceLabel('Safari/605 (something)')).toBe('Safari');
		expect(deviceLabel('')).toBe('Unknown device');
		expect(deviceLabel(null)).toBe('Unknown device');
	});
});

describe('/admin/sign-ins', () => {
	const owner = { id: 'o1', login: 'owner', email: 'o@x.test', isOwner: true };
	const admin = { id: 'a1', login: 'admin', isAdmin: true };
	const cookies = (value?: string) => ({ get: () => value }) as never;
	const load = (user: unknown, opts: { reveal?: string; env?: Record<string, unknown> } = {}) =>
		page.load({
			locals: { user },
			platform: { env: opts.env ?? { DB: db, KV: kvStore(ON) } },
			cookies: cookies(opts.reveal)
		} as never) as Promise<{
			tracking: { enabled: boolean };
			sessions: Array<{ email: string | null; own: boolean; id: string }>;
			events: Array<{ ip: string | null; email: string | null }>;
			summary: { last24h: { success: number; failure: number } };
			revealed: boolean;
		}>;

	it('is owner-only, including against ordinary admins', async () => {
		await expect(load(undefined)).rejects.toMatchObject({ status: 401 });
		await expect(load(admin)).rejects.toMatchObject({ status: 403 });
		await expect(load(owner, { env: {} })).rejects.toMatchObject({ status: 503 });
		const form = (entries: Record<string, string>) => {
			const data = new FormData();
			for (const [k, v] of Object.entries(entries)) data.append(k, v);
			return new Request('https://x.test', { method: 'POST', body: data });
		};
		for (const action of [page.actions.tracking, page.actions.revoke, page.actions.clear]) {
			await expect(
				action({
					locals: { user: admin },
					platform: { env: { DB: db, KV: kvStore() } },
					request: form({})
				} as never)
			).rejects.toMatchObject({ status: 403 });
		}
	});

	it('masks ip and email unless the owner has revealed PII', async () => {
		await db
			.prepare('INSERT INTO users (id, email) VALUES (?,?)')
			.bind('u1', 'ada@example.com')
			.run();
		await createAuthSession(db, { id: 'u1' } as never);
		await recordSignIn(platform(kvStore(ON)), req(), {
			method: 'password',
			success: true,
			userId: 'u1'
		});
		const masked = await load(owner);
		expect(masked.events[0].ip).toBe('203.0.x.x');
		expect(masked.events[0].email).not.toBe('ada@example.com');
		expect(masked.sessions[0].email).not.toBe('ada@example.com');
		const revealed = await load(owner, { reveal: '1' });
		expect(revealed.events[0].ip).toBe('203.0.113.9');
		expect(revealed.events[0].email).toBe('ada@example.com');
		expect(masked.summary.last24h.success).toBe(1);
	});

	it('toggles tracking, revokes a session and clears history', async () => {
		const kv = kvStore();
		const env = { DB: db, KV: kv };
		const form = (entries: Record<string, string>) => {
			const data = new FormData();
			for (const [k, v] of Object.entries(entries)) data.append(k, v);
			return new Request('https://x.test', { method: 'POST', body: data });
		};
		const ev = (request: Request, e: Record<string, unknown> = env) =>
			({ locals: { user: owner }, platform: { env: e }, request }) as never;
		expect(await page.actions.tracking(ev(form({ enabled: 'on' })))).toEqual({ saved: 'on' });
		expect((await readTracking(kv as never)).enabled).toBe(true);
		expect(await page.actions.tracking(ev(form({})))).toEqual({ saved: 'off' });
		expect((await readTracking(kv as never)).enabled).toBe(false);
		expect(await page.actions.tracking(ev(form({}), { DB: db }))).toMatchObject({ status: 503 });

		await db.prepare('INSERT INTO users (id, email) VALUES (?,?)').bind('u1', 'a@x.test').run();
		const token = await createAuthSession(db, { id: 'u1' } as never);
		const id = await hashSessionToken(token);
		expect((await listSessions(db)).map((s) => s.id)).toEqual([id]);
		expect(await page.actions.revoke(ev(form({ id })))).toEqual({ revoked: true });
		expect(await listSessions(db)).toEqual([]);
		expect(await page.actions.revoke(ev(form({ id })))).toMatchObject({ status: 404 });
		expect(await page.actions.revoke(ev(form({})))).toMatchObject({ status: 404 });

		await recordSignIn(platform(kvStore(ON)), req(), { method: 'password', success: true });
		expect(await page.actions.clear(ev(form({})))).toEqual({ cleared: 1 });
	});

	it('a revoked session no longer signs anyone in', async () => {
		await db.prepare('INSERT INTO users (id, email) VALUES (?,?)').bind('u1', 'a@x.test').run();
		const token = await createAuthSession(db, {
			id: 'u1',
			login: 'u1',
			email: 'a@x.test'
		} as never);
		const { getAuthSession } = await import('../../src/lib/utils/db');
		expect(await getAuthSession(db, token)).not.toBeNull();
		expect(await revokeSession(db, await hashSessionToken(token))).toBe(true);
		expect(await getAuthSession(db, token)).toBeNull();
	});
});

describe('listing fails soft', () => {
	it('returns empty/zero before the migration is applied', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const bare = createSqliteD1(['0001_initial_schema.sql']);
		expect(await listSignIns(bare)).toEqual([]);
		expect(await listSessions(bare)).toEqual([]);
		expect(await signInSummary(bare)).toEqual({
			last24h: { success: 0, failure: 0 },
			last7d: { success: 0, failure: 0 }
		});
		expect(await listSignIns(db, 99999)).toEqual([]);
	});
});
