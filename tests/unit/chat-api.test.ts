import { describe, expect, it, vi } from 'vitest';

/**
 * Tests for Chat API Endpoints
 * Following TDD: Write tests first, then implement the endpoints
 */

describe('POST /api/chat/stream - Text Chat Streaming', () => {
	it('should stream chat responses from OpenAI', async () => {
		// Mock platform with OpenAI key
		const mockKV = {
			get: vi.fn().mockImplementation((key: string) => {
				if (key === 'ai_keys_list') {
					return Promise.resolve(JSON.stringify(['key1']));
				}
				if (key === 'ai_key:key1') {
					return Promise.resolve(
						JSON.stringify({
							id: 'key1',
							provider: 'openai',
							apiKey: 'sk-test123',
							enabled: true
						})
					);
				}
				return Promise.resolve(null);
			})
		};

		const platform = { env: { KV: mockKV } };
		const locals = { user: { id: 'user1', isAdmin: false } };

		// Mock request
		const request = new Request('http://localhost/api/chat/stream', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				messages: [{ role: 'user', content: 'Hello' }]
			})
		});

		// Import endpoint
		const module = await import('$lib/../routes/api/chat/stream/+server');
		const response = await module.POST({ request, platform, locals } as any);

		expect(response.ok).toBe(true);
		expect(response.headers.get('Content-Type')).toBe('text/event-stream');
		expect(response.headers.get('Cache-Control')).toBe('no-cache');
	});

	it('should return 401 if user is not authenticated', async () => {
		const request = new Request('http://localhost/api/chat/stream', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ messages: [] })
		});

		const locals = { user: null };
		const platform = { env: { KV: {} } };

		const module = await import('$lib/../routes/api/chat/stream/+server');

		try {
			await module.POST({ request, platform, locals } as any);
			expect.fail('Expected error to be thrown');
		} catch (err: any) {
			expect(err.status).toBe(401);
		}
	});

	it('should return 400 if messages are invalid', async () => {
		const request = new Request('http://localhost/api/chat/stream', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ messages: 'invalid' })
		});

		const locals = { user: { id: 'user1' } };
		const platform = { env: { KV: {} } };

		const module = await import('$lib/../routes/api/chat/stream/+server');

		try {
			await module.POST({ request, platform, locals } as any);
			expect.fail('Expected error to be thrown');
		} catch (err: any) {
			expect(err.status).toBe(400);
		}
	});

	it('should return 503 if no OpenAI key is available', async () => {
		const mockKV = {
			get: vi.fn().mockResolvedValue(null)
		};

		const request = new Request('http://localhost/api/chat/stream', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				messages: [{ role: 'user', content: 'Hello' }]
			})
		});

		const locals = { user: { id: 'user1' } };
		const platform = { env: { KV: mockKV } };

		const module = await import('$lib/../routes/api/chat/stream/+server');

		try {
			await module.POST({ request, platform, locals } as any);
			expect.fail('Expected error to be thrown');
		} catch (err: any) {
			expect(err.status).toBe(503);
		}
	});
});

describe('POST /api/chat/voice/session - Voice Chat Session', () => {
	it('should create ephemeral token for voice chat', async () => {
		// Mock the OpenAI API call
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				client_secret: {
					value: 'ephemeral-token-123'
				}
			})
		});
		globalThis.fetch = mockFetch as any;

		const mockKV = {
			get: vi.fn().mockImplementation((key: string) => {
				if (key === 'ai_keys_list') {
					return Promise.resolve(JSON.stringify(['key1']));
				}
				if (key === 'ai_key:key1') {
					return Promise.resolve(
						JSON.stringify({
							id: 'key1',
							provider: 'openai',
							apiKey: 'sk-test123',
							enabled: true,
							voiceEnabled: true,
							voiceModel: 'gpt-4o-realtime-preview-2024-12-17'
						})
					);
				}
				return Promise.resolve(null);
			})
		};

		const platform = { env: { KV: mockKV } };
		const locals = { user: { id: 'user1', isAdmin: false } };

		const request = new Request('http://localhost/api/chat/voice/session', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' }
		});

		const module = await import('$lib/../routes/api/chat/voice/session/+server');
		const response = await module.POST({ request, platform, locals } as any);

		expect(response.ok).toBe(true);
		const data = await response.json();
		expect(data).toHaveProperty('token');
		expect(data.token).toBe('ephemeral-token-123');
	});

	it('should return 401 if user is not authenticated', async () => {
		const request = new Request('http://localhost/api/chat/voice/session', {
			method: 'POST'
		});

		const locals = { user: null };
		const platform = { env: { KV: {} } };

		const module = await import('$lib/../routes/api/chat/voice/session/+server');

		try {
			await module.POST({ request, platform, locals } as any);
			expect.fail('Expected error to be thrown');
		} catch (err: any) {
			expect(err.status).toBe(401);
		}
	});

	it('should return 503 if no OpenAI key is available', async () => {
		const mockKV = {
			get: vi.fn().mockResolvedValue(null)
		};

		const request = new Request('http://localhost/api/chat/voice/session', {
			method: 'POST'
		});

		const locals = { user: { id: 'user1' } };
		const platform = { env: { KV: mockKV } };

		const module = await import('$lib/../routes/api/chat/voice/session/+server');

		try {
			await module.POST({ request, platform, locals } as any);
			expect.fail('Expected error to be thrown');
		} catch (err: any) {
			expect(err.status).toBe(503);
		}
	});
});
