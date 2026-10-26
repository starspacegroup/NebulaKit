import { describe, expect, it, vi } from 'vitest';
import { authHandler } from '../../src/hooks.server';

/**
 * The session refresh in hooks.server.ts under the role ladder: role and
 * granted areas come from `users` / `user_permissions` every request, degrade
 * safely on a database that has not applied migration 0021, and a simulated dev
 * identity gets every area only inside the dev simulator.
 */

const ROW = {
	id: 'u1',
	email: 'u1@example.com',
	name: 'U One',
	github_login: null,
	github_avatar_url: null,
	is_admin: 1
};

function makeDb(opts: {
	session?: object;
	user: (sql: string) => object | Error;
	permissions?: Array<{ permission: string }> | Error;
}) {
	return {
		prepare: vi.fn((sql: string) => ({
			bind: vi.fn(() => ({
				first: vi.fn(async () => {
					if (sql.includes('FROM sessions')) return { data: JSON.stringify(opts.session ?? ROW) };
					const out = opts.user(sql);
					if (out instanceof Error) throw out;
					return out;
				}),
				all: vi.fn(async () => {
					if (opts.permissions instanceof Error) throw opts.permissions;
					return { results: opts.permissions ?? [] };
				})
			}))
		}))
	};
}

async function run(
	db: ReturnType<typeof makeDb>,
	url = 'https://nebulakit.example/admin',
	env = {}
) {
	const event: any = {
		cookies: { get: () => 'token', delete: vi.fn() },
		platform: { env: { DB: db, ...env } },
		locals: {},
		url: new URL(url),
		request: new Request(url)
	};
	await authHandler({ event, resolve: async () => new Response('ok') });
	return event;
}

describe('authHandler role and permission refresh', () => {
	it('resolves an admin with their grants in canonical order', async () => {
		const db = makeDb({
			user: () => ({ ...ROW, role: 'admin', can_view_stats: 0 }),
			permissions: [{ permission: 'pii' }, { permission: 'cms' }, { permission: 'nonsense' }]
		});
		const { locals } = await run(db);
		expect(locals.user).toMatchObject({
			role: 'admin',
			isAdmin: true,
			isSuperAdmin: false,
			permissions: ['cms', 'pii'],
			canViewStats: false
		});
	});

	it('does not read grants for roles that hold everything or nothing', async () => {
		const owner = makeDb({ user: () => ({ ...ROW, role: 'user', can_view_stats: 0 }) });
		const event = await run(owner, undefined, { GITHUB_OWNER_ID: 'u1' });
		expect(event.locals.user).toMatchObject({ role: 'owner', permissions: [] });
		const plain = makeDb({ user: () => ({ ...ROW, is_admin: 0, role: 'user' }) });
		expect((await run(plain)).locals.user).toMatchObject({
			role: 'user',
			isAdmin: false,
			permissions: []
		});
	});

	it('fails closed when the permissions table is missing, but still honours can_view_stats', async () => {
		const db = makeDb({
			user: () => ({ ...ROW, role: 'admin', can_view_stats: 1 }),
			permissions: new Error('no such table: user_permissions')
		});
		const { locals } = await run(db);
		expect(locals.user.permissions).toEqual(['stats']);
		expect(locals.user.canViewStats).toBe(true);
	});

	it('an unmigrated database (no role column) still resolves a legacy admin by is_admin', async () => {
		const db = makeDb({
			user: (sql) =>
				/\brole\b/.test(sql) ? new Error('no such column: role') : { ...ROW, can_view_stats: 1 }
		});
		const { locals } = await run(db);
		expect(locals.user).toMatchObject({ role: 'admin', isAdmin: true, canViewStats: true });
		// Not yet migrated: no grant rows, so only the legacy stats flag carries over.
		expect(locals.user.permissions).toEqual(['stats']);
	});

	it('tolerates a result with no rows array', async () => {
		const db = makeDb({ user: () => ({ ...ROW, role: 'admin', can_view_stats: 0 }) });
		const original = db.prepare;
		db.prepare = vi.fn((sql: string) => {
			const stmt = original(sql);
			return {
				bind: (...a: unknown[]) => {
					const bound = (stmt.bind as any)(...a);
					return { ...bound, all: async () => ({}) };
				}
			};
		}) as never;
		expect((await run(db)).locals.user.permissions).toEqual([]);
	});

	it('gives a simulated dev admin every area, inside the simulator only', async () => {
		const pretend = {
			id: 'p',
			login: 'p',
			email: 'p@example.dev',
			isOwner: false,
			isAdmin: true,
			isPretend: true
		};
		const db = makeDb({ session: pretend, user: () => ({}) });
		const event = await run(db, 'http://localhost/admin', { DEV_AUTH_BYPASS: 'true' });
		expect(event.locals.user.role).toBe('admin');
		expect(event.locals.user.permissions.length).toBeGreaterThan(5);
		const outside = await run(db, 'https://nebulakit.example/admin', { DEV_AUTH_BYPASS: 'true' });
		expect(outside.locals.user).toBeUndefined();
		const plainPretend = makeDb({ session: { ...pretend, isAdmin: false }, user: () => ({}) });
		const plain = await run(plainPretend, 'http://localhost/admin', { DEV_AUTH_BYPASS: 'true' });
		expect(plain.locals.user).toMatchObject({ role: 'user', permissions: [] });
	});
});
