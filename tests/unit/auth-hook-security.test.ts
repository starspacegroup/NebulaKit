import { describe, expect, it, vi } from 'vitest';

type SessionRow = { id: string; user_id: string; expires_at: string } | null;
type UserRow = {
	id: string;
	email: string;
	name: string | null;
	github_login: string | null;
	github_avatar_url: string | null;
	is_admin: number;
	can_view_stats?: number;
} | null;

function database(session: SessionRow, user: UserRow, failure?: Error) {
	return {
		prepare: vi.fn((sql: string) => ({
			bind: vi.fn(() => ({
				first: vi.fn(async () => {
					if (failure) throw failure;
					return sql.includes('FROM sessions') ? session : user;
				})
			}))
		}))
	};
}

function eventFor(cookie: string | undefined, db: ReturnType<typeof database>, ownerId?: string) {
	return {
		cookies: {
			get: vi.fn(() => cookie),
			delete: vi.fn()
		},
		platform: {
			env: { DB: db, GITHUB_OWNER_ID: ownerId, SESSION_SECRET: 'test-session-secret' }
		},
		locals: {},
		url: new URL('https://nebulakit.example/admin'),
		request: new Request('https://nebulakit.example/admin'),
		route: { id: '/admin' }
	};
}

async function runAuth(event: ReturnType<typeof eventFor>) {
	const hooks = await import('../../src/hooks.server');
	const authHandler = (hooks as typeof hooks & { authHandler?: Function }).authHandler;
	expect(authHandler).toBeTypeOf('function');
	await authHandler?.({
		event,
		resolve: vi.fn(async () => new Response('ok'))
	});
}

