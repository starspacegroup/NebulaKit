import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for Reset Page Server
 * TDD: Testing the reset page server-side logic
 */

// Mock SvelteKit redirect
const mockRedirect = vi.fn((status: number, location: string) => {
	const err = new Error('Redirect') as Error & { status: number; location: string };
	err.status = status;
	err.location = location;
	throw err;
});

vi.mock('@sveltejs/kit', () => ({
	redirect: (status: number, location: string) => mockRedirect(status, location)
}));

describe('Reset Page Server', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('load function', () => {
		it('should return empty object when reset route is enabled', async () => {
			const { load } = await import('../../src/routes/reset/+page.server');

			const mockGet = vi.fn().mockResolvedValue(null);

			const result = await load({
				platform: { env: { KV: { get: mockGet } } }
			} as any);

			expect(result).toEqual({});
			expect(mockGet).toHaveBeenCalledWith('reset_route_disabled');
		});

		it('should return empty object when reset_route_disabled is not "true"', async () => {
			const { load } = await import('../../src/routes/reset/+page.server');

			const mockGet = vi.fn().mockResolvedValue('false');

			const result = await load({
				platform: { env: { KV: { get: mockGet } } }
			} as any);

			expect(result).toEqual({});
		});

		it('should redirect to home when reset route is disabled', async () => {
			const { load } = await import('../../src/routes/reset/+page.server');

			const mockGet = vi.fn().mockResolvedValue('true');

			await expect(
				load({
					platform: { env: { KV: { get: mockGet } } }
				} as any)
			).rejects.toMatchObject({ status: 302, location: '/' });
		});

		it('should return empty object when platform is not available', async () => {
			const { load } = await import('../../src/routes/reset/+page.server');

			const result = await load({
				platform: null
			} as any);

			expect(result).toEqual({});
		});

		it('should return empty object when KV is not available', async () => {
			const { load } = await import('../../src/routes/reset/+page.server');

			const result = await load({
				platform: { env: {} }
			} as any);

			expect(result).toEqual({});
		});
	});
});
