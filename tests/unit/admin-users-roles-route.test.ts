import type { D1Database } from '@cloudflare/workers-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authHandler } from '../../src/hooks.server';
import { DELETE, PATCH } from '../../src/routes/api/admin/users/[id]/+server';
import { GET } from '../../src/routes/api/admin/users/+server';
import { requirePermission } from '../../src/lib/server/auth-guards';
import { createAuthSession } from '../../src/lib/utils/db';
import { createSessionUser } from '../../src/lib/utils/session';
import { createSqliteD1 } from '../helpers/sqlite-d1';

/**
 * Privilege-escalation attempts against the real route handlers, a real SQLite
 * database over the real migrations, and identities resolved by the real auth
 * hook (so role and grants come from `users` / `user_permissions`, not from a
 * hand-built locals object).
 */

const OWNER = 'u-owner';
let db: D1Database;

async function seed() {
	db = createSqliteD1();
	await db
		.prepare(
			`INSERT INTO users (id, email, name, is_admin, role, can_view_stats) VALUES
			 ('${OWNER}','owner@x.test','Owner',1,'user',0),
			 ('u-super','super@x.test','Super',1,'superadmin',0),
			 ('u-super2','super2@x.test','Super Two',1,'superadmin',0),
			 ('u-adminA','a@x.test','Admin A',1,'admin',0),
			 ('u-adminB','b@x.test','Admin B',1,'admin',0),
			 ('u-user','user@x.test','User',0,'user',0),
			 ('u-stats','stats@x.test','Stats',1,'admin',1)`
		)
		.run();
	await db
		.prepare(
			`INSERT INTO user_permissions (user_id, permission) VALUES
			 ('u-adminA','users'),('u-adminA','users-manage'),('u-adminA','cms'),
			 ('u-adminB','users'),('u-adminB','cms')`
		)
		.run();
}

function platform() {
	return { env: { DB: db, GITHUB_OWNER_ID: OWNER } } as unknown as App.Platform;
}

/** Sign in as `id` and resolve locals through the real auth hook. */
async function as(id: string): Promise<App.Locals> {
	const row = await db
		.prepare('SELECT id, email, name, is_admin FROM users WHERE id = ?')
		.bind(id)
		.first<{ id: string; email: string; name: string; is_admin: number }>();
	const token = await createAuthSession(db, createSessionUser(row!));
	const event: any = {
		cookies: { get: () => token, delete: vi.fn() },
		platform: platform(),
		locals: {},
		url: new URL('https://nebulakit.example/admin'),
		request: new Request('https://nebulakit.example/admin')
	};
	await authHandler({ event, resolve: async () => new Response('ok') });
	return event.locals;
}

const patch = async (actor: string, target: string, body: unknown) =>
	PATCH({
		platform: platform(),
		locals: await as(actor),
		params: { id: target },
		request: { json: async () => body }
	} as never);

const del = async (actor: string, target: string) =>
	DELETE({ platform: platform(), locals: await as(actor), params: { id: target } } as never);

const row = (id: string) =>
	db
		.prepare('SELECT role, is_admin, can_view_stats FROM users WHERE id = ?')
		.bind(id)
		.first<{ role: string; is_admin: number; can_view_stats: number }>();

const grants = async (id: string) =>
	(
		await db
			.prepare('SELECT permission FROM user_permissions WHERE user_id = ? ORDER BY permission')
			.bind(id)
			.all<{ permission: string }>()
	).results.map((r) => r.permission);

beforeEach(async () => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	await seed();
});

describe('the auth hook resolves role and grants from the database', () => {
	it('resolves each rung, and the owner from configuration despite a plain row', async () => {
		expect((await as(OWNER)).user).toMatchObject({ role: 'owner', isOwner: true, isAdmin: true });
		expect((await as('u-super')).user).toMatchObject({ role: 'superadmin', isSuperAdmin: true });
		expect((await as('u-adminA')).user).toMatchObject({
			role: 'admin',
			permissions: ['cms', 'users', 'users-manage']
		});
		expect((await as('u-user')).user).toMatchObject({ role: 'user', permissions: [] });
	});

	it('honours the legacy can_view_stats flag as the stats permission', async () => {
		const { user } = await as('u-stats');
		expect(user?.permissions).toContain('stats');
		expect(user?.canViewStats).toBe(true);
	});

	it('re-reads grants every request: revoking takes effect on the next call', async () => {
		expect(() => requirePermission({ user: undefined } as never, 'cms')).toThrow();
		const first = await as('u-adminB');
		expect(requirePermission(first, 'cms').id).toBe('u-adminB');
		await db.prepare("DELETE FROM user_permissions WHERE user_id = 'u-adminB'").run();
		const second = await as('u-adminB');
		expect(() => requirePermission(second, 'cms')).toThrowError(
			expect.objectContaining({ status: 403 })
		);
	});

	it('a demoted user keeps no authority even if grant rows linger', async () => {
		await db.prepare("UPDATE users SET role = 'user', is_admin = 0 WHERE id = 'u-adminA'").run();
		const { user } = await as('u-adminA');
		expect(user).toMatchObject({ role: 'user', isAdmin: false, permissions: [] });
	});
});

