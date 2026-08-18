/**
 * Tests for the dedicated CMS create/edit page server loaders:
 *   /admin/cms/[type]/new/+page.server.ts
 *   /admin/cms/[type]/[id]/+page.server.ts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const blogType = {
	id: 'type-1',
	slug: 'blog',
	name: 'Blog Posts',
	fields: [{ name: 'body', label: 'Body', type: 'richtext' }],
	settings: { hasTags: true }
};

describe('CMS create page loader (/admin/cms/[type]/new)', () => {
	let mockFetch: ReturnType<typeof vi.fn>;
	let load: any;

	beforeEach(async () => {
		vi.resetModules();
		mockFetch = vi.fn();
		const module = await import('../../src/routes/admin/cms/[type]/new/+page.server.js');
		load = module.load;
	});

	it('loads the content type and its tags', async () => {
		mockFetch
			.mockResolvedValueOnce({ ok: true, json: async () => ({ types: [blogType] }) })
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ tags: [{ id: 'tag-1', name: 'JS' }] })
			});

		const result = await load({ fetch: mockFetch, params: { type: 'blog' } });

		expect(result.contentType).toEqual(blogType);
		expect(result.tags).toEqual([{ id: 'tag-1', name: 'JS' }]);
		expect(mockFetch).toHaveBeenCalledWith('/api/cms/types');
		expect(mockFetch).toHaveBeenCalledWith('/api/cms/blog/tags');
	});

	it('skips tag fetch when the type has no tags', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ types: [{ ...blogType, settings: { hasTags: false } }] })
		});

		const result = await load({ fetch: mockFetch, params: { type: 'blog' } });

		expect(result.tags).toEqual([]);
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('throws 404 for an unknown content type', async () => {
		mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ types: [] }) });
		await expect(load({ fetch: mockFetch, params: { type: 'nope' } })).rejects.toThrow();
	});

	it('throws when the types fetch fails', async () => {
		mockFetch.mockResolvedValueOnce({ ok: false });
		await expect(load({ fetch: mockFetch, params: { type: 'blog' } })).rejects.toThrow();
	});
});

describe('CMS edit page loader (/admin/cms/[type]/[id])', () => {
	let mockFetch: ReturnType<typeof vi.fn>;
	let load: any;

	beforeEach(async () => {
		vi.resetModules();
		mockFetch = vi.fn();
		const module = await import('../../src/routes/admin/cms/[type]/[id]/+page.server.js');
		load = module.load;
	});

	it('loads the content type, item, and tags', async () => {
		const item = { id: 'item-1', title: 'Hello', fields: {}, tags: [] };
		mockFetch
			.mockResolvedValueOnce({ ok: true, json: async () => ({ types: [blogType] }) })
			.mockResolvedValueOnce({ ok: true, json: async () => ({ item }) })
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ tags: [{ id: 'tag-1', name: 'JS' }] })
			});

		const result = await load({ fetch: mockFetch, params: { type: 'blog', id: 'item-1' } });

		expect(result.contentType).toEqual(blogType);
		expect(result.item).toEqual(item);
		expect(result.tags).toEqual([{ id: 'tag-1', name: 'JS' }]);
		expect(mockFetch).toHaveBeenCalledWith('/api/cms/blog/item-1');
	});

	it('throws 404 when the item is missing', async () => {
		mockFetch
			.mockResolvedValueOnce({ ok: true, json: async () => ({ types: [blogType] }) })
			.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });

		await expect(
			load({ fetch: mockFetch, params: { type: 'blog', id: 'missing' } })
		).rejects.toThrow();
	});

	it('throws 500 when the item fetch errors non-404', async () => {
		mockFetch
			.mockResolvedValueOnce({ ok: true, json: async () => ({ types: [blogType] }) })
			.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });

		await expect(
			load({ fetch: mockFetch, params: { type: 'blog', id: 'item-1' } })
		).rejects.toThrow();
	});

	it('throws 404 for an unknown content type', async () => {
		mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ types: [] }) });
		await expect(load({ fetch: mockFetch, params: { type: 'nope', id: 'x' } })).rejects.toThrow();
	});
});
