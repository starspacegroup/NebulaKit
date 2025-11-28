/**
 * Extended tests for GitHub OAuth callback endpoint
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
		}),
		isRedirect: vi.fn((err: unknown) => {
			return err && typeof err === 'object' && 'location' in err;
		})
	};
});

import { GET } from '../../src/routes/api/auth/github/callback/+server';

describe('GitHub OAuth Callback - Extended Coverage', () => {
	let mockFetch: ReturnType<typeof vi.fn>;
	let mockKVGet: ReturnType<typeof vi.fn>;
	let mockKVPut: ReturnType<typeof vi.fn>;
	let mockDBPrepare: ReturnType<typeof vi.fn>;
	let mockCookiesSet: ReturnType<typeof vi.fn>;
	let consoleSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		mockFetch = vi.fn();
		mockKVGet = vi.fn();
		mockKVPut = vi.fn();
		mockDBPrepare = vi.fn();
		mockCookiesSet = vi.fn();
		consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		consoleSpy.mockRestore();
		vi.clearAllMocks();
	});

	const createMockEvent = (
		overrides: {
			code?: string | null;
			kvGet?: ReturnType<typeof vi.fn>;
			kvPut?: ReturnType<typeof vi.fn>;
			dbPrepare?: ReturnType<typeof vi.fn>;
			platform?: object | null;
		} = {}
	) => {
		const url = new URL('http://localhost/api/auth/github/callback');
		if (overrides.code !== null) {
			url.searchParams.set('code', overrides.code || 'test-code');
		}

		return {
			url,
			platform:
				overrides.platform !== null
					? {
							env: {
								KV: {
									get: overrides.kvGet || mockKVGet,
									put: overrides.kvPut || mockKVPut
								},
								DB: {
									prepare: overrides.dbPrepare || mockDBPrepare
								}
							}
						}
					: overrides.platform,
			cookies: {
				set: mockCookiesSet
			}
		};
	};

	it('should redirect with error when code is missing', async () => {
		await expect(
			GET(createMockEvent({ code: null }) as unknown as Parameters<typeof GET>[0])
		).rejects.toThrow('Redirect to /auth/login?error=no_code');
	});

	it('should redirect with error when auth config is not found', async () => {
		mockKVGet.mockResolvedValue(null);

		await expect(GET(createMockEvent() as unknown as Parameters<typeof GET>[0])).rejects.toThrow(
			'Redirect to /auth/login?error=not_configured'
		);
	});

	it('should redirect with error when token exchange fails', async () => {
		mockKVGet.mockResolvedValue(
			JSON.stringify({
				clientId: 'test-client',
				clientSecret: 'test-secret'
			})
		);
		mockFetch.mockResolvedValueOnce({
			ok: false,
			text: async () => 'error'
		});

		await expect(GET(createMockEvent() as unknown as Parameters<typeof GET>[0])).rejects.toThrow(
			'Redirect to /auth/login?error=token_exchange_failed'
		);
	});

	it('should redirect with error when access token is missing in response', async () => {
		mockKVGet.mockResolvedValue(
			JSON.stringify({
				clientId: 'test-client',
				clientSecret: 'test-secret'
			})
		);
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({})
		});

		await expect(GET(createMockEvent() as unknown as Parameters<typeof GET>[0])).rejects.toThrow(
			'Redirect to /auth/login?error=no_access_token'
		);
	});

	it('should redirect with error when user info fetch fails', async () => {
		mockKVGet.mockResolvedValue(
			JSON.stringify({
				clientId: 'test-client',
				clientSecret: 'test-secret'
			})
		);
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ access_token: 'test-token' })
			})
			.mockResolvedValueOnce({
				ok: false,
				text: async () => 'user fetch failed'
			});

		await expect(GET(createMockEvent() as unknown as Parameters<typeof GET>[0])).rejects.toThrow(
			'Redirect to /auth/login?error=user_fetch_failed'
		);
	});

	it('should recognize owner by GitHub ID', async () => {
		mockKVGet
			.mockResolvedValueOnce(
				JSON.stringify({
					clientId: 'test-client',
					clientSecret: 'test-secret'
				})
			)
			.mockResolvedValueOnce('12345'); // owner ID matches

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ access_token: 'test-token' })
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: 12345,
					login: 'owner',
					name: 'Owner User',
					email: 'owner@test.com',
					avatar_url: 'https://avatar.url'
				})
			});

		mockKVGet.mockResolvedValueOnce(null); // First login check
		mockKVPut.mockResolvedValue(undefined);

		await expect(GET(createMockEvent() as unknown as Parameters<typeof GET>[0])).rejects.toThrow(
			'Redirect to /admin'
		);

		expect(mockKVPut).toHaveBeenCalledWith('admin_first_login_completed', 'true');
	});

	it('should redirect non-owner to home', async () => {
		mockKVGet
			.mockResolvedValueOnce(
				JSON.stringify({
					clientId: 'test-client',
					clientSecret: 'test-secret'
				})
			)
			.mockResolvedValueOnce('99999'); // Different owner ID

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ access_token: 'test-token' })
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: 12345,
					login: 'notowner',
					name: 'Not Owner',
					email: 'not@owner.com',
					avatar_url: 'https://avatar.url'
				})
			});

		await expect(GET(createMockEvent() as unknown as Parameters<typeof GET>[0])).rejects.toThrow(
			'Redirect to /'
		);
	});

	it('should handle database errors gracefully', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		mockKVGet
			.mockResolvedValueOnce(
				JSON.stringify({
					clientId: 'test-client',
					clientSecret: 'test-secret'
				})
			)
			.mockResolvedValueOnce('12345');

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ access_token: 'test-token' })
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: 12345,
					login: 'owner',
					name: 'Owner User',
					email: 'owner@test.com',
					avatar_url: 'https://avatar.url'
				})
			});

		mockDBPrepare.mockImplementation(() => {
			throw new Error('Database connection failed');
		});

		// Should still complete login even if DB fails
		await expect(GET(createMockEvent() as unknown as Parameters<typeof GET>[0])).rejects.toThrow(
			'Redirect to /admin'
		);

		warnSpy.mockRestore();
	});

	it('should set session cookie correctly', async () => {
		mockKVGet
			.mockResolvedValueOnce(
				JSON.stringify({
					clientId: 'test-client',
					clientSecret: 'test-secret'
				})
			)
			.mockResolvedValueOnce('12345');

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ access_token: 'test-token' })
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: 12345,
					login: 'owner',
					name: 'Owner',
					email: 'owner@test.com',
					avatar_url: 'https://avatar.url'
				})
			});

		try {
			await GET(createMockEvent() as unknown as Parameters<typeof GET>[0]);
		} catch {
			// Expected redirect
		}

		expect(mockCookiesSet).toHaveBeenCalledWith(
			'session',
			expect.any(String),
			expect.objectContaining({
				path: '/',
				httpOnly: true
			})
		);
	});
});