describe('privilege escalation is blocked at the route', () => {
	it('an admin cannot promote themselves', async () => {
		await expect(patch('u-adminA', 'u-adminA', { role: 'superadmin' })).rejects.toMatchObject({
			status: 400
		});
		expect((await row('u-adminA'))?.role).toBe('admin');
	});

	it('an admin cannot act on a peer admin, a superadmin or the owner', async () => {
		for (const target of ['u-adminB', 'u-super', OWNER]) {
			await expect(patch('u-adminA', target, { role: 'user' })).rejects.toMatchObject({
				status: 403
			});
			await expect(del('u-adminA', target)).rejects.toMatchObject({ status: 403 });
		}
		expect((await row('u-adminB'))?.role).toBe('admin');
		expect((await row(OWNER))?.is_admin).toBe(1);
		expect(await row('u-super')).not.toBeNull();
	});

	it('an admin cannot grant a role at or above their own, nor edit permissions', async () => {
		for (const role of ['admin', 'superadmin']) {
			await expect(patch('u-adminA', 'u-user', { role })).rejects.toMatchObject({ status: 403 });
		}
		await expect(patch('u-adminA', 'u-user', { isAdmin: true })).rejects.toMatchObject({
			status: 403
		});
		await expect(patch('u-adminA', 'u-user', { permissions: ['api-keys'] })).rejects.toMatchObject({
			status: 403
		});
		expect(await row('u-user')).toMatchObject({ role: 'user', is_admin: 0 });
		expect(await grants('u-user')).toEqual([]);
	});

	it('an admin without users-manage cannot act even on a plain user', async () => {
		await expect(patch('u-adminB', 'u-user', { role: 'user' })).rejects.toMatchObject({
			status: 403
		});
		await expect(del('u-adminB', 'u-user')).rejects.toMatchObject({ status: 403 });
		expect(await row('u-user')).not.toBeNull();
	});

	it('a plain user cannot reach the routes at all', async () => {
		await expect(del('u-user', 'u-adminA')).rejects.toMatchObject({ status: 403 });
		await expect(patch('u-user', 'u-adminA', { role: 'user' })).rejects.toMatchObject({
			status: 403
		});
	});

	it('an admin may still demote or remove somebody below them', async () => {
		await db.prepare("UPDATE users SET role='admin', is_admin=1 WHERE id='u-user'").run();
		// u-user is now an admin = peer: refused. Put back to user and delete.
		await expect(del('u-adminA', 'u-user')).rejects.toMatchObject({ status: 403 });
		await db.prepare("UPDATE users SET role='user', is_admin=0 WHERE id='u-user'").run();
		const res = await del('u-adminA', 'u-user');
		expect((await res.json()).success).toBe(true);
		expect(await row('u-user')).toBeNull();
	});

	it('a superadmin can never demote, remove or re-role the owner', async () => {
		await expect(patch('u-super', OWNER, { role: 'user' })).rejects.toMatchObject({
			status: 403
		});
		await expect(patch('u-super', OWNER, { isAdmin: false })).rejects.toMatchObject({
			status: 403
		});
		await expect(patch('u-super', OWNER, { permissions: [] })).rejects.toMatchObject({
			status: 403
		});
		await expect(del('u-super', OWNER)).rejects.toMatchObject({ status: 403 });
		expect(await row(OWNER)).toMatchObject({ is_admin: 1 });
	});

	it('not even the owner can change the owner, and no request can assign owner', async () => {
		await expect(patch(OWNER, OWNER, { role: 'user' })).rejects.toMatchObject({ status: 400 });
		await expect(patch(OWNER, 'u-user', { role: 'owner' })).rejects.toMatchObject({
			status: 400
		});
		expect((await row('u-user'))?.role).toBe('user');
	});

	it('a superadmin cannot mint another superadmin or touch a peer', async () => {
		await expect(patch('u-super', 'u-user', { role: 'superadmin' })).rejects.toMatchObject({
			status: 403
		});
		await expect(patch('u-super', 'u-super2', { role: 'user' })).rejects.toMatchObject({
			status: 403
		});
		await expect(del('u-super', 'u-super2')).rejects.toMatchObject({ status: 403 });
		expect((await row('u-super2'))?.role).toBe('superadmin');
	});

	it('rejects malformed bodies', async () => {
		await expect(patch(OWNER, 'u-user', { role: 'god' })).rejects.toMatchObject({ status: 400 });
		await expect(patch(OWNER, 'u-user', { permissions: 'cms' })).rejects.toMatchObject({
			status: 400
		});
		await expect(patch(OWNER, 'u-user', {})).rejects.toMatchObject({ status: 400 });
		await expect(patch(OWNER, 'missing', { role: 'user' })).rejects.toMatchObject({
			status: 404
		});
	});
});

