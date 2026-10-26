import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSqliteD1 } from '../helpers/sqlite-d1';

/**
 * Migration 0021 against real SQLite: build the schema as it was before the
 * ladder, seed admins the way production has them, apply 0021, and prove
 * nobody lost access and nobody was promoted.
 */
const FILE = '0021_roles_and_permissions.sql';
const before = readdirSync(join(process.cwd(), 'migrations'))
	.filter((f) => /^\d{4}_.*\.sql$/.test(f) && f < FILE)
	.sort();

async function upgrade() {
	const db = createSqliteD1(before);
	await db
		.prepare(
			`INSERT INTO users (id, email, is_admin, can_view_stats) VALUES
			 ('owner-row','o@x.test',1,0),
			 ('plain-admin','a@x.test',1,0),
			 ('stats-admin','s@x.test',1,1),
			 ('member','m@x.test',0,0),
			 ('member-stats','ms@x.test',0,1)`
		)
		.run();
	const sql = readFileSync(join(process.cwd(), 'migrations', FILE), 'utf8');
	await db.exec(sql);
	return db;
}

async function grants(db: Awaited<ReturnType<typeof upgrade>>, id: string) {
	const rows = await db
		.prepare('SELECT permission FROM user_permissions WHERE user_id = ? ORDER BY permission')
		.bind(id)
		.all<{ permission: string }>();
	return rows.results.map((r) => r.permission);
}

describe('migration 0021 roles and permissions', () => {
	it('is the 0021 file and follows 0019 without touching earlier ones', () => {
		expect(before.at(-1)).toMatch(/^00(19|20)_/);
	});

	it('promotes nobody: existing admins become admin, everyone else user', async () => {
		const db = await upgrade();
		const roles = await db
			.prepare('SELECT id, role, is_admin FROM users ORDER BY id')
			.all<{ id: string; role: string; is_admin: number }>();
		expect(Object.fromEntries(roles.results.map((r) => [r.id, r.role]))).toEqual({
			'owner-row': 'admin',
			'plain-admin': 'admin',
			'stats-admin': 'admin',
			member: 'user',
			'member-stats': 'user'
		});
		expect(roles.results.some((r) => r.role === 'superadmin')).toBe(false);
	});

	it('gives every existing admin the areas they could already reach, and no owner-only area', async () => {
		const db = await upgrade();
		const base = ['cms', 'contact', 'lighthouse', 'pages', 'users'];
		expect(await grants(db, 'plain-admin')).toEqual(base);
		expect(await grants(db, 'owner-row')).toEqual(base);
		for (const ownerOnly of ['api-keys', 'pii', 'users-manage']) {
			expect(await grants(db, 'plain-admin')).not.toContain(ownerOnly);
		}
	});

	it('maps can_view_stats to the stats permission, and only for admins', async () => {
		const db = await upgrade();
		expect(await grants(db, 'stats-admin')).toEqual(
			[...['cms', 'contact', 'lighthouse', 'pages'], 'stats', 'users'].sort()
		);
		expect(await grants(db, 'plain-admin')).not.toContain('stats');
		// A non-admin with the flag gets no permission rows at all.
		expect(await grants(db, 'member-stats')).toEqual([]);
		expect(await grants(db, 'member')).toEqual([]);
		// The old column is untouched, so existing stats gating keeps working.
		const flag = await db
			.prepare("SELECT can_view_stats FROM users WHERE id = 'stats-admin'")
			.first<{ can_view_stats: number }>();
		expect(flag?.can_view_stats).toBe(1);
	});

	it('the role column refuses owner and unknown values', async () => {
		const db = await upgrade();
		await expect(
			db.prepare("UPDATE users SET role = 'owner' WHERE id = 'member'").run()
		).rejects.toThrow();
		await expect(
			db.prepare("UPDATE users SET role = 'root' WHERE id = 'member'").run()
		).rejects.toThrow();
		await db.prepare("UPDATE users SET role = 'superadmin' WHERE id = 'member'").run();
	});

	it('deleting a user removes their grants, and new users default to role user', async () => {
		const db = await upgrade();
		await db.prepare("DELETE FROM users WHERE id = 'plain-admin'").run();
		expect(await grants(db, 'plain-admin')).toEqual([]);
		await db.prepare("INSERT INTO users (id, email) VALUES ('new','n@x.test')").run();
		const row = await db
			.prepare("SELECT role FROM users WHERE id = 'new'")
			.first<{ role: string }>();
		expect(row?.role).toBe('user');
	});
});
