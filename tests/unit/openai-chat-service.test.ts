import { describe, expect, it, vi } from 'vitest';

/**
 * Tests for OpenAI Chat Service
 * Following TDD: Write tests first, then implement the service
 */

describe('OpenAI Chat Service', () => {
	describe('getEnabledOpenAIKey', () => {
		it('should return enabled OpenAI API key from KV storage', async () => {
			const mockKV = {
				get: vi.fn()
			};

			// Setup mock data
			mockKV.get.mockImplementation((key: string) => {
				if (key === 'ai_keys_list') {
					return Promise.resolve(JSON.stringify(['key1', 'key2']));
				}
				if (key === 'ai_key:key1') {
					return Promise.resolve(
						JSON.stringify({
							id: 'key1',
							name: 'OpenAI Production',
							provider: 'openai',
							apiKey: 'sk-test123',
							enabled: true
						})
					);
				}
				return Promise.resolve(null);
			});

			const platform = { env: { KV: mockKV } };

			// Import and test
			const { getEnabledOpenAIKey } = await import('$lib/services/openai-chat');
			const result = await getEnabledOpenAIKey(platform as any);

			expect(result).toEqual({
				id: 'key1',
				name: 'OpenAI Production',
				provider: 'openai',
				apiKey: 'sk-test123',
				enabled: true
			});
		});

		it('should return null if no OpenAI keys are enabled', async () => {
			const mockKV = {
				get: vi.fn()
			};

			mockKV.get.mockImplementation((key: string) => {
				if (key === 'ai_keys_list') {
					return Promise.resolve(JSON.stringify(['key1']));
				}
				if (key === 'ai_key:key1') {
					return Promise.resolve(
						JSON.stringify({
							id: 'key1',
							provider: 'anthropic',
							apiKey: 'sk-ant-123',
							enabled: true
						})
					);
				}
				return Promise.resolve(null);
			});

			const platform = { env: { KV: mockKV } };

			const { getEnabledOpenAIKey } = await import('$lib/services/openai-chat');
			const result = await getEnabledOpenAIKey(platform as any);

			expect(result).toBeNull();
		});

		it('should skip disabled OpenAI keys', async () => {
			const mockKV = {
				get: vi.fn()
			};

			mockKV.get.mockImplementation((key: string) => {
				if (key === 'ai_keys_list') {
					return Promise.resolve(JSON.stringify(['key1', 'key2']));
				}
				if (key === 'ai_key:key1') {
					return Promise.resolve(
						JSON.stringify({
							id: 'key1',
							provider: 'openai',
							apiKey: 'sk-disabled',
							enabled: false
						})
					);
				}
				if (key === 'ai_key:key2') {
					return Promise.resolve(
						JSON.stringify({
							id: 'key2',
							provider: 'openai',
							apiKey: 'sk-enabled',
							enabled: true
						})
					);
				}
				return Promise.resolve(null);
			});

			const platform = { env: { KV: mockKV } };

			const { getEnabledOpenAIKey } = await import('$lib/services/openai-chat');
			const result = await getEnabledOpenAIKey(platform as any);

			expect(result?.apiKey).toBe('sk-enabled');
		});
	});

	describe('streamChatCompletion', () => {
		it('should stream chat completion from OpenAI API', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				body: {
					getReader: () => ({
						read: vi
							.fn()
							.mockResolvedValueOnce({
								done: false,
								value: new TextEncoder().encode(
									'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'
								)
							})
							.mockResolvedValueOnce({
								done: false,
								value: new TextEncoder().encode(
									'data: {"choices":[{"delta":{"content":" world"}}]}\n\n'
								)
							})
							.mockResolvedValueOnce({
								done: false,
								value: new TextEncoder().encode('data: [DONE]\n\n')
							})
							.mockResolvedValueOnce({ done: true, value: undefined })
					})
				}
			});

			globalThis.fetch = mockFetch as any;

			const { streamChatCompletion } = await import('$lib/services/openai-chat');

			const messages = [{ role: 'user' as const, content: 'Hello' }];
			const stream = await streamChatCompletion('sk-test123', messages);

			const chunks: string[] = [];
			for await (const chunk of stream) {
				chunks.push(chunk);
			}

			expect(chunks).toEqual(['Hello', ' world']);
			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.openai.com/v1/chat/completions',
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({
						Authorization: 'Bearer sk-test123'
					})
				})
			);
		});

		it('should handle API errors gracefully', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 401,
				statusText: 'Unauthorized'
			});

			globalThis.fetch = mockFetch as any;

			const { streamChatCompletion } = await import('$lib/services/openai-chat');

			const messages = [{ role: 'user' as const, content: 'Hello' }];

			// Test that the generator throws when we try to iterate
			const stream = streamChatCompletion('sk-invalid', messages);
			await expect(stream.next()).rejects.toThrow('OpenAI API error');
		});
	});

	describe('createRealtimeSession', () => {
		it('should create ephemeral token for realtime API', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					client_secret: {
						value: 'eph_token_12345'
					}
				})
			});

			globalThis.fetch = mockFetch as any;

			const { createRealtimeSession } = await import('$lib/services/openai-chat');

			const result = await createRealtimeSession(
				'sk-test123',
				'gpt-4o-realtime-preview-2024-12-17'
			);

			expect(result).toEqual({
				token: 'eph_token_12345'
			});
			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.openai.com/v1/realtime/sessions',
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({
						Authorization: 'Bearer sk-test123'
					}),
					body: expect.stringContaining('gpt-4o-realtime-preview-2024-12-17')
				})
			);
		});

		it('should handle session creation errors', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				text: vi.fn().mockResolvedValue('Internal Server Error')
			});

			globalThis.fetch = mockFetch as any;

			const { createRealtimeSession } = await import('$lib/services/openai-chat');

			await expect(
				createRealtimeSession('sk-test123', 'gpt-4o-realtime-preview-2024-12-17')
			).rejects.toThrow('Failed to create realtime session');
		});
	});

	describe('formatMessagesForOpenAI', () => {
		it('should format messages correctly for OpenAI API', async () => {
			const { formatMessagesForOpenAI } = await import('$lib/services/openai-chat');

			const messages = [
				{ id: '1', role: 'user', content: 'Hello', timestamp: new Date() },
				{ id: '2', role: 'assistant', content: 'Hi there!', timestamp: new Date() }
			];

			const result = formatMessagesForOpenAI(messages);

			expect(result).toEqual([
				{ role: 'user', content: 'Hello' },
				{ role: 'assistant', content: 'Hi there!' }
			]);
		});

		it('should filter out system messages if not supported', async () => {
			const { formatMessagesForOpenAI } = await import('$lib/services/openai-chat');

			const messages = [
				{ id: '1', role: 'system', content: 'You are helpful', timestamp: new Date() },
				{ id: '2', role: 'user', content: 'Hello', timestamp: new Date() }
			];

			const result = formatMessagesForOpenAI(messages, { includeSystem: false });

			expect(result).toEqual([{ role: 'user', content: 'Hello' }]);
		});
	});
});
