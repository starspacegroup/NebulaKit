/**
 * Tests for Admin CMS Pages - Server Load Functions
 *
 * Tests the +page.server.ts files for admin CMS dashboard and type management.
 * Following established TDD patterns from the codebase.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Admin CMS Dashboard Page Server', () => {
	let mockFetch: ReturnType<typeof vi.fn>;
	let load: any;

	beforeEach(async () => {
		vi.resetModules();
		mockFetch = vi.fn();
		const module = await import('../../src/routes/admin/cms/+page.server.js');
		load = module.load;
	});

	it('should return content types when fetch is successful', async () => {
		const mockTypes = [
			{ id: '1', slug: 'blog', name: 'Blog Posts', fields: [], settings: {} },
			{ id: '2', slug: 'faq', name: 'FAQ', fields: [], settings: {} }
		];

		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ types: mockTypes })
		});

		const result = await load({ fetch: mockFetch });

		expect(result.contentTypes).toEqual(mockTypes);
		expect(mockFetch).toHaveBeenCalledWith('/api/cms/types');
	});

	it('should return empty array when fetch fails', async () => {
		mockFetch.mockResolvedValue({ ok: false });

		const result = await load({ fetch: mockFetch });

		expect(result.contentTypes).toEqual([]);
	});

	it('should return empty array when fetch throws', async () => {
		mockFetch.mockRejectedValue(new Error('Network error'));

		const result = await load({ fetch: mockFetch });

		expect(result.contentTypes).toEqual([]);
	});

	it('should return empty array when response has no types property', async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({})
		});

		const result = await load({ fetch: mockFetch });

		expect(result.contentTypes).toEqual([]);
	});
});

describe('Admin CMS Type Management Page Server', () => {
	let mockFetch: ReturnType<typeof vi.fn>;
	let load: any;

	beforeEach(async () => {
		vi.resetModules();
		mockFetch = vi.fn();
		const module = await import('../../src/routes/admin/cms/[type]/+page.server.js');
		load = module.load;
	});

	it('should load content type and items', async () => {
		const mockType = {
			id: 'type-1',
			slug: 'blog',
			name: 'Blog Posts',
			fields: [{ name: 'body', label: 'Body', type: 'richtext' }],
			settings: { hasTags: false }
		};
		const mockItems = [{ id: 'item-1', title: 'Test Post', status: 'draft' }];

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ types: [mockType] })
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					items: mockItems,
					total: 1,
					totalPages: 1,
					page: 1
				})
			});

		const result = await load({
			fetch: mockFetch,
			params: { type: 'blog' },
			url: new URL('http://localhost/admin/cms/blog')
		});

		expect(result.contentType).toEqual(mockType);
		expect(result.items).toEqual(mockItems);
		expect(result.totalItems).toBe(1);
		expect(result.totalPages).toBe(1);
		expect(result.currentPage).toBe(1);
	});

	it('should throw 404 when content type not found', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ types: [] })
		});

		await expect(
			load({
				fetch: mockFetch,
				params: { type: 'nonexistent' },
				url: new URL('http://localhost/admin/cms/nonexistent')
			})
		).rejects.toThrow();
	});

	it('should throw when types fetch fails', async () => {
		mockFetch.mockResolvedValueOnce({ ok: false });

		await expect(
			load({
				fetch: mockFetch,
				params: { type: 'blog' },
				url: new URL('http://localhost/admin/cms/blog')
			})
		).rejects.toThrow();
	});

	it('should pass status and search filters as query params', async () => {
		const mockType = {
			id: 'type-1',
			slug: 'blog',
			name: 'Blog Posts',
			fields: [],
			settings: { hasTags: false }
		};

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ types: [mockType] })
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					items: [],
					totalItems: 0,
					totalPages: 1,
					page: 1
				})
			});

		await load({
			fetch: mockFetch,
			params: { type: 'blog' },
			url: new URL('http://localhost/admin/cms/blog?status=published&search=hello')
		});

		// Second fetch should include the query params
		const secondCallUrl = mockFetch.mock.calls[1][0];
		expect(secondCallUrl).toContain('/api/cms/blog');
		expect(secondCallUrl).toContain('status=published');
		expect(secondCallUrl).toContain('search=hello');
	});

	it('should load tags when content type supports tags', async () => {
		const mockType = {
			id: 'type-1',
			slug: 'blog',
			name: 'Blog Posts',
			fields: [],
			settings: { hasTags: true }
		};
		const mockTags = [
			{ id: 'tag-1', name: 'Tech', slug: 'tech' },
			{ id: 'tag-2', name: 'Design', slug: 'design' }
		];

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ types: [mockType] })
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					items: [],
					totalItems: 0,
					totalPages: 1,
					page: 1
				})
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ tags: mockTags })
			});

		const result = await load({
			fetch: mockFetch,
			params: { type: 'blog' },
			url: new URL('http://localhost/admin/cms/blog')
		});

		expect(result.tags).toEqual(mockTags);
		expect(mockFetch).toHaveBeenCalledTimes(3);
	});

	it('should not load tags when content type does not support them', async () => {
		const mockType = {
			id: 'type-1',
			slug: 'blog',
			name: 'Blog Posts',
			fields: [],
			settings: { hasTags: false }
		};

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ types: [mockType] })
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					items: [],
					totalItems: 0,
					totalPages: 1,
					page: 1
				})
			});

		const result = await load({
			fetch: mockFetch,
			params: { type: 'blog' },
			url: new URL('http://localhost/admin/cms/blog')
		});

		expect(result.tags).toEqual([]);
		expect(mockFetch).toHaveBeenCalledTimes(2); // types + items only
	});

	it('should handle tags fetch failure gracefully', async () => {
		const mockType = {
			id: 'type-1',
			slug: 'blog',
			name: 'Blog Posts',
			fields: [],
			settings: { hasTags: true }
		};

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ types: [mockType] })
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					items: [],
					totalItems: 0,
					totalPages: 1,
					page: 1
				})
			})
			.mockRejectedValueOnce(new Error('Tags fetch failed'));

		const result = await load({
			fetch: mockFetch,
			params: { type: 'blog' },
			url: new URL('http://localhost/admin/cms/blog')
		});

		expect(result.tags).toEqual([]);
	});

	it('should return correct filters object from URL', async () => {
		const mockType = {
			id: 'type-1',
			slug: 'blog',
			name: 'Blog Posts',
			fields: [],
			settings: { hasTags: false }
		};

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ types: [mockType] })
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					items: [],
					totalItems: 0,
					totalPages: 1,
					page: 1
				})
			});

		const result = await load({
			fetch: mockFetch,
			params: { type: 'blog' },
			url: new URL('http://localhost/admin/cms/blog?status=draft&search=test')
		});

		expect(result.filters).toEqual({ status: 'draft', search: 'test' });
	});

	it('should handle items fetch failure with empty items', async () => {
		const mockType = {
			id: 'type-1',
			slug: 'blog',
			name: 'Blog Posts',
			fields: [],
			settings: { hasTags: false }
		};

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ types: [mockType] })
			})
			.mockResolvedValueOnce({
				ok: false
			});

		const result = await load({
			fetch: mockFetch,
			params: { type: 'blog' },
			url: new URL('http://localhost/admin/cms/blog')
		});

		expect(result.items).toEqual([]);
		expect(result.totalItems).toBe(0);
	});

	it('should pass page query param for pagination', async () => {
		const mockType = {
			id: 'type-1',
			slug: 'blog',
			name: 'Blog Posts',
			fields: [],
			settings: { hasTags: false }
		};

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ types: [mockType] })
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					items: [],
					totalItems: 25,
					totalPages: 3,
					page: 2
				})
			});

		const result = await load({
			fetch: mockFetch,
			params: { type: 'blog' },
			url: new URL('http://localhost/admin/cms/blog?page=2')
		});

		const secondCallUrl = mockFetch.mock.calls[1][0];
		expect(secondCallUrl).toContain('page=2');
		expect(result.currentPage).toBe(2);
		expect(result.totalPages).toBe(3);
	});
});
