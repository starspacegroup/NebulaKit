import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRedirect = vi.fn((status: number, location: string) => {
	const err = new Error('Redirect') as Error & { status: number; location: string };
	err.status = status;
	err.location = location;
	throw err;
});

vi.mock('@sveltejs/kit', () => ({
	redirect: (status: number, location: string) => mockRedirect(status, location)
}));

describe('Auth Signup Page Server', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	it('should redirect logged-in user to home page', async () => {
		const { load } = await import('../../src/routes/auth/signup/+page.server');

		await expect(
			load({
				locals: {
					user: { id: '1', login: 'user', email: 'user@test.com', isOwner: false }
				},
				url: new URL('http://localhost/auth/signup'),
				platform: {}
			} as any)
		).rejects.toMatchObject({ status: 302, location: '/' });
	});

	it('should redirect logged-in user with unauthorized error to home with forbidden', async () => {
		const { load } = await import('../../src/routes/auth/signup/+page.server');

		await expect(
			load({
				locals: {
					user: { id: '1', login: 'user', email: 'user@test.com', isOwner: false }
				},
				url: new URL('http://localhost/auth/signup?error=unauthorized'),
				platform: {}
			} as any)
		).rejects.toMatchObject({ status: 302, location: '/?error=forbidden' });
	});

	it('should return configuredProviders for non-logged-in user', async () => {
		const { load } = await import('../../src/routes/auth/signup/+page.server');

		const result = (await load({
			locals: {},
			url: new URL('http://localhost/auth/signup'),
			platform: {
				env: {
					GITHUB_CLIENT_ID: 'client-id',
					GITHUB_CLIENT_SECRET: 'client-secret'
				}
			}
		} as any)) as any;

		expect(result).toEqual({
			configuredProviders: {
				github: true,
				discord: false
			}
		});
	});

	it('should return configured providers from KV when available', async () => {
		const { load } = await import('../../src/routes/auth/signup/+page.server');

		const result = (await load({
			locals: { user: null },
			url: new URL('http://localhost/auth/signup'),
			platform: {
				env: {
					KV: {
						get: vi.fn().mockImplementation((key: string) => {
							if (key === 'auth_config:discord') {
								return JSON.stringify({
									clientId: 'discord-client-id',
									clientSecret: 'discord-client-secret'
								});
							}
							return null;
						})
					}
				}
			}
		} as any)) as any;

		expect(result).toEqual({
			configuredProviders: {
				github: false,
				discord: true
			}
		});
	});
});
