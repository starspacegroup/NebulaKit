import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for Auth Login Page Server
 * TDD: Testing the login page server-side logic
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

describe('Auth Login Page Server', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('load function', () => {
		it('should redirect logged-in user to home page', async () => {
			const { load } = await import('../../src/routes/auth/login/+page.server');

			const mockUrl = new URL('http://localhost/auth/login');

			await expect(
				load({
					locals: {
						user: { id: '1', login: 'user', email: 'user@test.com', isOwner: false }
					},
					url: mockUrl
				} as any)
			).rejects.toMatchObject({ status: 302, location: '/' });
		});

		it('should redirect logged-in user with unauthorized error to home with forbidden', async () => {
			const { load } = await import('../../src/routes/auth/login/+page.server');

			const mockUrl = new URL('http://localhost/auth/login?error=unauthorized');

			await expect(
				load({
					locals: {
						user: { id: '1', login: 'user', email: 'user@test.com', isOwner: false }
					},
					url: mockUrl
				} as any)
			).rejects.toMatchObject({ status: 302, location: '/?error=forbidden' });
		});

		it('should return configuredProviders for non-logged-in user', async () => {
			const { load } = await import('../../src/routes/auth/login/+page.server');

			const mockUrl = new URL('http://localhost/auth/login');

			const result = await load({
				locals: {},
				url: mockUrl
			} as any);

			expect(result).toEqual({
				configuredProviders: {
					github: false,
					discord: false
				},
				simulatedProviders: {
					github: false,
					discord: false
				},
				devAuthSimulationEnabled: false
			});
		});

		it('should return configuredProviders for non-logged-in user even with error param', async () => {
			const { load } = await import('../../src/routes/auth/login/+page.server');

			const mockUrl = new URL('http://localhost/auth/login?error=unauthorized');

			const result = await load({
				locals: { user: null },
				url: mockUrl
			} as any);

			expect(result).toEqual({
				configuredProviders: {
					github: false,
					discord: false
				},
				simulatedProviders: {
					github: false,
					discord: false
				},
				devAuthSimulationEnabled: false
			});
		});

		it('should expose simulated providers when DEV_AUTH_BYPASS is enabled', async () => {
			const { load } = await import('../../src/routes/auth/login/+page.server');

			const result = await load({
				locals: { user: null },
				url: new URL('http://localhost/auth/login'),
				platform: {
					env: {
						DEV_AUTH_BYPASS: 'true'
					}
				}
			} as any);

			expect(result).toEqual({
				configuredProviders: {
					github: false,
					discord: false
				},
				simulatedProviders: {
					github: true,
					discord: true
				},
				devAuthSimulationEnabled: true
			});
		});

		it('should handle logged-in owner user', async () => {
			const { load } = await import('../../src/routes/auth/login/+page.server');

			const mockUrl = new URL('http://localhost/auth/login');

			await expect(
				load({
					locals: {
						user: { id: '1', login: 'owner', email: 'owner@test.com', isOwner: true }
					},
					url: mockUrl
				} as any)
			).rejects.toMatchObject({ status: 302, location: '/' });
		});
	});
});
