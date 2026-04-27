import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock console to avoid noise
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('Discord Callback Server - Extended Coverage', () => {
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
		vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-123' });

		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	describe('Error handling - no code', () => {
		it('should redirect to login with error when no code provided', async () => {
			const mockEvent = {
				url: new URL('http://localhost/api/auth/discord/callback'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {}
			};

			const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

			try {
				await GET(mockEvent as any);
				expect.fail('Should have redirected');
			} catch (err: any) {
				expect(err.status).toBe(302);
				expect(err.location).toBe('/auth/login?error=no_code');
			}
		});
	});

	describe('OAuth configuration from KV', () => {
		it('should fetch Discord config from KV when env vars not set', async () => {
			const mockKV = {
				get: vi.fn().mockImplementation((key: string) => {
					if (key === 'auth_config:discord') {
						return JSON.stringify({
							clientId: 'kv-discord-id',
							clientSecret: 'kv-discord-secret'
						});
					}
					return null;
				})
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						access_token: 'test-token'
					})
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: '123456789',
						username: 'testuser',
						global_name: 'Test User',
						email: 'test@discord.com',
						avatar: 'abcdef'
					})
			});

			const mockEvent = {
				url: new URL('http://localhost/api/auth/discord/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						KV: mockKV
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

			const response = await GET(mockEvent as any);
			expect(response.status).toBe(302);
			expect(mockKV.get).toHaveBeenCalledWith('auth_config:discord');
		});

		it('should handle KV.get error gracefully', async () => {
			const mockKV = {
				get: vi.fn().mockRejectedValue(new Error('KV Error'))
			};

			const mockEvent = {
				url: new URL('http://localhost/api/auth/discord/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						KV: mockKV
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

			try {
				await GET(mockEvent as any);
				expect.fail('Should have redirected');
			} catch (err: any) {
				// Should redirect with not_configured since KV failed and no env vars
				expect(err.status).toBe(302);
				expect(err.location).toBe('/auth/login?error=not_configured');
			}
		});

		it('should redirect with not_configured when no OAuth config found', async () => {
			const mockEvent = {
				url: new URL('http://localhost/api/auth/discord/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

			try {
				await GET(mockEvent as any);
				expect.fail('Should have redirected');
			} catch (err: any) {
				expect(err.status).toBe(302);
				expect(err.location).toBe('/auth/login?error=not_configured');
			}
		});
	});

	describe('Token exchange errors', () => {
		it('should redirect with error when token exchange fails', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				text: () => Promise.resolve('Invalid code')
			});

			const mockEvent = {
				url: new URL('http://localhost/api/auth/discord/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						DISCORD_CLIENT_ID: 'client-id',
						DISCORD_CLIENT_SECRET: 'client-secret'
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

			try {
				await GET(mockEvent as any);
				expect.fail('Should have redirected');
			} catch (err: any) {
				expect(err.status).toBe(302);
				expect(err.location).toBe('/auth/login?error=token_exchange_failed');
			}
		});

		it('should redirect with error when no access token in response', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({})
			});

			const mockEvent = {
				url: new URL('http://localhost/api/auth/discord/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						DISCORD_CLIENT_ID: 'client-id',
						DISCORD_CLIENT_SECRET: 'client-secret'
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

			try {
				await GET(mockEvent as any);
				expect.fail('Should have redirected');
			} catch (err: any) {
				expect(err.status).toBe(302);
				expect(err.location).toBe('/auth/login?error=no_access_token');
			}
		});
	});

	describe('User info fetch errors', () => {
		it('should redirect with error when user fetch fails', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'test-token' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				text: () => Promise.resolve('Unauthorized')
			});

			const mockEvent = {
				url: new URL('http://localhost/api/auth/discord/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						DISCORD_CLIENT_ID: 'client-id',
						DISCORD_CLIENT_SECRET: 'client-secret'
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

			try {
				await GET(mockEvent as any);
				expect.fail('Should have redirected');
			} catch (err: any) {
				expect(err.status).toBe(302);
				expect(err.location).toBe('/auth/login?error=user_fetch_failed');
			}
		});
	});

	describe('Avatar URL generation', () => {
		it('should use default avatar when user has no avatar', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'test-token' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: '123456789',
						username: 'testuser',
						global_name: 'Test User',
						email: 'test@discord.com',
						avatar: null,
						discriminator: '1234'
					})
			});

			const mockEvent = {
				url: new URL('http://localhost/api/auth/discord/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						DISCORD_CLIENT_ID: 'client-id',
						DISCORD_CLIENT_SECRET: 'client-secret'
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

			const response = await GET(mockEvent as any);
			expect(response.status).toBe(302);
		});
	});

	describe('Owner ID fetching from KV', () => {
		it('should fetch owner ID from KV when env var not set', async () => {
			const mockKV = {
				get: vi.fn().mockImplementation((key: string) => {
					if (key === 'github_owner_id') {
						return 'owner-12345';
					}
					return null;
				})
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'test-token' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: '123456789',
						username: 'testuser',
						global_name: 'Test User',
						email: 'test@discord.com',
						avatar: 'abcdef'
					})
			});

			const mockEvent = {
				url: new URL('http://localhost/api/auth/discord/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						DISCORD_CLIENT_ID: 'client-id',
						DISCORD_CLIENT_SECRET: 'client-secret',
						KV: mockKV
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

			const response = await GET(mockEvent as any);
			expect(response.status).toBe(302);
			expect(mockKV.get).toHaveBeenCalledWith('github_owner_id');
		});

		it('should handle KV.get error for owner ID gracefully', async () => {
			const mockKV = {
				get: vi.fn().mockImplementation((key: string) => {
					if (key === 'github_owner_id') {
						throw new Error('KV Error');
					}
					return null;
				})
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'test-token' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: '123456789',
						username: 'testuser',
						global_name: 'Test User',
						email: 'test@discord.com',
						avatar: 'abcdef'
					})
			});

			const mockEvent = {
				url: new URL('http://localhost/api/auth/discord/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						DISCORD_CLIENT_ID: 'client-id',
						DISCORD_CLIENT_SECRET: 'client-secret',
						KV: mockKV
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

			// Should not throw, should continue
			const response = await GET(mockEvent as any);
			expect(response.status).toBe(302);
		});
	});

	describe('Linking mode with existing session', () => {
		it('should handle linking mode with invalid existing session', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'test-token' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: '123456789',
						username: 'testuser',
						global_name: 'Test User',
						email: 'test@discord.com',
						avatar: 'abcdef'
					})
			});

			const mockEvent = {
				url: new URL('http://localhost/api/auth/discord/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue('invalid-base64!!!'), set: vi.fn() },
				platform: {
					env: {
						DISCORD_CLIENT_ID: 'client-id',
						DISCORD_CLIENT_SECRET: 'client-secret'
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

			// Should not throw, treat as new login
			const response = await GET(mockEvent as any);
			expect(response.status).toBe(302);
		});

		it('should link Discord account to existing user', async () => {
			const existingSession = btoa(
				JSON.stringify({ id: 'existing-user-123', login: 'existinguser' })
			)
				.replace(/\+/g, '-')
				.replace(/\//g, '_')
				.replace(/=+$/, '');

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'test-token' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: '123456789',
						username: 'testuser',
						global_name: 'Test User',
						email: 'test@discord.com',
						avatar: 'abcdef'
					})
			});

			const mockDB = {
				prepare: vi.fn().mockImplementation((sql: string) => {
					if (sql.includes('oauth_accounts WHERE provider = ?')) {
						return {
							bind: vi.fn().mockReturnValue({
								first: vi.fn().mockResolvedValue(null)
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
					return { bind: vi.fn().mockReturnValue({ first: vi.fn(), run: vi.fn() }) };
				})
			};

			const mockEvent = {
				url: new URL('http://localhost/api/auth/discord/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(existingSession), set: vi.fn() },
				platform: {
					env: {
						DISCORD_CLIENT_ID: 'client-id',
						DISCORD_CLIENT_SECRET: 'client-secret',
						DB: mockDB
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

			const response = await GET(mockEvent as any);
			expect(response.status).toBe(302);
			expect(response.headers.get('Location')).toContain('/profile?linked=discord');
		});
	});

	describe('Session cookie handling', () => {
		it('should set Secure flag on HTTPS', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'test-token' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: '123456789',
						username: 'testuser',
						global_name: 'Test User',
						email: 'test@discord.com',
						avatar: 'abcdef'
					})
			});

			const mockEvent = {
				url: new URL('https://example.com/api/auth/discord/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						DISCORD_CLIENT_ID: 'client-id',
						DISCORD_CLIENT_SECRET: 'client-secret'
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

			const response = await GET(mockEvent as any);
			const cookie = response.headers.get('Set-Cookie');
			expect(cookie).toContain('Secure');
		});
	});

	describe('Existing user update', () => {
		it('should update existing Discord user in database', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'test-token' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: '123456789',
						username: 'testuser',
						global_name: 'Updated Name',
						email: 'test@discord.com',
						avatar: 'abcdef'
					})
			});

			const mockDB = {
				prepare: vi.fn().mockImplementation((sql: string) => {
					if (sql.includes('SELECT user_id FROM oauth_accounts WHERE provider')) {
						return {
							bind: vi.fn().mockReturnValue({
								first: vi.fn().mockResolvedValue(null)
							})
						};
					}
					if (sql.includes('SELECT id, is_admin FROM users')) {
						return {
							bind: vi.fn().mockReturnValue({
								first: vi.fn().mockResolvedValue({ id: 'discord_123456789', is_admin: 1 })
							})
						};
					}
					if (sql.includes('UPDATE users')) {
						return {
							bind: vi.fn().mockReturnValue({
								run: vi.fn().mockResolvedValue({ success: true })
							})
						};
					}
					if (sql.includes('SELECT id FROM oauth_accounts WHERE user_id')) {
						return {
							bind: vi.fn().mockReturnValue({
								first: vi.fn().mockResolvedValue({ id: 'oauth-123' })
							})
						};
					}
					return { bind: vi.fn().mockReturnValue({ first: vi.fn(), run: vi.fn() }) };
				})
			};

			const mockEvent = {
				url: new URL('http://localhost/api/auth/discord/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						DISCORD_CLIENT_ID: 'client-id',
						DISCORD_CLIENT_SECRET: 'client-secret',
						DB: mockDB
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

			const response = await GET(mockEvent as any);
			expect(response.status).toBe(302);
		});
	});

	describe('Login as linked user', () => {
		it('should login as linked user when Discord account is linked', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'test-token' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: '123456789',
						username: 'testuser',
						global_name: 'Test User',
						email: 'test@discord.com',
						avatar: 'abcdef'
					})
			});

			const mockDB = {
				prepare: vi.fn().mockImplementation((sql: string) => {
					if (sql.includes('oauth_accounts WHERE provider = ? AND provider_account_id')) {
						return {
							bind: vi.fn().mockReturnValue({
								first: vi.fn().mockResolvedValue({ user_id: 'linked-user-456' })
							})
						};
					}
					if (sql.includes('SELECT * FROM users WHERE id')) {
						return {
							bind: vi.fn().mockReturnValue({
								first: vi.fn().mockResolvedValue({
									id: 'linked-user-456',
									email: 'linked@test.com',
									name: 'Linked User',
									github_login: 'linkeduser',
									github_avatar_url: 'https://avatars.githubusercontent.com/u/456',
									is_admin: 0
								})
							})
						};
					}
					if (sql.includes('oauth_accounts WHERE user_id = ? AND provider = ?')) {
						return {
							bind: vi.fn().mockReturnValue({
								first: vi.fn().mockResolvedValue(null) // No GitHub link
							})
						};
					}
					return { bind: vi.fn().mockReturnValue({ first: vi.fn(), run: vi.fn() }) };
				})
			};

			const mockEvent = {
				url: new URL('http://localhost/api/auth/discord/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						DISCORD_CLIENT_ID: 'client-id',
						DISCORD_CLIENT_SECRET: 'client-secret',
						DB: mockDB
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

			const response = await GET(mockEvent as any);
			expect(response.status).toBe(302);
			expect(response.headers.get('Location')).toContain('/');
		});

		it('should check GitHub link for owner status', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'test-token' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: '123456789',
						username: 'testuser',
						global_name: 'Test User',
						email: 'test@discord.com',
						avatar: 'abcdef'
					})
			});

			const mockDB = {
				prepare: vi.fn().mockImplementation((sql: string) => {
					if (sql.includes('oauth_accounts WHERE provider = ? AND provider_account_id')) {
						return {
							bind: vi.fn().mockReturnValue({
								first: vi.fn().mockResolvedValue({ user_id: 'linked-user-456' })
							})
						};
					}
					if (sql.includes('SELECT * FROM users WHERE id')) {
						return {
							bind: vi.fn().mockReturnValue({
								first: vi.fn().mockResolvedValue({
									id: 'linked-user-456',
									email: 'linked@test.com',
									name: 'Linked User',
									github_login: 'owneruser',
									github_avatar_url: 'https://avatars.githubusercontent.com/u/456',
									is_admin: 0
								})
							})
						};
					}
					if (sql.includes('oauth_accounts WHERE user_id = ? AND provider = ?')) {
						return {
							bind: vi.fn().mockReturnValue({
								first: vi.fn().mockResolvedValue({ provider_account_id: 'github-owner-123' })
							})
						};
					}
					return { bind: vi.fn().mockReturnValue({ first: vi.fn(), run: vi.fn() }) };
				})
			};

			const mockKV = {
				get: vi.fn().mockImplementation((key: string) => {
					if (key === 'github_owner_id') {
						return 'github-owner-123';
					}
					return null;
				})
			};

			const mockEvent = {
				url: new URL('http://localhost/api/auth/discord/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						DISCORD_CLIENT_ID: 'client-id',
						DISCORD_CLIENT_SECRET: 'client-secret',
						DB: mockDB,
						KV: mockKV
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

			const response = await GET(mockEvent as any);
			expect(response.status).toBe(302);
		});
	});

	describe('New Discord user creation', () => {
		it('should create new user when Discord account not linked', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'test-token' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: '987654321',
						username: 'newuser',
						global_name: 'New User',
						email: null, // No email - should use fallback
						avatar: null
					})
			});

			const mockDB = {
				prepare: vi.fn().mockImplementation((sql: string) => {
					if (sql.includes('oauth_accounts WHERE provider = ? AND provider_account_id')) {
						return {
							bind: vi.fn().mockReturnValue({
								first: vi.fn().mockResolvedValue(null) // Not linked
							})
						};
					}
					if (sql.includes('SELECT id, is_admin FROM users WHERE id')) {
						return {
							bind: vi.fn().mockReturnValue({
								first: vi.fn().mockResolvedValue(null) // No existing user
							})
						};
					}
					if (sql.includes('INSERT INTO users')) {
						return {
							bind: vi.fn().mockReturnValue({
								run: vi.fn().mockResolvedValue({ success: true })
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
					return { bind: vi.fn().mockReturnValue({ first: vi.fn(), run: vi.fn() }) };
				})
			};

			const mockEvent = {
				url: new URL('http://localhost/api/auth/discord/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						DISCORD_CLIENT_ID: 'client-id',
						DISCORD_CLIENT_SECRET: 'client-secret',
						DB: mockDB
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

			const response = await GET(mockEvent as any);
			expect(response.status).toBe(302);
		});
	});

	describe('Database error handling', () => {
		it('should continue auth even if DB fails', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'test-token' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: '123456789',
						username: 'testuser',
						global_name: 'Test User',
						email: 'test@discord.com',
						avatar: 'abcdef'
					})
			});

			const mockDB = {
				prepare: vi.fn().mockImplementation(() => {
					throw new Error('DB connection failed');
				})
			};

			const mockEvent = {
				url: new URL('http://localhost/api/auth/discord/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						DISCORD_CLIENT_ID: 'client-id',
						DISCORD_CLIENT_SECRET: 'client-secret',
						DB: mockDB
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

			// Should not throw, should continue with auth
			const response = await GET(mockEvent as any);
			expect(response.status).toBe(302);
		});
	});

	describe('Account merge handling', () => {
		it('should merge accounts when Discord is already linked to different user', async () => {
			const existingSession = btoa(
				JSON.stringify({ id: 'existing-user-123', login: 'existinguser' })
			)
				.replace(/\+/g, '-')
				.replace(/\//g, '_')
				.replace(/=+$/, '');

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'test-token' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: '123456789',
						username: 'testuser',
						global_name: 'Test User',
						email: 'test@discord.com',
						avatar: 'abcdef'
					})
			});

			// Mock mergeAccounts
			vi.mock('$lib/services/account-merge', () => ({
				mergeAccounts: vi.fn().mockResolvedValue(undefined)
			}));

			const mockDB = {
				prepare: vi.fn().mockImplementation((sql: string) => {
					if (sql.includes('oauth_accounts WHERE provider = ? AND provider_account_id')) {
						return {
							bind: vi.fn().mockReturnValue({
								first: vi.fn().mockResolvedValue({ user_id: 'other-user-999' }) // Linked to different user
							})
						};
					}
					return { bind: vi.fn().mockReturnValue({ first: vi.fn(), run: vi.fn() }) };
				})
			};

			const mockEvent = {
				url: new URL('http://localhost/api/auth/discord/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(existingSession), set: vi.fn() },
				platform: {
					env: {
						DISCORD_CLIENT_ID: 'client-id',
						DISCORD_CLIENT_SECRET: 'client-secret',
						DB: mockDB
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

			const response = await GET(mockEvent as any);
			expect(response.status).toBe(302);
		});

		it('should attach Discord login to an existing account with the same email', async () => {
			const insertOAuthRun = vi.fn().mockResolvedValue({ success: true });

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'test-token' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: '123456789',
						username: 'discorduser',
						global_name: 'Discord User',
						email: 'existing@example.com',
						avatar: 'abcdef'
					})
			});

			const mockDB = {
				prepare: vi.fn().mockImplementation((sql: string) => {
					if (sql.includes('oauth_accounts WHERE provider = ? AND provider_account_id = ?')) {
						return {
							bind: vi.fn().mockReturnValue({
								first: vi.fn().mockResolvedValue(null)
							})
						};
					}

					if (sql.includes('FROM users u') && sql.includes('user_login_aliases')) {
						const matchedUser = {
							id: 'existing-user-123',
							email: 'existing@example.com',
							name: 'Existing User',
							github_login: 'existinguser',
							github_avatar_url: 'https://avatars.example/existing.png',
							is_admin: 0
						};

						return {
							bind: vi.fn().mockReturnValue({
								first: vi.fn().mockResolvedValue(matchedUser),
								all: vi.fn().mockResolvedValue({ results: [matchedUser] })
							})
						};
					}

					if (sql.includes('INSERT INTO oauth_accounts')) {
						return {
							bind: vi.fn((...values: unknown[]) => {
								expect(values[1]).toBe('existing-user-123');
								expect(values[2]).toBe('discord');
								expect(values[3]).toBe('123456789');

								return {
									run: insertOAuthRun
								};
							})
						};
					}

					if (sql.includes('SELECT id, is_admin FROM users WHERE id = ?')) {
						return {
							bind: vi.fn().mockReturnValue({
								first: vi.fn().mockResolvedValue(null)
							})
						};
					}

					if (sql.includes('SELECT provider_account_id FROM oauth_accounts WHERE user_id = ?')) {
						return {
							bind: vi.fn().mockReturnValue({
								first: vi.fn().mockResolvedValue(null)
							})
						};
					}

					return {
						bind: vi.fn().mockReturnValue({
							first: vi.fn().mockResolvedValue(null),
							all: vi.fn().mockResolvedValue({ results: [] }),
							run: vi.fn().mockResolvedValue({ success: true })
						})
					};
				})
			};

			const mockEvent = {
				url: new URL('http://localhost/api/auth/discord/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						DISCORD_CLIENT_ID: 'client-id',
						DISCORD_CLIENT_SECRET: 'client-secret',
						DB: mockDB
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/discord/callback/+server');

			const response = await GET(mockEvent as any);
			expect(response.status).toBe(302);
			expect(insertOAuthRun).toHaveBeenCalledTimes(1);
			expect(response.headers.get('Set-Cookie')).toContain('session=');
		});
	});
});
