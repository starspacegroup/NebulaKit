import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock console to avoid noise
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('Profile Page Server - Extended Coverage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
		vi.stubGlobal('crypto', {
			...webcrypto,
			randomUUID: () => '123e4567-e89b-12d3-a456-426614174000'
		} as Crypto);
	});

	afterEach(() => {
		consoleSpy.mockClear();
		consoleWarnSpy.mockClear();
		consoleErrorSpy.mockClear();
		vi.unstubAllGlobals();
	});

	describe('isProviderConfigured helper', () => {
		it('should return true for GitHub when env vars are set', async () => {
			const mockEvent = {
				locals: {
					user: { id: 'user-1', login: 'testuser' }
				},
				platform: {
					env: {
						GITHUB_CLIENT_ID: 'client-id',
						GITHUB_CLIENT_SECRET: 'client-secret'
					}
				}
			};

			const { load } = await import('../../src/routes/profile/+page.server');
			const result = (await load(mockEvent as any)) as any;

			expect(result.configuredProviders.github).toBe(true);
		});

		it('should return true for Discord when env vars are set', async () => {
			const mockEvent = {
				locals: {
					user: { id: 'user-1', login: 'testuser' }
				},
				platform: {
					env: {
						DISCORD_CLIENT_ID: 'discord-client-id',
						DISCORD_CLIENT_SECRET: 'discord-client-secret'
					}
				}
			};

			const { load } = await import('../../src/routes/profile/+page.server');
			const result = (await load(mockEvent as any)) as any;

			expect(result.configuredProviders.discord).toBe(true);
		});

		it('should return true for GitHub when KV has config', async () => {
			const mockEvent = {
				locals: {
					user: { id: 'user-1', login: 'testuser' }
				},
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

			const { load } = await import('../../src/routes/profile/+page.server');
			const result = (await load(mockEvent as any)) as any;

			expect(result.configuredProviders.github).toBe(true);
		});

		it('should return true for Discord when KV has config', async () => {
			const mockEvent = {
				locals: {
					user: { id: 'user-1', login: 'testuser' }
				},
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

			const { load } = await import('../../src/routes/profile/+page.server');
			const result = (await load(mockEvent as any)) as any;

			expect(result.configuredProviders.discord).toBe(true);
		});

		it('should return false for GitHub when KV config is missing clientId', async () => {
			const mockEvent = {
				locals: {
					user: { id: 'user-1', login: 'testuser' }
				},
				platform: {
					env: {
						KV: {
							get: vi.fn().mockImplementation((key: string) => {
								if (key === 'auth_config:github') {
									return JSON.stringify({
										clientSecret: 'only-secret'
									});
								}
								return null;
							})
						}
					}
				}
			};

			const { load } = await import('../../src/routes/profile/+page.server');
			const result = (await load(mockEvent as any)) as any;

			expect(result.configuredProviders.github).toBe(false);
		});

		it('should handle KV.get errors gracefully for GitHub', async () => {
			const mockEvent = {
				locals: {
					user: { id: 'user-1', login: 'testuser' }
				},
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

			const { load } = await import('../../src/routes/profile/+page.server');
			const result = (await load(mockEvent as any)) as any;

			// Should return false, not throw
			expect(result.configuredProviders.github).toBe(false);
		});

		it('should handle KV.get errors gracefully for Discord', async () => {
			const mockEvent = {
				locals: {
					user: { id: 'user-1', login: 'testuser' }
				},
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

			const { load } = await import('../../src/routes/profile/+page.server');
			const result = (await load(mockEvent as any)) as any;

			// Should return false, not throw
			expect(result.configuredProviders.discord).toBe(false);
		});
	});

	describe('Database operations for connected accounts', () => {
		it('should fetch connected accounts from DB', async () => {
			const mockAccounts = [
				{ provider: 'github', provider_account_id: '12345', created_at: '2024-01-01' }
			];

			const mockEvent = {
				locals: {
					user: { id: 'user-1', login: 'testuser' }
				},
				platform: {
					env: {
						DB: {
							prepare: vi.fn().mockReturnValue({
								bind: vi.fn().mockReturnValue({
									all: vi.fn().mockResolvedValue({ results: mockAccounts }),
									first: vi.fn().mockResolvedValue(null)
								})
							})
						}
					}
				}
			};

			const { load } = await import('../../src/routes/profile/+page.server');
			const result = (await load(mockEvent as any)) as any;

			expect(result.connectedAccounts).toEqual(mockAccounts);
		});

		it('should create missing GitHub oauth_account when user has github_login but no account', async () => {
			const mockEvent = {
				locals: {
					user: { id: '12345', login: 'testuser', email: 'test@example.com' }
				},
				platform: {
					env: {
						DB: {
							prepare: vi.fn().mockImplementation((sql: string) => {
								if (sql.includes('oauth_accounts WHERE user_id')) {
									return {
										bind: vi.fn().mockReturnValue({
											all: vi.fn().mockResolvedValue({ results: [] })
										})
									};
								}
								if (sql.includes('github_login FROM users')) {
									return {
										bind: vi.fn().mockReturnValue({
											first: vi.fn().mockResolvedValue({ github_login: 'testuser' })
										})
									};
								}
								if (sql.includes('INSERT INTO oauth_accounts')) {
									return {
										bind: vi.fn().mockReturnValue({
											run: vi.fn().mockResolvedValue({ success: true })
										})
									};
								}
								return { bind: vi.fn().mockReturnValue({ all: vi.fn(), first: vi.fn() }) };
							})
						}
					}
				}
			};

			const { load } = await import('../../src/routes/profile/+page.server');
			const result = (await load(mockEvent as any)) as any;

			// Should have created the github account
			expect(result.connectedAccounts).toHaveLength(1);
			expect(result.connectedAccounts[0].provider).toBe('github');
		});

		it('should not create duplicate oauth_account when user already has GitHub connection', async () => {
			const existingAccount = {
				provider: 'github',
				provider_account_id: 'existing-id',
				created_at: '2024-01-01'
			};

			const mockEvent = {
				locals: {
					user: { id: 'user-1', login: 'testuser' }
				},
				platform: {
					env: {
						DB: {
							prepare: vi.fn().mockImplementation((sql: string) => {
								if (sql.includes('oauth_accounts WHERE user_id')) {
									return {
										bind: vi.fn().mockReturnValue({
											all: vi.fn().mockResolvedValue({ results: [existingAccount] })
										})
									};
								}
								return { bind: vi.fn().mockReturnValue({ first: vi.fn() }) };
							})
						}
					}
				}
			};

			const { load } = await import('../../src/routes/profile/+page.server');
			const result = (await load(mockEvent as any)) as any;

			// Should still have just one account
			expect(result.connectedAccounts).toHaveLength(1);
			expect(result.connectedAccounts[0]).toEqual(existingAccount);
		});

		it('should surface GitHub as connected when the session has githubLogin but the oauth row is missing', async () => {
			const mockEvent = {
				locals: {
					user: {
						id: 'user-1',
						login: 'testuser',
						email: 'test@example.com',
						githubLogin: 'testuser'
					}
				},
				platform: {
					env: {
						DB: {
							prepare: vi.fn().mockImplementation((sql: string) => {
								if (sql.includes('oauth_accounts WHERE user_id')) {
									return {
										bind: vi.fn().mockReturnValue({
											all: vi.fn().mockResolvedValue({ results: [] })
										})
									};
								}

								return {
									bind: vi.fn().mockReturnValue({
										first: vi.fn().mockResolvedValue(null),
										all: vi.fn().mockResolvedValue({ results: [] })
									})
								};
							})
						}
					}
				}
			};

			const { load } = await import('../../src/routes/profile/+page.server');
			const result = (await load(mockEvent as any)) as any;

			expect(result.connectedAccounts).toHaveLength(1);
			expect(result.connectedAccounts[0].provider).toBe('github');
			expect(result.connectedAccounts[0].provider_account_id).toBe('testuser');
		});

		it('should handle DB errors gracefully when fetching accounts', async () => {
			const mockEvent = {
				locals: {
					user: { id: 'user-1', login: 'testuser', email: 'test@example.com' }
				},
				platform: {
					env: {
						DB: {
							prepare: vi.fn().mockReturnValue({
								bind: vi.fn().mockReturnValue({
									all: vi.fn().mockRejectedValue(new Error('DB Error'))
								})
							})
						}
					}
				}
			};

			const { load } = await import('../../src/routes/profile/+page.server');
			const result = (await load(mockEvent as any)) as any;

			// Should return empty array, not throw
			expect(result.connectedAccounts).toEqual([]);
		});

		it('should not create oauth_account when user has no github_login', async () => {
			const mockEvent = {
				locals: {
					user: { id: 'user-1', login: 'testuser' }
				},
				platform: {
					env: {
						DB: {
							prepare: vi.fn().mockImplementation((sql: string) => {
								if (sql.includes('oauth_accounts WHERE user_id')) {
									return {
										bind: vi.fn().mockReturnValue({
											all: vi.fn().mockResolvedValue({ results: [] })
										})
									};
								}
								if (sql.includes('github_login FROM users')) {
									return {
										bind: vi.fn().mockReturnValue({
											first: vi.fn().mockResolvedValue({ github_login: null })
										})
									};
								}
								return { bind: vi.fn().mockReturnValue({ run: vi.fn() }) };
							})
						}
					}
				}
			};

			const { load } = await import('../../src/routes/profile/+page.server');
			const result = (await load(mockEvent as any)) as any;

			// Should not have created any accounts
			expect(result.connectedAccounts).toHaveLength(0);
		});
	});
});
