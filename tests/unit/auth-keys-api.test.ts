import { beforeEach, describe, expect, it, vi } from 'vitest';

const ownerLocals = { user: { id: 'owner-1', isOwner: true, isAdmin: true } };

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
				platform: mockPlatform,
				locals: ownerLocals
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
				platform: mockPlatform,
				locals: ownerLocals
			} as any);

			const result = await response.json();
			expect(result.keys).toHaveLength(1);
			expect(result.keys[0].id).toBe('auth-123');
			expect(result.keys[0].isSetupKey).toBe(true);
		});

		it('should fail closed on malformed KV configuration', async () => {
			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockResolvedValue('invalid-json')
					}
				}
			};

			const { GET } = await import('../../src/routes/api/admin/auth-keys/+server');
			await expect(
				GET({ platform: mockPlatform, locals: ownerLocals } as any)
			).rejects.toMatchObject({ status: 500 });
		});

		it('should fail closed when KV is not available', async () => {
			const { GET } = await import('../../src/routes/api/admin/auth-keys/+server');
			await expect(GET({ platform: {}, locals: ownerLocals } as any)).rejects.toMatchObject({
				status: 500
			});
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
				platform: mockPlatform,
				locals: ownerLocals
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
				platform: mockPlatform,
				locals: ownerLocals
			} as any);

			const result = await response.json();
			expect(result.keys).toHaveLength(2);
			expect(result.keys[0].provider).toBe('github');
			expect(result.keys[1].provider).toBe('discord');
		});

		it('should fail closed on malformed Discord configuration', async () => {
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
			await expect(
				GET({ platform: mockPlatform, locals: ownerLocals } as any)
			).rejects.toMatchObject({ status: 500 });
			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		it('should fail closed when KV reads fail', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockRejectedValue(new Error('KV failure'))
					}
				}
			};

			const { GET } = await import('../../src/routes/api/admin/auth-keys/+server');

			await expect(
				GET({ platform: mockPlatform, locals: ownerLocals } as any)
			).rejects.toMatchObject({ status: 500 });
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
				platform: { env: { KV: { put: vi.fn().mockResolvedValue(undefined) } } },
				locals: ownerLocals
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
					platform: {},
					locals: ownerLocals
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
				platform: mockPlatform,
				locals: ownerLocals
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
					platform: {},
					locals: ownerLocals
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
			const stored = JSON.stringify({
				id: 'key-123',
				provider: 'discord',
				clientId: 'old-client'
			});
			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn((key: string) =>
							Promise.resolve(key === 'auth_config:discord' ? stored : null)
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
						provider: 'github',
						type: 'oauth',
						clientId: 'client-456'
					})
				},
				platform: mockPlatform,
				locals: ownerLocals
			} as any);

			const result = await response.json();
			expect(result.success).toBe(true);
			expect(result.key.name).toBe('Updated Key');
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
					platform: mockPlatform,
					locals: ownerLocals
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
					platform: mockPlatform,
					locals: ownerLocals
				} as any)
			).rejects.toThrow();
		});
	});

	describe('DELETE /api/admin/auth-keys/[id]', () => {
		it('should delete an auth key', async () => {
			const stored = JSON.stringify({ id: 'key-123', provider: 'discord' });
			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn((key: string) =>
							Promise.resolve(key === 'auth_config:discord' ? stored : null)
						),
						delete: vi.fn().mockResolvedValue(undefined)
					}
				}
			};

			const { DELETE } = await import('../../src/routes/api/admin/auth-keys/[id]/+server');
			const response = await DELETE({
				params: { id: 'key-123' },
				platform: mockPlatform,
				locals: ownerLocals
			} as any);

			const result = await response.json();
			expect(result.success).toBe(true);
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
					platform: mockPlatform,
					locals: ownerLocals
				} as any)
			).rejects.toThrow();
		});

		it('should fail closed when deletion storage is unavailable', async () => {
			const { DELETE } = await import('../../src/routes/api/admin/auth-keys/[id]/+server');
			await expect(
				DELETE({ params: { id: 'key-123' }, platform: {}, locals: ownerLocals } as any)
			).rejects.toMatchObject({ status: 500 });
		});
	});
});
