import { describe, expect, it, vi } from 'vitest';

/**
 * Tests for Chat Page Voice Availability
 * Ensures voice chat UI is hidden when no AI keys have voice enabled
 */

describe('Chat Page Voice Availability', () => {
	it('should return false when AI keys exist but voice is not enabled', async () => {
		const mockPlatform = {
			env: {
				KV: {
					get: vi
						.fn()
						.mockResolvedValueOnce(JSON.stringify(['key1']))
						.mockResolvedValueOnce(
							JSON.stringify({
								id: 'key1',
								name: 'OpenAI Key',
								provider: 'openai',
								apiKey: 'sk-test',
								enabled: true,
								voiceEnabled: false
							})
						)
						.mockResolvedValueOnce(JSON.stringify(['key1']))
						.mockResolvedValueOnce(
							JSON.stringify({
								id: 'key1',
								name: 'OpenAI Key',
								provider: 'openai',
								apiKey: 'sk-test',
								enabled: true,
								voiceEnabled: false
							})
						)
				}
			}
		};

		const mockLocals = {
			user: { id: 'user123', isAdmin: false, isOwner: false }
		};

		const module = await import('../../src/routes/chat/+page.server');
		const result = await module.load({ platform: mockPlatform, locals: mockLocals } as any);

		expect((result as { voiceAvailable: boolean }).voiceAvailable).toBe(false);
	});

	it('should return false when voice is undefined (not set)', async () => {
		const mockPlatform = {
			env: {
				KV: {
					get: vi
						.fn()
						.mockResolvedValueOnce(JSON.stringify(['key1']))
						.mockResolvedValueOnce(
							JSON.stringify({
								id: 'key1',
								name: 'OpenAI Key',
								provider: 'openai',
								apiKey: 'sk-test',
								enabled: true
								// voiceEnabled is undefined
							})
						)
						.mockResolvedValueOnce(JSON.stringify(['key1']))
						.mockResolvedValueOnce(
							JSON.stringify({
								id: 'key1',
								name: 'OpenAI Key',
								provider: 'openai',
								apiKey: 'sk-test',
								enabled: true
							})
						)
				}
			}
		};

		const mockLocals = {
			user: { id: 'user123', isAdmin: false, isOwner: false }
		};

		const module = await import('../../src/routes/chat/+page.server');
		const result = await module.load({ platform: mockPlatform, locals: mockLocals } as any);

		expect((result as { voiceAvailable: boolean }).voiceAvailable).toBe(false);
	});

	it('should return true when at least one AI key has voice enabled', async () => {
		const mockPlatform = {
			env: {
				KV: {
					get: vi
						.fn()
						.mockResolvedValueOnce(JSON.stringify(['key1', 'key2']))
						.mockResolvedValueOnce(
							JSON.stringify({
								id: 'key1',
								name: 'OpenAI Key 1',
								provider: 'openai',
								apiKey: 'sk-test1',
								enabled: true,
								voiceEnabled: false
							})
						)
						.mockResolvedValueOnce(JSON.stringify(['key1', 'key2']))
						.mockResolvedValueOnce(
							JSON.stringify({
								id: 'key1',
								name: 'OpenAI Key 1',
								provider: 'openai',
								apiKey: 'sk-test1',
								enabled: true,
								voiceEnabled: false
							})
						)
						.mockResolvedValueOnce(
							JSON.stringify({
								id: 'key2',
								name: 'OpenAI Key 2',
								provider: 'openai',
								apiKey: 'sk-test2',
								enabled: true,
								voiceEnabled: true,
								voiceModel: 'gpt-4o-realtime-preview-2024-12-17'
							})
						)
				}
			}
		};

		const mockLocals = {
			user: { id: 'user123', isAdmin: false, isOwner: false }
		};

		const module = await import('../../src/routes/chat/+page.server');
		const result = await module.load({ platform: mockPlatform, locals: mockLocals } as any);

		expect((result as { voiceAvailable: boolean }).voiceAvailable).toBe(true);
	});

	it('should return false when voice is enabled but AI key is disabled', async () => {
		const mockPlatform = {
			env: {
				KV: {
					get: vi
						.fn()
						.mockResolvedValueOnce(JSON.stringify(['key1']))
						.mockResolvedValueOnce(
							JSON.stringify({
								id: 'key1',
								name: 'OpenAI Key',
								provider: 'openai',
								apiKey: 'sk-test',
								enabled: false,
								voiceEnabled: true
							})
						)
				}
			}
		};

		const mockLocals = {
			user: { id: 'user123', isAdmin: false, isOwner: false }
		};

		const module = await import('../../src/routes/chat/+page.server');

		try {
			await module.load({ platform: mockPlatform, locals: mockLocals } as any);
			expect.fail('Expected redirect');
		} catch (err: any) {
			// Should redirect because no enabled keys exist
			expect(err.status).toBe(302);
		}
	});

	it('should find voice-enabled key among multiple keys', async () => {
		const mockPlatform = {
			env: {
				KV: {
					get: vi
						.fn()
						.mockResolvedValueOnce(JSON.stringify(['key1', 'key2', 'key3']))
						.mockResolvedValueOnce(
							JSON.stringify({
								id: 'key1',
								name: 'Key 1',
								provider: 'openai',
								apiKey: 'sk-1',
								enabled: true
							})
						)
						.mockResolvedValueOnce(JSON.stringify(['key1', 'key2', 'key3']))
						.mockResolvedValueOnce(
							JSON.stringify({
								id: 'key1',
								name: 'Key 1',
								provider: 'openai',
								apiKey: 'sk-1',
								enabled: true
							})
						)
						.mockResolvedValueOnce(
							JSON.stringify({
								id: 'key2',
								name: 'Key 2',
								provider: 'openai',
								apiKey: 'sk-2',
								enabled: true,
								voiceEnabled: true,
								voiceModel: 'gpt-4o-realtime-preview-2024-12-17'
							})
						)
				}
			}
		};

		const mockLocals = {
			user: { id: 'user123', isAdmin: false, isOwner: false }
		};

		const module = await import('../../src/routes/chat/+page.server');
		const result = await module.load({ platform: mockPlatform, locals: mockLocals } as any);

		expect((result as { voiceAvailable: boolean }).voiceAvailable).toBe(true);
	});
});
