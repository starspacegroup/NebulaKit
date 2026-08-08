import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthSession, getAuthSession, hashSessionToken } from '../../src/lib/utils/db';

vi.mock('@sveltejs/kit', async () => {
	const actual = await vi.importActual<typeof import('@sveltejs/kit')>('@sveltejs/kit');
	return {
		...actual,
		redirect: (status: number, location: string) => {
			const err = new Error('Redirect') as Error & { status: number; location: string };
			err.status = status;
			err.location = location;
			throw err;
		}
	};
});

/** Stateful sessions stub with a spied delete. */
function makeSessionDb() {
	const rows = new Map<string, { user_id: string; expires_at: string; data: string | null }>();
	const deleteSpy = vi.fn();
	const db = {
		prepare(sql: string) {
			return {
				// main's reset route also issues unbound statements (table wipes);
				// they don't touch the sessions map this stub models.
				async run() {
					return { success: true };
				},
				bind(...args: unknown[]) {
					return {
						async run() {
							if (/^INSERT INTO sessions/i.test(sql)) {
								const [id, user_id, expires_at, data] = args as string[];
								rows.set(id, { user_id, expires_at, data });
							} else if (/^DELETE FROM sessions WHERE id/i.test(sql)) {
								deleteSpy(args[0]);
								rows.delete(args[0] as string);
							}
							return { success: true };
						},
						async first<T>() {
							if (/^SELECT data FROM sessions/i.test(sql)) {
								const row = rows.get(args[0] as string);
								if (!row || new Date(row.expires_at).getTime() <= Date.now()) return null;
								return { data: row.data } as T;
							}
							return null;
						}
					};
				}
			};
		}
	};
	return { db: db as unknown as Parameters<typeof createAuthSession>[0], rows, deleteSpy };
}

describe('session teardown revokes the server-side row', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubGlobal('crypto', webcrypto as Crypto);
	});

	it('logout deletes the session so a copied cookie cannot be replayed', async () => {
		const { db, deleteSpy } = makeSessionDb();
		const id = await createAuthSession(db, {
			id: 'u1',
			login: 'u1',
			email: 'u1@example.com',
			name: 'U1',
			isOwner: true,
			isAdmin: true
		});
		// The session resolves before logout...
		expect(await getAuthSession(db, id)).not.toBeNull();

		const { POST } = await import('../../src/routes/api/auth/logout/+server');
		const cookies = { get: vi.fn().mockReturnValue(id), delete: vi.fn() };
		await expect(POST({ cookies, platform: { env: { DB: db } } } as any)).rejects.toMatchObject({
			status: 302,
			location: '/auth/login'
		});

		// The DELETE binds the digest — the raw cookie value never touches the DB.
		expect(deleteSpy).toHaveBeenCalledWith(await hashSessionToken(id));
		expect(cookies.delete).toHaveBeenCalledWith('session', { path: '/' });
		// ...and is gone afterward — replay of the same cookie fails.
		expect(await getAuthSession(db, id)).toBeNull();
	});

	it('logout still clears the cookie when the DB delete throws', async () => {
		const db = {
			prepare: () => ({
				bind: () => ({
					run: async () => {
						throw new Error('db down');
					}
				})
			})
		};
		const { GET } = await import('../../src/routes/api/auth/logout/+server');
		const cookies = { get: vi.fn().mockReturnValue('some-id'), delete: vi.fn() };
		await expect(GET({ cookies, platform: { env: { DB: db } } } as any)).rejects.toMatchObject({
			status: 302
		});
		expect(cookies.delete).toHaveBeenCalledWith('session', { path: '/' });
	});

	it('reset revokes the caller session row and clears the cookie', async () => {
		const { db, deleteSpy } = makeSessionDb();
		const id = await createAuthSession(db, {
			id: 'owner',
			login: 'owner',
			email: 'owner@example.com',
			name: 'Owner',
			isOwner: true,
			isAdmin: true
		});
		const kv = {
			get: vi.fn().mockResolvedValue(null),
			delete: vi.fn().mockResolvedValue(undefined)
		};
		const cookies = { get: vi.fn().mockReturnValue(id), delete: vi.fn() };

		const { POST } = await import('../../src/routes/api/reset/+server');
		const response = await POST({
			locals: { user: { id: 'owner', isOwner: true } },
			platform: { env: { DB: db, KV: kv } },
			cookies
		} as any);

		expect(response.status).toBe(200);
		// The DELETE binds the digest — the raw cookie value never touches the DB.
		expect(deleteSpy).toHaveBeenCalledWith(await hashSessionToken(id));
		expect(cookies.delete).toHaveBeenCalledWith('session', { path: '/' });
	});
});

describe('connections pretend path requires the store', () => {
	beforeEach(() => {
		vi.stubGlobal('crypto', webcrypto as Crypto);
	});

	it('returns 500 for a pretend unlink when no database is available', async () => {
		const { DELETE } = await import('../../src/routes/api/auth/connections/+server');
		await expect(
			DELETE({
				locals: { user: { id: 'dev', isPretend: true, simulatedConnections: ['discord'] } },
				platform: { env: {} },
				url: new URL('http://localhost/api/auth/connections'),
				request: { json: vi.fn().mockResolvedValue({ provider: 'discord' }) }
			} as any)
		).rejects.toMatchObject({ status: 500 });
	});
});

describe('getAuthSession edge cases (fail closed)', () => {
	beforeEach(() => {
		vi.stubGlobal('crypto', webcrypto as Crypto);
	});

	it('returns null for a pre-scheme row that has no stored payload', async () => {
		const db = {
			prepare: () => ({ bind: () => ({ first: async () => ({ data: null }) }) })
		} as unknown as Parameters<typeof getAuthSession>[0];
		expect(await getAuthSession(db, 'legacy-id')).toBeNull();
	});

	it('returns null when the stored payload is malformed JSON', async () => {
		const db = {
			prepare: () => ({ bind: () => ({ first: async () => ({ data: 'not json{' }) }) })
		} as unknown as Parameters<typeof getAuthSession>[0];
		expect(await getAuthSession(db, 'corrupt-id')).toBeNull();
	});
});
