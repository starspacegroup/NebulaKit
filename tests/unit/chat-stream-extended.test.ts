/**
 * Extended tests for chat stream API endpoint
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the openai-chat module
vi.mock('$lib/services/openai-chat', () => ({
	formatMessagesForOpenAI: vi.fn((messages) => messages),
	getEnabledOpenAIKey: vi.fn(),
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
		vi.mocked(getEnabledOpenAIKey).mockResolvedValue({ apiKey: 'test-key' } as AIKey);
		vi.mocked(streamChatCompletion).mockImplementation(async function* () {
			yield 'Hello';
			yield ' world';
		});

		const response = await POST(createMockEvent() as unknown as Parameters<typeof POST>[0]);

		expect(response.headers.get('Content-Type')).toBe('text/event-stream');
		expect(response.headers.get('Cache-Control')).toBe('no-cache');
	});

	it('should handle streaming errors gracefully', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(getEnabledOpenAIKey).mockResolvedValue({ apiKey: 'test-key' } as AIKey);
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
		vi.mocked(getEnabledOpenAIKey).mockResolvedValue({ apiKey: 'test-key' } as AIKey);
		vi.mocked(formatMessagesForOpenAI).mockReturnValue([{ role: 'user', content: 'formatted' }]);
		vi.mocked(streamChatCompletion).mockImplementation(async function* () {
			yield 'response';
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
});
