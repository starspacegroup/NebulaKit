import { beforeEach, describe, expect, it, vi } from 'vitest';

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
						get: vi.fn().mockResolvedValue(JSON.stringify(authConfig))
					}
				}
			};

			const { GET } = await import('../../src/routes/api/admin/auth-keys/+server');
			const response = await GET({
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
				platform: mockPlatform
			} as any);

			const result = await response.json();
			expect(result.keys).toEqual([]);
		});

		it('should return empty array when KV is not available', async () => {
			const { GET } = await import('../../src/routes/api/admin/auth-keys/+server');
			const response = await GET({
				platform: {}
			} as any);

			const result = await response.json();
			expect(result.keys).toEqual([]);
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
					platform: {}
				} as any)
			).rejects.toThrow();
		});
	});

	describe('PUT /api/admin/auth-keys/[id]', () => {
		it('should update an auth key', async () => {
			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockResolvedValue(null) // No setup key conflict
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
				platform: mockPlatform
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
						get: vi.fn().mockResolvedValue(null) // No setup key conflict
					}
				}
			};

			const { DELETE } = await import('../../src/routes/api/admin/auth-keys/[id]/+server');
			const response = await DELETE({
				params: { id: 'key-123' },
				platform: mockPlatform
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
					platform: mockPlatform
				} as any)
			).rejects.toThrow();
		});

		it('should allow deletion when no KV available', async () => {
			const { DELETE } = await import('../../src/routes/api/admin/auth-keys/[id]/+server');
			const response = await DELETE({
				params: { id: 'key-123' },
				platform: {}
			} as any);

			const result = await response.json();
			expect(result.success).toBe(true);
		});
	});
});
