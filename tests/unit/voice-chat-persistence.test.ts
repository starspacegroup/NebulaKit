import { chatHistoryStore } from '$lib/stores/chatHistory';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('voice transcript persistence', () => {
	let socket: MockWebSocket | undefined;

	class MockWebSocket {
		static OPEN = 1;
		readyState = MockWebSocket.OPEN;
		onopen: (() => void) | null = null;
		onmessage: ((event: { data: string }) => void) | null = null;
		onerror: (() => void) | null = null;
		onclose: (() => void) | null = null;
		send = vi.fn();
		close = vi.fn();

		constructor() {
			socket = this;
		}
	}

	beforeEach(() => {
		chatHistoryStore.reset();
		socket = undefined;
		vi.stubGlobal('WebSocket', MockWebSocket);
		class MockAudioContext {
			sampleRate = 24000;
			destination = {};
			createMediaStreamSource = vi.fn(() => ({ connect: vi.fn() }));
			createScriptProcessor = vi.fn(() => ({
				connect: vi.fn(),
				disconnect: vi.fn(),
				onaudioprocess: null
			}));
			close = vi.fn();
		}
		vi.stubGlobal('AudioContext', MockAudioContext);
		Object.defineProperty(navigator, 'mediaDevices', {
			configurable: true,
			value: {
				getUserMedia: vi.fn().mockResolvedValue({
					getTracks: () => [{ stop: vi.fn() }]
				})
			}
		});
		vi.stubGlobal(
			'fetch',
			vi.fn((input: string | URL | Request) => {
				const url = String(input);
				if (url.includes('/api/chat/models')) {
					return Promise.resolve(
						new Response(JSON.stringify({ models: [], defaultModel: 'gpt-4o' }), { status: 200 })
					);
				}
				return Promise.resolve(
					new Response(JSON.stringify({ token: 'ephemeral-token', model: 'gpt-realtime' }), {
						status: 200
					})
				);
			})
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('writes user and assistant realtime transcripts to the canonical history store', async () => {
		const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
		render(ChatInterface, { props: { voiceAvailable: true } });

		await fireEvent.click(screen.getByRole('button', { name: /start voice chat/i }));
		await waitFor(() => expect(socket).toBeDefined());

		socket?.onmessage?.({
			data: JSON.stringify({
				type: 'conversation.item.input_audio_transcription.completed',
				transcript: 'Persisted user transcript'
			})
		});
		socket?.onmessage?.({
			data: JSON.stringify({
				type: 'response.audio_transcript.delta',
				delta: 'Persisted assistant transcript'
			})
		});
		socket?.onmessage?.({
			data: JSON.stringify({
				type: 'response.done',
				response: {
					status: 'completed',
					output: [{}],
					usage: { input_tokens: 12, output_tokens: 8 }
				}
			})
		});

		const state = get(chatHistoryStore);
		expect(state.conversations).toHaveLength(1);
		expect(state.conversations[0].messages).toEqual([
			expect.objectContaining({ role: 'user', content: 'Persisted user transcript' }),
			expect.objectContaining({
				role: 'assistant',
				content: 'Persisted assistant transcript',
				cost: expect.objectContaining({ inputTokens: 12, outputTokens: 8 })
			})
		]);

		await fireEvent.click(screen.getByRole('button', { name: /listening to your voice/i }));
	});
});
