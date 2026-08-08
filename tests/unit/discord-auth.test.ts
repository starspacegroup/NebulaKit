import { beforeEach, describe, expect, it, vi } from 'vitest';

// The OAuth routes now round-trip a `state` value through an HttpOnly cookie:
// the init route sets it, the callback requires it back. Tests therefore need
// a cookie jar whose state lookups answer, and callback URLs carrying a
// matching `state` param.
const TEST_OAUTH_STATE = 'test-oauth-state';
function makeOAuthCookies(sessionValue: unknown = null) {
	return {
		get: vi.fn((name: string) =>
			name.startsWith('oauth_state_') ? TEST_OAUTH_STATE : sessionValue
		),
		set: vi.fn(),
		delete: vi.fn()
	};
}


/**
 * Tests for Discord OAuth Authentication
 * TDD: Testing the Discord OAuth flow
 */

// Mock SvelteKit redirect
const mockRedirect = vi.fn((status: number, location: string) => {
	const err = new Error('Redirect') as Error & { status: number; location: string };
	err.status = status;
	err.location = location;
	throw err;
});

vi.mock('@sveltejs/kit', () => ({
	redirect: (status: number, location: string) => mockRedirect(status, location),
	isRedirect: (err: unknown) => {
		return err instanceof Error && 'location' in err && 'status' in err;
	}
}));

describe('Discord OAuth - Initial Redirect', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	it('should redirect to setup if Discord OAuth is not configured', async () => {
		const { GET } = await import('../../src/routes/api/auth/discord/+server');

		const mockUrl = new URL('http://localhost/api/auth/discord');
		const mockPlatform = {
			env: {
				DISCORD_CLIENT_ID: undefined,
				KV: {
					get: vi.fn().mockResolvedValue(null)
				}
			}
		};

		await expect(
			GET({
				url: mockUrl,
				cookies: makeOAuthCookies(),
				platform: mockPlatform
			} as any)
		).rejects.toMatchObject({ status: 302, location: '/setup?error=oauth_not_configured' });
	});

	it('should redirect to Discord OAuth when configured via env', async () => {
		const { GET } = await import('../../src/routes/api/auth/discord/+server');

		const mockUrl = new URL('http://localhost/api/auth/discord');
		const mockPlatform = {
			env: {
				DISCORD_CLIENT_ID: 'test-discord-client-id',
				KV: null
			}
		};

		await expect(
			GET({
				url: mockUrl,
				cookies: makeOAuthCookies(),
				platform: mockPlatform
			} as any)
		).rejects.toMatchObject({
			status: 302
		});

		expect(mockRedirect).toHaveBeenCalled();
		const redirectUrl = mockRedirect.mock.calls[0][1];
		expect(redirectUrl).toContain('https://discord.com/api/oauth2/authorize');
		expect(redirectUrl).toContain('client_id=test-discord-client-id');
	});

	it('should redirect to Discord OAuth when configured via KV', async () => {
		const { GET } = await import('../../src/routes/api/auth/discord/+server');

		const mockUrl = new URL('http://localhost/api/auth/discord');
		const mockPlatform = {
			env: {
				DISCORD_CLIENT_ID: undefined,
				KV: {
					get: vi.fn().mockResolvedValue(JSON.stringify({ clientId: 'kv-discord-client-id' }))
				}
			}
		};

		await expect(
			GET({
				url: mockUrl,
				cookies: makeOAuthCookies(),
				platform: mockPlatform
			} as any)
		).rejects.toMatchObject({
			status: 302
		});

		expect(mockRedirect).toHaveBeenCalled();
		const redirectUrl = mockRedirect.mock.calls[0][1];
		expect(redirectUrl).toContain('client_id=kv-discord-client-id');
	});

	it('should include correct Discord OAuth scopes', async () => {
		const { GET } = await import('../../src/routes/api/auth/discord/+server');

		const mockUrl = new URL('http://localhost/api/auth/discord');
		const mockPlatform = {
			env: {
				DISCORD_CLIENT_ID: 'test-discord-client-id'
			}
		};

		await expect(
			GET({
				url: mockUrl,
				cookies: makeOAuthCookies(),
				platform: mockPlatform
			} as any)
		).rejects.toMatchObject({ status: 302 });

		const redirectUrl = mockRedirect.mock.calls[0][1];
		expect(redirectUrl).toContain('scope=identify+email');
	});
});

