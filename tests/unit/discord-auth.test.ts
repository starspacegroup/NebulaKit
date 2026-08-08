import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/utils/oauth-state', async () => {
	const actual = await vi.importActual<typeof import('../../src/lib/utils/oauth-state')>(
		'../../src/lib/utils/oauth-state'
	);
	return {
		...actual,
		createOAuthTransaction: vi.fn(async () => ({
			state: 'legacy-valid-state',
			cookie: 'legacy-signed-state-cookie'
		})),
		consumeOAuthState: vi.fn(async (provider: 'github' | 'discord') => ({
			provider,
			state: 'legacy-valid-state',
			intent: 'login',
			issuedAt: Date.now()
		})),
		verifyOAuthTransaction: vi.fn(async (_db: unknown, provider: 'github' | 'discord') => ({
			provider,
			state: 'legacy-valid-state',
			intent: 'login',
			issuedAt: Date.now()
		})),
		consumeOAuthTransaction: vi.fn(async (_db: unknown, provider: 'github' | 'discord') => ({
			provider,
			state: 'legacy-valid-state',
			intent: 'login',
			issuedAt: Date.now()
		}))
	};
});

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
		vi.stubGlobal('crypto', webcrypto as Crypto);
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
				platform: withDatabase(mockPlatform)
			} as any)
		).rejects.toMatchObject({ status: 302, location: '/setup?error=oauth_not_configured' });
	});

	it('should redirect to Discord OAuth when configured via env', async () => {
		const { GET } = await import('../../src/routes/api/auth/discord/+server');

		const mockUrl = new URL('http://localhost/api/auth/discord');
		const mockPlatform = {
			env: {
				DISCORD_CLIENT_ID: 'test-discord-client-id',
				SESSION_SECRET: 'test-session-secret',
				DB: {},
				KV: null
			}
		};

		await expect(
			GET({
				url: mockUrl,
				platform: withDatabase(mockPlatform),
				cookies: { set: vi.fn() },
				locals: {}
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
				SESSION_SECRET: 'test-session-secret',
				DB: {},
				KV: {
					get: vi.fn().mockResolvedValue(JSON.stringify({ clientId: 'kv-discord-client-id' }))
				}
			}
		};

		await expect(
			GET({
				url: mockUrl,
				platform: withDatabase(mockPlatform),
				cookies: { set: vi.fn() },
				locals: {}
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
				DISCORD_CLIENT_ID: 'test-discord-client-id',
				SESSION_SECRET: 'test-session-secret',
				DB: {}
			}
		};

		await expect(
			GET({
				url: mockUrl,
				platform: withDatabase(mockPlatform),
				cookies: { set: vi.fn() },
				locals: {}
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
		vi.stubGlobal('crypto', webcrypto as Crypto);
		vi.stubGlobal('fetch', vi.fn());
	});

	it('should redirect to login with error when no code provided', async () => {
		const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

		const mockUrl = new URL('http://localhost/api/auth/discord/callback');
		const mockCookies = {
			set: vi.fn(),
			get: vi.fn()
		};

		await expect(
			GET({
				url: mockUrl,
				cookies: mockCookies,
				platform: withDatabase({})
			} as any)
		).rejects.toMatchObject({ status: 302, location: '/auth/login?error=no_code' });
	});

	it('should redirect to login with error when Discord OAuth not configured', async () => {
		const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

		const mockUrl = new URL('http://localhost/api/auth/discord/callback?code=test-code');
		const mockCookies = {
			set: vi.fn(),
			get: vi.fn()
		};
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
				platform: withDatabase(mockPlatform)
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

		const mockUrl = new URL('http://localhost/api/auth/discord/callback?code=test-code');
		const mockCookies = {
			set: vi.fn(),
			get: vi.fn()
		};
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
			platform: withDatabase(mockPlatform)
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

		const mockUrl = new URL('http://localhost/api/auth/discord/callback?code=invalid-code');
		const mockCookies = {
			set: vi.fn(),
			get: vi.fn()
		};
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
				platform: withDatabase(mockPlatform)
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

		const mockUrl = new URL('http://localhost/api/auth/discord/callback?code=test-code');
		const mockCookies = {
			set: vi.fn(),
			get: vi.fn()
		};
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
				platform: withDatabase(mockPlatform)
			} as any)
		).rejects.toMatchObject({ status: 302, location: '/auth/login?error=user_fetch_failed' });
	});
});

function withDatabase<T extends { env?: Record<string, unknown> }>(platform: T): T {
	const db = (platform.env?.DB as ReturnType<typeof database>) ?? database();
	return {
		...platform,
		env: {
			...platform.env,
			DB: callbackDatabase(db)
		}
	} as T;
}

function callbackDatabase(db: ReturnType<typeof database>) {
	return {
		...db,
		prepare: vi.fn((sql: string) => {
			if (
				sql.trim() !==
				'SELECT id, email, name, github_login, github_avatar_url, is_admin FROM users WHERE id = ?'
			) {
				return (db.prepare as (sql: string) => ReturnType<typeof db.prepare>)(sql);
			}
			return {
				bind: vi.fn((userId: string) => ({
					first: vi.fn().mockResolvedValue({
						id: userId,
						email: `${userId}@example.com`,
						name: 'Discord User',
						github_login: null,
						github_avatar_url: null,
						is_admin: 0
					})
				}))
			};
		})
	};
}

function database() {
	return {
		prepare: vi.fn(() => ({
			bind: vi.fn(() => ({
				first: vi.fn().mockResolvedValue(null),
				all: vi.fn().mockResolvedValue({ results: [] }),
				run: vi.fn().mockResolvedValue({ success: true })
			}))
		}))
	};
}
import '../helpers/server-response';
