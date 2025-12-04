import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for AI Keys Voice Chat Configuration
 * TDD: Tests for voice chat enable/disable and model selection
 */

describe('AI Keys Voice Chat Configuration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		globalThis.fetch = vi.fn();
	});

	describe('POST /api/admin/ai-keys with voice settings', () => {
		it('should create key with voice chat enabled', async () => {
			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockResolvedValue(JSON.stringify([])),
						put: vi.fn().mockResolvedValue(undefined)
					}
				}
			};

			const mockLocals = {
				user: { isOwner: true }
			};

			const mockRequest = {
				json: vi.fn().mockResolvedValue({
					name: 'OpenAI Voice',
					provider: 'openai',
					apiKey: 'sk-test-key',
					model: 'gpt-4',
					enabled: true,
					voiceEnabled: true,
					voiceModel: 'gpt-4o-realtime-preview-2024-12-17'
				})
			};

			const { POST } = await import('../../src/routes/api/admin/ai-keys/+server.js');
			const response = await POST({
				request: mockRequest,
				platform: mockPlatform,
				locals: mockLocals
			} as any);

			const result = await response.json();

			expect(response.status).toBe(200);
			expect(result.success).toBe(true);
			expect(result.key).toMatchObject({
				name: 'OpenAI Voice',
				provider: 'openai',
				voiceEnabled: true,
				voiceModel: 'gpt-4o-realtime-preview-2024-12-17'
			});
		});

		it('should create key with voice chat disabled by default', async () => {
			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockResolvedValue(JSON.stringify([])),
						put: vi.fn().mockResolvedValue(undefined)
					}
				}
			};

			const mockLocals = {
				user: { isOwner: true }
			};

			const mockRequest = {
				json: vi.fn().mockResolvedValue({
					name: 'OpenAI Text Only',
					provider: 'openai',
					apiKey: 'sk-test-key',
					model: 'gpt-4',
					enabled: true
					// No voice settings provided
				})
			};

			const { POST } = await import('../../src/routes/api/admin/ai-keys/+server.js');
			const response = await POST({
				request: mockRequest,
				platform: mockPlatform,
				locals: mockLocals
			} as any);

			const result = await response.json();

			expect(response.status).toBe(200);
			expect(result.success).toBe(true);
			expect(result.key.voiceEnabled).toBe(false);
		});
	});

	describe('PUT /api/admin/ai-keys/[id] with voice settings', () => {
		it('should update key to enable voice chat', async () => {
			const existingKey = {
				id: 'key-1',
				name: 'OpenAI',
				provider: 'openai',
				apiKey: 'sk-test-key',
				model: 'gpt-4',
				enabled: true,
				voiceEnabled: false
			};

			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockResolvedValue(JSON.stringify(existingKey)),
						put: vi.fn().mockResolvedValue(undefined)
					}
				}
			};

			const mockLocals = {
				user: { isOwner: true }
			};

			const mockRequest = {
				json: vi.fn().mockResolvedValue({
					name: 'OpenAI',
					provider: 'openai',
					model: 'gpt-4',
					enabled: true,
					voiceEnabled: true,
					voiceModel: 'gpt-4o-realtime-preview-2024-12-17'
				})
			};

			const { PUT } = await import('../../src/routes/api/admin/ai-keys/[id]/+server.js');
			const response = await PUT({
				params: { id: 'key-1' },
				request: mockRequest,
				platform: mockPlatform,
				locals: mockLocals
			} as any);

			const result = await response.json();

			expect(response.status).toBe(200);
			expect(result.success).toBe(true);
			expect(result.key.voiceEnabled).toBe(true);
			expect(result.key.voiceModel).toBe('gpt-4o-realtime-preview-2024-12-17');
		});

		it('should update key to disable voice chat', async () => {
			const existingKey = {
				id: 'key-1',
				name: 'OpenAI',
				provider: 'openai',
				apiKey: 'sk-test-key',
				model: 'gpt-4',
				enabled: true,
				voiceEnabled: true,
				voiceModel: 'gpt-4o-realtime-preview-2024-12-17'
			};

			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockResolvedValue(JSON.stringify(existingKey)),
						put: vi.fn().mockResolvedValue(undefined)
					}
				}
			};

			const mockLocals = {
				user: { isOwner: true }
			};

			const mockRequest = {
				json: vi.fn().mockResolvedValue({
					name: 'OpenAI',
					provider: 'openai',
					model: 'gpt-4',
					enabled: true,
					voiceEnabled: false
				})
			};

			const { PUT } = await import('../../src/routes/api/admin/ai-keys/[id]/+server.js');
			const response = await PUT({
				params: { id: 'key-1' },
				request: mockRequest,
				platform: mockPlatform,
				locals: mockLocals
			} as any);

			const result = await response.json();

			expect(response.status).toBe(200);
			expect(result.success).toBe(true);
			expect(result.key.voiceEnabled).toBe(false);
		});
	});

	describe('Voice Session Creation with voice settings', () => {
		it('should create voice session when voice is enabled', async () => {
			const voiceEnabledKey = {
				id: 'key-1',
				name: 'OpenAI Voice',
				provider: 'openai',
				apiKey: 'sk-test-key',
				enabled: true,
				voiceEnabled: true,
				voiceModel: 'gpt-4o-realtime-preview-2024-12-17'
			};

			const mockPlatform = {
				env: {
					KV: {
						get: vi
							.fn()
							.mockResolvedValueOnce(JSON.stringify(['key-1']))
							.mockResolvedValueOnce(JSON.stringify(voiceEnabledKey))
					}
				}
			};

			const mockLocals = {
				user: { id: 'user-1' }
			};

			// Mock OpenAI API response
			(globalThis.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					client_secret: { value: 'ephemeral-token' }
				})
			});

			const { POST } = await import('../../src/routes/api/chat/voice/session/+server.js');
			const response = await POST({
				request: {},
				platform: mockPlatform,
				locals: mockLocals
			} as any);

			const result = await response.json();

			expect(response.status).toBe(200);
			expect(result.token).toBe('ephemeral-token');
			expect(result.model).toBe('gpt-4o-realtime-preview-2024-12-17');
		});

		it('should return 403 when voice is not enabled', async () => {
			const voiceDisabledKey = {
				id: 'key-1',
				name: 'OpenAI Text',
				provider: 'openai',
				apiKey: 'sk-test-key',
				enabled: true,
				voiceEnabled: false
			};

			const mockPlatform = {
				env: {
					KV: {
						get: vi
							.fn()
							.mockResolvedValueOnce(JSON.stringify(['key-1']))
							.mockResolvedValueOnce(JSON.stringify(voiceDisabledKey))
					}
				}
			};

			const mockLocals = {
				user: { id: 'user-1' }
			};

			const { POST } = await import('../../src/routes/api/chat/voice/session/+server.js');

			await expect(
				POST({
					request: {},
					platform: mockPlatform,
					locals: mockLocals
				} as any)
			).rejects.toThrow();
		});

		it('should use custom voice model when configured', async () => {
			const customVoiceKey = {
				id: 'key-1',
				name: 'OpenAI Voice Custom',
				provider: 'openai',
				apiKey: 'sk-test-key',
				enabled: true,
				voiceEnabled: true,
				voiceModel: 'gpt-4o-realtime-preview-2024-12-17'
			};

			const mockPlatform = {
				env: {
					KV: {
						get: vi
							.fn()
							.mockResolvedValueOnce(JSON.stringify(['key-1']))
							.mockResolvedValueOnce(JSON.stringify(customVoiceKey))
					}
				}
			};

			const mockLocals = {
				user: { id: 'user-1' }
			};

			// Mock OpenAI API response
			(globalThis.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					client_secret: { value: 'ephemeral-token' }
				})
			});

			const { POST } = await import('../../src/routes/api/chat/voice/session/+server.js');
			const response = await POST({
				request: {},
				platform: mockPlatform,
				locals: mockLocals
			} as any);

			const result = await response.json();

			expect(response.status).toBe(200);
			expect(result.model).toBe('gpt-4o-realtime-preview-2024-12-17');

			// Verify OpenAI API was called with custom model
			expect(globalThis.fetch).toHaveBeenCalledWith(
				'https://api.openai.com/v1/realtime/sessions',
				expect.objectContaining({
					method: 'POST',
					body: expect.stringContaining('gpt-4o-realtime-preview-2024-12-17')
				})
			);
		});
	});
});
