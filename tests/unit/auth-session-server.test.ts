import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthSession, getAuthSession } from '../../src/lib/utils/db';
import type { SessionUser } from '../../src/lib/utils/session';

/**
 * Minimal stateful D1 stub modelling just the `sessions` table, enough to prove
 * the server-side session contract: a real session round-trips, and a cookie
 * that names no row (a forgery) resolves to null. This is the regression guard
 * for the unsigned-base64-JSON auth bypass — the whole reason the payload moved
 * server-side.
 */
function makeSessionDb() {
	const rows = new Map<string, { user_id: string; expires_at: string; data: string | null }>();

	const db = {
		prepare(sql: string) {
			return {
				bind(...args: unknown[]) {
					return {
						async run() {
							if (/^INSERT INTO sessions/i.test(sql)) {
								const [id, user_id, expires_at, data] = args as string[];
								rows.set(id, { user_id, expires_at, data });
							} else if (/^DELETE FROM sessions WHERE id/i.test(sql)) {
								rows.delete(args[0] as string);
							}
							return { success: true };
						},
						async first<T>() {
							if (/^SELECT data FROM sessions/i.test(sql)) {
								const row = rows.get(args[0] as string);
								if (!row) return null;
								// mirror `datetime(expires_at) > datetime('now')`
								if (new Date(row.expires_at).getTime() <= Date.now()) return null;
								return { data: row.data } as T;
							}
							return null;
						}
					};
				}
			};
		}
	};

	return { db: db as unknown as Parameters<typeof createAuthSession>[0], rows };
}

const OWNER: SessionUser = {
	id: 'real-user-1',
	login: 'octocat',
	email: 'owner@example.com',
	name: 'Owner',
	isOwner: true,
	isAdmin: true
};

describe('server-side session (auth bypass fix)', () => {
	beforeEach(() => {
		vi.stubGlobal('crypto', webcrypto as Crypto);
	});

	it('round-trips a real session by its opaque id', async () => {
		const { db } = makeSessionDb();
		const id = await createAuthSession(db, OWNER);

		expect(typeof id).toBe('string');
		expect(id).not.toContain('isOwner'); // the id carries no payload

		const resolved = await getAuthSession(db, id);
		expect(resolved).toEqual(OWNER);
	});

	it('honours an explicit expiry window', async () => {
		const { db, rows } = makeSessionDb();
		const id = await createAuthSession(db, OWNER, 1);
		const expires = new Date(rows.get(id)!.expires_at).getTime();
		// ~1 day out, not the 7-day default.
		const daysOut = (expires - Date.now()) / 86_400_000;
		expect(daysOut).toBeGreaterThan(0.5);
		expect(daysOut).toBeLessThan(2);
	});

	it('resolves a forged / unknown cookie to null — fail closed', async () => {
		const { db } = makeSessionDb();
		// A hand-crafted base64(JSON) owner cookie, exactly the old forgery. It
		// names no session row, so it must resolve to nobody.
		const forged = Buffer.from(JSON.stringify({ id: 'x', isOwner: true })).toString('base64url');

		expect(await getAuthSession(db, forged)).toBeNull();
		expect(await getAuthSession(db, 'literally-anything')).toBeNull();
	});

	it('rejects an expired session', async () => {
		const { db, rows } = makeSessionDb();
		const id = await createAuthSession(db, OWNER);
		// force it into the past
		rows.get(id)!.expires_at = new Date(Date.now() - 1000).toISOString();

		expect(await getAuthSession(db, id)).toBeNull();
	});
});
