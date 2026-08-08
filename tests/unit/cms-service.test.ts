import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('CMS Service', () => {
	let mockDB: any;

	beforeEach(() => {
		vi.resetModules();
		mockDB = {
			prepare: vi.fn().mockReturnThis(),
			bind: vi.fn().mockReturnThis(),
			first: vi.fn(),
			all: vi.fn(),
			run: vi.fn(),
			batch: vi.fn()
		};
	});

	describe('syncContentTypes', () => {
		it('should insert new content types from registry', async () => {
			const { syncContentTypes } = await import('../../src/lib/services/cms.js');

			mockDB.all.mockResolvedValue({ results: [] });
			mockDB.batch.mockResolvedValue([{ success: true }]);

			await syncContentTypes(mockDB);

			expect(mockDB.batch).toHaveBeenCalled();
			const batchArgs = mockDB.batch.mock.calls[0][0];
			expect(batchArgs.length).toBeGreaterThanOrEqual(1);
		});

		it('should update existing content types that have changed', async () => {
			const { syncContentTypes } = await import('../../src/lib/services/cms.js');

			mockDB.all.mockResolvedValue({
				results: [
					{
						id: 'existing-id',
						slug: 'blog',
						name: 'Old Name',
						fields: '[]',
						settings: '{}'
					}
				]
			});
			mockDB.batch.mockResolvedValue([{ success: true }]);

			await syncContentTypes(mockDB);

			expect(mockDB.batch).toHaveBeenCalled();
		});

		it('should not batch when no changes needed', async () => {
			const { syncContentTypes } = await import('../../src/lib/services/cms.js');
			const { blogContentType } = await import('../../src/lib/cms/registry.js');

			mockDB.all.mockResolvedValue({
				results: [
					{
						id: 'existing-id',
						slug: 'blog',
						name: blogContentType.name,
						description: blogContentType.description,
						fields: JSON.stringify(blogContentType.fields),
						settings: JSON.stringify(blogContentType.settings),
						icon: blogContentType.icon
					}
				]
			});

			await syncContentTypes(mockDB);

			expect(mockDB.batch).not.toHaveBeenCalled();
		});
	});

	describe('getContentTypes', () => {
		it('should return all content types', async () => {
			const { getContentTypes } = await import('../../src/lib/services/cms.js');

			mockDB.all.mockResolvedValue({
				results: [
					{
						id: 'ct-1',
						slug: 'blog',
						name: 'Blog Posts',
						description: 'Articles',
						fields: '[]',
						settings: '{}',
						icon: 'article',
						sort_order: 0,
						created_at: '2024-01-01',
						updated_at: '2024-01-01'
					}
				]
			});

			const types = await getContentTypes(mockDB);
			expect(types).toHaveLength(1);
			expect(types[0].slug).toBe('blog');
			expect(types[0].fields).toEqual([]);
		});
	});

	describe('getContentTypeBySlug', () => {
		it('should return a content type by slug', async () => {
			const { getContentTypeBySlug } = await import('../../src/lib/services/cms.js');

			mockDB.first.mockResolvedValue({
				id: 'ct-1',
				slug: 'blog',
				name: 'Blog Posts',
				description: 'Articles',
				fields: '[]',
				settings: '{}',
				icon: 'article',
				sort_order: 0,
				created_at: '2024-01-01',
				updated_at: '2024-01-01'
			});

			const type = await getContentTypeBySlug(mockDB, 'blog');
			expect(type).toBeTruthy();
			expect(type!.slug).toBe('blog');
		});

		it('should return null for non-existent slug', async () => {
			const { getContentTypeBySlug } = await import('../../src/lib/services/cms.js');

			mockDB.first.mockResolvedValue(null);

			const type = await getContentTypeBySlug(mockDB, 'nonexistent');
			expect(type).toBeNull();
		});
	});

	describe('createContentItem', () => {
		it('should create a content item', async () => {
			const { createContentItem } = await import('../../src/lib/services/cms.js');

			mockDB.first.mockResolvedValueOnce({
				id: 'ct-1',
				slug: 'blog',
				name: 'Blog Posts',
				fields: JSON.stringify([
					{ name: 'excerpt', label: 'Excerpt', type: 'textarea', required: true },
					{ name: 'body', label: 'Body', type: 'richtext', required: true }
				]),
				settings: '{}',
				icon: 'article',
				sort_order: 0,
				created_at: '2024-01-01',
				updated_at: '2024-01-01'
			});
			// For author existence check
			mockDB.first.mockResolvedValueOnce({ id: 'user-1' });
			// For slug uniqueness check
			mockDB.first.mockResolvedValueOnce(null);
			// For the insert returning
			mockDB.first.mockResolvedValueOnce({
				id: 'ci-1',
				content_type_id: 'ct-1',
				slug: 'hello-world',
				title: 'Hello World',
				status: 'draft',
				fields: JSON.stringify({ excerpt: 'A test', body: 'Hello world body text' }),
				seo_title: null,
				seo_description: null,
				seo_image: null,
				author_id: 'user-1',
				published_at: null,
				created_at: '2024-01-01',
				updated_at: '2024-01-01'
			});

			const item = await createContentItem(mockDB, {
				contentTypeSlug: 'blog',
				title: 'Hello World',
				fields: { excerpt: 'A test', body: 'Hello world body text' },
				authorId: 'user-1'
			});

			expect(item).toBeTruthy();
			expect(item!.title).toBe('Hello World');
			expect(item!.slug).toBe('hello-world');
			expect(item!.status).toBe('draft');
		});

		it('should return null when content type not found', async () => {
			const { createContentItem } = await import('../../src/lib/services/cms.js');

			mockDB.first.mockResolvedValue(null);

			const item = await createContentItem(mockDB, {
				contentTypeSlug: 'nonexistent',
				title: 'Test',
				fields: {}
			});

			expect(item).toBeNull();
		});

		it('should use provided slug instead of generating one', async () => {
			const { createContentItem } = await import('../../src/lib/services/cms.js');

			mockDB.first.mockResolvedValueOnce({
				id: 'ct-1',
				slug: 'blog',
				name: 'Blog',
				fields: '[]',
				settings: '{}',
				icon: 'article',
				sort_order: 0,
				created_at: '2024-01-01',
				updated_at: '2024-01-01'
			});
			mockDB.first.mockResolvedValueOnce(null); // slug check
			mockDB.first.mockResolvedValueOnce({
				id: 'ci-1',
				content_type_id: 'ct-1',
				slug: 'custom-slug',
				title: 'Test',
				status: 'draft',
				fields: '{}',
				seo_title: null,
				seo_description: null,
				seo_image: null,
				author_id: null,
				published_at: null,
				created_at: '2024-01-01',
				updated_at: '2024-01-01'
			});

			const item = await createContentItem(mockDB, {
				contentTypeSlug: 'blog',
				title: 'Test',
				slug: 'custom-slug',
				fields: {}
			});

			expect(item!.slug).toBe('custom-slug');
		});

		it('should fall back to null author when author record does not exist', async () => {
			const { createContentItem } = await import('../../src/lib/services/cms.js');

			mockDB.first
				.mockResolvedValueOnce({
					id: 'ct-1',
					slug: 'blog',
					name: 'Blog Posts',
					fields: '[]',
					settings: '{}',
					icon: 'article',
					sort_order: 0,
					created_at: '2024-01-01',
					updated_at: '2024-01-01'
				})
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce({
					id: 'ci-1',
					content_type_id: 'ct-1',
					slug: 'hello-world',
					title: 'Hello World',
					status: 'draft',
					fields: '{}',
					seo_title: null,
					seo_description: null,
					seo_image: null,
					author_id: null,
					published_at: null,
					created_at: '2024-01-01',
					updated_at: '2024-01-01'
				});

			const item = await createContentItem(mockDB, {
				contentTypeSlug: 'blog',
				title: 'Hello World',
				fields: {},
				authorId: 'missing-user'
			});

			expect(item).toBeTruthy();
			expect(item?.authorId).toBeNull();
		});
	});

	describe('getContentItem', () => {
		it('should return a content item by id', async () => {
			const { getContentItem } = await import('../../src/lib/services/cms.js');

			mockDB.first.mockResolvedValue({
				id: 'ci-1',
				content_type_id: 'ct-1',
				slug: 'hello-world',
				title: 'Hello World',
				status: 'published',
				fields: '{"body":"Hello"}',
				seo_title: null,
				seo_description: null,
				seo_image: null,
				author_id: null,
				published_at: '2024-01-01',
				created_at: '2024-01-01',
				updated_at: '2024-01-01'
			});

			const item = await getContentItem(mockDB, 'ci-1');
			expect(item).toBeTruthy();
			expect(item!.id).toBe('ci-1');
			expect(item!.fields).toEqual({ body: 'Hello' });
		});

		it('should return null for non-existent item', async () => {
			const { getContentItem } = await import('../../src/lib/services/cms.js');

			mockDB.first.mockResolvedValue(null);

			const item = await getContentItem(mockDB, 'nonexistent');
			expect(item).toBeNull();
		});
	});

	describe('getContentItemBySlug', () => {
		it('should return a content item by type and slug', async () => {
			const { getContentItemBySlug } = await import('../../src/lib/services/cms.js');

			mockDB.first.mockResolvedValue({
				id: 'ci-1',
				content_type_id: 'ct-1',
				slug: 'hello-world',
				title: 'Hello World',
				status: 'published',
				fields: '{"body":"Hello"}',
				seo_title: null,
				seo_description: null,
				seo_image: null,
				author_id: null,
				published_at: '2024-01-01',
				created_at: '2024-01-01',
				updated_at: '2024-01-01'
			});

			const item = await getContentItemBySlug(mockDB, 'ct-1', 'hello-world');
			expect(item).toBeTruthy();
			expect(item!.slug).toBe('hello-world');
		});
	});

	describe('listContentItems', () => {
		it('should return paginated items', async () => {
			const { listContentItems } = await import('../../src/lib/services/cms.js');

			// Count query
			mockDB.first.mockResolvedValueOnce({ count: 2 });
			// Items query
			mockDB.all.mockResolvedValueOnce({
				results: [
					{
						id: 'ci-1',
						content_type_id: 'ct-1',
						slug: 'post-1',
						title: 'Post 1',
						status: 'published',
						fields: '{}',
						seo_title: null,
						seo_description: null,
						seo_image: null,
						author_id: null,
						published_at: '2024-01-01',
						created_at: '2024-01-01',
						updated_at: '2024-01-01'
					},
					{
						id: 'ci-2',
						content_type_id: 'ct-1',
						slug: 'post-2',
						title: 'Post 2',
						status: 'published',
						fields: '{}',
						seo_title: null,
						seo_description: null,
						seo_image: null,
						author_id: null,
						published_at: '2024-01-02',
						created_at: '2024-01-02',
						updated_at: '2024-01-02'
					}
				]
			});

			const result = await listContentItems(mockDB, 'ct-1', { page: 1, pageSize: 10 });
			expect(result.items).toHaveLength(2);
			expect(result.total).toBe(2);
			expect(result.page).toBe(1);
			expect(result.pageSize).toBe(10);
			expect(result.totalPages).toBe(1);
		});

		it('should filter by status', async () => {
			const { listContentItems } = await import('../../src/lib/services/cms.js');

			mockDB.first.mockResolvedValueOnce({ count: 1 });
			mockDB.all.mockResolvedValueOnce({
				results: [
					{
						id: 'ci-1',
						content_type_id: 'ct-1',
						slug: 'post-1',
						title: 'Post 1',
						status: 'published',
						fields: '{}',
						seo_title: null,
						seo_description: null,
						seo_image: null,
						author_id: null,
						published_at: '2024-01-01',
						created_at: '2024-01-01',
						updated_at: '2024-01-01'
					}
				]
			});

			const result = await listContentItems(mockDB, 'ct-1', { status: 'published' });
			expect(result.items).toHaveLength(1);
			// Verify status filter was included in query
			const prepareCall = mockDB.prepare.mock.calls.find((call: string[]) =>
				call[0].includes('status')
			);
			expect(prepareCall).toBeTruthy();
		});
	});

	describe('updateContentItem', () => {
		it('should update a content item', async () => {
			const { updateContentItem } = await import('../../src/lib/services/cms.js');

			// First call: get existing item
			mockDB.first.mockResolvedValueOnce({
				id: 'ci-1',
				content_type_id: 'ct-1',
				slug: 'hello-world',
				title: 'Hello World',
				status: 'draft',
				fields: '{"body":"Old"}',
				seo_title: null,
				seo_description: null,
				seo_image: null,
				author_id: null,
				published_at: null,
				created_at: '2024-01-01',
				updated_at: '2024-01-01'
			});
			// updateContentItem now reads the content type to evaluate publish locks
			mockDB.first.mockResolvedValueOnce({ fields: '[]', settings: '{}' });
			// Second call: update result
			mockDB.first.mockResolvedValueOnce({
				id: 'ci-1',
				content_type_id: 'ct-1',
				slug: 'hello-world',
				title: 'Updated Title',
				status: 'published',
				fields: '{"body":"New"}',
				seo_title: null,
				seo_description: null,
				seo_image: null,
				author_id: null,
				published_at: '2024-01-15',
				created_at: '2024-01-01',
				updated_at: '2024-01-15'
			});

			const item = await updateContentItem(mockDB, 'ci-1', {
				title: 'Updated Title',
				status: 'published',
				fields: { body: 'New' }
			});

			expect(item).toBeTruthy();
			expect(item!.title).toBe('Updated Title');
			expect(item!.status).toBe('published');
		});

		it('should return null when item not found', async () => {
			const { updateContentItem } = await import('../../src/lib/services/cms.js');

			mockDB.first.mockResolvedValue(null);

			const item = await updateContentItem(mockDB, 'nonexistent', {
				title: 'Test'
			});
			expect(item).toBeNull();
		});
	});

	describe('deleteContentItem', () => {
		it('should delete a content item', async () => {
			const { deleteContentItem } = await import('../../src/lib/services/cms.js');

			mockDB.run.mockResolvedValue({ success: true, meta: { changes: 1 } });

			const result = await deleteContentItem(mockDB, 'ci-1');
			expect(result).toBe(true);
		});

		it('should return false when item not found', async () => {
			const { deleteContentItem } = await import('../../src/lib/services/cms.js');

			mockDB.run.mockResolvedValue({ success: true, meta: { changes: 0 } });

			const result = await deleteContentItem(mockDB, 'nonexistent');
			expect(result).toBe(false);
		});
	});

	describe('createContentTag', () => {
		it('should create a tag', async () => {
			const { createContentTag } = await import('../../src/lib/services/cms.js');

			mockDB.first.mockResolvedValue({
				id: 'tag-1',
				content_type_id: 'ct-1',
				name: 'JavaScript',
				slug: 'javascript',
				created_at: '2024-01-01'
			});

			const tag = await createContentTag(mockDB, 'ct-1', 'JavaScript');
			expect(tag).toBeTruthy();
			expect(tag!.name).toBe('JavaScript');
			expect(tag!.slug).toBe('javascript');
		});
	});

	describe('getTagsForType', () => {
		it('should return tags for a content type', async () => {
			const { getTagsForType } = await import('../../src/lib/services/cms.js');

			mockDB.all.mockResolvedValue({
				results: [
					{
						id: 'tag-1',
						content_type_id: 'ct-1',
						name: 'JS',
						slug: 'js',
						created_at: '2024-01-01'
					},
					{ id: 'tag-2', content_type_id: 'ct-1', name: 'TS', slug: 'ts', created_at: '2024-01-01' }
				]
			});

			const tags = await getTagsForType(mockDB, 'ct-1');
			expect(tags).toHaveLength(2);
			expect(tags[0].name).toBe('JS');
		});
	});

	describe('setItemTags', () => {
		it('should replace item tags', async () => {
			const { setItemTags } = await import('../../src/lib/services/cms.js');

			mockDB.batch.mockResolvedValue([{ success: true }]);

			await setItemTags(mockDB, 'ci-1', ['tag-1', 'tag-2']);
			expect(mockDB.batch).toHaveBeenCalled();
		});
	});

	describe('getItemTags', () => {
		it('should return tags for an item', async () => {
			const { getItemTags } = await import('../../src/lib/services/cms.js');

			mockDB.all.mockResolvedValue({
				results: [
					{ id: 'tag-1', content_type_id: 'ct-1', name: 'JS', slug: 'js', created_at: '2024-01-01' }
				]
			});

			const tags = await getItemTags(mockDB, 'ci-1');
			expect(tags).toHaveLength(1);
			expect(tags[0].name).toBe('JS');
		});
	});
});
