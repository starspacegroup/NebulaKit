import { describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { applyDiscordProfile } from '../../src/lib/server/discord-profile';
import { createSqliteD1 } from '../helpers/sqlite-d1';

const verifiedUser = {
	id: '293484886726279168',
	username: 'ada',
	global_name: 'Ada',
	avatar: 'abcdef0123456789abcdef0123456789',
	email: 'Ada@Example.com',
	verified: true
};

async function user(db: D1Database, id: string) {
	return db
		.prepare('SELECT email, email_verified_at, github_avatar_url FROM users WHERE id = ?')
		.bind(id)
		.first<{ email: string; email_verified_at: string | null; github_avatar_url: string | null }>();
}

describe('applyDiscordProfile', () => {
	it('swaps a placeholder for the verified address, marks it verified and stores the avatar', async () => {
		const db = createSqliteD1();
		await db
			.prepare("INSERT INTO users (id, email, name) VALUES ('u','ada@discord.local','Ada')")
			.run();
		await applyDiscordProfile(db, 'u', verifiedUser);
		const row = await user(db, 'u');
		expect(row?.email).toBe('ada@example.com');
		expect(row?.email_verified_at).not.toBeNull();
		expect(row?.github_avatar_url).toContain('/avatars/293484886726279168/');
	});

	it('never overwrites an address the person chose, and does not mark it verified', async () => {
		const db = createSqliteD1();
		await db
			.prepare("INSERT INTO users (id, email, name) VALUES ('u','mine@home.test','Ada')")
			.run();
		await applyDiscordProfile(db, 'u', verifiedUser);
		const row = await user(db, 'u');
		expect(row?.email).toBe('mine@home.test');
		expect(row?.email_verified_at).toBeNull();
	});

	it('marks an account verified when it already holds the verified address', async () => {
		const db = createSqliteD1();
		await db
			.prepare("INSERT INTO users (id, email, name) VALUES ('u','ada@example.com','Ada')")
			.run();
		await applyDiscordProfile(db, 'u', verifiedUser);
		expect((await user(db, 'u'))?.email_verified_at).not.toBeNull();
	});

	it('does not mark anything verified when Discord has not verified the address', async () => {
		const db = createSqliteD1();
		await db
			.prepare("INSERT INTO users (id, email, name) VALUES ('u','ada@discord.local','Ada')")
			.run();
		await applyDiscordProfile(db, 'u', { ...verifiedUser, verified: false });
		const row = await user(db, 'u');
		expect(row?.email).toBe('ada@discord.local');
		expect(row?.email_verified_at).toBeNull();
	});

	it('keeps the placeholder when another account already uses the address', async () => {
		const db = createSqliteD1();
		await db
			.prepare(
				"INSERT INTO users (id, email, name) VALUES ('u','ada@discord.local','Ada'),('o','ada@example.com','Other')"
			)
			.run();
		await applyDiscordProfile(db, 'u', verifiedUser);
		expect((await user(db, 'u'))?.email).toBe('ada@discord.local');
		expect((await user(db, 'o'))?.email_verified_at).toBeNull();
	});
});
