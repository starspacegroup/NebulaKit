import { describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { mergeAccounts } from '../../src/lib/services/account-merge';
import { resolveOwnerStatus } from '../../src/lib/utils/auth-identity';
import { createSqliteD1 } from '../helpers/sqlite-d1';

async function seed(db: D1Database) {
	await db
		.prepare(
			"INSERT INTO users (id, email, name, is_admin, can_view_stats) VALUES ('src','s@x.test','Source',0,1),('dst','d@x.test','Target',0,0)"
		)
		.run();
	await db
		.prepare(
			"INSERT INTO sessions (id, user_id, expires_at) VALUES ('sess-src','src','2999-01-01')"
		)
		.run();
	await db.prepare("INSERT INTO content_types (id, slug, name) VALUES ('t','post','Post')").run();
	await db
		.prepare(
			"INSERT INTO content_items (id, content_type_id, slug, title, author_id) VALUES ('i','t','a','A','src')"
		)
		.run();
}

describe('mergeAccounts against real SQL', () => {
	it('drops the source sessions, keeps authorship and folds the stats grant', async () => {
		const db = createSqliteD1();
		await seed(db);
		await mergeAccounts(db, 'src', 'dst');

		expect(await db.prepare("SELECT id FROM sessions WHERE id = 'sess-src'").first()).toBeNull();
		expect(await db.prepare("SELECT id FROM users WHERE id = 'src'").first()).toBeNull();
		const item = await db
			.prepare("SELECT author_id FROM content_items WHERE id = 'i'")
			.first<{ author_id: string }>();
		expect(item?.author_id).toBe('dst');
		const target = await db
			.prepare("SELECT can_view_stats FROM users WHERE id = 'dst'")
			.first<{ can_view_stats: number }>();
		expect(target?.can_view_stats).toBe(1);
	});
});

describe('resolveOwnerStatus', () => {
	const platform = (env: Record<string, unknown>) => ({ env }) as unknown as App.Platform;
	const user = { id: 'u1', github_login: 'octocat' };

	it('trusts a username only when no numeric owner id is configured', async () => {
		expect(await resolveOwnerStatus(platform({ GITHUB_OWNER_ID: 'octocat' }), user)).toBe(true);
		// A numeric id is configured, so a matching username no longer counts.
		const kv = { get: async (k: string) => (k === 'github_owner_username' ? 'octocat' : null) };
		expect(await resolveOwnerStatus(platform({ GITHUB_OWNER_ID: '12345', KV: kv }), user)).toBe(
			false
		);
	});

	it('still recognises the owner by id', async () => {
		expect(await resolveOwnerStatus(platform({ GITHUB_OWNER_ID: 'u1' }), user)).toBe(true);
	});
});
