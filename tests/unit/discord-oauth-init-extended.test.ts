import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Discord OAuth Init - Extended Branch Coverage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	describe('GET /api/auth/discord', () => {
		it('should fallback to KV when env var not set and handle KV errors', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const mockEvent = {
				platform: {
					env: {
						SESSION_SECRET: 'test-session-secret',
						DISCORD_CLIENT_ID: undefined,
						KV: {
							get: vi.fn().mockRejectedValue(new Error('KV Error'))
						}
					}
				},
				url: new URL('http://localhost:4277/api/auth/discord')
			};

			const { GET } = await import('../../src/routes/api/auth/discord/+server');

			try {
				await GET(mockEvent as any);
				expect.fail('Should have thrown redirect');
			} catch (err: any) {
				// Should redirect to setup with error
				expect(err.status).toBe(302);
				expect(err.location).toContain('/setup');
			}

			expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch from KV:', expect.any(Error));
			consoleSpy.mockRestore();
		});

		it('should use KV clientId when env var not set', async () => {
			const mockEvent = {
				platform: {
					env: {
						SESSION_SECRET: 'test-session-secret',
						DISCORD_CLIENT_ID: undefined,
						DB: transactionDatabase(),
						KV: {
							get: vi.fn().mockResolvedValue(
								JSON.stringify({
									clientId: 'kv-client-id',
									clientSecret: 'kv-secret'
								})
							)
						}
					}
				},
				url: new URL('http://localhost:4277/api/auth/discord'),
				locals: {},
				cookies: {
					set: vi.fn(),
					get: vi.fn()
				}
			};

			const { GET } = await import('../../src/routes/api/auth/discord/+server');

			try {
				await GET(mockEvent as any);
				expect.fail('Should have thrown redirect');
			} catch (err: any) {
				// Should redirect to Discord OAuth
				expect(err.status).toBe(302);
				expect(err.location).toContain('discord.com');
				expect(err.location).toContain('kv-client-id');
			}
		});

		it('should redirect to dev simulation when bypass is enabled and OAuth is not configured', async () => {
			const mockEvent = {
				platform: {
					env: {
						DEV_AUTH_BYPASS: 'true',
						DISCORD_CLIENT_ID: undefined,
						KV: {
							get: vi.fn().mockResolvedValue(null)
						}
					}
				},
				url: new URL('http://localhost:4277/api/auth/discord')
			};

			const { GET } = await import('../../src/routes/api/auth/discord/+server');

			try {
				await GET(mockEvent as any);
				expect.fail('Should have thrown redirect');
			} catch (err: any) {
				expect(err.status).toBe(302);
				expect(err.location).toBe('/api/auth/dev-simulate?provider=discord');
			}
		});

		it('should pass through role when redirecting to dev simulation', async () => {
			const mockEvent = {
				platform: {
					env: {
						DEV_AUTH_BYPASS: 'true',
						DISCORD_CLIENT_ID: undefined,
						KV: {
							get: vi.fn().mockResolvedValue(null)
						}
					}
				},
				url: new URL('http://localhost:4277/api/auth/discord?role=admin')
			};

			const { GET } = await import('../../src/routes/api/auth/discord/+server');

			try {
				await GET(mockEvent as any);
				expect.fail('Should have thrown redirect');
			} catch (err: any) {
				expect(err.status).toBe(302);
				expect(err.location).toBe('/api/auth/dev-simulate?provider=discord&role=admin');
			}
		});

		it('should pass through mode=link when redirecting to dev simulation', async () => {
			const mockEvent = {
				platform: {
					env: {
						DEV_AUTH_BYPASS: 'true',
						DISCORD_CLIENT_ID: undefined,
						KV: {
							get: vi.fn().mockResolvedValue(null)
						}
					}
				},
				url: new URL('http://localhost:4277/api/auth/discord?mode=link')
			};

			const { GET } = await import('../../src/routes/api/auth/discord/+server');

			try {
				await GET(mockEvent as any);
				expect.fail('Should have thrown redirect');
			} catch (err: any) {
				expect(err.status).toBe(302);
				expect(err.location).toBe('/api/auth/dev-simulate?provider=discord&mode=link');
			}
		});

		it('requires an authenticated user for account linking', async () => {
			const event = configuredLinkEvent();
			const { GET } = await import('../../src/routes/api/auth/discord/+server');

			await expect(GET(event as any)).rejects.toMatchObject({
				status: 302,
				location: '/auth/login?error=authentication_required'
			});
		});

		it('requires a signed database session for account linking', async () => {
			const event = configuredLinkEvent();
			event.locals = { user: { id: 'user-1' } };
			const { GET } = await import('../../src/routes/api/auth/discord/+server');

			await expect(GET(event as any)).rejects.toMatchObject({
				status: 302,
				location: '/auth/login?error=authentication_required'
			});
		});

		it('binds link state to the authenticated database session', async () => {
			const event = configuredLinkEvent();
			event.locals = { user: { id: 'user-1' } };
			// Opaque scheme: the cookie is the raw token, and the route validates
			// it against the sessions table before binding the transaction to it.
			event.cookies.get.mockReturnValue('opaque-session-token');
			(event.platform.env as Record<string, unknown>).DB = {
				prepare: vi.fn((sql: string) => ({
					bind: vi.fn(() => ({
						run: vi.fn().mockResolvedValue({ success: true }),
						first: vi.fn(async () =>
							sql.includes('FROM sessions')
								? { id: 'digest', user_id: 'user-1', expires_at: '2099-01-01T00:00:00.000Z' }
								: null
						)
					}))
				}))
			};
			const { GET } = await import('../../src/routes/api/auth/discord/+server');

			await expect(GET(event as any)).rejects.toMatchObject({
				status: 302,
				location: expect.stringContaining('discord.com/api/oauth2/authorize')
			});
		});
	});
});

function configuredLinkEvent() {
	return {
		platform: {
			env: {
				SESSION_SECRET: 'test-session-secret',
				DISCORD_CLIENT_ID: 'client-id',
				DB: transactionDatabase()
			}
		},
		url: new URL('http://localhost:4277/api/auth/discord?mode=link'),
		locals: {},
		cookies: { set: vi.fn(), get: vi.fn() }
	};
}

function transactionDatabase() {
	return {
		prepare: vi.fn(() => ({
			bind: vi.fn(() => ({
				run: vi.fn().mockResolvedValue({ success: true })
			}))
		}))
	};
}
