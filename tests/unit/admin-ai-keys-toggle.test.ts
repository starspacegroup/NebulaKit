import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock SvelteKit modules
const mockJson = vi.fn((data) => ({ data, status: 200 }));
const mockError = vi.fn((status, message) => {
	const err = new Error(message) as any;
	err.status = status;
	throw err;
});

vi.mock('@sveltejs/kit', () => ({
	json: mockJson,
	error: mockError
}));

describe('AI Keys Toggle API', () => {
	let mockKV: any;
	let mockPlatform: any;
	let mockLocals: any;

	beforeEach(() => {
		vi.clearAllMocks();

		mockKV = {
			get: vi.fn(),
			put: vi.fn(),
			delete: vi.fn()
		};

		mockPlatform = {
			env: {
				KV: mockKV
			}
		};

		mockLocals = {
			user: {
				id: '1',
				isOwner: true
			}
		};
	});

	describe('PATCH /api/admin/ai-keys/[id]/toggle', () => {
		it('should toggle enabled status to false', async () => {
			const existingKey = {
				id: 'key-1',
				name: 'OpenAI',
				provider: 'openai',
				apiKey: 'sk-test',
				enabled: true,
				createdAt: '2024-01-01'
			};

			mockKV.get.mockResolvedValue(JSON.stringify(existingKey));

			const { PATCH } = await import('../../src/routes/api/admin/ai-keys/[id]/toggle/+server.js');

			const request = {
				json: async () => ({ enabled: false })
			};

			const params = { id: 'key-1' };

			const result = await PATCH({
				params,
				request,
				platform: mockPlatform,
				locals: mockLocals
			} as any);

			expect(mockKV.get).toHaveBeenCalledWith('ai_key:key-1');
			expect(mockKV.put).toHaveBeenCalled();

			const putCall = mockKV.put.mock.calls[0];
			expect(putCall[0]).toBe('ai_key:key-1');

			const updatedKey = JSON.parse(putCall[1]);
			expect(updatedKey.enabled).toBe(false);
			expect(updatedKey.name).toBe('OpenAI');
			expect(updatedKey.provider).toBe('openai');

			expect(mockJson).toHaveBeenCalledWith(
				expect.objectContaining({
					success: true,
					key: expect.objectContaining({
						enabled: false
					})
				})
			);
		});

		it('should toggle enabled status to true', async () => {
			const existingKey = {
				id: 'key-1',
				name: 'OpenAI',
				provider: 'openai',
				apiKey: 'sk-test',
				enabled: false,
				createdAt: '2024-01-01'
			};

			mockKV.get.mockResolvedValue(JSON.stringify(existingKey));

			const { PATCH } = await import('../../src/routes/api/admin/ai-keys/[id]/toggle/+server.js');

			const request = {
				json: async () => ({ enabled: true })
			};

			const params = { id: 'key-1' };

			await PATCH({
				params,
				request,
				platform: mockPlatform,
				locals: mockLocals
			} as any);

			const putCall = mockKV.put.mock.calls[0];
			const updatedKey = JSON.parse(putCall[1]);
			expect(updatedKey.enabled).toBe(true);
		});

		it('should not expose API key in response', async () => {
			const existingKey = {
				id: 'key-1',
				name: 'OpenAI',
				provider: 'openai',
				apiKey: 'sk-secret-key',
				enabled: true,
				createdAt: '2024-01-01'
			};

			mockKV.get.mockResolvedValue(JSON.stringify(existingKey));

			const { PATCH } = await import('../../src/routes/api/admin/ai-keys/[id]/toggle/+server.js');

			const request = {
				json: async () => ({ enabled: false })
			};

			const params = { id: 'key-1' };

			await PATCH({
				params,
				request,
				platform: mockPlatform,
				locals: mockLocals
			} as any);

			expect(mockJson).toHaveBeenCalledWith(
				expect.objectContaining({
					key: expect.not.objectContaining({
						apiKey: expect.anything()
					})
				})
			);
		});

		it('should require admin access', async () => {
			const nonAdminLocals = {
				user: {
					id: '2',
					isOwner: false
				}
			};

			const { PATCH } = await import('../../src/routes/api/admin/ai-keys/[id]/toggle/+server.js');

			const request = {
				json: async () => ({ enabled: false })
			};

			const params = { id: 'key-1' };

			await expect(
				PATCH({
					params,
					request,
					platform: mockPlatform,
					locals: nonAdminLocals
				} as any)
			).rejects.toThrow();

			expect(mockError).toHaveBeenCalledWith(403, 'Admin access required');
		});

		it('should return 404 if key not found', async () => {
			mockKV.get.mockResolvedValue(null);

			const { PATCH } = await import('../../src/routes/api/admin/ai-keys/[id]/toggle/+server.js');

			const request = {
				json: async () => ({ enabled: false })
			};

			const params = { id: 'non-existent' };

			await expect(
				PATCH({
					params,
					request,
					platform: mockPlatform,
					locals: mockLocals
				} as any)
			).rejects.toThrow();

			expect(mockError).toHaveBeenCalledWith(404, 'Key not found');
		});

		it('should return 500 if KV not available', async () => {
			const platformWithoutKV = {
				env: {}
			};

			const { PATCH } = await import('../../src/routes/api/admin/ai-keys/[id]/toggle/+server.js');

			const request = {
				json: async () => ({ enabled: false })
			};

			const params = { id: 'key-1' };

			await expect(
				PATCH({
					params,
					request,
					platform: platformWithoutKV,
					locals: mockLocals
				} as any)
			).rejects.toThrow();

			expect(mockError).toHaveBeenCalledWith(500, 'KV storage not available');
		});

		it('should update timestamp when toggling', async () => {
			const existingKey = {
				id: 'key-1',
				name: 'OpenAI',
				provider: 'openai',
				apiKey: 'sk-test',
				enabled: true,
				createdAt: '2024-01-01'
			};

			mockKV.get.mockResolvedValue(JSON.stringify(existingKey));

			const { PATCH } = await import('../../src/routes/api/admin/ai-keys/[id]/toggle/+server.js');

			const request = {
				json: async () => ({ enabled: false })
			};

			const params = { id: 'key-1' };

			await PATCH({
				params,
				request,
				platform: mockPlatform,
				locals: mockLocals
			} as any);

			const putCall = mockKV.put.mock.calls[0];
			const updatedKey = JSON.parse(putCall[1]);
			expect(updatedKey.updatedAt).toBeDefined();
		});
	});
});

