import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('OpenAI Models API', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('GET /api/admin/ai-keys/models', () => {
		it('should return 403 when user is not admin', async () => {
			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn()
					}
				}
			};

			const mockLocals = {
				user: { isOwner: false }
			};

			const { GET } = await import('../../src/routes/api/admin/ai-keys/models/+server.js');

			await expect(
				GET({
					platform: mockPlatform,
					locals: mockLocals,
					url: new URL('http://localhost/api/admin/ai-keys/models')
				} as any)
			).rejects.toMatchObject({
				status: 403
			});
		});

		it('should return static model list when no API key available', async () => {
			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockResolvedValue(null)
					}
				}
			};

			const mockLocals = {
				user: { isOwner: true }
			};

			const { GET } = await import('../../src/routes/api/admin/ai-keys/models/+server.js');

			const response = await GET({
				platform: mockPlatform,
				locals: mockLocals,
				url: new URL('http://localhost/api/admin/ai-keys/models')
			} as any);

			expect(response.status).toBe(200);
			const data = await response.json();

			expect(data.chatModels).toBeDefined();
			expect(data.voiceModels).toBeDefined();
			expect(data.fromApi).toBe(false);

			// Should have known models with pricing
			expect(data.chatModels.length).toBeGreaterThan(0);
			expect(data.voiceModels.length).toBeGreaterThan(0);

			// Verify pricing is included
			const gpt4o = data.chatModels.find((m: any) => m.id === 'gpt-4o');
			expect(gpt4o).toBeDefined();
			expect(gpt4o.pricing).toBeDefined();
			expect(gpt4o.pricing.input).toBeGreaterThan(0);
			expect(gpt4o.pricing.output).toBeGreaterThan(0);
		});

		it('should fetch models from OpenAI API when key is available', async () => {
			const mockOpenAIKey = {
				id: 'key-1',
				provider: 'openai',
				apiKey: 'sk-test-key',
				enabled: true
			};

			const mockPlatform = {
				env: {
					KV: {
						get: vi
							.fn()
							.mockResolvedValueOnce(JSON.stringify(['key-1']))
							.mockResolvedValueOnce(JSON.stringify(mockOpenAIKey))
					}
				}
			};

			const mockLocals = {
				user: { isOwner: true }
			};

			// Mock OpenAI API response
			(globalThis.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					object: 'list',
					data: [
						{ id: 'gpt-4o', object: 'model', created: 1234567890, owned_by: 'openai' },
						{ id: 'gpt-4o-mini', object: 'model', created: 1234567890, owned_by: 'openai' },
						{
							id: 'gpt-4o-realtime-preview-2024-12-17',
							object: 'model',
							created: 1234567890,
							owned_by: 'openai'
						},
						{
							id: 'text-embedding-ada-002',
							object: 'model',
							created: 1234567890,
							owned_by: 'openai'
						} // Should be filtered out
					]
				})
			});

			const { GET } = await import('../../src/routes/api/admin/ai-keys/models/+server.js');

			const response = await GET({
				platform: mockPlatform,
				locals: mockLocals,
				url: new URL('http://localhost/api/admin/ai-keys/models')
			} as any);

			expect(response.status).toBe(200);
			const data = await response.json();

			expect(data.fromApi).toBe(true);
			expect(data.chatModels).toBeDefined();
			expect(data.voiceModels).toBeDefined();

			// Chat models should include gpt-4o but not embedding models
			const chatModelIds = data.chatModels.map((m: any) => m.id);
			expect(chatModelIds).toContain('gpt-4o');
			expect(chatModelIds).toContain('gpt-4o-mini');
			expect(chatModelIds).not.toContain('text-embedding-ada-002');

			// Voice models should include realtime models
			const voiceModelIds = data.voiceModels.map((m: any) => m.id);
			expect(voiceModelIds).toContain('gpt-4o-realtime-preview-2024-12-17');
		});

		it('should use specific key when keyId is provided', async () => {
			const mockOpenAIKey = {
				id: 'specific-key',
				provider: 'openai',
				apiKey: 'sk-specific-key',
				enabled: true
			};

			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockResolvedValueOnce(JSON.stringify(mockOpenAIKey))
					}
				}
			};

			const mockLocals = {
				user: { isOwner: true }
			};

			(globalThis.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					object: 'list',
					data: [{ id: 'gpt-4o', object: 'model', created: 1234567890, owned_by: 'openai' }]
				})
			});

			const { GET } = await import('../../src/routes/api/admin/ai-keys/models/+server.js');

			const response = await GET({
				platform: mockPlatform,
				locals: mockLocals,
				url: new URL('http://localhost/api/admin/ai-keys/models?keyId=specific-key')
			} as any);

			expect(response.status).toBe(200);
			expect(mockPlatform.env.KV.get).toHaveBeenCalledWith('ai_key:specific-key');
		});

		it('should handle OpenAI API errors gracefully', async () => {
			const mockOpenAIKey = {
				id: 'key-1',
				provider: 'openai',
				apiKey: 'sk-invalid-key',
				enabled: true
			};

			const mockPlatform = {
				env: {
					KV: {
						get: vi
							.fn()
							.mockResolvedValueOnce(JSON.stringify(['key-1']))
							.mockResolvedValueOnce(JSON.stringify(mockOpenAIKey))
					}
				}
			};

			const mockLocals = {
				user: { isOwner: true }
			};

			(globalThis.fetch as any).mockResolvedValueOnce({
				ok: false,
				status: 401,
				text: async () => 'Invalid API key'
			});

			const { GET } = await import('../../src/routes/api/admin/ai-keys/models/+server.js');

			// The API returns the OpenAI error status and message
			await expect(
				GET({
					platform: mockPlatform,
					locals: mockLocals,
					url: new URL('http://localhost/api/admin/ai-keys/models')
				} as any)
			).rejects.toMatchObject({
				status: 401,
				body: { message: expect.stringContaining('Failed to fetch models') }
			});
		});

		it('should include audio pricing for realtime models', async () => {
			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockResolvedValue(null)
					}
				}
			};

			const mockLocals = {
				user: { isOwner: true }
			};

			const { GET } = await import('../../src/routes/api/admin/ai-keys/models/+server.js');

			const response = await GET({
				platform: mockPlatform,
				locals: mockLocals,
				url: new URL('http://localhost/api/admin/ai-keys/models')
			} as any);

			const data = await response.json();

			// Voice models should have audio pricing
			const realtimeModel = data.voiceModels.find(
				(m: any) => m.id === 'gpt-4o-realtime-preview-2024-12-17'
			);
			expect(realtimeModel).toBeDefined();
			expect(realtimeModel.audioPricing).toBeDefined();
			expect(realtimeModel.audioPricing.input).toBeGreaterThan(0);
			expect(realtimeModel.audioPricing.output).toBeGreaterThan(0);
		});

		it('should skip non-OpenAI keys when looking for API key', async () => {
			const anthropicKey = {
				id: 'key-1',
				provider: 'anthropic',
				apiKey: 'sk-ant-key',
				enabled: true
			};

			const mockPlatform = {
				env: {
					KV: {
						get: vi
							.fn()
							.mockResolvedValueOnce(JSON.stringify(['key-1']))
							.mockResolvedValueOnce(JSON.stringify(anthropicKey))
					}
				}
			};

			const mockLocals = {
				user: { isOwner: true }
			};

			const { GET } = await import('../../src/routes/api/admin/ai-keys/models/+server.js');

			const response = await GET({
				platform: mockPlatform,
				locals: mockLocals,
				url: new URL('http://localhost/api/admin/ai-keys/models')
			} as any);

			expect(response.status).toBe(200);
			const data = await response.json();

			// Should return static list since no OpenAI key was found
			expect(data.fromApi).toBe(false);
		});
	});
});