describe('Discord OAuth - Callback', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
		vi.stubGlobal('fetch', vi.fn());
	});

	it('should redirect to login with error when no code provided', async () => {
		const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

		const mockUrl = new URL('http://localhost/api/auth/discord/callback');
		const mockCookies = makeOAuthCookies();

		await expect(
			GET({
				url: mockUrl,
				cookies: mockCookies,
				platform: {}
			} as any)
		).rejects.toMatchObject({ status: 302, location: '/auth/login?error=no_code' });
	});

	it('should redirect to login with error when Discord OAuth not configured', async () => {
		const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

		const mockUrl = new URL('http://localhost/api/auth/discord/callback?code=test-code&state=test-oauth-state');
		const mockCookies = makeOAuthCookies();
		const mockPlatform = {
			env: {
				DISCORD_CLIENT_ID: undefined,
				DISCORD_CLIENT_SECRET: undefined,
				KV: {
					get: vi.fn().mockResolvedValue(null)
				}
			}
		};

		await expect(
			GET({
				url: mockUrl,
				cookies: mockCookies,
				platform: mockPlatform
			} as any)
		).rejects.toMatchObject({ status: 302, location: '/auth/login?error=not_configured' });
	});

	it('should exchange code for token and create session on success', async () => {
		const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

		const mockDiscordUser = {
			id: '123456789',
			username: 'testuser',
			discriminator: '0',
			email: 'test@discord.com',
			avatar: 'abc123'
		};

		vi.mocked(fetch)
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'discord-access-token' })
			} as any)
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockDiscordUser)
			} as any);

		const mockUrl = new URL('http://localhost/api/auth/discord/callback?code=test-code&state=test-oauth-state');
		const mockCookies = makeOAuthCookies();
		const mockPlatform = {
			env: {
				DISCORD_CLIENT_ID: 'test-client-id',
				DISCORD_CLIENT_SECRET: 'test-client-secret',
				DB: {
					prepare: vi.fn().mockReturnValue({
						bind: vi.fn().mockReturnValue({
							first: vi.fn().mockResolvedValue(null),
							run: vi.fn().mockResolvedValue({})
						})
					})
				},
				KV: {
					get: vi.fn().mockResolvedValue(null),
					put: vi.fn().mockResolvedValue(undefined)
				}
			}
		};

		const response = await GET({
			url: mockUrl,
			cookies: mockCookies,
			platform: mockPlatform
		} as any);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('http://localhost/');
		expect(response.headers.get('Set-Cookie')).toContain('session=');
	});

	it('should handle token exchange failure', async () => {
		const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

		vi.mocked(fetch).mockResolvedValueOnce({
			ok: false,
			status: 400,
			text: () => Promise.resolve('Bad Request')
		} as any);

		const mockUrl = new URL('http://localhost/api/auth/discord/callback?code=invalid-code&state=test-oauth-state');
		const mockCookies = makeOAuthCookies();
		const mockPlatform = {
			env: {
				DISCORD_CLIENT_ID: 'test-client-id',
				DISCORD_CLIENT_SECRET: 'test-client-secret'
			}
		};

		await expect(
			GET({
				url: mockUrl,
				cookies: mockCookies,
				platform: mockPlatform
			} as any)
		).rejects.toMatchObject({ status: 302, location: '/auth/login?error=token_exchange_failed' });
	});

	it('should handle user fetch failure', async () => {
		const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

		vi.mocked(fetch)
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'discord-access-token' })
			} as any)
			.mockResolvedValueOnce({
				ok: false,
				status: 401,
				text: () => Promise.resolve('Unauthorized')
			} as any);

		const mockUrl = new URL('http://localhost/api/auth/discord/callback?code=test-code&state=test-oauth-state');
		const mockCookies = makeOAuthCookies();
		const mockPlatform = {
			env: {
				DISCORD_CLIENT_ID: 'test-client-id',
				DISCORD_CLIENT_SECRET: 'test-client-secret'
			}
		};

		await expect(
			GET({
				url: mockUrl,
				cookies: mockCookies,
				platform: mockPlatform
			} as any)
		).rejects.toMatchObject({ status: 302, location: '/auth/login?error=user_fetch_failed' });
	});
});
