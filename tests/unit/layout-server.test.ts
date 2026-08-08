import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for Layout Server Load
 * TDD: Tests for root layout data loading
 */

describe('Layout Server Load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	describe('load function', () => {
		it('should return user from locals and check AI providers', async () => {
			const mockUser = {
				id: 'user-123',
				login: 'testuser',
				isAdmin: false
			};

			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue({ hasProviders: true })
			});

			const { load } = await import('../../src/routes/+layout.server');
			const result = (await load({
				locals: { user: mockUser },
				fetch: mockFetch
			} as any)) as { user: typeof mockUser | null; hasAIProviders: boolean };

			expect(result.user).toEqual(mockUser);
			expect(result.hasAIProviders).toBe(true);
			expect(mockFetch).toHaveBeenCalledWith('/api/admin/ai-keys/status');
		});

		it('should return null user when not authenticated', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue({ hasProviders: false })
			});

			const { load } = await import('../../src/routes/+layout.server');
			const result = (await load({
				locals: {},
				fetch: mockFetch
			} as any)) as { user: null; hasAIProviders: boolean };

			expect(result.user).toBeNull();
			expect(result.hasAIProviders).toBe(false);
		});

		it('should handle AI provider check failure gracefully', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500
			});

			const { load } = await import('../../src/routes/+layout.server');
			const result = (await load({
				locals: { user: { id: 'user-123' } },
				fetch: mockFetch
			} as any)) as { hasAIProviders: boolean };

			expect(result.hasAIProviders).toBe(false);
		});

		it('should handle fetch error gracefully', async () => {
			const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));

			const { load } = await import('../../src/routes/+layout.server');
			const result = (await load({
				locals: { user: { id: 'user-123' } },
				fetch: mockFetch
			} as any)) as { hasAIProviders: boolean };

			expect(result.hasAIProviders).toBe(false);
		});

		it('should include eligible CMS items for the command palette', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue({ hasProviders: false })
			});
			const mockDB = {
				prepare: vi.fn().mockReturnThis(),
				bind: vi.fn().mockReturnThis(),
				all: vi
					.fn()
					.mockResolvedValueOnce({ results: [] })
					.mockResolvedValueOnce({
						results: [
							{
								content_type_slug: 'blog',
								content_type_name: 'Blog Posts',
								route_prefix: '/blog',
								item_id: 'item-1',
								item_slug: 'hello-world',
								item_title: 'Hello World',
								item_description: 'First post'
							}
						]
					}),
				batch: vi.fn()
			};

			const { load } = await import('../../src/routes/+layout.server');
			const result = (await load({
				locals: { user: null },
				fetch: mockFetch,
				platform: { env: { DB: mockDB } }
			} as any)) as {
				cmsPaletteItems: Array<{ id: string; label: string; href: string; description: string }>;
			};

			expect(result.cmsPaletteItems).toEqual([
				{
					id: 'cms-item-1',
					label: 'Hello World',
					href: '/blog/hello-world',
					description: 'Blog Posts: First post',
					contentTypeName: 'Blog Posts'
				}
			]);
		});
	});
});