describe('server-authenticated session hook', () => {
	it('passes through requests without a session cookie', async () => {
		const db = database(null, null);
		const event = eventFor(undefined, db);

		await runAuth(event);

		expect(db.prepare).not.toHaveBeenCalled();
		expect(event.cookies.delete).not.toHaveBeenCalled();
		expect(event.locals).not.toHaveProperty('user');
	});

	it('rejects a forged owner-shaped base64 JSON cookie', async () => {
		const forged = btoa(
			JSON.stringify({
				id: 'owner-id',
				login: 'attacker',
				email: 'attacker@example.com',
				isOwner: true,
				isAdmin: true
			})
		);
		const event = eventFor(forged, database(null, null));

		await runAuth(event);

		expect(event.locals).not.toHaveProperty('user');
		expect(event.cookies.delete).toHaveBeenCalledWith('session', { path: '/' });
	});

	it('accepts self-contained identity only for an explicitly enabled pretend session', async () => {
		const { signValue } = await import('../../src/lib/utils/session');
		const db = database(null, null);
		const event = eventFor(
			await signValue(
				{
					id: 'pretend-user',
					login: 'pretend',
					email: 'pretend@example.dev',
					isOwner: false,
					isAdmin: true,
					isPretend: true
				},
				'test-session-secret'
			),
			db
		);
		(event.platform.env as Record<string, unknown>).DEV_AUTH_BYPASS = 'true';

		await runAuth(event);

		expect(event.locals).toMatchObject({ user: { id: 'pretend-user', isPretend: true } });
		expect(db.prepare).not.toHaveBeenCalled();
		expect(event.cookies.delete).not.toHaveBeenCalled();
	});

	it('rejects a self-contained non-pretend identity even when simulation is enabled', async () => {
		const { signValue } = await import('../../src/lib/utils/session');
		const event = eventFor(
			await signValue(
				{
					id: 'browser-user',
					login: 'browser',
					email: 'browser@example.dev',
					isOwner: true,
					isPretend: false
				},
				'test-session-secret'
			),
			database(null, null)
		);
		(event.platform.env as Record<string, unknown>).DEV_AUTH_BYPASS = 'true';

		await runAuth(event);

		expect(event.locals).not.toHaveProperty('user');
		expect(event.cookies.delete).toHaveBeenCalledWith('session', { path: '/' });
	});

	it('loads identity and current roles from D1 for an opaque session id', async () => {
		const { signValue } = await import('../../src/lib/utils/session');
		const event = eventFor(
			await signValue({ token: 'session-opaque-123' }, 'test-session-secret'),
			database(
				{
					id: 'session-opaque-123',
					user_id: 'user-1',
					expires_at: '2099-01-01T00:00:00.000Z'
				},
				{
					id: 'user-1',
					email: 'owner@example.com',
					name: 'Current Owner',
					github_login: 'current-owner',
					github_avatar_url: null,
					is_admin: 0,
					can_view_stats: 1
				}
			),
			'user-1'
		);

		await runAuth(event);

		expect(event.locals).toMatchObject({
			user: {
				id: 'user-1',
				login: 'current-owner',
				email: 'owner@example.com',
				isOwner: true,
				isAdmin: true,
				canViewStats: true
			}
		});
	});

	it('fails closed when D1 session lookup fails', async () => {
		const { signValue } = await import('../../src/lib/utils/session');
		const event = eventFor(
			await signValue({ token: 'session-opaque-123' }, 'test-session-secret'),
			database(null, null, new Error('D1 unavailable'))
		);

		await runAuth(event);

		expect(event.locals).not.toHaveProperty('user');
		expect(event.cookies.delete).toHaveBeenCalledWith('session', { path: '/' });
	});

	it('accepts a signed pretend identity only when the dev bypass is enabled', async () => {
		const { signValue } = await import('../../src/lib/utils/session');
		const event = eventFor(
			await signValue(
				{
					id: 'pretend-1',
					login: 'pretend',
					email: 'pretend@example.dev',
					isOwner: false,
					isAdmin: false,
					isPretend: true
				},
				'test-session-secret'
			),
			database(null, null)
		);
		(event.platform.env as Record<string, unknown>).DEV_AUTH_BYPASS = 'true';
		event.url = new URL('http://localhost/admin');

		await runAuth(event);
		expect(event.locals).toMatchObject({ user: { id: 'pretend-1', isPretend: true } });
		expect(event.cookies.delete).not.toHaveBeenCalled();
	});

	it('uses the pre-can_view_stats user query as a migration fallback', async () => {
		const { signValue } = await import('../../src/lib/utils/session');
		const session = {
			id: 'session-opaque-123',
			user_id: 'user-1',
			expires_at: '2099-01-01T00:00:00.000Z'
		};
		const user = {
			id: 'user-1',
			email: 'user@example.com',
			name: 'User',
			github_login: 'user',
			github_avatar_url: null,
			is_admin: 0
		};
		const db = {
			prepare: vi.fn((sql: string) => ({
				bind: vi.fn(() => ({
					first: vi.fn(async () => {
						if (sql.includes('FROM sessions')) return session;
						if (sql.includes('can_view_stats')) throw new Error('column missing');
						return user;
					})
				}))
			}))
		};
		const event = eventFor(
			await signValue({ token: 'session-opaque-123' }, 'test-session-secret'),
			db as ReturnType<typeof database>
		);

		await runAuth(event);
		expect(event.locals).toMatchObject({ user: { id: 'user-1', canViewStats: false } });
	});

	it('does not touch cookies when no session cookie is present', async () => {
		const event = eventFor('', database(null, null));

		await runAuth(event);
		expect(event.cookies.delete).not.toHaveBeenCalled();
	});

	it('clears a validly signed cookie after its session is revoked', async () => {
		const { signValue } = await import('../../src/lib/utils/session');
		const event = eventFor(
			await signValue({ token: 'revoked-session' }, 'test-session-secret'),
			database(null, null)
		);

		await runAuth(event);
		expect(event.locals).not.toHaveProperty('user');
		expect(event.cookies.delete).toHaveBeenCalledWith('session', { path: '/' });
	});

	it('fails closed when a valid session references a deleted user', async () => {
		const { signValue } = await import('../../src/lib/utils/session');
		const event = eventFor(
			await signValue({ token: 'session-opaque-123' }, 'test-session-secret'),
			database(
				{
					id: 'stored-session-digest',
					user_id: 'deleted-user',
					expires_at: '2099-01-01T00:00:00.000Z'
				},
				null
			)
		);

		await runAuth(event);

		expect(event.locals).not.toHaveProperty('user');
		expect(event.cookies.delete).toHaveBeenCalledWith('session', { path: '/' });
	});

	it('falls back to the pre-stats user query for an unmigrated local database', async () => {
		const { signValue } = await import('../../src/lib/utils/session');
		const session = {
			id: 'stored-session-digest',
			user_id: 'legacy-user',
			expires_at: '2099-01-01T00:00:00.000Z'
		};
		const legacyUser = {
			id: 'legacy-user',
			email: 'legacy@example.com',
			name: 'Legacy User',
			github_login: null,
			github_avatar_url: null,
			is_admin: 0
		};
		const db = {
			prepare: vi.fn((sql: string) => ({
				bind: vi.fn(() => ({
					first: vi.fn(async () => {
						if (sql.includes('FROM sessions')) return session;
						if (sql.includes('can_view_stats')) throw new Error('no such column');
						return legacyUser;
					})
				}))
			}))
		};
		const event = eventFor(
			await signValue({ token: 'session-opaque-123' }, 'test-session-secret'),
			db as ReturnType<typeof database>,
			'legacy-user'
		);

		await runAuth(event);

		expect(event.locals).toMatchObject({
			user: { id: 'legacy-user', isOwner: true, isAdmin: true, canViewStats: false }
		});
		expect(db.prepare).toHaveBeenCalledTimes(3);
	});
});
import '../helpers/server-response';
