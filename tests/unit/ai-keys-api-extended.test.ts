import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for AI Keys API Endpoints
 * TDD: Tests for AI provider key management
 */

describe('AI Keys API', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	describe('GET /api/admin/ai-keys', () => {
		it('should return 403 when user is not owner', async () => {
			const { GET } = await import('../../src/routes/api/admin/ai-keys/+server');

			await expect(
				GET({
					platform: {},
					locals: { user: { id: '1', isOwner: false } }
				} as any)
			).rejects.toThrow();
		});

		it('should return 403 when user is null', async () => {
			const { GET } = await import('../../src/routes/api/admin/ai-keys/+server');

			await expect(
				GET({
					platform: {},
					locals: {}
				} as any)
			).rejects.toThrow();
		});

		it('should return empty array when KV is not available', async () => {
			const { GET } = await import('../../src/routes/api/admin/ai-keys/+server');

			const response = await GET({
				platform: { env: {} },
				locals: { user: { id: '1', isOwner: true } }
			} as any);

			const result = await response.json();
			expect(result.keys).toEqual([]);
		});

		it('should return empty array when no keys list exists', async () => {
			const mockKV = {
				get: vi.fn().mockResolvedValue(null)
			};

			const { GET } = await import('../../src/routes/api/admin/ai-keys/+server');

			const response = await GET({
				platform: { env: { KV: mockKV } },
				locals: { user: { id: '1', isOwner: true } }
			} as any);

			const result = await response.json();
			expect(result.keys).toEqual([]);
		});

		it('should return all keys without apiKey field', async () => {
			const mockKV = {
				get: vi
					.fn()
					.mockResolvedValueOnce(JSON.stringify(['key1', 'key2']))
					.mockResolvedValueOnce(JSON.stringify({ id: 'key1', name: 'Key 1', apiKey: 'secret1' }))
					.mockResolvedValueOnce(JSON.stringify({ id: 'key2', name: 'Key 2', apiKey: 'secret2' }))
			};

			const { GET } = await import('../../src/routes/api/admin/ai-keys/+server');

			const response = await GET({
				platform: { env: { KV: mockKV } },
				locals: { user: { id: '1', isOwner: true } }
			} as any);

			const result = await response.json();
			expect(result.keys).toHaveLength(2);
			expect(result.keys[0].apiKey).toBeUndefined();
			expect(result.keys[1].apiKey).toBeUndefined();
		});

		it('should skip keys that no longer exist', async () => {
			const mockKV = {
				get: vi
					.fn()
					.mockResolvedValueOnce(JSON.stringify(['key1', 'deleted-key']))
					.mockResolvedValueOnce(JSON.stringify({ id: 'key1', name: 'Key 1' }))
					.mockResolvedValueOnce(null) // Deleted key
			};

			const { GET } = await import('../../src/routes/api/admin/ai-keys/+server');

			const response = await GET({
				platform: { env: { KV: mockKV } },
				locals: { user: { id: '1', isOwner: true } }
			} as any);

			const result = await response.json();
			expect(result.keys).toHaveLength(1);
		});
	});

	describe('POST /api/admin/ai-keys', () => {
		it('should return 403 when user is not owner', async () => {
			const { POST } = await import('../../src/routes/api/admin/ai-keys/+server');

			await expect(
				POST({
					request: { json: vi.fn().mockResolvedValue({}) },
					platform: {},
					locals: { user: { id: '1', isOwner: false } }
				} as any)
			).rejects.toThrow();
		});

		it('should return 400 when required fields are missing', async () => {
			const { POST } = await import('../../src/routes/api/admin/ai-keys/+server');

			await expect(
				POST({
					request: { json: vi.fn().mockResolvedValue({ name: 'Test' }) },
					platform: { env: { KV: {} } },
					locals: { user: { id: '1', isOwner: true } }
				} as any)
			).rejects.toThrow();
		});

		it('should return 500 when KV is not available', async () => {
			const { POST } = await import('../../src/routes/api/admin/ai-keys/+server');

			await expect(
				POST({
					request: { json: vi.fn().mockResolvedValue({ name: 'Test', apiKey: 'key123' }) },
					platform: { env: {} },
					locals: { user: { id: '1', isOwner: true } }
				} as any)
			).rejects.toThrow();
		});

		it('should create a new AI key', async () => {
			const mockPut = vi.fn().mockResolvedValue(undefined);
			const mockKV = {
				get: vi.fn().mockResolvedValue(null),
				put: mockPut
			};

			vi.stubGlobal('crypto', { randomUUID: () => 'new-key-id' });

			const { POST } = await import('../../src/routes/api/admin/ai-keys/+server');

			const response = await POST({
				request: {
					json: vi.fn().mockResolvedValue({
						name: 'OpenAI Key',
						provider: 'openai',
						model: 'gpt-4',
						apiKey: 'sk-secret',
						enabled: true
					})
				},
				platform: { env: { KV: mockKV } },
				locals: { user: { id: '1', isOwner: true } }
			} as any);

			const result = await response.json();
			expect(result.success).toBe(true);
			expect(result.key.name).toBe('OpenAI Key');
			expect(result.key.apiKey).toBeUndefined(); // Should not include apiKey
			expect(mockPut).toHaveBeenCalledWith('ai_key:new-key-id', expect.any(String));
		});

		it('should default enabled to true when not provided', async () => {
			const mockPut = vi.fn().mockResolvedValue(undefined);
			const mockKV = {
				get: vi.fn().mockResolvedValue(null),
				put: mockPut
			};

			vi.stubGlobal('crypto', { randomUUID: () => 'new-key-id' });

			const { POST } = await import('../../src/routes/api/admin/ai-keys/+server');

			const response = await POST({
				request: {
					json: vi.fn().mockResolvedValue({
						name: 'Test Key',
						apiKey: 'key123'
					})
				},
				platform: { env: { KV: mockKV } },
				locals: { user: { id: '1', isOwner: true } }
			} as any);

			const result = await response.json();
			expect(result.key.enabled).toBe(true);
		});
	});

	describe('PUT /api/admin/ai-keys/[id]', () => {
		it('should return 403 when user is not owner', async () => {
			const { PUT } = await import('../../src/routes/api/admin/ai-keys/[id]/+server');

			await expect(
				PUT({
					params: { id: 'key1' },
					request: { json: vi.fn().mockResolvedValue({}) },
					platform: {},
					locals: { user: { id: '1', isOwner: false } }
				} as any)
			).rejects.toThrow();
		});

		it('should return 400 when name is missing', async () => {
			const { PUT } = await import('../../src/routes/api/admin/ai-keys/[id]/+server');

			await expect(
				PUT({
					params: { id: 'key1' },
					request: { json: vi.fn().mockResolvedValue({}) },
					platform: { env: { KV: {} } },
					locals: { user: { id: '1', isOwner: true } }
				} as any)
			).rejects.toThrow();
		});

		it('should return 500 when KV is not available', async () => {
			const { PUT } = await import('../../src/routes/api/admin/ai-keys/[id]/+server');

			await expect(
				PUT({
					params: { id: 'key1' },
					request: { json: vi.fn().mockResolvedValue({ name: 'Test' }) },
					platform: { env: {} },
					locals: { user: { id: '1', isOwner: true } }
				} as any)
			).rejects.toThrow();
		});

		it('should return 404 when key not found', async () => {
			const mockKV = {
				get: vi.fn().mockResolvedValue(null)
			};

			const { PUT } = await import('../../src/routes/api/admin/ai-keys/[id]/+server');

			await expect(
				PUT({
					params: { id: 'nonexistent' },
					request: { json: vi.fn().mockResolvedValue({ name: 'Test' }) },
					platform: { env: { KV: mockKV } },
					locals: { user: { id: '1', isOwner: true } }
				} as any)
			).rejects.toThrow();
		});

		it('should update an existing key', async () => {
			const mockPut = vi.fn().mockResolvedValue(undefined);
			const mockKV = {
				get: vi.fn().mockResolvedValue(
					JSON.stringify({
						id: 'key1',
						name: 'Old Name',
						apiKey: 'old-secret'
					})
				),
				put: mockPut
			};

			const { PUT } = await import('../../src/routes/api/admin/ai-keys/[id]/+server');

			const response = await PUT({
				params: { id: 'key1' },
				request: {
					json: vi.fn().mockResolvedValue({
						name: 'New Name',
						provider: 'openai',
						model: 'gpt-4o'
					})
				},
				platform: { env: { KV: mockKV } },
				locals: { user: { id: '1', isOwner: true } }
			} as any);

			const result = await response.json();
			expect(result.success).toBe(true);
			expect(result.key.name).toBe('New Name');
			expect(result.key.apiKey).toBeUndefined();
		});

		it('should update apiKey when provided', async () => {
			const mockPut = vi.fn().mockResolvedValue(undefined);
			const mockKV = {
				get: vi.fn().mockResolvedValue(
					JSON.stringify({
						id: 'key1',
						name: 'Test Key',
						apiKey: 'old-secret'
					})
				),
				put: mockPut
			};

			const { PUT } = await import('../../src/routes/api/admin/ai-keys/[id]/+server');

			await PUT({
				params: { id: 'key1' },
				request: {
					json: vi.fn().mockResolvedValue({
						name: 'Test Key',
						apiKey: 'new-secret'
					})
				},
				platform: { env: { KV: mockKV } },
				locals: { user: { id: '1', isOwner: true } }
			} as any);

			// Verify the stored key has the new apiKey
			const storedData = JSON.parse(mockPut.mock.calls[0][1]);
			expect(storedData.apiKey).toBe('new-secret');
		});
	});

	describe('DELETE /api/admin/ai-keys/[id]', () => {
		it('should return 403 when user is not owner', async () => {
			const { DELETE } = await import('../../src/routes/api/admin/ai-keys/[id]/+server');

			await expect(
				DELETE({
					params: { id: 'key1' },
					platform: {},
					locals: { user: { id: '1', isOwner: false } }
				} as any)
			).rejects.toThrow();
		});

		it('should return 500 when KV is not available', async () => {
			const { DELETE } = await import('../../src/routes/api/admin/ai-keys/[id]/+server');

			await expect(
				DELETE({
					params: { id: 'key1' },
					platform: { env: {} },
					locals: { user: { id: '1', isOwner: true } }
				} as any)
			).rejects.toThrow();
		});

		it('should delete key and update list', async () => {
			const mockDelete = vi.fn().mockResolvedValue(undefined);
			const mockPut = vi.fn().mockResolvedValue(undefined);
			const mockKV = {
				get: vi.fn().mockResolvedValue(JSON.stringify(['key1', 'key2'])),
				delete: mockDelete,
				put: mockPut
			};

			const { DELETE } = await import('../../src/routes/api/admin/ai-keys/[id]/+server');

			const response = await DELETE({
				params: { id: 'key1' },
				platform: { env: { KV: mockKV } },
				locals: { user: { id: '1', isOwner: true } }
			} as any);

			const result = await response.json();
			expect(result.success).toBe(true);
			expect(mockDelete).toHaveBeenCalledWith('ai_key:key1');

			// Verify list was updated without key1
			const updatedList = JSON.parse(mockPut.mock.calls[0][1]);
			expect(updatedList).toEqual(['key2']);
		});

		it('should handle deletion when no keys list exists', async () => {
			const mockDelete = vi.fn().mockResolvedValue(undefined);
			const mockKV = {
				get: vi.fn().mockResolvedValue(null),
				delete: mockDelete
			};

			const { DELETE } = await import('../../src/routes/api/admin/ai-keys/[id]/+server');

			const response = await DELETE({
				params: { id: 'key1' },
				platform: { env: { KV: mockKV } },
				locals: { user: { id: '1', isOwner: true } }
			} as any);

			const result = await response.json();
			expect(result.success).toBe(true);
		});
	});

	describe('PATCH /api/admin/ai-keys/[id]', () => {
		it('should return 403 when user is not owner', async () => {
			const { PATCH } = await import('../../src/routes/api/admin/ai-keys/[id]/+server');

			await expect(
				PATCH({
					params: { id: 'key1' },
					request: { json: vi.fn().mockResolvedValue({}) },
					platform: {},
					locals: { user: { id: '1', isOwner: false } }
				} as any)
			).rejects.toThrow();
		});

		it('should return 500 when KV is not available', async () => {
			const { PATCH } = await import('../../src/routes/api/admin/ai-keys/[id]/+server');

			await expect(
				PATCH({
					params: { id: 'key1' },
					request: { json: vi.fn().mockResolvedValue({ enabled: true }) },
					platform: { env: {} },
					locals: { user: { id: '1', isOwner: true } }
				} as any)
			).rejects.toThrow();
		});

		it('should return 404 when key not found', async () => {
			const mockKV = {
				get: vi.fn().mockResolvedValue(null)
			};

			const { PATCH } = await import('../../src/routes/api/admin/ai-keys/[id]/+server');

			await expect(
				PATCH({
					params: { id: 'nonexistent' },
					request: { json: vi.fn().mockResolvedValue({ enabled: true }) },
					platform: { env: { KV: mockKV } },
					locals: { user: { id: '1', isOwner: true } }
				} as any)
			).rejects.toThrow();
		});

		it('should toggle enabled status', async () => {
			const mockPut = vi.fn().mockResolvedValue(undefined);
			const mockKV = {
				get: vi.fn().mockResolvedValue(
					JSON.stringify({
						id: 'key1',
						name: 'Test Key',
						enabled: true
					})
				),
				put: mockPut
			};

			const { PATCH } = await import('../../src/routes/api/admin/ai-keys/[id]/+server');

			const response = await PATCH({
				params: { id: 'key1' },
				request: { json: vi.fn().mockResolvedValue({ enabled: false }) },
				platform: { env: { KV: mockKV } },
				locals: { user: { id: '1', isOwner: true } }
			} as any);

			const result = await response.json();
			expect(result.success).toBe(true);
			expect(result.key.enabled).toBe(false);
		});
	});
});
