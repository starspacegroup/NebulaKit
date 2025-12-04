/**
 * Extended tests for voice session API endpoint
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the openai-chat module
vi.mock('$lib/services/openai-chat', () => ({
	getEnabledOpenAIKey: vi.fn(),
	createRealtimeSession: vi.fn()
}));

import { createRealtimeSession, getEnabledOpenAIKey } from '$lib/services/openai-chat';
import { POST } from '../../src/routes/api/chat/voice/session/+server';

describe('Voice Session API - Extended Coverage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const createMockEvent = (
		overrides: {
			user?: object | null;
		} = {}
	) => {
		return {
			request: {},
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

	it('should return 503 when no OpenAI key is configured', async () => {
		vi.mocked(getEnabledOpenAIKey).mockResolvedValue(null);

		await expect(
			POST(createMockEvent() as unknown as Parameters<typeof POST>[0])
		).rejects.toThrow();
	});

	it('should return 403 when voice chat is not enabled', async () => {
		vi.mocked(getEnabledOpenAIKey).mockResolvedValue({
			id: 'key-1',
			name: 'Test Key',
			provider: 'openai',
			apiKey: 'test-key',
			enabled: true,
			voiceEnabled: false
		});

		await expect(
			POST(createMockEvent() as unknown as Parameters<typeof POST>[0])
		).rejects.toThrow();
	});

	it('should create session with configured voice model', async () => {
		vi.mocked(getEnabledOpenAIKey).mockResolvedValue({
			id: 'key-1',
			name: 'Test Key',
			provider: 'openai',
			apiKey: 'test-key',
			enabled: true,
			voiceEnabled: true,
			voiceModel: 'gpt-4o-realtime-custom'
		});
		vi.mocked(createRealtimeSession).mockResolvedValue({
			token: 'session-token-123'
		});

		const response = await POST(createMockEvent() as unknown as Parameters<typeof POST>[0]);
		const data = await response.json();

		expect(data.token).toBe('session-token-123');
		expect(data.model).toBe('gpt-4o-realtime-custom');
		expect(createRealtimeSession).toHaveBeenCalledWith('test-key', 'gpt-4o-realtime-custom');
	});

	it('should use default voice model when not configured', async () => {
		vi.mocked(getEnabledOpenAIKey).mockResolvedValue({
			id: 'key-1',
			name: 'Test Key',
			provider: 'openai',
			apiKey: 'test-key',
			enabled: true,
			voiceEnabled: true
		});
		vi.mocked(createRealtimeSession).mockResolvedValue({
			token: 'session-token-123'
		});

		const response = await POST(createMockEvent() as unknown as Parameters<typeof POST>[0]);
		const data = await response.json();

		expect(data.model).toBe('gpt-4o-realtime-preview-2024-12-17');
	});

	it('should re-throw errors with status property', async () => {
		vi.mocked(getEnabledOpenAIKey).mockRejectedValue({ status: 429, message: 'Rate limited' });

		await expect(
			POST(createMockEvent() as unknown as Parameters<typeof POST>[0])
		).rejects.toHaveProperty('status', 429);
	});

	it('should throw 500 for unknown errors', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(getEnabledOpenAIKey).mockResolvedValue({
			id: 'key-1',
			name: 'Test Key',
			provider: 'openai',
			apiKey: 'test-key',
			enabled: true,
			voiceEnabled: true
		});
		vi.mocked(createRealtimeSession).mockRejectedValue(new Error('Unknown error'));

		await expect(
			POST(createMockEvent() as unknown as Parameters<typeof POST>[0])
		).rejects.toThrow();

		consoleSpy.mockRestore();
	});
});