describe('legitimate changes', () => {
	it('a superadmin promotes a user to admin with the default areas, and the target is signed out', async () => {
		await db
			.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES ('s1','u-user','2999-01-01')")
			.run();
		const res = await patch('u-super', 'u-user', { role: 'admin' });
		expect(await res.json()).toMatchObject({ success: true, role: 'admin' });
		expect(await row('u-user')).toMatchObject({ role: 'admin', is_admin: 1 });
		expect(await grants('u-user')).toEqual(['cms', 'contact', 'lighthouse', 'pages', 'users']);
		expect(await db.prepare("SELECT id FROM sessions WHERE id='s1'").first()).toBeNull();
	});

	it('the legacy isAdmin body still works for the owner', async () => {
		const up = await patch(OWNER, 'u-user', { isAdmin: true });
		expect((await up.json()).message).toMatch(/promoted/i);
		const down = await patch(OWNER, 'u-user', { isAdmin: false });
		expect((await down.json()).message).toMatch(/demoted/i);
		expect(await row('u-user')).toMatchObject({ role: 'user', is_admin: 0 });
	});

	it('the owner can make a superadmin; a superadmin is not given per-area rows', async () => {
		await patch(OWNER, 'u-adminB', { role: 'superadmin' });
		expect(await row('u-adminB')).toMatchObject({ role: 'superadmin', is_admin: 1 });
		expect(await grants('u-adminB')).toEqual([]);
		expect(requirePermission(await as('u-adminB'), 'pii').id).toBe('u-adminB');
	});

	it("sets an admin's areas, drops unknown names, and keeps can_view_stats in step", async () => {
		const res = await patch('u-super', 'u-adminB', { permissions: ['stats', 'bogus', 'pii'] });
		expect((await res.json()).message).toMatch(/updated/i);
		expect(await grants('u-adminB')).toEqual(['pii', 'stats']);
		expect((await row('u-adminB'))?.can_view_stats).toBe(1);
		const { user } = await as('u-adminB');
		expect(user).toMatchObject({ canViewStats: true });
		expect(user?.permissions).toEqual(['stats', 'pii']);

		await patch('u-super', 'u-adminB', { permissions: ['cms'] });
		expect(await grants('u-adminB')).toEqual(['cms']);
		expect((await row('u-adminB'))?.can_view_stats).toBe(0);
	});

	it('demoting an admin clears their grants and the stats flag', async () => {
		await patch(OWNER, 'u-stats', { role: 'user' });
		expect(await grants('u-stats')).toEqual([]);
		expect(await row('u-stats')).toMatchObject({ role: 'user', is_admin: 0, can_view_stats: 0 });
	});

	it('permissions cannot be set on somebody who is not an admin', async () => {
		await expect(patch(OWNER, 'u-user', { permissions: ['cms'] })).rejects.toMatchObject({
			status: 403
		});
		await expect(patch(OWNER, 'u-super2', { permissions: ['cms'] })).rejects.toMatchObject({
			status: 403
		});
	});

	it('the owner can delete an admin, which cascades their grants', async () => {
		await del(OWNER, 'u-adminA');
		expect(await grants('u-adminA')).toEqual([]);
	});
});

describe('GET /api/admin/users', () => {
	it('reports the effective role (owner from config) and the granted areas', async () => {
		const res = await GET({
			platform: platform(),
			locals: await as(OWNER),
			cookies: { get: () => '1' }
		} as never);
		const { users } = await res.json();
		const byId = Object.fromEntries(users.map((u: any) => [u.id, u]));
		expect(byId[OWNER].effective_role).toBe('owner');
		expect(byId['u-super'].effective_role).toBe('superadmin');
		expect(byId['u-adminA'].permissions).toEqual(['cms', 'users', 'users-manage']);
		expect(byId['u-user']).toMatchObject({ effective_role: 'user', permissions: [] });
	});

	it('an admin with only "users" can read the list but not act', async () => {
		const res = await GET({
			platform: platform(),
			locals: await as('u-adminB'),
			cookies: { get: () => undefined }
		} as never);
		expect((await res.json()).users.length).toBe(7);
	});

	it('an admin without "users" cannot read the list', async () => {
		await expect(
			GET({
				platform: platform(),
				locals: await as('u-stats'),
				cookies: { get: () => undefined }
			} as never)
		).rejects.toMatchObject({ status: 403 });
	});
});
