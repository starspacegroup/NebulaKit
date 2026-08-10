import { beforeEach, describe, expect, it, vi } from 'vitest';

const ownerLocals = { user: { id: 'owner-1', isOwner: true, isAdmin: true } };

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

const mockError = vi.fn((status: number, message: string) => {
	const err = new Error(message) as Error & { status: number; body: { message: string } };
	err.status = status;
	err.body = { message };
	throw err;
});

vi.mock('@sveltejs/kit', () => ({
	redirect: (status: number, location: string) => mockRedirect(status, location),
	error: (status: number, message: string) => mockError(status, message)
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
				platform: { env: { KV: { get: mockGet } } },
				locals: ownerLocals
			} as any);

			expect(result).toEqual({});
			expect(mockGet).toHaveBeenCalledWith('reset_route_disabled');
		});

		it('should return empty object when reset_route_disabled is not "true"', async () => {
			const { load } = await import('../../src/routes/reset/+page.server');

			const mockGet = vi.fn().mockResolvedValue('false');

			const result = await load({
				platform: { env: { KV: { get: mockGet } } },
				locals: ownerLocals
			} as any);

			expect(result).toEqual({});
		});

		it('should redirect to home when reset route is disabled', async () => {
			const { load } = await import('../../src/routes/reset/+page.server');

			const mockGet = vi.fn().mockResolvedValue('true');

			await expect(
				load({
					platform: { env: { KV: { get: mockGet } } },
					locals: ownerLocals
				} as any)
			).rejects.toMatchObject({ status: 302, location: '/' });
		});

		it('should return empty object when platform is not available', async () => {
			const { load } = await import('../../src/routes/reset/+page.server');

			const result = await load({
				platform: null,
				locals: ownerLocals
			} as any);

			expect(result).toEqual({});
		});

		it('should return empty object when KV is not available', async () => {
			const { load } = await import('../../src/routes/reset/+page.server');

			const result = await load({
				platform: { env: {} },
				locals: ownerLocals
			} as any);

			expect(result).toEqual({});
		});
	});

	describe('access control', () => {
		// The page destroys configuration, so it is owner-only and must reject
		// before any KV read — the rendered copy documents this contract.
		it('rejects anonymous visitors', async () => {
			const { load } = await import('../../src/routes/reset/+page.server');
			const mockGet = vi.fn();

			await expect(
				load({ platform: { env: { KV: { get: mockGet } } }, locals: {} } as any)
			).rejects.toMatchObject({ status: 401 });
			expect(mockGet).not.toHaveBeenCalled();
		});

		it('rejects a signed-in non-owner', async () => {
			const { load } = await import('../../src/routes/reset/+page.server');
			const mockGet = vi.fn();

			await expect(
				load({
					platform: { env: { KV: { get: mockGet } } },
					locals: { user: { id: 'admin-1', isOwner: false, isAdmin: true } }
				} as any)
			).rejects.toMatchObject({ status: 403 });
			expect(mockGet).not.toHaveBeenCalled();
		});
	});

	describe('page copy', () => {
		it('describes the enforced owner-only contract, not the retired open-access warning', async () => {
			const { readFileSync } = await import('node:fs');
			const source = readFileSync('src/routes/reset/+page.svelte', 'utf-8');

			// The load function rejects anonymous and non-owner visitors, so the page
			// must not claim it is reachable without authentication.
			expect(source).not.toMatch(/accessible without authentication/i);
			expect(source).toMatch(/only reachable by the signed-in owner/i);
		});
	});
});
