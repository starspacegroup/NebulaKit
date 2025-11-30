import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for Reset API
 * TDD: Testing the reset configuration endpoint
 */

// Mock SvelteKit
vi.mock('@sveltejs/kit', () => ({
	error: (status: number, message: string) => {
		const err = new Error(message) as Error & { status: number; body: { message: string } };
		err.status = status;
		err.body = { message };
		throw err;
	},
	json: (data: unknown) =>
		new Response(JSON.stringify(data), {
			headers: { 'Content-Type': 'application/json' }
		})
}));

describe('Reset API', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('POST /api/reset', () => {
		it('should return 500 when KV is not available', async () => {
			const { POST } = await import('../../src/routes/api/reset/+server');

			const mockCookies = {
				delete: vi.fn()
			};

			await expect(
				POST({
					platform: { env: {} },
					cookies: mockCookies
				} as any)
			).rejects.toMatchObject({ status: 500 });
		});

		it('should return 403 when reset route is disabled', async () => {
			const { POST } = await import('../../src/routes/api/reset/+server');

			const mockGet = vi.fn().mockResolvedValue('true');
			const mockCookies = {
				delete: vi.fn()
			};

			await expect(
				POST({
					platform: { env: { KV: { get: mockGet } } },
					cookies: mockCookies
				} as any)
			).rejects.toMatchObject({ status: 403 });

			expect(mockGet).toHaveBeenCalledWith('reset_route_disabled');
		});

		it('should reset configuration successfully', async () => {
			const { POST } = await import('../../src/routes/api/reset/+server');

			const mockGet = vi.fn().mockResolvedValue(null);
			const mockDelete = vi.fn().mockResolvedValue(undefined);
			const mockCookiesDelete = vi.fn();

			const response = await POST({
				platform: {
					env: {
						KV: {
							get: mockGet,
							delete: mockDelete
						}
					}
				},
				cookies: { delete: mockCookiesDelete }
			} as any);

			const data = await response.json();
			expect(data.success).toBe(true);
			expect(data.message).toContain('reset successfully');

			// Should delete all setup-related KV keys
			expect(mockDelete).toHaveBeenCalledWith('auth_config:github');
			expect(mockDelete).toHaveBeenCalledWith('github_owner_id');
			expect(mockDelete).toHaveBeenCalledWith('github_owner_username');
			expect(mockDelete).toHaveBeenCalledWith('admin_first_login_completed');

			// Should clear session cookie
			expect(mockCookiesDelete).toHaveBeenCalledWith('session', { path: '/' });
		});

		it('should handle individual KV delete failures gracefully', async () => {
			const { POST } = await import('../../src/routes/api/reset/+server');

			const mockGet = vi.fn().mockResolvedValue(null);
			// First delete succeeds, second fails, rest succeed
			const mockDelete = vi
				.fn()
				.mockResolvedValueOnce(undefined)
				.mockRejectedValueOnce(new Error('Delete failed'))
				.mockResolvedValue(undefined);
			const mockCookiesDelete = vi.fn();

			const response = await POST({
				platform: {
					env: {
						KV: {
							get: mockGet,
							delete: mockDelete
						}
					}
				},
				cookies: { delete: mockCookiesDelete }
			} as any);

			const data = await response.json();
			// Should still succeed overall
			expect(data.success).toBe(true);
		});

		it('should handle unexpected errors', async () => {
			const { POST } = await import('../../src/routes/api/reset/+server');

			const mockGet = vi.fn().mockRejectedValue(new Error('Unexpected error'));
			const mockCookies = {
				delete: vi.fn()
			};

			await expect(
				POST({
					platform: { env: { KV: { get: mockGet } } },
					cookies: mockCookies
				} as any)
			).rejects.toMatchObject({ status: 500 });
		});

		it('should re-throw HTTP errors with status property', async () => {
			const { POST } = await import('../../src/routes/api/reset/+server');

			const httpError = new Error('Custom error') as Error & { status: number };
			httpError.status = 404;
			const mockGet = vi.fn().mockRejectedValue(httpError);
			const mockCookies = {
				delete: vi.fn()
			};

			await expect(
				POST({
					platform: { env: { KV: { get: mockGet } } },
					cookies: mockCookies
				} as any)
			).rejects.toMatchObject({ status: 404 });
		});
	});
});
