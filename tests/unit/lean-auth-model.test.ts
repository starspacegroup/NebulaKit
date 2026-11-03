import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Ties the Lean model of auth (umbrella repo, proofs/Proofs/Auth.lean) to this code.
 * tests/fixtures/lean-auth-model.json is the model's own output
 * (`cd ../proofs && lake exe authtable`). Every row is a case where the TypeScript must
 * answer what Lean answers; if the code changes shape this fails and the proofs no
 * longer describe it. Sessions and the auth hook run against real SQLite (node:sqlite),
 * so `datetime(expires_at) > datetime('now')` is SQLite's answer, not a mock's.
 */

const findValidSessionOverride = vi.hoisted(() => ({
	fn: null as null | ((t: string) => unknown)
}));
vi.mock('$lib/utils/db', async (importActual) => {
	const actual = await importActual<typeof import('$lib/utils/db')>();
	return {
		...actual,
		findValidSession: (db: unknown, token: string) =>
			findValidSessionOverride.fn
				? findValidSessionOverride.fn(token)
				: actual.findValidSession(db as never, token)
	};
});
vi.mock('$lib/utils/auth-provider-config', async (importActual) => ({
	...(await importActual<object>()),
	// The callbacks stop right after the state gate: "not configured" means it passed.
	getAuthProviderCredentials: async () => ({ clientId: '', clientSecret: '' })
}));

const model = JSON.parse(
	readFileSync(join(__dirname, '..', 'fixtures', 'lean-auth-model.json'), 'utf8')
);

const roles = await import('$lib/access/roles');
const perms = await import('$lib/access/permissions');
const guards = await import('$lib/server/auth-guards');
const statsGuard = await import('$lib/server/stats-guard');
const pii = await import('$lib/server/pii-mask');
const { load: adminLayoutLoad } = await import('../../src/routes/admin/+layout.server');
const { authHandler } = await import('../../src/hooks.server');
const db = await import('$lib/utils/db');
const oauth = await import('$lib/utils/oauth-state');
const throttle = await import('$lib/server/login-throttle');
const { timingSafeEqualStrings } = await import('$lib/server/timing-safe');
const { hashPassword } = await import('$lib/utils/passwords');
const githubCallback = await import('../../src/routes/api/auth/github/callback/+server');
const discordCallback = await import('../../src/routes/api/auth/discord/callback/+server');
const loginRoute = await import('../../src/routes/api/auth/login/+server');

afterEach(() => {
	vi.useRealTimers();
	findValidSessionOverride.fn = null;
});

// ── D1 over node:sqlite ─────────────────────────────────────────────────────

function d1(sqlite: DatabaseSync) {
	const norm = (v: unknown) => (typeof v === 'boolean' ? Number(v) : v === undefined ? null : v);
	const stmt = (sql: string, args: unknown[] = []) => ({
		bind: (...a: unknown[]) => stmt(sql, a.map(norm)),
		first: async () => (sqlite.prepare(sql).get(...(args as never[])) as unknown) ?? null,
		all: async () => ({ results: sqlite.prepare(sql).all(...(args as never[])) }),
		run: async () => {
			sqlite.prepare(sql).run(...(args as never[]));
			return { success: true };
		}
	});
	return {
		prepare: (sql: string) => stmt(sql),
		batch: async (list: { run: () => Promise<unknown> }[]) => {
			for (const s of list) await s.run();
			return [];
		}
	};
}

function freshDb() {
	const sqlite = new DatabaseSync(':memory:');
	sqlite.exec(`
		CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, name TEXT, github_login TEXT,
		  github_avatar_url TEXT, is_admin INTEGER DEFAULT 0, can_view_stats INTEGER DEFAULT 0,
		  role TEXT, password_hash TEXT);
		CREATE TABLE user_login_aliases (user_id TEXT, email TEXT);
		CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT, expires_at TEXT, data TEXT);
		CREATE TABLE user_permissions (user_id TEXT, permission TEXT, granted_by TEXT);
	`);
	return { sqlite, db: d1(sqlite) };
}

