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

		// /api/chat/models lists the union of chat models across every enabled key,
		// so a model-less stream request must not fail just because the first key
		// happens to be voice-only.
		it('should skip chat-less keys when no model is requested', async () => {
			const mockKV = { get: vi.fn() };

			mockKV.get.mockImplementation((key: string) => {
				if (key === 'ai_keys_list') {
					return Promise.resolve(JSON.stringify(['voice-only', 'chat-capable']));
				}
				if (key === 'ai_key:voice-only') {
					return Promise.resolve(
						JSON.stringify({
							id: 'voice-only',
							provider: 'openai',
							apiKey: 'sk-voice',
							enabled: true,
							models: ['gpt-4o-realtime-preview']
						})
					);
				}
				if (key === 'ai_key:chat-capable') {
					return Promise.resolve(
						JSON.stringify({
							id: 'chat-capable',
							provider: 'openai',
							apiKey: 'sk-chat',
							enabled: true,
							models: ['gpt-4o-mini']
						})
					);
				}
				return Promise.resolve(null);
			});

			const { getEnabledOpenAIKey } = await import('$lib/services/openai-chat');
			const result = await getEnabledOpenAIKey({ env: { KV: mockKV } } as any);

			expect(result?.id).toBe('chat-capable');
		});

		it('should fall back to the first key when none are chat-capable', async () => {
			const mockKV = { get: vi.fn() };

			mockKV.get.mockImplementation((key: string) => {
				if (key === 'ai_keys_list') {
					return Promise.resolve(JSON.stringify(['voice-only']));
				}
				if (key === 'ai_key:voice-only') {
					return Promise.resolve(
						JSON.stringify({
							id: 'voice-only',
							provider: 'openai',
							apiKey: 'sk-voice',
							enabled: true,
							models: ['gpt-4o-realtime-preview']
						})
					);
				}
				return Promise.resolve(null);
			});

			const { getEnabledOpenAIKey } = await import('$lib/services/openai-chat');
			const result = await getEnabledOpenAIKey({ env: { KV: mockKV } } as any);

			// The route then surfaces 503 "No chat models configured", unchanged.
			expect(result?.id).toBe('voice-only');
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

		it('selects only an enabled key configured for the requested model', async () => {
			const keys = {
				key1: { provider: 'openai', apiKey: 'sk-first', enabled: true, models: ['gpt-4o'] },
				key2: {
					provider: 'openai',
					apiKey: 'sk-second',
					enabled: true,
					models: ['gpt-4o-mini']
				},
				key3: {
					provider: 'openai',
					apiKey: 'sk-disabled',
					enabled: false,
					models: ['o3']
				}
			};
			const mockKV = {
				get: vi.fn(async (key: string) =>
					key === 'ai_keys_list'
						? JSON.stringify(Object.keys(keys))
						: JSON.stringify(keys[key.replace('ai_key:', '') as keyof typeof keys] ?? null)
				)
			};
			const { getEnabledOpenAIKey } = await import('$lib/services/openai-chat');
			const platform = { env: { KV: mockKV } } as any;

			expect((await getEnabledOpenAIKey(platform, 'gpt-4o-mini'))?.apiKey).toBe('sk-second');
			expect(await getEnabledOpenAIKey(platform, 'o3')).toBeNull();
			expect(await getEnabledOpenAIKey(platform, 'missing')).toBeNull();
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
								value: new TextEncoder().encode(
									'data: {"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15},"model":"gpt-4o"}\n\n'
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

			const contentChunks: string[] = [];
			let usageData = null;
			for await (const chunk of stream) {
				if (chunk.type === 'content' && chunk.content) {
					contentChunks.push(chunk.content);
				} else if (chunk.type === 'usage') {
					usageData = chunk.usage;
				}
			}

			expect(contentChunks).toEqual(['Hello', ' world']);
			expect(usageData).toEqual({
				promptTokens: 10,
				completionTokens: 5,
				totalTokens: 15
			});
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

		it('should include system messages by default', async () => {
			const { formatMessagesForOpenAI } = await import('$lib/services/openai-chat');

			const messages = [
				{ id: '1', role: 'system', content: 'You are helpful', timestamp: new Date() },
				{ id: '2', role: 'user', content: 'Hello', timestamp: new Date() }
			];

			const result = formatMessagesForOpenAI(messages);

			expect(result).toEqual([
				{ role: 'system', content: 'You are helpful' },
				{ role: 'user', content: 'Hello' }
			]);
		});
	});

	describe('streamChatCompletion error handling', () => {
		it('should throw when response body is null', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				body: null
			});

			globalThis.fetch = mockFetch as any;

			const { streamChatCompletion } = await import('$lib/services/openai-chat');

			const messages = [{ role: 'user' as const, content: 'Hello' }];
			const stream = streamChatCompletion('sk-test123', messages);

			await expect(stream.next()).rejects.toThrow('No response body');
		});

		it('should handle malformed JSON in SSE stream', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

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
								value: new TextEncoder().encode('data: {invalid json}\n\n')
							})
							.mockResolvedValueOnce({
								done: false,
								value: new TextEncoder().encode(
									'data: {"choices":[{"delta":{"content":" world"}}]}\n\n'
								)
							})
							.mockResolvedValueOnce({ done: true, value: undefined })
					})
				}
			});

			globalThis.fetch = mockFetch as any;

			const { streamChatCompletion } = await import('$lib/services/openai-chat');

			const messages = [{ role: 'user' as const, content: 'Hello' }];
			const stream = streamChatCompletion('sk-test123', messages);

			const contentChunks: string[] = [];
			for await (const chunk of stream) {
				if (chunk.type === 'content' && chunk.content) {
					contentChunks.push(chunk.content);
				}
			}

			// Should still get valid chunks despite malformed JSON
			expect(contentChunks).toEqual(['Hello', ' world']);
			// Should have logged the error
			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});
	});

	describe('createRealtimeSession error handling', () => {
		it('should throw when client_secret is missing from response', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					// Missing client_secret
					id: 'session-123'
				})
			});

			globalThis.fetch = mockFetch as any;

			const { createRealtimeSession } = await import('$lib/services/openai-chat');

			await expect(
				createRealtimeSession('sk-test123', 'gpt-4o-realtime-preview-2024-12-17')
			).rejects.toThrow('Invalid response: missing client_secret');

			consoleSpy.mockRestore();
		});

		it('should throw when client_secret.value is missing', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					client_secret: {} // Missing value property
				})
			});

			globalThis.fetch = mockFetch as any;

			const { createRealtimeSession } = await import('$lib/services/openai-chat');

			await expect(
				createRealtimeSession('sk-test123', 'gpt-4o-realtime-preview-2024-12-17')
			).rejects.toThrow('Invalid response: missing client_secret');

			consoleSpy.mockRestore();
		});
	});

	describe('getEnabledOpenAIKey edge cases', () => {
		it('should return null when no keys list exists', async () => {
			const mockKV = {
				get: vi.fn().mockResolvedValue(null)
			};

			const platform = { env: { KV: mockKV } };

			const { getEnabledOpenAIKey } = await import('$lib/services/openai-chat');
			const result = await getEnabledOpenAIKey(platform as any);

			expect(result).toBeNull();
		});

		it('should handle KV read errors gracefully', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			const mockKV = {
				get: vi.fn().mockRejectedValue(new Error('KV error'))
			};

			const platform = { env: { KV: mockKV } };

			const { getEnabledOpenAIKey } = await import('$lib/services/openai-chat');
			const result = await getEnabledOpenAIKey(platform as any);

			expect(result).toBeNull();
			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		it('should skip keys with null data', async () => {
			const mockKV = {
				get: vi.fn()
			};

			mockKV.get.mockImplementation((key: string) => {
				if (key === 'ai_keys_list') {
					return Promise.resolve(JSON.stringify(['key1', 'key2']));
				}
				if (key === 'ai_key:key1') {
					return Promise.resolve(null); // Key data is null
				}
				if (key === 'ai_key:key2') {
					return Promise.resolve(
						JSON.stringify({
							id: 'key2',
							provider: 'openai',
							apiKey: 'sk-valid',
							enabled: true
						})
					);
				}
				return Promise.resolve(null);
			});

			const platform = { env: { KV: mockKV } };

			const { getEnabledOpenAIKey } = await import('$lib/services/openai-chat');
			const result = await getEnabledOpenAIKey(platform as any);

			expect(result?.apiKey).toBe('sk-valid');
		});
	});
});
