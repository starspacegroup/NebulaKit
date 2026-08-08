import { describe, expect, it, vi } from 'vitest';

/**
 * The auth hook under the merged session scheme (opaque-sessions x main):
 * the cookie carries an opaque random token; getAuthSession() hashes it and
 * reads the trusted payload from sessions.data; identity and CURRENT roles are
 * then refreshed from the users table on every request. These tests pin the
 * fail-closed properties: forged cookies, revoked sessions, deleted users,
 * database failures, and dev-simulated identities outside the simulator all
 * leave the request unauthenticated and clear the cookie.
 */

type SessionRow = { data: string | null } | null;
type UserRow = {
	id: string;
	email: string;
	name: string | null;
	github_login: string | null;
	github_avatar_url: string | null;
	is_admin: number;
	can_view_stats?: number;
} | null;

function sessionDataRow(payload: Record<string, unknown>): SessionRow {
	return { data: JSON.stringify(payload) };
}

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
		// The pre-opaque scheme's cookie format. It hashes to no stored session,
		// so it authenticates nothing no matter what it claims to contain.
		const forged = btoa(
			JSON.stringify({
				id: 'owner-id',
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

	it('accepts a stored pretend identity only inside the enabled dev simulator', async () => {
		// The simulator stores a real session row whose payload is marked
		// isPretend. Unlike real users it is served from the stored payload (no
		// users-table row exists for it), but ONLY when simulation is enabled on
		// a local host.
		const db = database(
			sessionDataRow({
				id: 'pretend-user',
				login: 'pretend',
				email: 'pretend@example.dev',
				isOwner: false,
				isAdmin: true,
				isPretend: true
			}),
			null
		);
		const event = eventFor('pretend-session-token', db);
		(event.platform.env as Record<string, unknown>).DEV_AUTH_BYPASS = 'true';
		event.url = new URL('http://localhost/admin');

		await runAuth(event);

		expect(event.locals).toMatchObject({ user: { id: 'pretend-user', isPretend: true } });
		expect(event.cookies.delete).not.toHaveBeenCalled();
	});

	it('rejects a stored pretend identity outside a local dev host even with the bypass set', async () => {
		// The opaque-sessions branch's hardening: a stray DEV_AUTH_BYPASS on a
		// deployed environment must not let a pretend session authenticate.
		const db = database(
			sessionDataRow({
				id: 'pretend-user',
				login: 'pretend',
				email: 'pretend@example.dev',
				isOwner: true,
				isAdmin: true,
				isPretend: true
			}),
			null
		);
		const event = eventFor('pretend-session-token', db); // nebulakit.example
		(event.platform.env as Record<string, unknown>).DEV_AUTH_BYPASS = 'true';

		await runAuth(event);

		expect(event.locals).not.toHaveProperty('user');
		expect(event.cookies.delete).toHaveBeenCalledWith('session', { path: '/' });
	});

	it('loads identity and current roles from D1 for an opaque session token', async () => {
		// Roles come from the users table at request time, NOT from the stored
		// payload — the payload below claims no privileges, the users row grants
		// them, and the users row must win (grant/revoke without re-login).
		const event = eventFor(
			'opaque-session-token-123',
			database(
				sessionDataRow({
					id: 'user-1',
					login: 'stale-login',
					email: 'stale@example.com',
					isOwner: false,
					isAdmin: false
				}),
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
		const event = eventFor(
			'opaque-session-token-123',
			database(null, null, new Error('D1 unavailable'))
		);

		await runAuth(event);

		expect(event.locals).not.toHaveProperty('user');
		expect(event.cookies.delete).toHaveBeenCalledWith('session', { path: '/' });
	});

	it('does not touch cookies when no session cookie is present', async () => {
		const event = eventFor('', database(null, null));

		await runAuth(event);
		expect(event.cookies.delete).not.toHaveBeenCalled();
	});

	it('clears the cookie after its session is revoked server-side', async () => {
		// Logout deletes the row; a copied cookie then resolves to nothing.
		const event = eventFor('revoked-session-token', database(null, null));

		await runAuth(event);
		expect(event.locals).not.toHaveProperty('user');
		expect(event.cookies.delete).toHaveBeenCalledWith('session', { path: '/' });
	});

	it('fails closed when a valid session references a deleted user', async () => {
		const event = eventFor(
			'opaque-session-token-123',
			database(
				sessionDataRow({
					id: 'deleted-user',
					login: 'gone',
					email: 'gone@example.com',
					isOwner: false,
					isAdmin: false
				}),
				null
			)
		);

		await runAuth(event);

		expect(event.locals).not.toHaveProperty('user');
		expect(event.cookies.delete).toHaveBeenCalledWith('session', { path: '/' });
	});

	it('falls back to the pre-stats user query for an unmigrated local database', async () => {
		const session = sessionDataRow({
			id: 'legacy-user',
			login: 'legacy',
			email: 'legacy@example.com',
			isOwner: false,
			isAdmin: false
		});
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
			'opaque-session-token-123',
			db as ReturnType<typeof database>,
			'legacy-user'
		);

		await runAuth(event);

		expect(event.locals).toMatchObject({
			user: { id: 'legacy-user', isOwner: true, isAdmin: true, canViewStats: false }
		});
		// getAuthSession + can_view_stats query (throws) + fallback query.
		expect(db.prepare).toHaveBeenCalledTimes(3);
	});
});
import '../helpers/server-response';
