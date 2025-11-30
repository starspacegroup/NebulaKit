import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for Reset Route Settings API
 * TDD: Testing the admin endpoint to toggle reset route
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

describe('Reset Route Settings API', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('POST /api/admin/settings/reset-route', () => {
		it('should return 403 when user is not owner', async () => {
			const { POST } = await import('../../src/routes/api/admin/settings/reset-route/+server');

			const mockRequest = {
				json: async () => ({ disabled: true })
			} as Request;

			await expect(
				POST({
					request: mockRequest,
					locals: { user: { id: '1', login: 'user', email: 'user@test.com', isOwner: false } },
					platform: { env: { KV: {} } }
				} as any)
			).rejects.toMatchObject({ status: 403 });
		});

		it('should return 403 when no user is present', async () => {
			const { POST } = await import('../../src/routes/api/admin/settings/reset-route/+server');

			const mockRequest = {
				json: async () => ({ disabled: true })
			} as Request;

			await expect(
				POST({
					request: mockRequest,
					locals: {},
					platform: { env: { KV: {} } }
				} as any)
			).rejects.toMatchObject({ status: 403 });
		});

		it('should return 500 when KV is not available', async () => {
			const { POST } = await import('../../src/routes/api/admin/settings/reset-route/+server');

			const mockRequest = {
				json: async () => ({ disabled: true })
			} as Request;

			await expect(
				POST({
					request: mockRequest,
					locals: { user: { id: '1', login: 'owner', email: 'owner@test.com', isOwner: true } },
					platform: { env: {} }
				} as any)
			).rejects.toMatchObject({ status: 500 });
		});

		it('should disable reset route successfully', async () => {
			const { POST } = await import('../../src/routes/api/admin/settings/reset-route/+server');

			const mockPut = vi.fn().mockResolvedValue(undefined);
			const mockRequest = {
				json: async () => ({ disabled: true })
			} as Request;

			const response = await POST({
				request: mockRequest,
				locals: { user: { id: '1', login: 'owner', email: 'owner@test.com', isOwner: true } },
				platform: { env: { KV: { put: mockPut } } }
			} as any);

			const data = await response.json();
			expect(data.success).toBe(true);
			expect(data.disabled).toBe(true);
			expect(mockPut).toHaveBeenCalledWith('reset_route_disabled', 'true');
		});

		it('should enable reset route successfully', async () => {
			const { POST } = await import('../../src/routes/api/admin/settings/reset-route/+server');

			const mockDelete = vi.fn().mockResolvedValue(undefined);
			const mockRequest = {
				json: async () => ({ disabled: false })
			} as Request;

			const response = await POST({
				request: mockRequest,
				locals: { user: { id: '1', login: 'owner', email: 'owner@test.com', isOwner: true } },
				platform: { env: { KV: { delete: mockDelete } } }
			} as any);

			const data = await response.json();
			expect(data.success).toBe(true);
			expect(data.disabled).toBe(false);
			expect(mockDelete).toHaveBeenCalledWith('reset_route_disabled');
		});

		it('should handle KV errors gracefully', async () => {
			const { POST } = await import('../../src/routes/api/admin/settings/reset-route/+server');

			const mockPut = vi.fn().mockRejectedValue(new Error('KV Error'));
			const mockRequest = {
				json: async () => ({ disabled: true })
			} as Request;

			await expect(
				POST({
					request: mockRequest,
					locals: { user: { id: '1', login: 'owner', email: 'owner@test.com', isOwner: true } },
					platform: { env: { KV: { put: mockPut } } }
				} as any)
			).rejects.toMatchObject({ status: 500 });
		});

		it('should convert falsy disabled value to false', async () => {
			const { POST } = await import('../../src/routes/api/admin/settings/reset-route/+server');

			const mockDelete = vi.fn().mockResolvedValue(undefined);
			const mockRequest = {
				json: async () => ({ disabled: '' })
			} as Request;

			const response = await POST({
				request: mockRequest,
				locals: { user: { id: '1', login: 'owner', email: 'owner@test.com', isOwner: true } },
				platform: { env: { KV: { delete: mockDelete } } }
			} as any);

			const data = await response.json();
			expect(data.disabled).toBe(false);
		});
	});
});
