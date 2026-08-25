import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Auth Login Page Server - Extended Coverage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	describe('User redirection when logged in', () => {
		it('should redirect logged-in user to home', async () => {
			const mockEvent = {
				locals: {
					user: { id: 'user-1', login: 'testuser' }
				},
				url: new URL('http://localhost/auth/login'),
				platform: {}
			};

			const { load } = await import('../../src/routes/auth/login/+page.server');

			try {
				await load(mockEvent as any);
				expect.fail('Should have redirected');
			} catch (err: any) {
				expect(err.status).toBe(302);
				expect(err.location).toBe('/');
			}
		});

		it('should redirect to /?error=forbidden when error=unauthorized', async () => {
			const mockEvent = {
				locals: {
					user: { id: 'user-1', login: 'testuser' }
				},
				url: new URL('http://localhost/auth/login?error=unauthorized'),
				platform: {}
			};

			const { load } = await import('../../src/routes/auth/login/+page.server');

			try {
				await load(mockEvent as any);
				expect.fail('Should have redirected');
			} catch (err: any) {
				expect(err.status).toBe(302);
				expect(err.location).toBe('/?error=forbidden');
			}
		});
	});

	describe('isProviderConfigured helper', () => {
		it('should return true for GitHub when env vars are set', async () => {
			const mockEvent = {
				locals: {},
				url: new URL('http://localhost/auth/login'),
				platform: {
					env: {
						GITHUB_CLIENT_ID: 'client-id',
						GITHUB_CLIENT_SECRET: 'client-secret'
					}
				}
			};

			const { load } = await import('../../src/routes/auth/login/+page.server');
			const result = (await load(mockEvent as any)) as any;

			expect(result.configuredProviders.github).toBe(true);
		});

		it('should return true for Discord when env vars are set', async () => {
			const mockEvent = {
				locals: {},
				url: new URL('http://localhost/auth/login'),
				platform: {
					env: {
						DISCORD_CLIENT_ID: 'discord-client-id',
						DISCORD_CLIENT_SECRET: 'discord-client-secret'
					}
				}
			};

			const { load } = await import('../../src/routes/auth/login/+page.server');
			const result = (await load(mockEvent as any)) as any;

			expect(result.configuredProviders.discord).toBe(true);
		});

		it('should return true for GitHub when KV has config', async () => {
			const mockEvent = {
				locals: {},
				url: new URL('http://localhost/auth/login'),
				platform: {
					env: {
						KV: {
							get: vi.fn().mockImplementation((key: string) => {
								if (key === 'auth_config:github') {
									return JSON.stringify({
										clientId: 'kv-client-id',
										clientSecret: 'kv-client-secret'
									});
								}
								return null;
							})
						}
					}
				}
			};

			const { load } = await import('../../src/routes/auth/login/+page.server');
			const result = (await load(mockEvent as any)) as any;

			expect(result.configuredProviders.github).toBe(true);
		});

		it('should return true for Discord when KV has config', async () => {
			const mockEvent = {
				locals: {},
				url: new URL('http://localhost/auth/login'),
				platform: {
					env: {
						KV: {
							get: vi.fn().mockImplementation((key: string) => {
								if (key === 'auth_config:discord') {
									return JSON.stringify({
										clientId: 'discord-kv-client-id',
										clientSecret: 'discord-kv-client-secret'
									});
								}
								return null;
							})
						}
					}
				}
			};

			const { load } = await import('../../src/routes/auth/login/+page.server');
			const result = (await load(mockEvent as any)) as any;

			expect(result.configuredProviders.discord).toBe(true);
		});

		it('should return false for GitHub when KV config is missing secrets', async () => {
			const mockEvent = {
				locals: {},
				url: new URL('http://localhost/auth/login'),
				platform: {
					env: {
						KV: {
							get: vi.fn().mockImplementation((key: string) => {
								if (key === 'auth_config:github') {
									return JSON.stringify({
										clientId: 'only-client-id'
									});
								}
								return null;
							})
						}
					}
				}
			};

			const { load } = await import('../../src/routes/auth/login/+page.server');
			const result = (await load(mockEvent as any)) as any;

			expect(result.configuredProviders.github).toBe(false);
		});

		it('should return false for Discord when KV config is missing secrets', async () => {
			const mockEvent = {
				locals: {},
				url: new URL('http://localhost/auth/login'),
				platform: {
					env: {
						KV: {
							get: vi.fn().mockImplementation((key: string) => {
								if (key === 'auth_config:discord') {
									return JSON.stringify({
										clientId: 'only-client-id'
									});
								}
								return null;
							})
						}
					}
				}
			};

			const { load } = await import('../../src/routes/auth/login/+page.server');
			const result = (await load(mockEvent as any)) as any;

			expect(result.configuredProviders.discord).toBe(false);
		});

		it('should handle KV.get errors gracefully for GitHub', async () => {
			const mockEvent = {
				locals: {},
				url: new URL('http://localhost/auth/login'),
				platform: {
					env: {
						KV: {
							get: vi.fn().mockImplementation((key: string) => {
								if (key === 'auth_config:github') {
									throw new Error('KV error');
								}
								return null;
							})
						}
					}
				}
			};

			const { load } = await import('../../src/routes/auth/login/+page.server');
			const result = (await load(mockEvent as any)) as any;

			// Should return false, not throw
			expect(result.configuredProviders.github).toBe(false);
		});

		it('should handle KV.get errors gracefully for Discord', async () => {
			const mockEvent = {
				locals: {},
				url: new URL('http://localhost/auth/login'),
				platform: {
					env: {
						KV: {
							get: vi.fn().mockImplementation((key: string) => {
								if (key === 'auth_config:discord') {
									throw new Error('KV error');
								}
								return null;
							})
						}
					}
				}
			};

			const { load } = await import('../../src/routes/auth/login/+page.server');
			const result = (await load(mockEvent as any)) as any;

			// Should return false, not throw
			expect(result.configuredProviders.discord).toBe(false);
		});

		it('should return false for both when no platform is available', async () => {
			const mockEvent = {
				locals: {},
				url: new URL('http://localhost/auth/login'),
				platform: undefined
			};

			const { load } = await import('../../src/routes/auth/login/+page.server');
			const result = (await load(mockEvent as any)) as any;

			expect(result.configuredProviders.github).toBe(false);
			expect(result.configuredProviders.discord).toBe(false);
		});
	});
});
