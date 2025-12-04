import { describe, expect, it, vi } from 'vitest';

describe('Chat Page Redirect', () => {
	it('should redirect to /admin when no API keys enabled and user is admin', async () => {
		// Arrange
		const mockPlatform = {
			env: {
				KV: {
					get: vi.fn().mockResolvedValue(null) // No API keys
				}
			}
		};

		const mockLocals = {
			user: {
				id: '1',
				login: 'admin',
				email: 'admin@test.com',
				isOwner: true,
				isAdmin: true
			}
		};

		// Dynamic import to load the server module
		const module = await import('../../src/routes/chat/+page.server');

		// Act & Assert - redirect() throws an error in SvelteKit
		try {
			await module.load({
				platform: mockPlatform,
				locals: mockLocals
			} as any);
			expect.fail('Expected redirect to be thrown');
		} catch (error: any) {
			expect(error.status).toBe(302);
			expect(error.location).toBe('/admin');
		}
	});

	it('should redirect to / when no API keys enabled and user is not admin', async () => {
		// Arrange
		const mockPlatform = {
			env: {
				KV: {
					get: vi.fn().mockResolvedValue(null) // No API keys
				}
			}
		};

		const mockLocals = {
			user: {
				id: '1',
				login: 'user',
				email: 'user@test.com',
				isOwner: false,
				isAdmin: false
			}
		};

		// Dynamic import to load the server module
		const module = await import('../../src/routes/chat/+page.server');

		// Act & Assert - redirect() throws an error in SvelteKit
		try {
			await module.load({
				platform: mockPlatform,
				locals: mockLocals
			} as any);
			expect.fail('Expected redirect to be thrown');
		} catch (error: any) {
			expect(error.status).toBe(302);
			expect(error.location).toBe('/');
		}
	});

	it('should redirect to /auth/login when user is not logged in', async () => {
		// Arrange - No need to mock keys since auth check happens first
		const mockPlatform = {
			env: {
				KV: {
					get: vi.fn().mockResolvedValue(null) // No API keys
				}
			}
		};

		const mockLocals = {
			user: undefined // Not logged in
		};

		// Dynamic import to load the server module
		const module = await import('../../src/routes/chat/+page.server');

		// Act & Assert - redirect() throws an error in SvelteKit
		try {
			await module.load({
				platform: mockPlatform,
				locals: mockLocals
			} as any);
			expect.fail('Expected redirect to be thrown');
		} catch (error: any) {
			expect(error.status).toBe(302);
			expect(error.location).toBe('/auth/login?redirect=/chat');
		}
	});

	it('should allow access when at least one API key is enabled', async () => {
		// Arrange
		const mockKeysList = JSON.stringify(['key1', 'key2']);
		const mockKeyData = JSON.stringify({
			id: 'key1',
			name: 'Test Key',
			provider: 'openai',
			enabled: true
		});

		const mockKV = {
			get: vi.fn().mockImplementation((key: string) => {
				if (key === 'ai_keys_list') return Promise.resolve(mockKeysList);
				if (key === 'ai_key:key1') return Promise.resolve(mockKeyData);
				return Promise.resolve(null);
			})
		};

		const mockPlatform = {
			env: {
				KV: mockKV
			}
		};

		const mockLocals = {
			user: {
				id: '1',
				login: 'user',
				email: 'user@test.com',
				isOwner: false,
				isAdmin: false
			}
		};

		// Dynamic import to load the server module
		const module = await import('../../src/routes/chat/+page.server');

		// Act
		const result = await module.load({
			platform: mockPlatform,
			locals: mockLocals
		} as any);

		// Assert - Should not redirect, allowing access
		expect(result).toHaveProperty('voiceAvailable');
		expect(typeof (result as { voiceAvailable: boolean }).voiceAvailable).toBe('boolean');
	});

	it('should redirect when all API keys are disabled', async () => {
		// Arrange
		const mockKeysList = JSON.stringify(['key1', 'key2']);
		const mockKeyData1 = JSON.stringify({
			id: 'key1',
			name: 'Test Key 1',
			provider: 'openai',
			enabled: false
		});
		const mockKeyData2 = JSON.stringify({
			id: 'key2',
			name: 'Test Key 2',
			provider: 'anthropic',
			enabled: false
		});

		const mockKV = {
			get: vi.fn().mockImplementation((key: string) => {
				if (key === 'ai_keys_list') return Promise.resolve(mockKeysList);
				if (key === 'ai_key:key1') return Promise.resolve(mockKeyData1);
				if (key === 'ai_key:key2') return Promise.resolve(mockKeyData2);
				return Promise.resolve(null);
			})
		};

		const mockPlatform = {
			env: {
				KV: mockKV
			}
		};

		const mockLocals = {
			user: {
				id: '1',
				login: 'admin',
				email: 'admin@test.com',
				isOwner: true,
				isAdmin: true
			}
		};

		// Dynamic import to load the server module
		const module = await import('../../src/routes/chat/+page.server');

		// Act & Assert - redirect() throws an error in SvelteKit
		try {
			await module.load({
				platform: mockPlatform,
				locals: mockLocals
			} as any);
			expect.fail('Expected redirect to be thrown');
		} catch (error: any) {
			expect(error.status).toBe(302);
			expect(error.location).toBe('/admin');
		}
	});
});
