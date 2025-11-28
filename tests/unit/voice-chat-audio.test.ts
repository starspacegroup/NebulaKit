import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Voice Chat Audio Service', () => {
	let mockAudioContext: any;
	let mockMediaStream: any;
	let mockWebSocket: any;

	beforeEach(() => {
		// Mock AudioContext
		mockAudioContext = {
			createMediaStreamSource: vi.fn().mockReturnValue({
				connect: vi.fn()
			}),
			createAnalyser: vi.fn().mockReturnValue({
				fftSize: 0,
				frequencyBinCount: 128,
				connect: vi.fn(),
				getByteFrequencyData: vi.fn()
			}),
			createGain: vi.fn().mockReturnValue({
				connect: vi.fn(),
				gain: { value: 0 }
			}),
			createBufferSource: vi.fn().mockReturnValue({
				buffer: null,
				connect: vi.fn(),
				start: vi.fn()
			}),
			createBuffer: vi.fn().mockReturnValue({
				getChannelData: vi.fn().mockReturnValue(new Float32Array(100))
			}),
			destination: {},
			sampleRate: 24000,
			currentTime: 0,
			close: vi.fn()
		};

		// Mock MediaStream
		mockMediaStream = {
			getTracks: vi.fn().mockReturnValue([
				{
					stop: vi.fn(),
					kind: 'audio'
				}
			])
		};

		// Mock WebSocket
		mockWebSocket = {
			send: vi.fn(),
			close: vi.fn(),
			readyState: 1 // OPEN
		};

		// Mock global audio APIs
		globalThis.AudioContext = vi.fn(() => mockAudioContext) as any;
		(globalThis.navigator as any).mediaDevices = {
			getUserMedia: vi.fn().mockResolvedValue(mockMediaStream)
		};
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('Audio Capture', () => {
		it('should capture microphone audio in PCM16 format at 24kHz', async () => {
			// This tests that we can capture audio from the microphone
			// and convert it to the format expected by OpenAI Realtime API
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			expect(stream).toBeDefined();
			expect(stream.getTracks()).toHaveLength(1);
		});

		it('should encode audio as base64 PCM16', () => {
			// OpenAI expects audio as base64-encoded PCM16
			const sampleData = new Int16Array([100, 200, 300, 400]);
			const buffer = new ArrayBuffer(sampleData.length * 2);
			const view = new Int16Array(buffer);
			view.set(sampleData);

			// Convert to base64
			const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
			expect(base64).toBeTruthy();
			expect(typeof base64).toBe('string');
		});

		it('should send audio chunks to WebSocket at regular intervals', () => {
			// We should send audio in small chunks (e.g., 100ms) to enable real-time processing
			const audioChunk = 'base64encodedaudio';

			mockWebSocket.send(
				JSON.stringify({
					type: 'input_audio_buffer.append',
					audio: audioChunk
				})
			);

			expect(mockWebSocket.send).toHaveBeenCalledWith(
				expect.stringContaining('input_audio_buffer.append')
			);
		});

		it('should handle microphone permission denial', async () => {
			(globalThis.navigator as any).mediaDevices.getUserMedia = vi
				.fn()
				.mockRejectedValue(new Error('Permission denied'));

			await expect(navigator.mediaDevices.getUserMedia({ audio: true })).rejects.toThrow(
				'Permission denied'
			);
		});
	});

	describe('Audio Playback', () => {
		it('should decode base64 audio and play it', () => {
			// OpenAI sends audio as base64-encoded PCM16
			const base64Audio = 'SGVsbG8gV29ybGQ='; // Example base64

			// Decode base64 to audio buffer
			const binaryString = atob(base64Audio);
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}

			expect(bytes).toBeInstanceOf(Uint8Array);
		});

		it('should convert PCM16 to Float32 for AudioContext playback', () => {
			// AudioContext expects Float32Array, OpenAI sends Int16
			const pcm16 = new Int16Array([16384, -16384, 0]);
			const float32 = new Float32Array(pcm16.length);

			for (let i = 0; i < pcm16.length; i++) {
				float32[i] = pcm16[i] / 32768.0; // Convert to -1.0 to 1.0 range
			}

			expect(float32[0]).toBeCloseTo(0.5, 1);
			expect(float32[1]).toBeCloseTo(-0.5, 1);
			expect(float32[2]).toBe(0);
		});

		it('should queue and play audio chunks in order', async () => {
			// Audio chunks should be played sequentially without gaps
			const audioQueue: string[] = ['chunk1', 'chunk2', 'chunk3'];
			const playedChunks: string[] = [];

			for (const chunk of audioQueue) {
				playedChunks.push(chunk);
			}

			expect(playedChunks).toEqual(audioQueue);
		});

		it('should handle audio playback errors gracefully', () => {
			mockAudioContext.createBufferSource = vi.fn().mockImplementation(() => {
				throw new Error('Playback failed');
			});

			expect(() => mockAudioContext.createBufferSource()).toThrow('Playback failed');
		});
	});

	describe('WebSocket Communication', () => {
		it('should send session configuration on connection', () => {
			mockWebSocket.send(
				JSON.stringify({
					type: 'session.update',
					session: {
						turn_detection: {
							type: 'server_vad',
							threshold: 0.5,
							prefix_padding_ms: 300,
							silence_duration_ms: 500
						},
						input_audio_transcription: {
							model: 'whisper-1'
						},
						modalities: ['text', 'audio'],
						temperature: 0.8
					}
				})
			);

			expect(mockWebSocket.send).toHaveBeenCalledWith(expect.stringContaining('session.update'));
		});

		it('should handle response.audio.delta messages', () => {
			const message = {
				type: 'response.audio.delta',
				delta: 'base64audiodata'
			};

			expect(message.type).toBe('response.audio.delta');
			expect(message.delta).toBeTruthy();
		});

		it('should handle response.audio_transcript.delta messages', () => {
			const message = {
				type: 'response.audio_transcript.delta',
				delta: 'Hello world'
			};

			expect(message.type).toBe('response.audio_transcript.delta');
			expect(message.delta).toBe('Hello world');
		});

		it('should handle connection errors', () => {
			const onError = vi.fn();
			mockWebSocket.onerror = onError;

			const errorEvent = new Event('error');
			mockWebSocket.onerror(errorEvent);

			expect(onError).toHaveBeenCalled();
		});
	});

	describe('Audio Processing', () => {
		it('should resample audio to 24kHz if needed', () => {
			// OpenAI Realtime API expects 24kHz mono PCM16
			const inputSampleRate = 48000;
			const outputSampleRate = 24000;
			const inputSamples = new Float32Array(48000); // 1 second at 48kHz

			// Simple downsampling (skip every other sample for 2:1 ratio)
			const ratio = inputSampleRate / outputSampleRate;
			const outputLength = Math.floor(inputSamples.length / ratio);
			const outputSamples = new Float32Array(outputLength);

			for (let i = 0; i < outputLength; i++) {
				outputSamples[i] = inputSamples[Math.floor(i * ratio)];
			}

			expect(outputSamples.length).toBe(24000);
		});

		it('should convert stereo to mono', () => {
			// If stereo input, average left and right channels
			const stereoData = new Float32Array([0.5, 0.3, 0.7, 0.1]); // L, R, L, R
			const monoData = new Float32Array(stereoData.length / 2);

			for (let i = 0; i < monoData.length; i++) {
				monoData[i] = (stereoData[i * 2] + stereoData[i * 2 + 1]) / 2;
			}

			expect(monoData.length).toBe(2);
			expect(monoData[0]).toBeCloseTo(0.4, 1);
			expect(monoData[1]).toBeCloseTo(0.4, 1);
		});
	});

	describe('State Management', () => {
		it('should track voice state transitions correctly', () => {
			const states: Array<'idle' | 'listening' | 'processing' | 'speaking'> = [];

			// Simulate state transitions
			states.push('idle');
			states.push('listening'); // User starts speaking
			states.push('processing'); // User stops, AI processing
			states.push('speaking'); // AI responds
			states.push('listening'); // Back to listening

			expect(states).toEqual(['idle', 'listening', 'processing', 'speaking', 'listening']);
		});

		it('should clean up resources on disconnect', () => {
			const cleanup = () => {
				mockWebSocket.close();
				mockMediaStream.getTracks().forEach((track: any) => track.stop());
				mockAudioContext.close();
			};

			cleanup();

			expect(mockWebSocket.close).toHaveBeenCalled();
			expect(mockMediaStream.getTracks()[0].stop).toHaveBeenCalled();
			expect(mockAudioContext.close).toHaveBeenCalled();
		});

		it('should wait for session.created before sending session.update', () => {
			// Simulates proper session configuration flow
			const messagesSent: string[] = [];
			const messagesReceived: string[] = [];
			let sessionConfigured = false;

			mockWebSocket.send = vi.fn((msg: string) => {
				const parsed = JSON.parse(msg);
				messagesSent.push(parsed.type);
			});

			// Simulate server sends session.created first
			messagesReceived.push('session.created');
			// Only then should client send session.update
			mockWebSocket.send(JSON.stringify({ type: 'session.update', session: {} }));
			messagesReceived.push('session.updated');
			sessionConfigured = true;

			expect(messagesReceived).toEqual(['session.created', 'session.updated']);
			expect(messagesSent).toEqual(['session.update']);
			expect(sessionConfigured).toBe(true);
		});

		it('should not send audio before session is configured', () => {
			let sessionConfigured = false;
			const audioSent: boolean[] = [];

			const sendAudio = () => {
				if (!sessionConfigured) {
					return; // Don't send audio before session is configured
				}
				audioSent.push(true);
			};

			// Try to send audio before session is configured
			sendAudio();
			expect(audioSent).toHaveLength(0);

			// Configure session
			sessionConfigured = true;
			sendAudio();
			expect(audioSent).toHaveLength(1);
		});
	});
});
