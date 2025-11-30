import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for Setup API Endpoint
 * TDD: Tests for initial setup configuration
 */

describe('Setup API', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	describe('GET /api/setup', () => {
		it('should return hasConfig=false when KV not available', async () => {
			const { GET } = await import('../../src/routes/api/setup/+server');
			const response = await GET({
				platform: {}
			} as any);

			const result = await response.json();
			expect(result.hasConfig).toBe(false);
			expect(result.hasAdmin).toBe(false);
		});

		it('should return hasConfig=true when auth config exists', async () => {
			const mockPlatform = {
				env: {
					KV: {
						get: vi
							.fn()
							.mockResolvedValueOnce(JSON.stringify({ clientId: 'test' })) // auth_config:github
							.mockResolvedValueOnce('12345') // github_owner_id
							.mockResolvedValueOnce(null) // admin_first_login_completed
					}
				}
			};

			const { GET } = await import('../../src/routes/api/setup/+server');
			const response = await GET({
				platform: mockPlatform
			} as any);

			const result = await response.json();
			expect(result.hasConfig).toBe(true);
			expect(result.hasAdmin).toBe(true);
			expect(result.setupLocked).toBe(false);
		});

		it('should return setupLocked=true when admin has logged in', async () => {
			const mockPlatform = {
				env: {
					KV: {
						get: vi
							.fn()
							.mockResolvedValueOnce(JSON.stringify({ clientId: 'test' }))
							.mockResolvedValueOnce('12345')
							.mockResolvedValueOnce('true') // admin_first_login_completed
					}
				}
			};

			const { GET } = await import('../../src/routes/api/setup/+server');
			const response = await GET({
				platform: mockPlatform
			} as any);

			const result = await response.json();
			expect(result.setupLocked).toBe(true);
		});

		it('should handle KV errors gracefully', async () => {
			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockRejectedValue(new Error('KV Error'))
					}
				}
			};

			const { GET } = await import('../../src/routes/api/setup/+server');
			const response = await GET({
				platform: mockPlatform
			} as any);

			const result = await response.json();
			expect(result.hasConfig).toBe(false);
			expect(result.hasAdmin).toBe(false);
			expect(result.setupLocked).toBe(false);
		});
	});

	describe('POST /api/setup', () => {
		it('should return 403 when setup is locked', async () => {
			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockResolvedValue('true') // setup locked
					}
				}
			};

			const { POST } = await import('../../src/routes/api/setup/+server');

			await expect(
				POST({
					request: {
						json: vi.fn().mockResolvedValue({
							clientId: 'test',
							clientSecret: 'secret',
							adminGithubUsername: 'testuser'
						})
					},
					platform: mockPlatform
				} as any)
			).rejects.toThrow();
		});

		it('should return 400 when client credentials missing for new setup', async () => {
			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockResolvedValue(null) // Not locked, no existing config
					}
				}
			};

			const { POST } = await import('../../src/routes/api/setup/+server');

			await expect(
				POST({
					request: {
						json: vi.fn().mockResolvedValue({
							adminGithubUsername: 'testuser'
							// Missing clientId and clientSecret
						})
					},
					platform: mockPlatform
				} as any)
			).rejects.toThrow();
		});

		it('should return 400 when admin username is missing', async () => {
			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockResolvedValue(null)
					}
				}
			};

			const { POST } = await import('../../src/routes/api/setup/+server');

			await expect(
				POST({
					request: {
						json: vi.fn().mockResolvedValue({
							clientId: 'test',
							clientSecret: 'secret'
							// Missing adminGithubUsername
						})
					},
					platform: mockPlatform
				} as any)
			).rejects.toThrow();
		});

		it('should return 400 for invalid GitHub username format', async () => {
			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockResolvedValue(null)
					}
				}
			};

			const { POST } = await import('../../src/routes/api/setup/+server');

			await expect(
				POST({
					request: {
						json: vi.fn().mockResolvedValue({
							clientId: 'test',
							clientSecret: 'secret',
							adminGithubUsername: 'invalid--username-'
						})
					},
					platform: mockPlatform
				} as any)
			).rejects.toThrow();
		});

		it('should save config when valid data provided', async () => {
			const mockPut = vi.fn().mockResolvedValue(undefined);
			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockResolvedValue(null),
						put: mockPut
					}
				}
			};

			// Mock fetch for GitHub API
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue({
					id: 12345,
					login: 'testuser'
				})
			});

			vi.stubGlobal('crypto', { randomUUID: () => 'config-uuid' });

			const { POST } = await import('../../src/routes/api/setup/+server');
			const response = await POST({
				request: {
					json: vi.fn().mockResolvedValue({
						clientId: 'test-client',
						clientSecret: 'test-secret',
						adminGithubUsername: 'testuser'
					})
				},
				platform: mockPlatform
			} as any);

			const result = await response.json();
			expect(result.success).toBe(true);
			expect(result.adminUsername).toBe('testuser');
			expect(mockPut).toHaveBeenCalledWith('auth_config:github', expect.any(String));
			expect(mockPut).toHaveBeenCalledWith('github_owner_id', '12345');
		});

		it('should handle GitHub API 404 error', async () => {
			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockResolvedValue(null)
					}
				}
			};

			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 404
			});

			const { POST } = await import('../../src/routes/api/setup/+server');

			await expect(
				POST({
					request: {
						json: vi.fn().mockResolvedValue({
							clientId: 'test',
							clientSecret: 'secret',
							adminGithubUsername: 'nonexistent-user-12345'
						})
					},
					platform: mockPlatform
				} as any)
			).rejects.toThrow();
		});

		it('should work without KV (development mode)', async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue({
					id: 12345,
					login: 'testuser'
				})
			});

			const { POST } = await import('../../src/routes/api/setup/+server');
			const response = await POST({
				request: {
					json: vi.fn().mockResolvedValue({
						clientId: 'test-client',
						clientSecret: 'test-secret',
						adminGithubUsername: 'testuser'
					})
				},
				platform: {}
			} as any);

			const result = await response.json();
			expect(result.success).toBe(true);
			expect(result.message).toContain('KV');
		});

		it('should allow updating admin without credentials when config exists', async () => {
			const existingConfig = {
				id: 'existing-id',
				clientId: 'existing-client',
				clientSecret: 'existing-secret',
				createdAt: '2024-01-01'
			};

			const mockPut = vi.fn().mockResolvedValue(undefined);
			const mockPlatform = {
				env: {
					KV: {
						get: vi
							.fn()
							.mockResolvedValueOnce(null) // setup not locked
							.mockResolvedValueOnce(JSON.stringify(existingConfig)), // existing config
						put: mockPut
					}
				}
			};

			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue({
					id: 67890,
					login: 'newadmin'
				})
			});

			const { POST } = await import('../../src/routes/api/setup/+server');
			const response = await POST({
				request: {
					json: vi.fn().mockResolvedValue({
						adminGithubUsername: 'newadmin'
						// No clientId/clientSecret - using existing
					})
				},
				platform: mockPlatform
			} as any);

			const result = await response.json();
			expect(result.success).toBe(true);
			expect(result.adminUsername).toBe('newadmin');
		});
	});
});
