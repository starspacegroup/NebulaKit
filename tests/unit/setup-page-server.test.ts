/**
 * Tests for setup page server load function
 */
import { redirect } from '@sveltejs/kit';
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
	user?: { id: string; name: string } | null;
}

interface MockLoadEvent {
	platform?: MockPlatform;
	locals: MockLocals;
}

describe('Setup Page Server', () => {
	let mockKVGet: ReturnType<typeof vi.fn>;
	let load: (event: MockLoadEvent) => Promise<object>;

	beforeEach(async () => {
		vi.resetModules();
		vi.clearAllMocks();
		mockKVGet = vi.fn();

		const module = await import('../../src/routes/setup/+page.server');
		load = module.load as (event: MockLoadEvent) => Promise<object>;
	});

	it('should allow access to setup page when admin has not completed first login', async () => {
		mockKVGet.mockResolvedValue(null);

		const result = await load({
			platform: {
				env: {
					KV: { get: mockKVGet }
				}
			},
			locals: {}
		});

		expect(result).toEqual({});
		expect(mockKVGet).toHaveBeenCalledWith('admin_first_login_completed');
	});

	it('should redirect authenticated user to /admin when setup is locked', async () => {
		mockKVGet.mockResolvedValue('true');

		await expect(
			load({
				platform: {
					env: {
						KV: { get: mockKVGet }
					}
				},
				locals: {
					user: { id: '1', name: 'Admin' }
				}
			})
		).rejects.toThrow('Redirect to /admin');

		expect(redirect).toHaveBeenCalledWith(302, '/admin');
	});

	it('should redirect unauthenticated user to / when setup is locked', async () => {
		mockKVGet.mockResolvedValue('true');

		await expect(
			load({
				platform: {
					env: {
						KV: { get: mockKVGet }
					}
				},
				locals: {}
			})
		).rejects.toThrow('Redirect to /');

		expect(redirect).toHaveBeenCalledWith(302, '/');
	});

	it('should handle missing platform gracefully', async () => {
		const result = await load({
			platform: undefined,
			locals: {}
		});

		expect(result).toEqual({});
	});

	it('should handle missing KV gracefully', async () => {
		const result = await load({
			platform: {
				env: {}
			},
			locals: {}
		});

		expect(result).toEqual({});
	});

	it('should handle null user when setup is locked', async () => {
		mockKVGet.mockResolvedValue('true');

		await expect(
			load({
				platform: {
					env: {
						KV: { get: mockKVGet }
					}
				},
				locals: {
					user: null
				}
			})
		).rejects.toThrow('Redirect to /');
	});
});
