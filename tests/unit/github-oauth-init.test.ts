/**
 * Extended tests for GitHub OAuth initiation endpoint
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock modules
vi.mock('@sveltejs/kit', async () => {
	const actual = await vi.importActual('@sveltejs/kit');
	return {
		...actual,
		redirect: vi.fn((status: number, location: string) => {
			const error = new Error(`Redirect to ${location}`) as Error & {
				status: number;
				location: string;
			};
			error.status = status;
			error.location = location;
			throw error;
		})
	};
});

import { GET } from '../../src/routes/api/auth/github/+server';

describe('GitHub OAuth Initiation - Extended Coverage', () => {
	let mockKVGet: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockKVGet = vi.fn();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	const createMockEvent = (
		overrides: {
			envClientId?: string | null;
			kvGet?: ReturnType<typeof vi.fn>;
			platform?: object | null;
		} = {}
	) => {
		return {
			url: new URL('http://localhost/api/auth/github'),
			cookies: { set: vi.fn(), get: vi.fn() },
			locals: {},
			platform:
				overrides.platform !== null
					? {
							env: {
								SESSION_SECRET: 'test-session-secret',
								GITHUB_CLIENT_ID: overrides.envClientId,
								DB: transactionDatabase(),
								KV: overrides.kvGet
									? {
											get: overrides.kvGet
										}
									: undefined
							}
						}
					: overrides.platform
		};
	};

	it('should use environment variable clientId when available', async () => {
		await expect(
			GET(createMockEvent({ envClientId: 'env-client-id' }) as unknown as Parameters<typeof GET>[0])
		).rejects.toThrow('Redirect to https://github.com/login/oauth/authorize');
	});

	it('should fetch clientId from KV when env variable not set', async () => {
		mockKVGet.mockResolvedValue(JSON.stringify({ clientId: 'kv-client-id' }));

		await expect(
			GET(createMockEvent({ kvGet: mockKVGet }) as unknown as Parameters<typeof GET>[0])
		).rejects.toThrow('Redirect to https://github.com/login/oauth/authorize');

		expect(mockKVGet).toHaveBeenCalledWith('auth_config:github');
	});

	it('should redirect to setup when no clientId is available', async () => {
		mockKVGet.mockResolvedValue(null);

		await expect(
			GET(createMockEvent({ kvGet: mockKVGet }) as unknown as Parameters<typeof GET>[0])
		).rejects.toThrow('Redirect to /setup?error=oauth_not_configured');
	});

	it('should handle KV fetch errors gracefully', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		mockKVGet.mockRejectedValue(new Error('KV error'));

		await expect(
			GET(createMockEvent({ kvGet: mockKVGet }) as unknown as Parameters<typeof GET>[0])
		).rejects.toThrow('Redirect to /setup?error=oauth_not_configured');

		expect(consoleSpy).toHaveBeenCalled();
		consoleSpy.mockRestore();
	});

	it('should redirect to setup when platform is not available', async () => {
		await expect(
			GET(createMockEvent({ platform: null }) as unknown as Parameters<typeof GET>[0])
		).rejects.toThrow('Redirect to /setup?error=oauth_not_configured');
	});

	it('should handle null stored config from KV', async () => {
		mockKVGet.mockResolvedValue(null);

		await expect(
			GET(createMockEvent({ kvGet: mockKVGet }) as unknown as Parameters<typeof GET>[0])
		).rejects.toThrow('Redirect to /setup?error=oauth_not_configured');
	});

	it('should redirect to dev simulation when bypass is enabled and OAuth is not configured', async () => {
		mockKVGet.mockResolvedValue(null);

		await expect(
			GET({
				url: new URL('http://localhost/api/auth/github'),
				platform: {
					env: {
						GITHUB_CLIENT_ID: undefined,
						DEV_AUTH_BYPASS: 'true',
						KV: {
							get: mockKVGet
						}
					}
				}
			} as unknown as Parameters<typeof GET>[0])
		).rejects.toThrow('Redirect to /api/auth/dev-simulate?provider=github');
	});

	it('should pass through role when redirecting to dev simulation', async () => {
		mockKVGet.mockResolvedValue(null);

		await expect(
			GET({
				url: new URL('http://localhost/api/auth/github?role=superadmin'),
				platform: {
					env: {
						GITHUB_CLIENT_ID: undefined,
						DEV_AUTH_BYPASS: 'true',
						KV: {
							get: mockKVGet
						}
					}
				}
			} as unknown as Parameters<typeof GET>[0])
		).rejects.toThrow('Redirect to /api/auth/dev-simulate?provider=github&role=superadmin');
	});

	it('should pass through mode=link when redirecting to dev simulation', async () => {
		mockKVGet.mockResolvedValue(null);

		await expect(
			GET({
				url: new URL('http://localhost/api/auth/github?mode=link'),
				platform: {
					env: {
						GITHUB_CLIENT_ID: undefined,
						DEV_AUTH_BYPASS: 'true',
						KV: {
							get: mockKVGet
						}
					}
				}
			} as unknown as Parameters<typeof GET>[0])
		).rejects.toThrow('Redirect to /api/auth/dev-simulate?provider=github&mode=link');
	});

	it('requires an authenticated user for account linking', async () => {
		const event = createMockEvent({ envClientId: 'env-client-id' });
		event.url = new URL('http://localhost/api/auth/github?mode=link');

		await expect(GET(event as unknown as Parameters<typeof GET>[0])).rejects.toThrow(
			'Redirect to /auth/login?error=authentication_required'
		);
	});

	it('requires a signed database session for account linking', async () => {
		const event = createMockEvent({ envClientId: 'env-client-id' });
		event.url = new URL('http://localhost/api/auth/github?mode=link');
		event.locals = { user: { id: 'user-1' } };

		await expect(GET(event as unknown as Parameters<typeof GET>[0])).rejects.toThrow(
			'Redirect to /auth/login?error=authentication_required'
		);
	});

	it('binds link state to the authenticated database session', async () => {
		const { signValue } = await import('../../src/lib/utils/session');
		const event = createMockEvent({ envClientId: 'env-client-id' });
		event.url = new URL('http://localhost/api/auth/github?mode=link');
		event.locals = { user: { id: 'user-1' } };
		event.cookies.get.mockReturnValue(
			await signValue({ token: 'opaque-session-token' }, 'test-session-secret')
		);

		await expect(GET(event as unknown as Parameters<typeof GET>[0])).rejects.toThrow(
			'Redirect to https://github.com/login/oauth/authorize'
		);
	});
});

function transactionDatabase() {
	return {
		prepare: vi.fn(() => ({
			bind: vi.fn(() => ({
				run: vi.fn().mockResolvedValue({ success: true })
			}))
		}))
	};
}
