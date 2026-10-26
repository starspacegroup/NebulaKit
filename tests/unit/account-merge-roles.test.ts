import { describe, expect, it } from 'vitest';
import { mergeAccounts } from '../../src/lib/services/account-merge';
import { createSqliteD1 } from '../helpers/sqlite-d1';

describe('mergeAccounts carries the role ladder (real SQL)', () => {
	it('a plain target becomes an admin with the source grants, never more', async () => {
		const db = createSqliteD1();
		await db
			.prepare(
				`INSERT INTO users (id, email, is_admin, role) VALUES
         ('src','s@x.test',1,'superadmin'),('dst','d@x.test',0,'user')`
			)
			.run();
		await db
			.prepare(
				"INSERT INTO user_permissions (user_id, permission) VALUES ('src','cms'),('src','pii')"
			)
			.run();
		await mergeAccounts(db, 'src', 'dst');
		const dst = await db
			.prepare("SELECT role, is_admin FROM users WHERE id = 'dst'")
			.first<{ role: string; is_admin: number }>();
		// A superadmin source never yields a superadmin target: that is granted by a person.
		expect(dst).toEqual({ role: 'admin', is_admin: 1 });
		const perms = await db
			.prepare("SELECT permission FROM user_permissions WHERE user_id = 'dst' ORDER BY permission")
			.all<{ permission: string }>();
		expect(perms.results.map((r) => r.permission)).toEqual(['cms', 'pii']);
	});

	it('an existing role on the target is kept, and a non-admin source changes nothing', async () => {
		const db = createSqliteD1();
		await db
			.prepare(
				`INSERT INTO users (id, email, is_admin, role) VALUES
         ('src','s@x.test',0,'user'),('dst','d@x.test',1,'superadmin')`
			)
			.run();
		await mergeAccounts(db, 'src', 'dst');
		const dst = await db
			.prepare("SELECT role FROM users WHERE id = 'dst'")
			.first<{ role: string }>();
		expect(dst?.role).toBe('superadmin');
	});
});
