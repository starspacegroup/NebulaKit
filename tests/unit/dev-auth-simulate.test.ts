import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRedirect = vi.fn((status: number, location: string) => {
	const err = new Error('Redirect') as Error & { status: number; location: string };
	err.status = status;
	err.location = location;
	throw err;
});

vi.mock('@sveltejs/kit', () => ({
	redirect: (status: number, location: string) => mockRedirect(status, location)
}));

describe('Dev auth simulation endpoint', () => {
	async function decodeSessionFromCookie(
		setCookieHeader: string
	): Promise<Record<string, unknown>> {
		const sessionPart = setCookieHeader
			.split(';')
			.map((part) => part.trim())
			.find((part) => part.startsWith('session='));

		if (!sessionPart) {
			throw new Error('Session cookie not found');
		}

		const { decodeSessionCookie } = await import('../../src/lib/utils/session');
		const decoded = await decodeSessionCookie(sessionPart.replace('session=', ''), 'test-secret');
		if (!decoded) throw new Error('Session cookie is invalid');
		return decoded as unknown as Record<string, unknown>;
	}

	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
		vi.stubGlobal('crypto', webcrypto as Crypto);
	});

	it('creates a simulated GitHub session when bypass is enabled', async () => {
		const { GET } = await import('../../src/routes/api/auth/dev-simulate/+server');

		const response = await GET({
			url: new URL('http://localhost/api/auth/dev-simulate?provider=github'),
			platform: {
				env: {
					DEV_AUTH_BYPASS: 'true',
					SESSION_SECRET: 'test-secret'
				}
			}
		} as any);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('http://localhost/');
		const cookieHeader = response.headers.get('Set-Cookie') || '';
		expect(cookieHeader).toContain('session=');
		expect(cookieHeader).toContain('HttpOnly');
		const session = await decodeSessionFromCookie(cookieHeader);
		expect(session.isPretend).toBe(true);
		expect(session.simulatedConnections).toEqual(['github']);
	});

	it('creates a simulated Discord session when bypass is enabled', async () => {
		const { GET } = await import('../../src/routes/api/auth/dev-simulate/+server');

		const response = await GET({
			url: new URL('http://localhost/api/auth/dev-simulate?provider=discord'),
			platform: {
				env: {
					DEV_AUTH_BYPASS: 'true',
					SESSION_SECRET: 'test-secret'
				}
			}
		} as any);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('http://localhost/');
		expect(response.headers.get('Set-Cookie')).toContain('session=');
	});

	it('creates admin session and redirects to admin when role=admin', async () => {
		const { GET } = await import('../../src/routes/api/auth/dev-simulate/+server');

		const response = await GET({
			url: new URL('http://localhost/api/auth/dev-simulate?provider=github&role=admin'),
			platform: {
				env: {
					DEV_AUTH_BYPASS: 'true',
					SESSION_SECRET: 'test-secret'
				}
			}
		} as any);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('http://localhost/admin');
		const cookieHeader = response.headers.get('Set-Cookie') || '';
		const session = await decodeSessionFromCookie(cookieHeader);
		expect(session.isAdmin).toBe(true);
		expect(session.isOwner).toBe(false);
		expect(session.isPretend).toBe(true);
	});

	it('creates superadmin session with owner privileges', async () => {
		const { GET } = await import('../../src/routes/api/auth/dev-simulate/+server');

		const response = await GET({
			url: new URL('http://localhost/api/auth/dev-simulate?provider=discord&role=superadmin'),
			platform: {
				env: {
					DEV_AUTH_BYPASS: 'true',
					SESSION_SECRET: 'test-secret'
				}
			}
		} as any);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('http://localhost/admin');
		const cookieHeader = response.headers.get('Set-Cookie') || '';
		const session = await decodeSessionFromCookie(cookieHeader);
		expect(session.isAdmin).toBe(true);
		expect(session.isOwner).toBe(true);
		expect(session.isPretend).toBe(true);
	});

	it('redirects to login when bypass is disabled', async () => {
		const { GET } = await import('../../src/routes/api/auth/dev-simulate/+server');

		await expect(
			GET({
				url: new URL('http://localhost/api/auth/dev-simulate?provider=github'),
				platform: {
					env: {
						DEV_AUTH_BYPASS: 'false'
					}
				}
			} as any)
		).rejects.toMatchObject({ status: 302, location: '/auth/login?error=not_configured' });
	});

	it('redirects to login for unsupported providers', async () => {
		const { GET } = await import('../../src/routes/api/auth/dev-simulate/+server');

		await expect(
			GET({
				url: new URL('http://localhost/api/auth/dev-simulate?provider=google'),
				platform: {
					env: {
						DEV_AUTH_BYPASS: 'true'
					}
				}
			} as any)
		).rejects.toMatchObject({ status: 302, location: '/auth/login?error=oauth_failed' });
	});

	it('links a provider onto an existing pretend session when mode=link', async () => {
		const { GET } = await import('../../src/routes/api/auth/dev-simulate/+server');

		const existingSession = {
			id: 'dev-github-abc12345',
			login: 'dev-github-abc12345',
			email: 'dev@example.dev',
			isOwner: false,
			isAdmin: false,
			isPretend: true,
			simulatedConnections: ['github']
		};

		const { signValue } = await import('../../src/lib/utils/session');
		const encodedSession = await signValue(existingSession, 'test-secret');

		const response = await GET({
			url: new URL('http://localhost/api/auth/dev-simulate?provider=discord&mode=link'),
			platform: {
				env: {
					DEV_AUTH_BYPASS: 'true',
					SESSION_SECRET: 'test-secret'
				}
			},
			cookies: {
				get: vi.fn().mockReturnValue(encodedSession)
			}
		} as any);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('http://localhost/profile?linked=discord');

		const updatedSession = await decodeSessionFromCookie(response.headers.get('Set-Cookie') || '');
		expect(updatedSession.id).toBe(existingSession.id);
		expect(updatedSession.simulatedConnections).toEqual(['github', 'discord']);
	});
});
import '../helpers/server-response';