function cookieJar(values: Record<string, string | undefined>) {
	return {
		get: (name: string) => values[name],
		delete: (name: string) => {
			delete values[name];
		},
		set: () => {}
	};
}

async function status(fn: () => unknown): Promise<string> {
	try {
		await fn();
		return 'ok';
	} catch (e: any) {
		if (typeof e?.status === 'number') return String(e.status);
		throw e;
	}
}

// ── The subject as App.Locals['user'] ───────────────────────────────────────

function toUser(s: any) {
	if (!s) return undefined;
	return {
		id: 'u1',
		login: 'u1',
		email: 'u1@x.test',
		isOwner: s.isOwner,
		isSuperAdmin: s.isSuperAdmin,
		isAdmin: s.isAdmin,
		role: s.role,
		permissions: s.permissions,
		canViewStats: s.canViewStats
	};
}

async function guardAnswers(user: any) {
	const locals = { user } as App.Locals;
	let layout: boolean;
	try {
		await adminLayoutLoad({ locals, cookies: cookieJar({}) } as never);
		layout = true;
	} catch (e: any) {
		if (e?.status !== 302) throw e;
		layout = false;
	}
	return {
		effectiveRole: roles.effectiveRole(user),
		can: model.permissions.map((p: any) => perms.can(user, p)),
		requireUser: await status(() => guards.requireUser(locals)),
		requireAdmin: await status(() => guards.requireAdmin(locals)),
		requireOwner: await status(() => guards.requireOwner(locals)),
		requirePermission: await Promise.all(
			model.permissions.map((p: any) => status(() => guards.requirePermission(locals, p)))
		),
		layoutAdmits: layout,
		statsView: statsGuard.canViewStats(user),
		statsManage: statsGuard.canManageStatsConnection(user),
		canRevealPii: pii.canRevealPii(user)
	};
}

function expected(row: any) {
	const { subject: _s, ...rest } = row;
	return rest;
}

describe('Lean model: roles and permissions', () => {
	it('the permission list is exactly PERMISSIONS', () => {
		expect(model.permissions).toEqual([...perms.PERMISSIONS]);
	});

	it(`role ladder agrees on ${model.roles.length} cases`, () => {
		for (const r of model.roles) {
			const got = {
				canActOn: roles.canActOn(r.actor, r.target),
				canGrant: roles.canGrant(r.actor, r.next),
				canAssignRole: roles.canAssignRole(r.actor, r.target, r.next).ok,
				canDeleteUser: roles.canDeleteUser(r.actor, r.target).ok,
				canEditPermissions: perms.canEditPermissions(r.actor, r.target).ok
			};
			const { actor: _a, target: _t, next: _n, ...want } = r;
			expect(got, JSON.stringify(r)).toEqual(want);
		}
	});

	it(`guards agree on ${model.guards.length} subjects (incl. anonymous)`, async () => {
		for (const row of model.guards) {
			expect(await guardAnswers(toUser(row.subject)), JSON.stringify(row.subject)).toEqual(
				expected(row)
			);
		}
	});
});

