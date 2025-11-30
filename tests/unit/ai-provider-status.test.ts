import { describe, expect, it, vi } from 'vitest';

describe('AI Provider Status API', () => {
	it('should return hasProviders: false when no AI keys exist', async () => {
		const mockKV = {
			get: vi.fn().mockResolvedValue(null)
		};

		const mockPlatform = {
			env: {
				KV: mockKV
			}
		};

		const { GET } = await import('../../src/routes/api/admin/ai-keys/status/+server');
		const response = await GET({
			platform: mockPlatform,
			locals: { user: { isOwner: true } }
		} as any);

		const data = await response.json();
		expect(data).toEqual({ hasProviders: false });
	});

	it('should return hasProviders: false when all AI keys are disabled', async () => {
		const keyId = 'test-key-1';
		const keyData = {
			id: keyId,
			name: 'Test OpenAI',
			provider: 'openai',
			model: 'gpt-4',
			enabled: false,
			createdAt: new Date().toISOString()
		};

		const mockKV = {
			get: vi.fn((key: string) => {
				if (key === 'ai_keys_list') {
					return Promise.resolve(JSON.stringify([keyId]));
				}
				if (key === `ai_key:${keyId}`) {
					return Promise.resolve(JSON.stringify(keyData));
				}
				return Promise.resolve(null);
			})
		};

		const mockPlatform = {
			env: {
				KV: mockKV
			}
		};

		const { GET } = await import('../../src/routes/api/admin/ai-keys/status/+server');
		const response = await GET({
			platform: mockPlatform,
			locals: { user: { isOwner: true } }
		} as any);

		const data = await response.json();
		expect(data).toEqual({ hasProviders: false });
	});

	it('should return hasProviders: true when at least one AI key is enabled', async () => {
		const keyId1 = 'test-key-1';
		const keyData1 = {
			id: keyId1,
			name: 'Test OpenAI Disabled',
			provider: 'openai',
			model: 'gpt-4',
			enabled: false,
			createdAt: new Date().toISOString()
		};

		const keyId2 = 'test-key-2';
		const keyData2 = {
			id: keyId2,
			name: 'Test Anthropic Enabled',
			provider: 'anthropic',
			model: 'claude-3-sonnet',
			enabled: true,
			createdAt: new Date().toISOString()
		};

		const mockKV = {
			get: vi.fn((key: string) => {
				if (key === 'ai_keys_list') {
					return Promise.resolve(JSON.stringify([keyId1, keyId2]));
				}
				if (key === `ai_key:${keyId1}`) {
					return Promise.resolve(JSON.stringify(keyData1));
				}
				if (key === `ai_key:${keyId2}`) {
					return Promise.resolve(JSON.stringify(keyData2));
				}
				return Promise.resolve(null);
			})
		};

		const mockPlatform = {
			env: {
				KV: mockKV
			}
		};

		const { GET } = await import('../../src/routes/api/admin/ai-keys/status/+server');
		const response = await GET({
			platform: mockPlatform,
			locals: { user: { isOwner: true } }
		} as any);

		const data = await response.json();
		expect(data).toEqual({ hasProviders: true });
	});

	it('should return hasProviders: true when multiple AI keys are enabled', async () => {
		const keyId1 = 'test-key-1';
		const keyData1 = {
			id: keyId1,
			name: 'Test OpenAI',
			provider: 'openai',
			model: 'gpt-4',
			enabled: true,
			createdAt: new Date().toISOString()
		};

		const keyId2 = 'test-key-2';
		const keyData2 = {
			id: keyId2,
			name: 'Test Anthropic',
			provider: 'anthropic',
			model: 'claude-3-sonnet',
			enabled: true,
			createdAt: new Date().toISOString()
		};

		const mockKV = {
			get: vi.fn((key: string) => {
				if (key === 'ai_keys_list') {
					return Promise.resolve(JSON.stringify([keyId1, keyId2]));
				}
				if (key === `ai_key:${keyId1}`) {
					return Promise.resolve(JSON.stringify(keyData1));
				}
				if (key === `ai_key:${keyId2}`) {
					return Promise.resolve(JSON.stringify(keyData2));
				}
				return Promise.resolve(null);
			})
		};

		const mockPlatform = {
			env: {
				KV: mockKV
			}
		};

		const { GET } = await import('../../src/routes/api/admin/ai-keys/status/+server');
		const response = await GET({
			platform: mockPlatform,
			locals: { user: { isOwner: true } }
		} as any);

		const data = await response.json();
		expect(data).toEqual({ hasProviders: true });
	});
});
