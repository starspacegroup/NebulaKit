import { beforeEach, describe, expect, it, vi } from 'vitest';

// These endpoints are admin/owner-gated, so tests drive them as the owner.
// The unauthenticated and under-privileged cases are asserted separately.
const OWNER_LOCALS = {
	user: {
		id: '72961',
		login: 'davis9001',
		email: 'owner@example.com',
		isOwner: true,
		isAdmin: true
	}
};

/**
 * Tests for Auth Keys API Endpoints
 * TDD: Tests for auth key management
 */

describe('Auth Keys API', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	describe('GET /api/admin/auth-keys', () => {
		it('should return empty keys array when no config exists', async () => {
			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockResolvedValue(null)
					}
				}
			};

			const { GET } = await import('../../src/routes/api/admin/auth-keys/+server');
			const response = await GET({
				locals: OWNER_LOCALS,
				platform: mockPlatform
			} as any);

			const result = await response.json();
			expect(result.keys).toEqual([]);
		});

		it('should return GitHub OAuth key from KV', async () => {
			const authConfig = {
				id: 'auth-123',
				provider: 'github',
				clientId: 'client-123',
				createdAt: '2024-01-01T00:00:00Z'
			};

			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockImplementation((key: string) => {
							if (key === 'auth_config:github') {
								return Promise.resolve(JSON.stringify(authConfig));
							}
							return Promise.resolve(null);
						})
					}
				}
			};

			const { GET } = await import('../../src/routes/api/admin/auth-keys/+server');
			const response = await GET({
				locals: OWNER_LOCALS,
				platform: mockPlatform
			} as any);

			const result = await response.json();
			expect(result.keys).toHaveLength(1);
			expect(result.keys[0].id).toBe('auth-123');
			expect(result.keys[0].isSetupKey).toBe(true);
		});

		it('should handle KV parse errors gracefully', async () => {
			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockResolvedValue('invalid-json')
					}
				}
			};

			const { GET } = await import('../../src/routes/api/admin/auth-keys/+server');
			const response = await GET({
				locals: OWNER_LOCALS,
				platform: mockPlatform
			} as any);

			const result = await response.json();
			expect(result.keys).toEqual([]);
		});

		it('should return empty array when KV is not available', async () => {
			const { GET } = await import('../../src/routes/api/admin/auth-keys/+server');
			const response = await GET({
				locals: OWNER_LOCALS,
				platform: {}
			} as any);

			const result = await response.json();
			expect(result.keys).toEqual([]);
		});

		it('should return Discord OAuth key from KV', async () => {
			const discordConfig = {
				id: 'discord-123',
				provider: 'discord',
				clientId: 'discord-client-123',
				createdAt: '2024-01-02T00:00:00Z'
			};

			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockImplementation((key: string) => {
							if (key === 'auth_config:discord') {
								return Promise.resolve(JSON.stringify(discordConfig));
							}
							return Promise.resolve(null);
						})
					}
				}
			};

			const { GET } = await import('../../src/routes/api/admin/auth-keys/+server');
			const response = await GET({
				locals: OWNER_LOCALS,
				platform: mockPlatform
			} as any);

			const result = await response.json();
			expect(result.keys).toHaveLength(1);
			expect(result.keys[0].id).toBe('discord-123');
			expect(result.keys[0].name).toBe('Discord OAuth (Setup)');
			expect(result.keys[0].isSetupKey).toBe(true);
		});

		it('should return both GitHub and Discord OAuth keys from KV', async () => {
			const githubConfig = {
				id: 'github-123',
				provider: 'github',
				clientId: 'github-client-123',
				createdAt: '2024-01-01T00:00:00Z'
			};

			const discordConfig = {
				id: 'discord-123',
				provider: 'discord',
				clientId: 'discord-client-123',
				createdAt: '2024-01-02T00:00:00Z'
			};

			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockImplementation((key: string) => {
							if (key === 'auth_config:github') {
								return Promise.resolve(JSON.stringify(githubConfig));
							}
							if (key === 'auth_config:discord') {
								return Promise.resolve(JSON.stringify(discordConfig));
							}
							return Promise.resolve(null);
						})
					}
				}
			};

			const { GET } = await import('../../src/routes/api/admin/auth-keys/+server');
			const response = await GET({
				locals: OWNER_LOCALS,
				platform: mockPlatform
			} as any);

			const result = await response.json();
			expect(result.keys).toHaveLength(2);
			expect(result.keys[0].provider).toBe('github');
			expect(result.keys[1].provider).toBe('discord');
		});

		it('should handle Discord KV parse errors gracefully', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockImplementation((key: string) => {
							if (key === 'auth_config:discord') {
								return Promise.resolve('invalid-json-for-discord');
							}
							return Promise.resolve(null);
						})
					}
				}
			};

			const { GET } = await import('../../src/routes/api/admin/auth-keys/+server');
			const response = await GET({
				locals: OWNER_LOCALS,
				platform: mockPlatform
			} as any);

			const result = await response.json();
			expect(result.keys).toEqual([]);
			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		it('should handle KV.get errors gracefully and return empty keys', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockRejectedValue(new Error('KV failure'))
					}
				}
			};

			const { GET } = await import('../../src/routes/api/admin/auth-keys/+server');

			// The GET function catches KV errors internally and returns empty keys
			const response = await GET({
				locals: OWNER_LOCALS,
				platform: mockPlatform
			} as any);

			const result = await response.json();
			expect(result.keys).toEqual([]);
			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});
	});

	describe('POST /api/admin/auth-keys', () => {
		it('should create a new auth key', async () => {
			vi.stubGlobal('crypto', { randomUUID: () => 'new-key-123' });

			const { POST } = await import('../../src/routes/api/admin/auth-keys/+server');
			const response = await POST({
				request: {
					json: vi.fn().mockResolvedValue({
						name: 'Test Key',
						provider: 'github',
						type: 'oauth',
						clientId: 'client-123',
						clientSecret: 'secret-123'
					})
				},
				locals: OWNER_LOCALS,
				platform: {}
			} as any);

			const result = await response.json();
			expect(result.success).toBe(true);
			expect(result.key.id).toBe('new-key-123');
			expect(result.key.name).toBe('Test Key');
		});

		it('should return 400 when required fields are missing', async () => {
			const { POST } = await import('../../src/routes/api/admin/auth-keys/+server');

			await expect(
				POST({
					request: {
						json: vi.fn().mockResolvedValue({
							name: 'Test Key'
							// Missing clientId and clientSecret
						})
					},
					locals: OWNER_LOCALS,
					platform: {}
				} as any)
			).rejects.toThrow();
		});

		it('should save auth key to KV when provider is specified', async () => {
			vi.stubGlobal('crypto', { randomUUID: () => 'kv-key-123' });
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
			const mockPut = vi.fn().mockResolvedValue(undefined);

			const mockPlatform = {
				env: {
					KV: {
						put: mockPut
					}
				}
			};

			const { POST } = await import('../../src/routes/api/admin/auth-keys/+server');
			const response = await POST({
				request: {
					json: vi.fn().mockResolvedValue({
						name: 'GitHub OAuth Key',
						provider: 'github',
						type: 'oauth',
						clientId: 'client-123',
						clientSecret: 'secret-123'
					})
				},
				locals: OWNER_LOCALS,
				platform: mockPlatform
			} as any);

			const result = await response.json();
			expect(result.success).toBe(true);
			expect(mockPut).toHaveBeenCalledWith('auth_config:github', expect.any(String));

			consoleSpy.mockRestore();
		});

		it('should return 500 when POST fails unexpectedly', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const { POST } = await import('../../src/routes/api/admin/auth-keys/+server');

			try {
				await POST({
					request: {
						json: vi.fn().mockRejectedValue(new Error('Request parse failed'))
					},
					locals: OWNER_LOCALS,
					platform: {}
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}

			consoleSpy.mockRestore();
		});
	});

	describe('PUT /api/admin/auth-keys/[id]', () => {
		it('should update an auth key', async () => {
			const mockPlatform = {
				env: {
					KV: {
						get: vi
							.fn()
							.mockImplementation((key: string) =>
								Promise.resolve(
									key === 'auth_config:discord'
										? JSON.stringify({ id: 'key-123', provider: 'discord', clientId: 'old' })
										: null
								)
							),
						put: vi.fn().mockResolvedValue(undefined)
					}
				}
			};

			const { PUT } = await import('../../src/routes/api/admin/auth-keys/[id]/+server');
			const response = await PUT({
				params: { id: 'key-123' },
				request: {
					json: vi.fn().mockResolvedValue({
						name: 'Updated Key',
						provider: 'discord',
						type: 'oauth',
						clientId: 'client-456'
					})
				},
				locals: OWNER_LOCALS,
				platform: mockPlatform
			} as any);

			const result = await response.json();
			expect(result.success).toBe(true);
			expect(result.key.name).toBe('Updated Key');
			expect(mockPlatform.env.KV.put).toHaveBeenCalledWith(
				'auth_config:discord',
				expect.any(String)
			);
		});

		it('should return 404 for an id that matches no stored config', async () => {
			const mockPlatform = {
				env: {
					KV: { get: vi.fn().mockResolvedValue(null), put: vi.fn() }
				}
			};

			const { PUT } = await import('../../src/routes/api/admin/auth-keys/[id]/+server');

			await expect(
				PUT({
					params: { id: 'nope' },
					request: {
						json: vi.fn().mockResolvedValue({ name: 'X', provider: 'discord', clientId: 'c' })
					},
					locals: OWNER_LOCALS,
					platform: mockPlatform
				} as any)
			).rejects.toMatchObject({ status: 404 });
			expect(mockPlatform.env.KV.put).not.toHaveBeenCalled();
		});

		it('should not let a mismatched id smuggle a write onto the GitHub setup config', async () => {
			// The setup-key guard compares the path id against the stored GitHub
			// config. Trusting `provider` from the body meant an unrelated id
			// sailed past that check while the write still landed on GitHub.
			const mockPlatform = {
				env: {
					KV: {
						get: vi
							.fn()
							.mockImplementation((key: string) =>
								Promise.resolve(
									key === 'auth_config:github'
										? JSON.stringify({ id: 'setup-key-123', provider: 'github' })
										: null
								)
							),
						put: vi.fn().mockResolvedValue(undefined)
					}
				}
			};

			const { PUT } = await import('../../src/routes/api/admin/auth-keys/[id]/+server');

			await expect(
				PUT({
					params: { id: 'some-unrelated-id' },
					request: {
						json: vi.fn().mockResolvedValue({
							name: 'Hijack',
							provider: 'github',
							clientId: 'attacker-client',
							clientSecret: 'attacker-secret'
						})
					},
					locals: OWNER_LOCALS,
					platform: mockPlatform
				} as any)
			).rejects.toMatchObject({ status: 404 });

			expect(mockPlatform.env.KV.put).not.toHaveBeenCalled();
		});

		it('should prevent editing setup key', async () => {
			const setupKey = {
				id: 'setup-key-123',
				provider: 'github'
			};

			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockResolvedValue(JSON.stringify(setupKey))
					}
				}
			};

			const { PUT } = await import('../../src/routes/api/admin/auth-keys/[id]/+server');

			await expect(
				PUT({
					params: { id: 'setup-key-123' },
					request: {
						json: vi.fn().mockResolvedValue({
							name: 'Hacked',
							clientId: 'evil-client'
						})
					},
					locals: OWNER_LOCALS,
					platform: mockPlatform
				} as any)
			).rejects.toThrow();
		});

		it('should return 400 when required fields are missing', async () => {
			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockResolvedValue(null)
					}
				}
			};

			const { PUT } = await import('../../src/routes/api/admin/auth-keys/[id]/+server');

			await expect(
				PUT({
					params: { id: 'key-123' },
					request: {
						json: vi.fn().mockResolvedValue({
							// Missing name and clientId
						})
					},
					locals: OWNER_LOCALS,
					platform: mockPlatform
				} as any)
			).rejects.toThrow();
		});
	});

	describe('DELETE /api/admin/auth-keys/[id]', () => {
		it('should delete an auth key', async () => {
			const mockPlatform = {
				env: {
					KV: {
						get: vi
							.fn()
							.mockImplementation((key: string) =>
								Promise.resolve(
									key === 'auth_config:discord'
										? JSON.stringify({ id: 'key-123', provider: 'discord' })
										: null
								)
							),
						delete: vi.fn().mockResolvedValue(undefined)
					}
				}
			};

			const { DELETE } = await import('../../src/routes/api/admin/auth-keys/[id]/+server');
			const response = await DELETE({
				params: { id: 'key-123' },
				locals: OWNER_LOCALS,
				platform: mockPlatform
			} as any);

			const result = await response.json();
			expect(result.success).toBe(true);
			expect(mockPlatform.env.KV.delete).toHaveBeenCalledWith('auth_config:discord');
		});

		it('should prevent deleting setup key', async () => {
			const setupKey = {
				id: 'setup-key-123',
				provider: 'github'
			};

			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockResolvedValue(JSON.stringify(setupKey))
					}
				}
			};

			const { DELETE } = await import('../../src/routes/api/admin/auth-keys/[id]/+server');

			await expect(
				DELETE({
					params: { id: 'setup-key-123' },
					locals: OWNER_LOCALS,
					platform: mockPlatform
				} as any)
			).rejects.toThrow();
		});

		it('should refuse deletion when no KV available', async () => {
			// Previously this reported success without deleting anything, and the
			// setup-key guard was skipped on the way through.
			const { DELETE } = await import('../../src/routes/api/admin/auth-keys/[id]/+server');

			await expect(
				DELETE({
					params: { id: 'key-123' },
					locals: OWNER_LOCALS,
					platform: {}
				} as any)
			).rejects.toMatchObject({ status: 500 });
		});
	});

	describe('authorization', () => {
		const ANON = undefined;
		const PLAIN_USER = {
			user: { id: '1', login: 'someone', email: 's@example.com', isOwner: false, isAdmin: false }
		};

		it('rejects unauthenticated callers on every method', async () => {
			const { GET, POST } = await import('../../src/routes/api/admin/auth-keys/+server');
			const { PUT, DELETE } = await import('../../src/routes/api/admin/auth-keys/[id]/+server');

			const platform = { env: { KV: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } } };
			const request = { json: vi.fn().mockResolvedValue({}) };

			await expect(GET({ locals: ANON, platform } as any)).rejects.toMatchObject({ status: 401 });
			await expect(POST({ locals: ANON, platform, request } as any)).rejects.toMatchObject({
				status: 401
			});
			await expect(
				PUT({ locals: ANON, platform, request, params: { id: 'x' } } as any)
			).rejects.toMatchObject({ status: 401 });
			await expect(
				DELETE({ locals: ANON, platform, params: { id: 'x' } } as any)
			).rejects.toMatchObject({ status: 401 });

			expect(platform.env.KV.put).not.toHaveBeenCalled();
			expect(platform.env.KV.delete).not.toHaveBeenCalled();
		});

		it('rejects authenticated non-admins', async () => {
			const { GET, POST } = await import('../../src/routes/api/admin/auth-keys/+server');
			const platform = { env: { KV: { get: vi.fn(), put: vi.fn() } } };

			await expect(GET({ locals: PLAIN_USER, platform } as any)).rejects.toMatchObject({
				status: 403
			});
			await expect(
				POST({
					locals: PLAIN_USER,
					platform,
					request: {
						json: vi.fn().mockResolvedValue({
							name: 'n',
							clientId: 'c',
							clientSecret: 's',
							provider: 'github'
						})
					}
				} as any)
			).rejects.toMatchObject({ status: 403 });

			expect(platform.env.KV.put).not.toHaveBeenCalled();
		});

		it('rejects an unrecognised provider rather than writing an arbitrary KV key', async () => {
			const { POST } = await import('../../src/routes/api/admin/auth-keys/+server');
			const platform = { env: { KV: { get: vi.fn(), put: vi.fn() } } };

			await expect(
				POST({
					locals: OWNER_LOCALS,
					platform,
					request: {
						json: vi.fn().mockResolvedValue({
							name: 'n',
							clientId: 'c',
							clientSecret: 's',
							provider: 'reset_route_disabled'
						})
					}
				} as any)
			).rejects.toMatchObject({ status: 400 });

			expect(platform.env.KV.put).not.toHaveBeenCalled();
		});
	});
});