describe('Lean model: the auth hook', () => {
	it(`builds the modelled subject for ${model.hook.length} user rows`, async () => {
		for (const row of model.hook) {
			const { sqlite, db: d } = freshDb();
			sqlite
				.prepare(
					`INSERT INTO users (id, email, name, is_admin, can_view_stats, role) VALUES (?,?,?,?,?,?)`
				)
				.run(
					'1001',
					'a@x.test',
					'A',
					row.isAdminCol ? 1 : 0,
					row.canViewStatsCol ? 1 : 0,
					row.role
				);
			for (const p of row.grants)
				sqlite.prepare('INSERT INTO user_permissions VALUES (?,?,?)').run('1001', p, 'x');
			const token = await db.createAuthSession(d as never, {
				id: '1001',
				login: 'a',
				email: 'a@x.test',
				isOwner: false
			});
			const event: any = {
				cookies: cookieJar({ session: token }),
				platform: { env: { DB: d, GITHUB_OWNER_ID: row.ownerConfigured ? '1001' : '999' } },
				url: new URL('https://example.com/'),
				locals: {}
			};
			await authHandler({ event, resolve: () => new Response('') });
			const u = event.locals.user;
			const want = row.result.subject;
			const ctx = JSON.stringify(row);
			expect(u, ctx).toBeTruthy();
			expect(
				{
					isOwner: u.isOwner,
					isSuperAdmin: u.isSuperAdmin,
					isAdmin: u.isAdmin,
					role: u.role,
					permissions: u.permissions,
					canViewStats: u.canViewStats
				},
				ctx
			).toEqual(want);
			expect(await guardAnswers(u), ctx).toEqual(expected(row.result));
		}
	});

	it(`authenticates exactly when the model does on ${model.sessions.length} sessions`, async () => {
		for (const row of model.sessions) {
			const { sqlite, db: d } = freshDb();
			if (row.userExists)
				sqlite
					.prepare(`INSERT INTO users (id, email, role) VALUES ('1001','a@x.test','user')`)
					.run();
			const token = 'session-token-' + Math.random();
			if (!row.noRow) {
				const expires = new Date(Date.now() + row.expiresIn * 1000).toISOString();
				const data = {
					id: '1001',
					login: 'a',
					email: 'a@x.test',
					isOwner: false,
					isPretend: row.pretend
				};
				sqlite
					.prepare('INSERT INTO sessions VALUES (?,?,?,?)')
					.run(await db.hashSessionToken(token), '1001', expires, JSON.stringify(data));
			}
			const event: any = {
				cookies: cookieJar({ session: token }),
				platform: {
					env: {
						...(row.db ? { DB: d } : {}),
						...(row.devSim ? { DEV_AUTH_BYPASS: 'true' } : {})
					}
				},
				url: new URL(row.devSim ? 'http://localhost:5173/' : 'https://example.com/'),
				locals: {}
			};
			await authHandler({ event, resolve: () => new Response('') });
			expect(Boolean(event.locals.user), JSON.stringify(row)).toBe(row.authenticates);
		}
	});
});

// ── OAuth state ─────────────────────────────────────────────────────────────

const SECRET = 'lean-model-secret';
const stateName = (n: number | null) => (n === null ? null : `st-${n}`);
const userName = (n: number | null) => (n === null ? undefined : `u${n}`);
const tokenName = (n: number | null) => (n === null ? undefined : `tok-${n}`);

async function cookieFor(p: any): Promise<string | undefined> {
	if (!p) return undefined;
	return oauth.signValue(
		{
			provider: p.provider,
			state: stateName(p.state),
			intent: p.intent,
			issuedAt: p.issuedAt,
			...(p.userId === null ? {} : { userId: userName(p.userId) })
		},
		SECRET
	);
}

