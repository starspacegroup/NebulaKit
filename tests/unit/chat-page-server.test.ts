/**
 * Extended tests for chat page server load function
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock SvelteKit redirect
vi.mock('@sveltejs/kit', () => ({
	redirect: vi.fn((status: number, location: string) => {
		const error = new Error(`Redirect to ${location}`) as Error & {
			status: number;
			location: string;
		};
		error.status = status;
		error.location = location;
		throw error;
	})
}));

interface MockPlatform {
	env?: {
		KV?: {
			get: ReturnType<typeof vi.fn>;
		};
	};
}

interface MockLocals {
	user?: { id: string; isAdmin?: boolean; isOwner?: boolean } | null;
}

interface MockLoadEvent {
	platform?: MockPlatform;
	locals: MockLocals;
}

describe('Chat Page Server - Extended Coverage', () => {
	let mockKVGet: ReturnType<typeof vi.fn>;
	let load: (event: MockLoadEvent) => Promise<{ voiceAvailable: boolean; userId: string }>;

	beforeEach(async () => {
		vi.resetModules();
		vi.clearAllMocks();
		mockKVGet = vi.fn();

		const module = await import('../../src/routes/chat/+page.server');
		load = module.load as (
			event: MockLoadEvent
		) => Promise<{ voiceAvailable: boolean; userId: string }>;
	});

	describe('Authentication', () => {
		it('should redirect unauthenticated users to login', async () => {
			await expect(
				load({
					platform: {
						env: {
							KV: { get: mockKVGet }
						}
					},
					locals: {}
				})
			).rejects.toThrow('Redirect to /auth/login?redirect=/chat');
		});

		it('should redirect when user is null', async () => {
			await expect(
				load({
					platform: {
						env: {
							KV: { get: mockKVGet }
						}
					},
					locals: { user: null }
				})
			).rejects.toThrow('Redirect to /auth/login?redirect=/chat');
		});

		it('should return userId for authenticated users', async () => {
			mockKVGet
				.mockResolvedValueOnce(JSON.stringify(['key1']))
				.mockResolvedValueOnce(JSON.stringify({ id: 'key1', enabled: true }))
				.mockResolvedValueOnce(JSON.stringify(['key1']))
				.mockResolvedValueOnce(JSON.stringify({ id: 'key1', enabled: true, voiceEnabled: false }));

			const result = await load({
				platform: {
					env: {
						KV: { get: mockKVGet }
					}
				},
				locals: {
					user: { id: 'user123', isAdmin: false, isOwner: false }
				}
			});

			expect(result.userId).toBe('user123');
		});
	});

	it('should return voiceAvailable: true when providers exist with voice enabled', async () => {
		mockKVGet
			// First call for checkEnabledProviders
			.mockResolvedValueOnce(JSON.stringify(['key1']))
			.mockResolvedValueOnce(JSON.stringify({ id: 'key1', enabled: true }))
			// Second set for checkVoiceAvailability
			.mockResolvedValueOnce(JSON.stringify(['key1']))
			.mockResolvedValueOnce(JSON.stringify({ id: 'key1', enabled: true, voiceEnabled: true }));

		const result = await load({
			platform: {
				env: {
					KV: { get: mockKVGet }
				}
			},
			locals: {
				user: { id: 'user1' }
			}
		});

		expect(result.voiceAvailable).toBe(true);
	});

	it('should return voiceAvailable: false when providers exist but voice not enabled', async () => {
		mockKVGet
			// First call for checkEnabledProviders
			.mockResolvedValueOnce(JSON.stringify(['key1']))
			.mockResolvedValueOnce(JSON.stringify({ id: 'key1', enabled: true }))
			// Second set for checkVoiceAvailability
			.mockResolvedValueOnce(JSON.stringify(['key1']))
			.mockResolvedValueOnce(JSON.stringify({ id: 'key1', enabled: true, voiceEnabled: false }));

		const result = await load({
			platform: {
				env: {
					KV: { get: mockKVGet }
				}
			},
			locals: {
				user: { id: 'user1' }
			}
		});

		expect(result.voiceAvailable).toBe(false);
	});

	it('should redirect admin to /admin when no providers exist', async () => {
		mockKVGet.mockResolvedValue(null);

		await expect(
			load({
				platform: {
					env: {
						KV: { get: mockKVGet }
					}
				},
				locals: {
					user: { id: '1', isAdmin: true }
				}
			})
		).rejects.toThrow('Redirect to /admin');
	});

	it('should redirect owner to /admin when no providers exist', async () => {
		mockKVGet.mockResolvedValue(null);

		await expect(
			load({
				platform: {
					env: {
						KV: { get: mockKVGet }
					}
				},
				locals: {
					user: { id: '1', isOwner: true }
				}
			})
		).rejects.toThrow('Redirect to /admin');
	});

	it('should redirect regular user to / when no providers exist', async () => {
		mockKVGet.mockResolvedValue(null);

		await expect(
			load({
				platform: {
					env: {
						KV: { get: mockKVGet }
					}
				},
				locals: {
					user: { id: '1', isAdmin: false, isOwner: false }
				}
			})
		).rejects.toThrow('Redirect to /');
	});

	it('should handle missing platform gracefully for authenticated user', async () => {
		await expect(
			load({
				platform: undefined,
				locals: {
					user: { id: 'user1' }
				}
			})
		).rejects.toThrow('Redirect to /');
	});

	it('should handle provider with explicitly false enabled', async () => {
		mockKVGet
			.mockResolvedValueOnce(JSON.stringify(['key1']))
			.mockResolvedValueOnce(JSON.stringify({ id: 'key1', enabled: false }));

		await expect(
			load({
				platform: {
					env: {
						KV: { get: mockKVGet }
					}
				},
				locals: {
					user: { id: 'user1' }
				}
			})
		).rejects.toThrow('Redirect to /');
	});

	it('should handle voice availability when voice check throws error', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		mockKVGet
			// First call for checkEnabledProviders succeeds
			.mockResolvedValueOnce(JSON.stringify(['key1']))
			.mockResolvedValueOnce(JSON.stringify({ id: 'key1', enabled: true }))
			// Voice check throws
			.mockRejectedValueOnce(new Error('Voice check error'));

		const result = await load({
			platform: {
				env: {
					KV: { get: mockKVGet }
				}
			},
			locals: {
				user: { id: 'user1' }
			}
		});

		expect(result.voiceAvailable).toBe(false);
		consoleSpy.mockRestore();
	});

	it('should handle multiple providers where one has voice enabled', async () => {
		mockKVGet
			// checkEnabledProviders
			.mockResolvedValueOnce(JSON.stringify(['key1', 'key2']))
			.mockResolvedValueOnce(JSON.stringify({ id: 'key1', enabled: true }))
			// checkVoiceAvailability
			.mockResolvedValueOnce(JSON.stringify(['key1', 'key2']))
			.mockResolvedValueOnce(JSON.stringify({ id: 'key1', enabled: true, voiceEnabled: false }))
			.mockResolvedValueOnce(JSON.stringify({ id: 'key2', enabled: true, voiceEnabled: true }));

		const result = await load({
			platform: {
				env: {
					KV: { get: mockKVGet }
				}
			},
			locals: {
				user: { id: 'user1' }
			}
		});

		expect(result.voiceAvailable).toBe(true);
	});

	it('should handle voice check with disabled provider that has voice', async () => {
		mockKVGet
			// checkEnabledProviders - finds enabled provider
			.mockResolvedValueOnce(JSON.stringify(['key1', 'key2']))
			.mockResolvedValueOnce(JSON.stringify({ id: 'key1', enabled: false }))
			.mockResolvedValueOnce(JSON.stringify({ id: 'key2', enabled: true }))
			// checkVoiceAvailability - only key1 has voice but is disabled
			.mockResolvedValueOnce(JSON.stringify(['key1', 'key2']))
			.mockResolvedValueOnce(JSON.stringify({ id: 'key1', enabled: false, voiceEnabled: true }))
			.mockResolvedValueOnce(JSON.stringify({ id: 'key2', enabled: true, voiceEnabled: false }));

		const result = await load({
			platform: {
				env: {
					KV: { get: mockKVGet }
				}
			},
			locals: {
				user: { id: 'user1' }
			}
		});

		expect(result.voiceAvailable).toBe(false);
	});

	it('should handle null key data in voice check', async () => {
		mockKVGet
			// checkEnabledProviders
			.mockResolvedValueOnce(JSON.stringify(['key1']))
			.mockResolvedValueOnce(JSON.stringify({ id: 'key1', enabled: true }))
			// checkVoiceAvailability - null key data
			.mockResolvedValueOnce(JSON.stringify(['key1']))
			.mockResolvedValueOnce(null);

		const result = await load({
			platform: {
				env: {
					KV: { get: mockKVGet }
				}
			},
			locals: {
				user: { id: 'user1' }
			}
		});

		expect(result.voiceAvailable).toBe(false);
	});
});
