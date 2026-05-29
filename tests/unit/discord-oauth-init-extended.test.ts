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
						DISCORD_CLIENT_ID: undefined,
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
				cookies: {
					set: vi.fn()
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
	});
});
