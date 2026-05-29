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
	function decodeSessionFromCookie(setCookieHeader: string): Record<string, unknown> {
		const sessionPart = setCookieHeader
			.split(';')
			.map((part) => part.trim())
			.find((part) => part.startsWith('session='));

		if (!sessionPart) {
			throw new Error('Session cookie not found');
		}

		const encoded = sessionPart.replace('session=', '');
		let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
		while (base64.length % 4) {
			base64 += '=';
		}

		return JSON.parse(atob(base64)) as Record<string, unknown>;
	}

	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	it('creates a simulated GitHub session when bypass is enabled', async () => {
		const { GET } = await import('../../src/routes/api/auth/dev-simulate/+server');

		const response = await GET({
			url: new URL('http://localhost/api/auth/dev-simulate?provider=github'),
			platform: {
				env: {
					DEV_AUTH_BYPASS: 'true'
				}
			}
		} as any);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('http://localhost/');
		const cookieHeader = response.headers.get('Set-Cookie') || '';
		expect(cookieHeader).toContain('session=');
		expect(cookieHeader).toContain('HttpOnly');
		expect(decodeSessionFromCookie(cookieHeader).isPretend).toBe(true);
	});

	it('creates a simulated Discord session when bypass is enabled', async () => {
		const { GET } = await import('../../src/routes/api/auth/dev-simulate/+server');

		const response = await GET({
			url: new URL('http://localhost/api/auth/dev-simulate?provider=discord'),
			platform: {
				env: {
					DEV_AUTH_BYPASS: 'true'
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
					DEV_AUTH_BYPASS: 'true'
				}
			}
		} as any);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('http://localhost/admin');
		const cookieHeader = response.headers.get('Set-Cookie') || '';
		const session = decodeSessionFromCookie(cookieHeader);
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
					DEV_AUTH_BYPASS: 'true'
				}
			}
		} as any);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('http://localhost/admin');
		const cookieHeader = response.headers.get('Set-Cookie') || '';
		const session = decodeSessionFromCookie(cookieHeader);
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
});