describe('Lean model: OAuth state', () => {
	it(`verifyOAuthState agrees on ${model.oauthState.length} cases`, async () => {
		vi.useFakeTimers();
		for (const row of model.oauthState) {
			vi.setSystemTime(row.now);
			const got = await oauth.verifyOAuthState(
				row.check,
				stateName(row.presented),
				await cookieFor(row.payload),
				SECRET
			);
			expect(Boolean(got), JSON.stringify(row)).toBe(row.result);
		}
		// A signature made with another secret is the model's `payload = none`.
		vi.setSystemTime(model.oauthState[0].now);
		const forged = await oauth.signValue(
			{ provider: 'github', state: 'st-1', intent: 'login', issuedAt: model.oauthState[0].now },
			'other-secret'
		);
		expect(await oauth.verifyOAuthState('github', 'st-1', forged, SECRET)).toBeNull();
	});

	async function storedRow(s: any) {
		if (!s) return null;
		return {
			intent: s.intent,
			user_id: s.userId === null ? null : userName(s.userId),
			session_id: s.sessionId === null ? null : await db.hashSessionToken(tokenName(s.sessionId)!)
		};
	}

	function fakeDb(row: unknown) {
		return {
			prepare: () => ({
				bind: () => ({ first: async () => row, run: async () => ({}) }),
				run: async () => ({})
			})
		};
	}

	it(`verifyOAuthTransaction and both callbacks agree on ${model.oauthTransactions.length} cases`, async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		findValidSessionOverride.fn = (t) => (t.startsWith('tok-') ? { id: 'x' } : null);
		for (const row of model.oauthTransactions) {
			vi.setSystemTime(row.now);
			const cookie = await cookieFor(row.payload);
			const stored = await storedRow(row.stored);
			const ctx = JSON.stringify(row);

			const got = await oauth.verifyOAuthTransaction(
				fakeDb(stored) as never,
				'github',
				'st-1',
				cookieJar({ oauth_state_github: cookie }),
				SECRET,
				tokenName(row.bound)
			);
			expect(Boolean(got), ctx).toBe(row.verify);

			for (const [provider, mod] of [
				['github', githubCallback],
				['discord', discordCallback]
			] as const) {
				// Same payload, re-signed for this provider.
				const pc = row.payload ? await cookieFor({ ...row.payload, provider }) : undefined;
				const url = new URL(`https://example.com/api/auth/${provider}/callback?code=c&state=st-1`);
				let location = '';
				try {
					await mod.GET({
						url,
						cookies: cookieJar({
							[`oauth_state_${provider}`]: pc,
							session: tokenName(row.bound)
						}),
						platform: { env: { DB: fakeDb(stored), SESSION_SECRET: SECRET } },
						locals: { user: row.localUser === null ? undefined : { id: userName(row.localUser) } }
					} as never);
				} catch (e: any) {
					location = e?.location ?? String(e);
				}
				const admitted = location.includes('error=not_configured');
				const rejected = location.includes('error=invalid_state');
				expect(admitted || rejected, `${provider} ${ctx} -> ${location}`).toBe(true);
				expect(admitted, `${provider} ${ctx}`).toBe(row.callback);
			}
		}
	});
});

// ── Login throttle, through the real /api/auth/login ─────────────────────────

describe('Lean model: login throttle', () => {
	it(`POST /api/auth/login answers as the model on ${model.throttle.length} scripts`, async () => {
		const passwordHash = await hashPassword('right-password');
		for (const script of model.throttle) {
			const { sqlite, db: d } = freshDb();
			for (let e = 0; e < 6; e++)
				sqlite
					.prepare(`INSERT INTO users (id, email, role, password_hash) VALUES (?,?,'user',?)`)
					.run(`u${e}`, `e${e}@x.test`, passwordHash);
			const store = new Map<string, string>();
			const kv = {
				get: async (k: string) => store.get(k) ?? null,
				put: async (k: string, v: string) => void store.set(k, v),
				delete: async (k: string) => void store.delete(k)
			};
			const results: string[] = [];
			for (const step of script.steps) {
				const request = new Request('https://example.com/api/auth/login', {
					method: 'POST',
					headers: { 'cf-connecting-ip': `10.0.0.${step.ip}`, 'content-type': 'application/json' },
					body: JSON.stringify({
						email: `e${step.email}@x.test`,
						password: step.good ? 'right-password' : 'wrong'
					})
				});
				const r = await status(async () => {
					const res = await loginRoute.POST({
						request,
						platform: { env: { DB: d, KV: kv } },
						url: new URL(request.url)
					} as never);
					if (res.status !== 200) throw { status: res.status };
				});
				results.push(r === 'ok' ? '200' : r);
			}
			expect(results, JSON.stringify(script.steps)).toEqual(script.results);
		}
	}, 120_000);

	it('MAX_ATTEMPTS is the model constant', () => {
		expect(throttle.MAX_ATTEMPTS).toBe(model.maxAttempts);
	});
});

describe('Lean model: constant-time compare', () => {
	it(`timingSafeEqualStrings agrees on ${model.timingSafe.length} pairs`, () => {
		for (const row of model.timingSafe) {
			const a = String.fromCharCode(...row.a);
			const b = String.fromCharCode(...row.b);
			expect(timingSafeEqualStrings(a, b), JSON.stringify(row)).toBe(row.eq);
		}
	});
});
