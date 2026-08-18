/**
 * Extended tests for chat stream API endpoint
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the openai-chat module
vi.mock('$lib/services/openai-chat', () => ({
	formatMessagesForOpenAI: vi.fn((messages) => messages),
	getConfiguredChatModels: vi.fn((key) => {
		const supported = new Set(['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo']);
		return (key.models || (key.model ? [key.model] : [])).filter((model: string) =>
			supported.has(model)
		);
	}),
	getEnabledOpenAIKey: vi.fn(),
	selectDefaultChatModel: vi.fn((models) =>
		models.includes('gpt-4o-mini')
			? 'gpt-4o-mini'
			: models.includes('gpt-4o')
				? 'gpt-4o'
				: models[0]
	),
	streamChatCompletion: vi.fn()
}));

import {
	formatMessagesForOpenAI,
	getEnabledOpenAIKey,
	streamChatCompletion,
	type AIKey
} from '$lib/services/openai-chat';
import { POST } from '../../src/routes/api/chat/stream/+server';

describe('Chat Stream API - Extended Coverage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const createMockEvent = (
		overrides: {
			user?: object | null;
			body?: object;
		} = {}
	) => {
		const mockRequest = {
			json: vi.fn().mockResolvedValue(
				overrides.body || {
					messages: [{ role: 'user', content: 'Hello' }]
				}
			)
		};

		return {
			request: mockRequest,
			platform: { env: {} },
			locals: {
				user: overrides.user !== null ? overrides.user || { id: '1', name: 'Test' } : null
			}
		};
	};

	it('should return 401 when user is not authenticated', async () => {
		await expect(
			POST(createMockEvent({ user: null }) as unknown as Parameters<typeof POST>[0])
		).rejects.toThrow();
	});

	it('should return 400 when messages is not an array', async () => {
		await expect(
			POST(
				createMockEvent({ body: { messages: 'not an array' } }) as unknown as Parameters<
					typeof POST
				>[0]
			)
		).rejects.toThrow();
	});

	it('should return 400 when messages is empty array', async () => {
		await expect(
			POST(createMockEvent({ body: { messages: [] } }) as unknown as Parameters<typeof POST>[0])
		).rejects.toThrow();
	});

	it('should return 503 when no OpenAI key is configured', async () => {
		vi.mocked(getEnabledOpenAIKey).mockResolvedValue(null);

		await expect(
			POST(createMockEvent() as unknown as Parameters<typeof POST>[0])
		).rejects.toThrow();
	});

	it('should return streaming response when key is available', async () => {
		vi.mocked(getEnabledOpenAIKey).mockResolvedValue({
			apiKey: 'test-key',
			models: ['gpt-4o']
		} as AIKey);
		vi.mocked(streamChatCompletion).mockImplementation(async function* () {
			yield { type: 'content' as const, content: 'Hello' };
			yield { type: 'content' as const, content: ' world' };
			yield {
				type: 'usage' as const,
				usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
				model: 'gpt-4o-mini'
			};
		});

		const response = await POST(createMockEvent() as unknown as Parameters<typeof POST>[0]);

		expect(response.headers.get('Content-Type')).toBe('text/event-stream');
		expect(response.headers.get('Cache-Control')).toBe('no-cache');
	});

	it('should handle streaming errors gracefully', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(getEnabledOpenAIKey).mockResolvedValue({
			apiKey: 'test-key',
			models: ['gpt-4o']
		} as AIKey);
		vi.mocked(streamChatCompletion).mockImplementation(async function* () {
			throw new Error('Stream failed');
		});

		const response = await POST(createMockEvent() as unknown as Parameters<typeof POST>[0]);

		// Response should still be created even if streaming fails
		expect(response).toBeDefined();
		expect(response.headers.get('Content-Type')).toBe('text/event-stream');

		consoleSpy.mockRestore();
	});

	it('should format messages before streaming', async () => {
		vi.mocked(getEnabledOpenAIKey).mockResolvedValue({
			apiKey: 'test-key',
			models: ['gpt-4o']
		} as AIKey);
		vi.mocked(formatMessagesForOpenAI).mockReturnValue([{ role: 'user', content: 'formatted' }]);
		vi.mocked(streamChatCompletion).mockImplementation(async function* () {
			yield { type: 'content', content: 'response' };
		});

		await POST(createMockEvent() as unknown as Parameters<typeof POST>[0]);

		expect(formatMessagesForOpenAI).toHaveBeenCalled();
	});

	it('should re-throw errors with status property', async () => {
		vi.mocked(getEnabledOpenAIKey).mockRejectedValue({ status: 404, message: 'Not found' });

		await expect(
			POST(createMockEvent() as unknown as Parameters<typeof POST>[0])
		).rejects.toHaveProperty('status', 404);
	});

	it('should throw 500 for unknown errors', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(getEnabledOpenAIKey).mockRejectedValue(new Error('Unknown error'));

		await expect(
			POST(createMockEvent() as unknown as Parameters<typeof POST>[0])
		).rejects.toThrow();

		consoleSpy.mockRestore();
	});

	it('should pass model parameter to streamChatCompletion', async () => {
		vi.mocked(getEnabledOpenAIKey).mockResolvedValue({
			apiKey: 'test-key',
			models: ['gpt-4o-mini']
		} as AIKey);
		vi.mocked(streamChatCompletion).mockImplementation(async function* () {
			yield { type: 'content', content: 'response' };
		});

		await POST(
			createMockEvent({
				body: {
					messages: [{ role: 'user', content: 'Hello' }],
					model: 'gpt-4o-mini'
				}
			}) as unknown as Parameters<typeof POST>[0]
		);

		// Verify streamChatCompletion was called with the model option
		expect(streamChatCompletion).toHaveBeenCalledWith(
			'test-key',
			expect.any(Array),
			expect.objectContaining({ model: 'gpt-4o-mini' })
		);
	});

	it('should use default model when not specified', async () => {
		vi.mocked(getEnabledOpenAIKey).mockResolvedValue({
			apiKey: 'test-key',
			models: ['gpt-4o']
		} as AIKey);
		vi.mocked(streamChatCompletion).mockImplementation(async function* () {
			yield { type: 'content', content: 'response' };
		});

		await POST(createMockEvent() as unknown as Parameters<typeof POST>[0]);

		// Verify streamChatCompletion was called with default model
		expect(streamChatCompletion).toHaveBeenCalledWith(
			'test-key',
			expect.any(Array),
			expect.objectContaining({ model: 'gpt-4o' })
		);
	});

	it.each(['unknown-model', 'gpt-4o-disabled'])(
		'should return 400 for an unknown or disabled model (%s)',
		async (model) => {
			vi.mocked(getEnabledOpenAIKey).mockResolvedValueOnce(null);

			await expect(
				POST(
					createMockEvent({
						body: { messages: [{ role: 'user', content: 'Hello' }], model }
					}) as unknown as Parameters<typeof POST>[0]
				)
			).rejects.toMatchObject({ status: 400 });
			expect(streamChatCompletion).not.toHaveBeenCalled();
		}
	);

	it.each([null, '', 42])('rejects invalid explicit model value %j', async (model) => {
		await expect(
			POST(
				createMockEvent({
					body: { messages: [{ role: 'user', content: 'Hello' }], model }
				}) as unknown as Parameters<typeof POST>[0]
			)
		).rejects.toMatchObject({ status: 400 });
		expect(getEnabledOpenAIKey).not.toHaveBeenCalled();
	});

	it('supports a legacy single-model key', async () => {
		vi.mocked(getEnabledOpenAIKey).mockResolvedValue({
			apiKey: 'test-key',
			model: 'gpt-4-turbo'
		} as AIKey);
		vi.mocked(streamChatCompletion).mockImplementation(async function* () {
			yield { type: 'content', content: 'legacy' };
		});

		const response = await POST(createMockEvent() as unknown as Parameters<typeof POST>[0]);
		expect(await response.text()).toContain('legacy');
		expect(streamChatCompletion).toHaveBeenCalledWith('test-key', expect.any(Array), {
			model: 'gpt-4-turbo'
		});
	});

	it('prefers gpt-4o-mini from a multi-model key', async () => {
		vi.mocked(getEnabledOpenAIKey).mockResolvedValue({
			apiKey: 'test-key',
			models: ['gpt-4o', 'gpt-4o-mini']
		} as AIKey);
		vi.mocked(streamChatCompletion).mockImplementation(async function* () {});

		const response = await POST(createMockEvent() as unknown as Parameters<typeof POST>[0]);
		await response.text();
		expect(streamChatCompletion).toHaveBeenCalledWith('test-key', expect.any(Array), {
			model: 'gpt-4o-mini'
		});
	});

	it('rejects an enabled key with no configured chat models', async () => {
		vi.mocked(getEnabledOpenAIKey).mockResolvedValue({
			id: 'key-1',
			name: 'OpenAI',
			provider: 'openai',
			enabled: true,
			apiKey: 'test-key',
			models: []
		});

		await expect(
			POST(createMockEvent() as unknown as Parameters<typeof POST>[0])
		).rejects.toMatchObject({ status: 503 });
	});

	it('rejects a key configured only with unsupported models', async () => {
		vi.mocked(getEnabledOpenAIKey).mockResolvedValue({
			apiKey: 'test-key',
			models: ['unrecognized-model']
		} as AIKey);

		await expect(
			POST(createMockEvent() as unknown as Parameters<typeof POST>[0])
		).rejects.toMatchObject({ status: 503 });
		expect(streamChatCompletion).not.toHaveBeenCalled();
	});

	it('ignores empty chunks and uses the usage fallback model', async () => {
		vi.mocked(getEnabledOpenAIKey).mockResolvedValue({
			apiKey: 'test-key',
			models: ['gpt-4o']
		} as AIKey);
		vi.mocked(streamChatCompletion).mockImplementation(async function* () {
			yield { type: 'content' as const, content: '' };
			yield { type: 'usage' as const } as never;
			yield {
				type: 'usage' as const,
				usage: { promptTokens: 2, completionTokens: 1, totalTokens: 3 }
			};
		});

		const response = await POST(createMockEvent() as unknown as Parameters<typeof POST>[0]);
		const body = await response.text();
		expect(body).toContain('"model":"gpt-4o"');
		expect(body).toContain('[DONE]');
	});
});
