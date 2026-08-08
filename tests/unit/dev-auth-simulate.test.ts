import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthSession, getAuthSession } from '../../src/lib/utils/db';
import type { SessionUser } from '../../src/lib/utils/session';

const mockRedirect = vi.fn((status: number, location: string) => {
	const err = new Error('Redirect') as Error & { status: number; location: string };
	err.status = status;
	err.location = location;
	throw err;
});

vi.mock('@sveltejs/kit', () => ({
	redirect: (status: number, location: string) => mockRedirect(status, location)
}));

/**
 * Stateful `sessions` stub. The simulator now stores its (pretend) payload
 * server-side and the cookie is only the opaque id — exactly like a real login —
 * so the test resolves the session the same way the app does, via getAuthSession,
 * rather than decoding the cookie.
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
	return { db: db as unknown as Parameters<typeof createAuthSession>[0], rows };
}

function sessionIdFromCookie(setCookieHeader: string): string {
	const part = setCookieHeader
		.split(';')
		.map((p) => p.trim())
		.find((p) => p.startsWith('session='));
	if (!part) throw new Error('Session cookie not found');
	return part.replace('session=', '');
}

describe('Dev auth simulation endpoint', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
		vi.stubGlobal('crypto', webcrypto as Crypto);
	});

	it('creates a simulated GitHub session when bypass is enabled', async () => {
		const { GET } = await import('../../src/routes/api/auth/dev-simulate/+server');
		const { db } = makeSessionDb();

		const response = await GET({
			url: new URL('http://localhost/api/auth/dev-simulate?provider=github'),
			platform: { env: { DEV_AUTH_BYPASS: 'true', DB: db } }
		} as any);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('http://localhost/');
		const cookieHeader = response.headers.get('Set-Cookie') || '';
		expect(cookieHeader).toContain('session=');
		expect(cookieHeader).toContain('HttpOnly');
		// The cookie is an opaque id; the payload is resolved from the store.
		const session = await getAuthSession(db, sessionIdFromCookie(cookieHeader));
		expect(session?.isPretend).toBe(true);
		expect(session?.simulatedConnections).toEqual(['github']);
	});

	it('creates a simulated Discord session when bypass is enabled', async () => {
		const { GET } = await import('../../src/routes/api/auth/dev-simulate/+server');
		const { db } = makeSessionDb();

		const response = await GET({
			url: new URL('http://localhost/api/auth/dev-simulate?provider=discord'),
			platform: { env: { DEV_AUTH_BYPASS: 'true', DB: db } }
		} as any);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('http://localhost/');
		expect(response.headers.get('Set-Cookie')).toContain('session=');
	});

	it('creates admin session and redirects to admin when role=admin', async () => {
		const { GET } = await import('../../src/routes/api/auth/dev-simulate/+server');
		const { db } = makeSessionDb();

		const response = await GET({
			url: new URL('http://localhost/api/auth/dev-simulate?provider=github&role=admin'),
			platform: { env: { DEV_AUTH_BYPASS: 'true', DB: db } }
		} as any);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('http://localhost/admin');
		const session = await getAuthSession(
			db,
			sessionIdFromCookie(response.headers.get('Set-Cookie') || '')
		);
		expect(session?.isAdmin).toBe(true);
		expect(session?.isOwner).toBe(false);
		expect(session?.isPretend).toBe(true);
	});

	it('creates superadmin session with owner privileges', async () => {
		const { GET } = await import('../../src/routes/api/auth/dev-simulate/+server');
		const { db } = makeSessionDb();

		const response = await GET({
			url: new URL('http://localhost/api/auth/dev-simulate?provider=discord&role=superadmin'),
			platform: { env: { DEV_AUTH_BYPASS: 'true', DB: db } }
		} as any);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('http://localhost/admin');
		const session = await getAuthSession(
			db,
			sessionIdFromCookie(response.headers.get('Set-Cookie') || '')
		);
		expect(session?.isAdmin).toBe(true);
		expect(session?.isOwner).toBe(true);
		expect(session?.isPretend).toBe(true);
	});

	it('refuses when the session store is unavailable', async () => {
		const { GET } = await import('../../src/routes/api/auth/dev-simulate/+server');

		// The simulator mints a real server-side session, so with no DB it cannot
		// proceed — it fails closed rather than issuing an unresolvable cookie.
		await expect(
			GET({
				url: new URL('http://localhost/api/auth/dev-simulate?provider=github'),
				platform: { env: { DEV_AUTH_BYPASS: 'true' } }
			} as any)
		).rejects.toMatchObject({ status: 302, location: '/auth/login?error=not_configured' });
	});

	it('redirects to login when bypass is disabled', async () => {
		const { GET } = await import('../../src/routes/api/auth/dev-simulate/+server');
		const { db } = makeSessionDb();

		await expect(
			GET({
				url: new URL('http://localhost/api/auth/dev-simulate?provider=github'),
				platform: { env: { DEV_AUTH_BYPASS: 'false', DB: db } }
			} as any)
		).rejects.toMatchObject({ status: 302, location: '/auth/login?error=not_configured' });
	});

	it('refuses to run off a local host even with the bypass set', async () => {
		const { GET } = await import('../../src/routes/api/auth/dev-simulate/+server');
		const { db } = makeSessionDb();

		// The bypass must not re-enable the simulator on a deployed host — it mints
		// a real owner/admin session, so this is the production-safety guard.
		await expect(
			GET({
				url: new URL('https://nebulakit.starspace.group/api/auth/dev-simulate?provider=github'),
				platform: { env: { DEV_AUTH_BYPASS: 'true', DB: db } }
			} as any)
		).rejects.toMatchObject({ status: 302, location: '/auth/login?error=not_configured' });
	});

	it('redirects to login for unsupported providers', async () => {
		const { GET } = await import('../../src/routes/api/auth/dev-simulate/+server');
		const { db } = makeSessionDb();

		await expect(
			GET({
				url: new URL('http://localhost/api/auth/dev-simulate?provider=google'),
				platform: { env: { DEV_AUTH_BYPASS: 'true', DB: db } }
			} as any)
		).rejects.toMatchObject({ status: 302, location: '/auth/login?error=oauth_failed' });
	});

	it('links a provider onto an existing pretend session when mode=link', async () => {
		const { GET } = await import('../../src/routes/api/auth/dev-simulate/+server');
		const { db } = makeSessionDb();

		// Seed an existing pretend session and hand its opaque id back as the cookie.
		const existing: SessionUser = {
			id: 'dev-github-abc12345',
			login: 'dev-github-abc12345',
			email: 'dev@example.dev',
			name: 'Dev',
			isOwner: false,
			isAdmin: false,
			isPretend: true,
			simulatedConnections: ['github']
		};
		const existingId = await createAuthSession(db, existing);

		const response = await GET({
			url: new URL('http://localhost/api/auth/dev-simulate?provider=discord&mode=link'),
			platform: { env: { DEV_AUTH_BYPASS: 'true', DB: db } },
			cookies: { get: vi.fn().mockReturnValue(existingId) }
		} as any);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('http://localhost/profile?linked=discord');

		const updated = await getAuthSession(
			db,
			sessionIdFromCookie(response.headers.get('Set-Cookie') || '')
		);
		expect(updated?.id).toBe(existing.id);
		expect(updated?.simulatedConnections).toEqual(['github', 'discord']);
	});
});
