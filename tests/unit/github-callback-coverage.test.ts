import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/utils/oauth-state', async () => {
	const actual = await vi.importActual<typeof import('../../src/lib/utils/oauth-state')>(
		'../../src/lib/utils/oauth-state'
	);
	return {
		...actual,
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

vi.mock('$lib/utils/db', async () => {
	const actual =
		await vi.importActual<typeof import('../../src/lib/utils/db')>('../../src/lib/utils/db');
	return {
		...actual,
		createSession: vi.fn(async (_db: unknown, userId: string) => ({
			id: 'stored-session-digest',
			token: 'opaque-session-token',
			user_id: userId,
			expires_at: new Date('2099-01-01T00:00:00.000Z')
		})),
		replaceSession: vi.fn(async (_db: unknown, userId: string) => ({
			id: 'stored-session-digest',
			token: 'opaque-session-token',
			user_id: userId,
			expires_at: new Date('2099-01-01T00:00:00.000Z')
		}))
	};
});

// Mock console to avoid noise
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('GitHub Callback Server - Extended Coverage', () => {
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
		vi.stubGlobal('crypto', webcrypto as Crypto);
		vi.stubEnv('DEV', true);

		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	describe('Error handling - no code', () => {
		it('should redirect to login with error when no code provided', async () => {
			const mockEvent = {
				url: new URL('http://localhost/api/auth/github/callback'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {}
			};

			const { GET } = await import('../../src/routes/api/auth/github/callback/+server');

			try {
				await GET(withDatabase(mockEvent) as any);
				expect.fail('Should have redirected');
			} catch (err: any) {
				expect(err.status).toBe(302);
				expect(err.location).toBe('/auth/login?error=no_code');
			}
		});
	});

	describe('OAuth configuration from KV', () => {
		it('should fetch GitHub config from KV when env vars not set', async () => {
			const mockKV = {
				get: vi.fn().mockImplementation((key: string) => {
					if (key === 'auth_config:github') {
						return JSON.stringify({
							clientId: 'kv-github-id',
							clientSecret: 'kv-github-secret'
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
						id: 123456789,
						login: 'testuser',
						name: 'Test User',
						email: 'test@github.com',
						avatar_url: 'https://avatars.githubusercontent.com/u/123456789'
					})
			});

			const mockEvent = {
				url: new URL('http://localhost/api/auth/github/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						KV: mockKV
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/github/callback/+server');

			const response = await GET(withDatabase(mockEvent) as any);
			expect(response.status).toBe(302);
			expect(mockKV.get).toHaveBeenCalledWith('auth_config:github');
		});

		it('should handle KV.get error gracefully', async () => {
			const mockKV = {
				get: vi.fn().mockRejectedValue(new Error('KV Error'))
			};

			const mockEvent = {
				url: new URL('http://localhost/api/auth/github/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						KV: mockKV
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/github/callback/+server');

			try {
				await GET(withDatabase(mockEvent) as any);
				expect.fail('Should have redirected');
			} catch (err: any) {
				expect(err.status).toBe(302);
				expect(err.location).toBe('/auth/login?error=not_configured');
			}
		});

		it('should redirect with not_configured when no OAuth config found', async () => {
			const mockEvent = {
				url: new URL('http://localhost/api/auth/github/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/github/callback/+server');

			try {
				await GET(withDatabase(mockEvent) as any);
				expect.fail('Should have redirected');
			} catch (err: any) {
				expect(err.status).toBe(302);
				expect(err.location).toBe('/auth/login?error=not_configured');
			}
		});
	});

	describe('Token exchange errors', () => {
		it('rejects a callback whose transaction preflight is no longer valid', async () => {
			const { verifyOAuthTransaction } = await import('../../src/lib/utils/oauth-state');
			vi.mocked(verifyOAuthTransaction).mockResolvedValueOnce(null);
			const { GET } = await import('../../src/routes/api/auth/github/callback/+server');

			await expect(
				GET(
					withDatabase({
						url: new URL('http://localhost/api/auth/github/callback?code=test-code'),
						cookies: { get: vi.fn(), set: vi.fn() },
						platform: { env: {} }
					}) as any
				)
			).rejects.toMatchObject({ location: '/auth/login?error=invalid_state' });
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it('rejects a callback when another request consumes the transaction first', async () => {
			const { consumeOAuthTransaction } = await import('../../src/lib/utils/oauth-state');
			vi.mocked(consumeOAuthTransaction).mockResolvedValueOnce(null);
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: vi.fn().mockResolvedValue({ access_token: 'token' })
			});
			const { GET } = await import('../../src/routes/api/auth/github/callback/+server');

			await expect(
				GET(
					withDatabase({
						url: new URL('http://localhost/api/auth/github/callback?code=test-code'),
						cookies: { get: vi.fn(), set: vi.fn() },
						platform: { env: { GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret' } }
					}) as any
				)
			).rejects.toMatchObject({ location: '/auth/login?error=invalid_state' });
			expect(mockFetch).toHaveBeenCalledOnce();
		});

		it('should redirect with error when token exchange fails', async () => {
			const { consumeOAuthTransaction, verifyOAuthTransaction } =
				await import('../../src/lib/utils/oauth-state');
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				text: () => Promise.resolve('Invalid code')
			});

			const mockEvent = {
				url: new URL('http://localhost/api/auth/github/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						GITHUB_CLIENT_ID: 'client-id',
						GITHUB_CLIENT_SECRET: 'client-secret'
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/github/callback/+server');

			try {
				await GET(withDatabase(mockEvent) as any);
				expect.fail('Should have redirected');
			} catch (err: any) {
				expect(err.status).toBe(302);
				expect(err.location).toBe('/auth/login?error=token_exchange_failed');
			}
			expect(verifyOAuthTransaction).toHaveBeenCalledOnce();
			expect(consumeOAuthTransaction).not.toHaveBeenCalled();
		});

		it('should redirect with error when no access token in response', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({})
			});

			const mockEvent = {
				url: new URL('http://localhost/api/auth/github/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						GITHUB_CLIENT_ID: 'client-id',
						GITHUB_CLIENT_SECRET: 'client-secret'
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/github/callback/+server');

			try {
				await GET(withDatabase(mockEvent) as any);
				expect.fail('Should have redirected');
			} catch (err: any) {
				expect(err.status).toBe(302);
				expect(err.location).toBe('/auth/login?error=no_access_token');
			}
		});
	});

	describe('User info fetch errors', () => {
		it('should redirect with error when user fetch fails', async () => {
			const { consumeOAuthTransaction } = await import('../../src/lib/utils/oauth-state');
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
				url: new URL('http://localhost/api/auth/github/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						GITHUB_CLIENT_ID: 'client-id',
						GITHUB_CLIENT_SECRET: 'client-secret'
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/github/callback/+server');

			try {
				await GET(withDatabase(mockEvent) as any);
				expect.fail('Should have redirected');
			} catch (err: any) {
				expect(err.status).toBe(302);
				expect(err.location).toBe('/auth/login?error=user_fetch_failed');
			}
			expect(consumeOAuthTransaction).toHaveBeenCalledOnce();
		});
	});

	describe('Owner ID checking', () => {
		it('should use username as owner when GITHUB_OWNER_ID is not numeric', async () => {
			const mockKV = {
				get: vi.fn().mockResolvedValue(null),
				put: vi.fn().mockResolvedValue(undefined)
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'test-token' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: 123456789,
						login: 'owneruser',
						name: 'Owner User',
						email: 'owner@github.com',
						avatar_url: 'https://avatars.githubusercontent.com/u/123456789'
					})
			});

			const mockEvent = {
				url: new URL('http://localhost/api/auth/github/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						GITHUB_CLIENT_ID: 'client-id',
						GITHUB_CLIENT_SECRET: 'client-secret',
						GITHUB_OWNER_ID: 'owneruser', // username, not numeric
						KV: mockKV
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/github/callback/+server');

			const response = await GET(withDatabase(mockEvent) as any);
			expect(response.status).toBe(302);
			// Should redirect to /admin since username matches
			expect(response.headers.get('Location')).toContain('/admin');
		});

		it('should fetch owner ID from KV when env var not set', async () => {
			const mockKV = {
				get: vi.fn().mockImplementation((key: string) => {
					if (key === 'github_owner_id') {
						return '123456789';
					}
					return null;
				}),
				put: vi.fn().mockResolvedValue(undefined)
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'test-token' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: 123456789,
						login: 'testuser',
						name: 'Test User',
						email: 'test@github.com',
						avatar_url: 'https://avatars.githubusercontent.com/u/123456789'
					})
			});

			const mockEvent = {
				url: new URL('http://localhost/api/auth/github/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						GITHUB_CLIENT_ID: 'client-id',
						GITHUB_CLIENT_SECRET: 'client-secret',
						KV: mockKV
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/github/callback/+server');

			const response = await GET(withDatabase(mockEvent) as any);
			expect(response.status).toBe(302);
			expect(mockKV.get).toHaveBeenCalledWith('github_owner_id');
			expect(response.headers.get('Location')).toContain('/admin');
		});

		it('should check github_owner_username from KV', async () => {
			const mockKV = {
				get: vi.fn().mockImplementation((key: string) => {
					if (key === 'github_owner_username') {
						return 'testuser';
					}
					return null;
				}),
				put: vi.fn().mockResolvedValue(undefined)
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'test-token' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: 123456789,
						login: 'testuser',
						name: 'Test User',
						email: 'test@github.com',
						avatar_url: 'https://avatars.githubusercontent.com/u/123456789'
					})
			});

			const mockEvent = {
				url: new URL('http://localhost/api/auth/github/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						GITHUB_CLIENT_ID: 'client-id',
						GITHUB_CLIENT_SECRET: 'client-secret',
						KV: mockKV
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/github/callback/+server');

			const response = await GET(withDatabase(mockEvent) as any);
			expect(response.status).toBe(302);
			expect(response.headers.get('Location')).toContain('/admin');
		});

		it('should handle KV.get error for owner ID gracefully', async () => {
			const mockKV = {
				get: vi.fn().mockRejectedValue(new Error('KV Error'))
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'test-token' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: 123456789,
						login: 'testuser',
						name: 'Test User',
						email: 'test@github.com',
						avatar_url: 'https://avatars.githubusercontent.com/u/123456789'
					})
			});

			const mockEvent = {
				url: new URL('http://localhost/api/auth/github/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						GITHUB_CLIENT_ID: 'client-id',
						GITHUB_CLIENT_SECRET: 'client-secret',
						KV: mockKV
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/github/callback/+server');

			// Should continue without throwing, user will not be owner
			const response = await GET(withDatabase(mockEvent) as any);
			expect(response.status).toBe(302);
			expect(response.headers.get('Location')).toContain('/');
		});

		it('should attach GitHub login to an existing account with the same email', async () => {
			const insertOAuthRun = vi.fn().mockResolvedValue({ success: true });
			const updateUserRun = vi.fn().mockResolvedValue({ success: true });

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'test-token' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: 123456789,
						login: 'githubuser',
						name: 'GitHub User',
						email: 'existing@example.com',
						avatar_url: 'https://avatars.githubusercontent.com/u/123456789'
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
							github_login: null,
							github_avatar_url: null,
							is_admin: 0
						};

						return {
							bind: vi.fn().mockReturnValue({
								first: vi.fn().mockResolvedValue(matchedUser),
								all: vi.fn().mockResolvedValue({ results: [matchedUser] })
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

					if (sql.includes('INSERT INTO oauth_accounts')) {
						return {
							bind: vi.fn((...values: unknown[]) => {
								expect(values[1]).toBe('existing-user-123');
								expect(values[2]).toBe('github');
								expect(values[3]).toBe('123456789');

								return {
									run: insertOAuthRun
								};
							})
						};
					}

					if (
						sql.includes(
							'UPDATE users SET github_login = ?, github_avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
						)
					) {
						return {
							bind: vi.fn((...values: unknown[]) => {
								expect(values[0]).toBe('githubuser');
								expect(values[2]).toBe('existing-user-123');

								return {
									run: updateUserRun
								};
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
				url: new URL('http://localhost/api/auth/github/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						GITHUB_CLIENT_ID: 'client-id',
						GITHUB_CLIENT_SECRET: 'client-secret',
						DB: mockDB
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/github/callback/+server');

			const response = await GET(withDatabase(mockEvent) as any);
			expect(response.status).toBe(302);
			expect(insertOAuthRun).toHaveBeenCalledTimes(1);
			expect(updateUserRun).toHaveBeenCalledTimes(1);
			expect(response.headers.get('Set-Cookie')).toContain('session=');
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
						id: 123456789,
						login: 'testuser',
						name: 'Test User',
						email: 'test@github.com',
						avatar_url: 'https://avatars.githubusercontent.com/u/123456789'
					})
			});

			const mockEvent = {
				url: new URL('http://localhost/api/auth/github/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue('invalid-base64!!!'), set: vi.fn() },
				platform: {
					env: {
						GITHUB_CLIENT_ID: 'client-id',
						GITHUB_CLIENT_SECRET: 'client-secret'
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/github/callback/+server');

			// Should not throw, treat as new login
			const response = await GET(withDatabase(mockEvent) as any);
			expect(response.status).toBe(302);
		});

		it('should link GitHub account to existing user', async () => {
			const { consumeOAuthTransaction, verifyOAuthTransaction } =
				await import('../../src/lib/utils/oauth-state');
			vi.mocked(verifyOAuthTransaction).mockResolvedValueOnce({
				provider: 'github',
				state: 'legacy-valid-state',
				intent: 'link',
				userId: 'existing-user-123',
				issuedAt: Date.now()
			});
			vi.mocked(consumeOAuthTransaction).mockResolvedValueOnce({
				provider: 'github',
				state: 'legacy-valid-state',
				intent: 'link',
				userId: 'existing-user-123',
				issuedAt: Date.now()
			});

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'test-token' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: 123456789,
						login: 'testuser',
						name: 'Test User',
						email: 'test@github.com',
						avatar_url: 'https://avatars.githubusercontent.com/u/123456789'
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
					if (sql.includes('UPDATE users SET github_login')) {
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
				url: new URL('http://localhost/api/auth/github/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				locals: {
					user: { id: 'existing-user-123', login: 'existinguser' }
				},
				platform: {
					env: {
						GITHUB_CLIENT_ID: 'client-id',
						GITHUB_CLIENT_SECRET: 'client-secret',
						DB: mockDB
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/github/callback/+server');

			const response = await GET(withDatabase(mockEvent) as any);
			expect(response.status).toBe(302);
			expect(response.headers.get('Location')).toContain('/profile?linked=github');
		});
	});

	describe('Existing linked account login', () => {
		it('should login as linked user when GitHub account is linked', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'test-token' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: 123456789,
						login: 'testuser',
						name: 'Test User',
						email: 'test@github.com',
						avatar_url: 'https://avatars.githubusercontent.com/u/123456789'
					})
			});

			const mockDB = {
				prepare: vi.fn().mockImplementation((sql: string) => {
					if (sql.includes('oauth_accounts WHERE provider = ?')) {
						return {
							bind: vi.fn().mockReturnValue({
								first: vi.fn().mockResolvedValue({ user_id: 'linked-user-456' })
							})
						};
					}
					if (sql.includes('SELECT id FROM users WHERE id')) {
						return {
							bind: vi.fn().mockReturnValue({
								first: vi.fn().mockResolvedValue({
									id: 'linked-user-456',
									email: 'linked@test.com',
									name: 'Linked User',
									github_login: 'linkeduser',
									github_avatar_url: 'https://avatars.githubusercontent.com/u/456',
									is_admin: 1
								})
							})
						};
					}
					return { bind: vi.fn().mockReturnValue({ first: vi.fn(), run: vi.fn() }) };
				})
			};

			const mockEvent = {
				url: new URL('http://localhost/api/auth/github/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						GITHUB_CLIENT_ID: 'client-id',
						GITHUB_CLIENT_SECRET: 'client-secret',
						DB: mockDB
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/github/callback/+server');

			const response = await GET(withDatabase(mockEvent) as any);
			expect(response.status).toBe(302);
			// Should redirect to /admin since user is admin
			expect(response.headers.get('Location')).toContain('/admin');
		});
	});

	describe('Existing user update', () => {
		it('should update existing user and create oauth_account if missing', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'test-token' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: 123456789,
						login: 'testuser',
						name: 'Updated Name',
						email: 'test@github.com',
						avatar_url: 'https://avatars.githubusercontent.com/u/123456789'
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
					if (sql.includes('SELECT id, is_admin FROM users')) {
						return {
							bind: vi.fn().mockReturnValue({
								first: vi.fn().mockResolvedValue({ id: '123456789', is_admin: 0 })
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
								first: vi.fn().mockResolvedValue(null) // No existing oauth_account
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
				url: new URL('http://localhost/api/auth/github/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						GITHUB_CLIENT_ID: 'client-id',
						GITHUB_CLIENT_SECRET: 'client-secret',
						DB: mockDB
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/github/callback/+server');

			const response = await GET(withDatabase(mockEvent) as any);
			expect(response.status).toBe(302);
		});
	});

	describe('New user creation', () => {
		it('should create new user and oauth_account', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'test-token' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: 123456789,
						login: 'newuser',
						name: 'New User',
						email: null, // No email - should use fallback
						avatar_url: 'https://avatars.githubusercontent.com/u/123456789'
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
					if (sql.includes('SELECT id, is_admin FROM users')) {
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
				url: new URL('http://localhost/api/auth/github/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						GITHUB_CLIENT_ID: 'client-id',
						GITHUB_CLIENT_SECRET: 'client-secret',
						DB: mockDB
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/github/callback/+server');

			const response = await GET(withDatabase(mockEvent) as any);
			expect(response.status).toBe(302);
		});
	});

	describe('First admin login tracking', () => {
		it('should set admin_first_login_completed in KV when owner first logs in', async () => {
			const mockKV = {
				get: vi.fn().mockImplementation((key: string) => {
					if (key === 'github_owner_id') {
						return '123456789';
					}
					if (key === 'admin_first_login_completed') {
						return null;
					}
					return null;
				}),
				put: vi.fn().mockResolvedValue(undefined)
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'test-token' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: 123456789,
						login: 'owner',
						name: 'Owner User',
						email: 'owner@github.com',
						avatar_url: 'https://avatars.githubusercontent.com/u/123456789'
					})
			});

			const mockEvent = {
				url: new URL('http://localhost/api/auth/github/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						GITHUB_CLIENT_ID: 'client-id',
						GITHUB_CLIENT_SECRET: 'client-secret',
						KV: mockKV
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/github/callback/+server');

			const response = await GET(withDatabase(mockEvent) as any);
			expect(response.status).toBe(302);
			expect(mockKV.put).toHaveBeenCalledWith('admin_first_login_completed', 'true');
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
						id: 123456789,
						login: 'testuser',
						name: 'Test User',
						email: 'test@github.com',
						avatar_url: 'https://avatars.githubusercontent.com/u/123456789'
					})
			});

			const mockEvent = {
				url: new URL('https://example.com/api/auth/github/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						GITHUB_CLIENT_ID: 'client-id',
						GITHUB_CLIENT_SECRET: 'client-secret'
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/github/callback/+server');

			const response = await GET(withDatabase(mockEvent) as any);
			const cookie = response.headers.get('Set-Cookie');
			expect(cookie).toContain('Secure');
		});
	});

	describe('Database error handling', () => {
		it('should fail closed if DB access fails', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ access_token: 'test-token' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: 123456789,
						login: 'testuser',
						name: 'Test User',
						email: 'test@github.com',
						avatar_url: 'https://avatars.githubusercontent.com/u/123456789'
					})
			});

			const mockDB = {
				prepare: vi.fn().mockImplementation(() => {
					throw new Error('DB connection failed');
				})
			};

			const mockEvent = {
				url: new URL('http://localhost/api/auth/github/callback?code=test-code'),
				cookies: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
				platform: {
					env: {
						GITHUB_CLIENT_ID: 'client-id',
						GITHUB_CLIENT_SECRET: 'client-secret',
						DB: mockDB
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/github/callback/+server');

			await expect(GET(withDatabase(mockEvent) as any)).rejects.toMatchObject({
				status: 302,
				location: '/auth/login?error=oauth_failed'
			});
		});
	});
});

function withDatabase<T extends { platform?: { env?: Record<string, unknown> } }>(event: T): T {
	return {
		...event,
		platform: {
			...event.platform,
			env: {
				...event.platform?.env,
				DB: callbackDatabase(
					(event.platform?.env?.DB as ReturnType<typeof database>) ?? database(),
					event.platform?.env
				)
			}
		}
	} as T;
}

function callbackDatabase(db: ReturnType<typeof database>, env?: Record<string, unknown>) {
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
						name: 'OAuth User',
						github_login:
							typeof env?.GITHUB_OWNER_ID === 'string' && Number.isNaN(Number(env.GITHUB_OWNER_ID))
								? env.GITHUB_OWNER_ID
								: 'testuser',
						github_avatar_url: null,
						is_admin: userId === 'linked-user-456' ? 1 : 0
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
