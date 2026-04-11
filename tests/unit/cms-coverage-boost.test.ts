/**
 * CMS Coverage Boost Tests
 *
 * Comprehensive tests to reach 95%+ coverage on all CMS-related files:
 * - routes/[contentType]/+page.server.ts
 * - routes/[contentType]/[slug]/+page.server.ts
 * - routes/api/cms/[type]/+server.ts (branch gaps)
 * - routes/api/cms/[type]/[id]/+server.ts (branch gaps)
 * - routes/api/cms/[type]/tags/+server.ts (branch gaps)
 * - routes/api/cms/types/+server.ts (branch gaps)
 * - routes/api/cms/types/[id]/+server.ts (branch gaps)
 * - lib/services/cms.ts (uncovered functions and branch gaps)
 * - lib/cms/index.ts (re-exports)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Helper: Queue-based Mock DB ──────────────────────────────────────────────

function createMockDB(): any {
	const db: any = {
		_firstQueue: [] as any[],
		_allQueue: [] as any[],
		_runResult: { meta: { changes: 1 } },
		_batchResults: [],
		prepare: vi.fn().mockReturnThis(),
		bind: vi.fn().mockReturnThis(),
		first: vi.fn(function () {
			return Promise.resolve(db._firstQueue.shift() ?? null);
		}),
		all: vi.fn(function () {
			return Promise.resolve(db._allQueue.shift() ?? { results: [] });
		}),
		run: vi.fn(function () {
			return Promise.resolve(db._runResult);
		}),
		batch: vi.fn(function () {
			return Promise.resolve(db._batchResults);
		})
	};
	return db;
}

function createMockEvent(options: {
	user?: any;
	params?: Record<string, string>;
	body?: any;
	db?: any;
	url?: URL;
}): any {
	const db = options.db !== undefined ? options.db : createMockDB();
	return {
		locals: { user: options.user || null },
		params: options.params || {},
		platform: { env: { DB: db } },
		request: { json: async () => options.body || {} },
		url: options.url || new URL('http://localhost/test')
	};
}

const adminUser = { id: 'user-1', login: 'admin', email: 'a@b.com', isOwner: true, isAdmin: true };
const regularUser = {
	id: 'user-2',
	login: 'user',
	email: 'u@b.com',
	isOwner: false,
	isAdmin: false
};

const mockContentTypeRow = {
	id: 'ct-1',
	slug: 'blog',
	name: 'Blog Posts',
	description: 'Articles',
	fields: '[]',
	settings:
		'{"listPageSize":12,"defaultSort":"published_at","defaultSortDirection":"desc","hasTags":true}',
	icon: 'article',
	sort_order: 0,
	is_system: 1,
	created_at: '2026-01-01',
	updated_at: '2026-01-01'
};

const mockContentItemRow = {
	id: 'item-1',
	content_type_id: 'ct-1',
	slug: 'hello-world',
	title: 'Hello World',
	status: 'published',
	fields: '{"body":"content"}',
	seo_title: null,
	seo_description: null,
	seo_image: null,
	author_id: 'user-1',
	published_at: '2026-01-01',
	created_at: '2026-01-01',
	updated_at: '2026-01-01'
};

const mockTagRow = {
	id: 'tag-1',
	content_type_id: 'ct-1',
	name: 'JavaScript',
	slug: 'javascript',
	created_at: '2026-01-01'
};

// ─── [contentType]/+page.server.ts ────────────────────────────────────────────

describe('[contentType] page server load', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('should throw 500 when database is not available', async () => {
		const { load } = await import('../../src/routes/[contentType]/+page.server.js');
		try {
			await load({
				params: { contentType: 'blog' },
				platform: { env: {} },
				url: new URL('http://localhost/blog')
			} as any);
			expect.fail('Should have thrown');
		} catch (err: any) {
			expect(err.status).toBe(500);
		}
	});

	it('should throw 404 for nonexistent content type', async () => {
		const { load } = await import('../../src/routes/[contentType]/+page.server.js');
		const mockDB = createMockDB();
		// syncContentTypes: return existing types
		mockDB._allQueue.push({ results: [mockContentTypeRow] });
		// isContentTypeSlug: return null
		mockDB._firstQueue.push(null);

		try {
			await load({
				params: { contentType: 'nonexistent' },
				platform: { env: { DB: mockDB } },
				url: new URL('http://localhost/nonexistent')
			} as any);
			expect.fail('Should have thrown');
		} catch (err: any) {
			expect(err.status).toBe(404);
		}
	});

	it('should throw 404 when content type exists in slug check but not in full lookup', async () => {
		const { load } = await import('../../src/routes/[contentType]/+page.server.js');
		const mockDB = createMockDB();
		// syncContentTypes: return existing types
		mockDB._allQueue.push({ results: [mockContentTypeRow] });
		// isContentTypeSlug: found
		mockDB._firstQueue.push({ id: 'ct-1' });
		// getContentTypeBySlug: not found (edge case)
		mockDB._firstQueue.push(null);

		try {
			await load({
				params: { contentType: 'blog' },
				platform: { env: { DB: mockDB } },
				url: new URL('http://localhost/blog')
			} as any);
			expect.fail('Should have thrown');
		} catch (err: any) {
			expect(err.status).toBe(404);
		}
	});

	it('should return content type with items on success', async () => {
		const { load } = await import('../../src/routes/[contentType]/+page.server.js');
		const mockDB = createMockDB();
		// syncContentTypes: return existing types
		mockDB._allQueue.push({ results: [mockContentTypeRow] });
		// isContentTypeSlug: found
		mockDB._firstQueue.push({ id: 'ct-1' });
		// getContentTypeBySlug: returns the content type
		mockDB._firstQueue.push(mockContentTypeRow);
		// listContentItems: count
		mockDB._firstQueue.push({ count: 1 });
		// listContentItems: items
		mockDB._allQueue.push({ results: [mockContentItemRow] });

		const result = (await load({
			params: { contentType: 'blog' },
			platform: { env: { DB: mockDB } },
			url: new URL('http://localhost/blog')
		} as any)) as any;

		expect(result.contentType).toBeTruthy();
		expect(result.contentType.slug).toBe('blog');
		expect(result.items).toHaveLength(1);
	});

	it('should parse search, tag, and page query params', async () => {
		const { load } = await import('../../src/routes/[contentType]/+page.server.js');
		const mockDB = createMockDB();
		// syncContentTypes
		mockDB._allQueue.push({ results: [mockContentTypeRow] });
		// isContentTypeSlug
		mockDB._firstQueue.push({ id: 'ct-1' });
		// getContentTypeBySlug
		mockDB._firstQueue.push(mockContentTypeRow);
		// listContentItems: count
		mockDB._firstQueue.push({ count: 0 });
		// listContentItems: items
		mockDB._allQueue.push({ results: [] });

		const result = (await load({
			params: { contentType: 'blog' },
			platform: { env: { DB: mockDB } },
			url: new URL('http://localhost/blog?search=test&tag=js&page=2')
		} as any)) as any;

		expect(result.items).toEqual([]);
	});

	it('should handle platform being undefined', async () => {
		const { load } = await import('../../src/routes/[contentType]/+page.server.js');
		try {
			await load({
				params: { contentType: 'blog' },
				platform: undefined,
				url: new URL('http://localhost/blog')
			} as any);
			expect.fail('Should have thrown');
		} catch (err: any) {
			expect(err.status).toBe(500);
		}
	});
});

// ─── [contentType]/[slug]/+page.server.ts ─────────────────────────────────────

describe('[contentType]/[slug] page server load', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('should throw 500 when database is not available', async () => {
		const { load } = await import('../../src/routes/[contentType]/[slug]/+page.server.js');
		try {
			await load({
				params: { contentType: 'blog', slug: 'hello' },
				platform: { env: {} }
			} as any);
			expect.fail('Should have thrown');
		} catch (err: any) {
			expect(err.status).toBe(500);
		}
	});

	it('should throw 404 for nonexistent content type slug', async () => {
		const { load } = await import('../../src/routes/[contentType]/[slug]/+page.server.js');
		const mockDB = createMockDB();
		// syncContentTypes
		mockDB._allQueue.push({ results: [] });
		// isContentTypeSlug: not found
		mockDB._firstQueue.push(null);

		try {
			await load({
				params: { contentType: 'nonexistent', slug: 'hello' },
				platform: { env: { DB: mockDB } }
			} as any);
			expect.fail('Should have thrown');
		} catch (err: any) {
			expect(err.status).toBe(404);
		}
	});

	it('should throw 404 when content type slug exists but full lookup fails', async () => {
		const { load } = await import('../../src/routes/[contentType]/[slug]/+page.server.js');
		const mockDB = createMockDB();
		// syncContentTypes
		mockDB._allQueue.push({ results: [] });
		// isContentTypeSlug: found
		mockDB._firstQueue.push({ id: 'ct-1' });
		// getContentTypeBySlug: null
		mockDB._firstQueue.push(null);

		try {
			await load({
				params: { contentType: 'blog', slug: 'hello' },
				platform: { env: { DB: mockDB } }
			} as any);
			expect.fail('Should have thrown');
		} catch (err: any) {
			expect(err.status).toBe(404);
		}
	});

	it('should throw 404 when content item not found', async () => {
		const { load } = await import('../../src/routes/[contentType]/[slug]/+page.server.js');
		const mockDB = createMockDB();
		// syncContentTypes
		mockDB._allQueue.push({ results: [] });
		// isContentTypeSlug
		mockDB._firstQueue.push({ id: 'ct-1' });
		// getContentTypeBySlug
		mockDB._firstQueue.push(mockContentTypeRow);
		// getContentItemBySlug: not found
		mockDB._firstQueue.push(null);

		try {
			await load({
				params: { contentType: 'blog', slug: 'nonexistent' },
				platform: { env: { DB: mockDB } }
			} as any);
			expect.fail('Should have thrown');
		} catch (err: any) {
			expect(err.status).toBe(404);
		}
	});

	it('should throw 404 when content item is not published', async () => {
		const { load } = await import('../../src/routes/[contentType]/[slug]/+page.server.js');
		const mockDB = createMockDB();
		// syncContentTypes
		mockDB._allQueue.push({ results: [] });
		// isContentTypeSlug
		mockDB._firstQueue.push({ id: 'ct-1' });
		// getContentTypeBySlug
		mockDB._firstQueue.push(mockContentTypeRow);
		// getContentItemBySlug: draft item
		mockDB._firstQueue.push({ ...mockContentItemRow, status: 'draft' });

		try {
			await load({
				params: { contentType: 'blog', slug: 'draft-post' },
				platform: { env: { DB: mockDB } }
			} as any);
			expect.fail('Should have thrown');
		} catch (err: any) {
			expect(err.status).toBe(404);
		}
	});

	it('should return content type, item, and tags on success', async () => {
		const { load } = await import('../../src/routes/[contentType]/[slug]/+page.server.js');
		const mockDB = createMockDB();
		// syncContentTypes
		mockDB._allQueue.push({ results: [] });
		// isContentTypeSlug
		mockDB._firstQueue.push({ id: 'ct-1' });
		// getContentTypeBySlug
		mockDB._firstQueue.push(mockContentTypeRow);
		// getContentItemBySlug: published item
		mockDB._firstQueue.push(mockContentItemRow);
		// getItemTags: tags (hasTags is true in settings)
		mockDB._allQueue.push({ results: [mockTagRow] });

		const result = (await load({
			params: { contentType: 'blog', slug: 'hello-world' },
			platform: { env: { DB: mockDB } }
		} as any)) as any;

		expect(result.contentType).toBeTruthy();
		expect(result.item).toBeTruthy();
		expect(result.tags).toHaveLength(1);
	});

	it('should skip tag loading when hasTags is false', async () => {
		const { load } = await import('../../src/routes/[contentType]/[slug]/+page.server.js');
		const mockDB = createMockDB();
		const noTagsRow = {
			...mockContentTypeRow,
			settings: '{"hasTags":false}'
		};
		// syncContentTypes
		mockDB._allQueue.push({ results: [] });
		// isContentTypeSlug
		mockDB._firstQueue.push({ id: 'ct-1' });
		// getContentTypeBySlug
		mockDB._firstQueue.push(noTagsRow);
		// getContentItemBySlug
		mockDB._firstQueue.push(mockContentItemRow);

		const result = (await load({
			params: { contentType: 'blog', slug: 'hello-world' },
			platform: { env: { DB: mockDB } }
		} as any)) as any;

		expect(result.tags).toEqual([]);
	});

	it('should handle platform being undefined', async () => {
		const { load } = await import('../../src/routes/[contentType]/[slug]/+page.server.js');
		try {
			await load({
				params: { contentType: 'blog', slug: 'test' },
				platform: undefined
			} as any);
			expect.fail('Should have thrown');
		} catch (err: any) {
			expect(err.status).toBe(500);
		}
	});
});

// ─── CMS API [type] – Additional branch coverage ─────────────────────────────

describe('CMS API /api/cms/[type] - Branch Coverage', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	describe('GET /api/cms/[type] - filter branches', () => {
		it('should handle all query parameters (status, authorId, search, tag, sorting)', async () => {
			const { GET } = await import('../../src/routes/api/cms/[type]/+server.js');
			const mockDB = createMockDB();
			// getContentTypeBySlug
			mockDB._firstQueue.push(mockContentTypeRow);
			// listContentItems: count
			mockDB._firstQueue.push({ count: 0 });
			// listContentItems: items
			mockDB._allQueue.push({ results: [] });

			const response = await GET(
				createMockEvent({
					user: adminUser,
					params: { type: 'blog' },
					db: mockDB,
					url: new URL(
						'http://localhost/api/cms/blog?status=draft&authorId=user-1&search=hello&tag=js&page=2&pageSize=5&sortBy=title&sortDirection=asc'
					)
				})
			);

			expect(response.status).toBe(200);
		});

		it('should handle missing database', async () => {
			const { GET } = await import('../../src/routes/api/cms/[type]/+server.js');
			try {
				await GET(
					createMockEvent({
						user: adminUser,
						params: { type: 'blog' },
						db: null,
						url: new URL('http://localhost/api/cms/blog')
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('should handle internal errors in GET', async () => {
			const { GET } = await import('../../src/routes/api/cms/[type]/+server.js');
			const mockDB = createMockDB();
			mockDB.first.mockRejectedValueOnce(new Error('DB error'));

			try {
				await GET(
					createMockEvent({
						user: adminUser,
						params: { type: 'blog' },
						db: mockDB,
						url: new URL('http://localhost/api/cms/blog')
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});
	});

	describe('POST /api/cms/[type] - branch coverage', () => {
		it('should require authentication', async () => {
			const { POST } = await import('../../src/routes/api/cms/[type]/+server.js');
			try {
				await POST(
					createMockEvent({
						user: null,
						params: { type: 'blog' }
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('should require admin privileges', async () => {
			const { POST } = await import('../../src/routes/api/cms/[type]/+server.js');
			try {
				await POST(
					createMockEvent({
						user: regularUser,
						params: { type: 'blog' }
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(403);
			}
		});

		it('should handle missing database in POST', async () => {
			const { POST } = await import('../../src/routes/api/cms/[type]/+server.js');
			try {
				await POST({
					locals: { user: adminUser },
					params: { type: 'blog' },
					platform: { env: {} },
					request: { json: async () => ({}) }
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('should return 404 when content type not found', async () => {
			const { POST } = await import('../../src/routes/api/cms/[type]/+server.js');
			const mockDB = createMockDB();
			mockDB._firstQueue.push(null);

			try {
				await POST(
					createMockEvent({
						user: adminUser,
						params: { type: 'nonexistent' },
						body: { title: 'Test' },
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(404);
			}
		});

		it('should return 400 when title is missing', async () => {
			const { POST } = await import('../../src/routes/api/cms/[type]/+server.js');
			const mockDB = createMockDB();
			mockDB._firstQueue.push(mockContentTypeRow);

			try {
				await POST(
					createMockEvent({
						user: adminUser,
						params: { type: 'blog' },
						body: {},
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should validate fields against type definition', async () => {
			const { POST } = await import('../../src/routes/api/cms/[type]/+server.js');
			const mockDB = createMockDB();
			const typeWithRequiredFields = {
				...mockContentTypeRow,
				fields: JSON.stringify([
					{
						name: 'body',
						label: 'Body',
						type: 'richtext',
						required: true,
						validation: { required: true }
					}
				])
			};
			mockDB._firstQueue.push(typeWithRequiredFields);

			try {
				await POST(
					createMockEvent({
						user: adminUser,
						params: { type: 'blog' },
						body: { title: 'Test', fields: {} },
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should create item and return 201', async () => {
			const { POST } = await import('../../src/routes/api/cms/[type]/+server.js');
			const mockDB = createMockDB();
			// getContentTypeBySlug
			mockDB._firstQueue.push(mockContentTypeRow);
			// createContentItem: get content type
			mockDB._firstQueue.push(mockContentTypeRow);
			// createContentItem: author existence
			mockDB._firstQueue.push({ id: 'user-1' });
			// createContentItem: check slug uniqueness
			mockDB._firstQueue.push(null);
			// createContentItem: insert
			mockDB._firstQueue.push(mockContentItemRow);

			const response = await POST(
				createMockEvent({
					user: adminUser,
					params: { type: 'blog' },
					body: { title: 'Hello World' },
					db: mockDB
				})
			);

			expect(response.status).toBe(201);
		});

		it('should handle failed create (null result)', async () => {
			const { POST } = await import('../../src/routes/api/cms/[type]/+server.js');
			const mockDB = createMockDB();
			// getContentTypeBySlug
			mockDB._firstQueue.push(mockContentTypeRow);
			// createContentItem: get content type
			mockDB._firstQueue.push(mockContentTypeRow);
			// createContentItem: author existence
			mockDB._firstQueue.push({ id: 'user-1' });
			// createContentItem: check slug uniqueness
			mockDB._firstQueue.push(null);
			// createContentItem: insert fails
			mockDB._firstQueue.push(null);

			try {
				await POST(
					createMockEvent({
						user: adminUser,
						params: { type: 'blog' },
						body: { title: 'Test' },
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('should handle internal errors in POST', async () => {
			const { POST } = await import('../../src/routes/api/cms/[type]/+server.js');
			const mockDB = createMockDB();
			mockDB.first.mockRejectedValueOnce(new Error('DB error'));

			try {
				await POST(
					createMockEvent({
						user: adminUser,
						params: { type: 'blog' },
						body: { title: 'Test' },
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});
	});
});

// ─── CMS API [type]/[id] – Additional branch coverage ────────────────────────

describe('CMS API /api/cms/[type]/[id] - Branch Coverage', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	describe('GET /api/cms/[type]/[id]', () => {
		it('should require authentication', async () => {
			const { GET } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');
			try {
				await GET(createMockEvent({ user: null, params: { type: 'blog', id: 'item-1' } }));
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('should handle missing database', async () => {
			const { GET } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');
			try {
				await GET({
					locals: { user: adminUser },
					params: { type: 'blog', id: 'item-1' },
					platform: { env: {} }
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('should return 404 when item not found', async () => {
			const { GET } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');
			const mockDB = createMockDB();
			mockDB._firstQueue.push(null);

			try {
				await GET(
					createMockEvent({
						user: adminUser,
						params: { type: 'blog', id: 'nonexistent' },
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(404);
			}
		});

		it('should return item on success', async () => {
			const { GET } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');
			const mockDB = createMockDB();
			mockDB._firstQueue.push(mockContentItemRow);

			const response = await GET(
				createMockEvent({
					user: adminUser,
					params: { type: 'blog', id: 'item-1' },
					db: mockDB
				})
			);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.item).toBeTruthy();
		});

		it('should handle internal errors', async () => {
			const { GET } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');
			const mockDB = createMockDB();
			mockDB.first.mockRejectedValueOnce(new Error('DB fail'));

			try {
				await GET(
					createMockEvent({
						user: adminUser,
						params: { type: 'blog', id: 'item-1' },
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});
	});

	describe('PUT /api/cms/[type]/[id]', () => {
		it('should require authentication', async () => {
			const { PUT } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');
			try {
				await PUT(createMockEvent({ user: null, params: { type: 'blog', id: 'item-1' } }));
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('should require admin privileges', async () => {
			const { PUT } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');
			try {
				await PUT(createMockEvent({ user: regularUser, params: { type: 'blog', id: 'item-1' } }));
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(403);
			}
		});

		it('should handle missing database', async () => {
			const { PUT } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');
			try {
				await PUT({
					locals: { user: adminUser },
					params: { type: 'blog', id: 'item-1' },
					platform: { env: {} },
					request: { json: async () => ({}) }
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('should return 404 when item not found for update', async () => {
			const { PUT } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');
			const mockDB = createMockDB();
			// updateContentItem: get existing item
			mockDB._firstQueue.push(null);

			try {
				await PUT(
					createMockEvent({
						user: adminUser,
						params: { type: 'blog', id: 'nonexistent' },
						body: { title: 'Updated' },
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(404);
			}
		});

		it('should update item and return 200', async () => {
			const { PUT } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');
			const mockDB = createMockDB();
			// updateContentItem: get existing
			mockDB._firstQueue.push(mockContentItemRow);
			// updateContentItem: update returning
			mockDB._firstQueue.push({ ...mockContentItemRow, title: 'Updated' });

			const response = await PUT(
				createMockEvent({
					user: adminUser,
					params: { type: 'blog', id: 'item-1' },
					body: {
						title: 'Updated',
						slug: 'updated',
						status: 'published',
						fields: { body: 'new content' },
						seoTitle: 'SEO',
						seoDescription: 'Desc',
						seoImage: 'img.png',
						tagIds: ['tag-1']
					},
					db: mockDB
				})
			);

			expect(response.status).toBe(200);
		});

		it('should handle internal errors in PUT', async () => {
			const { PUT } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');
			const mockDB = createMockDB();
			mockDB.first.mockRejectedValueOnce(new Error('DB fail'));

			try {
				await PUT(
					createMockEvent({
						user: adminUser,
						params: { type: 'blog', id: 'item-1' },
						body: { title: 'Updated' },
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});
	});

	describe('DELETE /api/cms/[type]/[id]', () => {
		it('should require authentication', async () => {
			const { DELETE } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');
			try {
				await DELETE(createMockEvent({ user: null, params: { type: 'blog', id: 'item-1' } }));
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('should require admin privileges', async () => {
			const { DELETE } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');
			try {
				await DELETE(
					createMockEvent({ user: regularUser, params: { type: 'blog', id: 'item-1' } })
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(403);
			}
		});

		it('should handle missing database', async () => {
			const { DELETE } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');
			try {
				await DELETE({
					locals: { user: adminUser },
					params: { type: 'blog', id: 'item-1' },
					platform: { env: {} }
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('should return 404 when item not found for delete', async () => {
			const { DELETE } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');
			const mockDB = createMockDB();
			mockDB._runResult = { meta: { changes: 0 } };

			try {
				await DELETE(
					createMockEvent({
						user: adminUser,
						params: { type: 'blog', id: 'nonexistent' },
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(404);
			}
		});

		it('should delete item and return success', async () => {
			const { DELETE } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');
			const mockDB = createMockDB();
			mockDB._runResult = { meta: { changes: 1 } };

			const response = await DELETE(
				createMockEvent({
					user: adminUser,
					params: { type: 'blog', id: 'item-1' },
					db: mockDB
				})
			);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.success).toBe(true);
		});

		it('should handle internal errors in DELETE', async () => {
			const { DELETE } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');
			const mockDB = createMockDB();
			mockDB.run.mockRejectedValueOnce(new Error('DB fail'));

			try {
				await DELETE(
					createMockEvent({
						user: adminUser,
						params: { type: 'blog', id: 'item-1' },
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});
	});
});

// ─── CMS API [type]/tags – Comprehensive coverage ────────────────────────────

describe('CMS API /api/cms/[type]/tags - Coverage', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	describe('GET /api/cms/[type]/tags', () => {
		it('should require authentication', async () => {
			const { GET } = await import('../../src/routes/api/cms/[type]/tags/+server.js');
			try {
				await GET(createMockEvent({ user: null, params: { type: 'blog' } }));
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('should handle missing database', async () => {
			const { GET } = await import('../../src/routes/api/cms/[type]/tags/+server.js');
			try {
				await GET({
					locals: { user: adminUser },
					params: { type: 'blog' },
					platform: { env: {} }
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('should return 404 when content type not found', async () => {
			const { GET } = await import('../../src/routes/api/cms/[type]/tags/+server.js');
			const mockDB = createMockDB();
			mockDB._firstQueue.push(null);

			try {
				await GET(
					createMockEvent({
						user: adminUser,
						params: { type: 'nonexistent' },
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(404);
			}
		});

		it('should return tags for a content type', async () => {
			const { GET } = await import('../../src/routes/api/cms/[type]/tags/+server.js');
			const mockDB = createMockDB();
			mockDB._firstQueue.push(mockContentTypeRow);
			mockDB._allQueue.push({ results: [mockTagRow] });

			const response = await GET(
				createMockEvent({
					user: adminUser,
					params: { type: 'blog' },
					db: mockDB
				})
			);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.tags).toHaveLength(1);
		});

		it('should handle internal errors in GET', async () => {
			const { GET } = await import('../../src/routes/api/cms/[type]/tags/+server.js');
			const mockDB = createMockDB();
			mockDB.first.mockRejectedValueOnce(new Error('DB error'));

			try {
				await GET(
					createMockEvent({
						user: adminUser,
						params: { type: 'blog' },
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});
	});

	describe('POST /api/cms/[type]/tags', () => {
		it('should require authentication', async () => {
			const { POST } = await import('../../src/routes/api/cms/[type]/tags/+server.js');
			try {
				await POST(createMockEvent({ user: null, params: { type: 'blog' } }));
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('should require admin privileges', async () => {
			const { POST } = await import('../../src/routes/api/cms/[type]/tags/+server.js');
			try {
				await POST(createMockEvent({ user: regularUser, params: { type: 'blog' } }));
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(403);
			}
		});

		it('should handle missing database in POST', async () => {
			const { POST } = await import('../../src/routes/api/cms/[type]/tags/+server.js');
			try {
				await POST({
					locals: { user: adminUser },
					params: { type: 'blog' },
					platform: { env: {} },
					request: { json: async () => ({}) }
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('should return 404 when content type not found', async () => {
			const { POST } = await import('../../src/routes/api/cms/[type]/tags/+server.js');
			const mockDB = createMockDB();
			mockDB._firstQueue.push(null);

			try {
				await POST(
					createMockEvent({
						user: adminUser,
						params: { type: 'nonexistent' },
						body: { name: 'Test' },
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(404);
			}
		});

		it('should return 400 when tag name is missing', async () => {
			const { POST } = await import('../../src/routes/api/cms/[type]/tags/+server.js');
			const mockDB = createMockDB();
			mockDB._firstQueue.push(mockContentTypeRow);

			try {
				await POST(
					createMockEvent({
						user: adminUser,
						params: { type: 'blog' },
						body: {},
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should create tag and return 201', async () => {
			const { POST } = await import('../../src/routes/api/cms/[type]/tags/+server.js');
			const mockDB = createMockDB();
			// getContentTypeBySlug
			mockDB._firstQueue.push(mockContentTypeRow);
			// createContentTag: insert
			mockDB._firstQueue.push(mockTagRow);

			const response = await POST(
				createMockEvent({
					user: adminUser,
					params: { type: 'blog' },
					body: { name: 'JavaScript' },
					db: mockDB
				})
			);

			expect(response.status).toBe(201);
			const data = await response.json();
			expect(data.tag).toBeTruthy();
		});

		it('should return 500 when tag creation fails', async () => {
			const { POST } = await import('../../src/routes/api/cms/[type]/tags/+server.js');
			const mockDB = createMockDB();
			// getContentTypeBySlug
			mockDB._firstQueue.push(mockContentTypeRow);
			// createContentTag: insert fails
			mockDB._firstQueue.push(null);

			try {
				await POST(
					createMockEvent({
						user: adminUser,
						params: { type: 'blog' },
						body: { name: 'JavaScript' },
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('should handle internal errors in POST', async () => {
			const { POST } = await import('../../src/routes/api/cms/[type]/tags/+server.js');
			const mockDB = createMockDB();
			mockDB.first.mockRejectedValueOnce(new Error('DB error'));

			try {
				await POST(
					createMockEvent({
						user: adminUser,
						params: { type: 'blog' },
						body: { name: 'JavaScript' },
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});
	});
});

// ─── CMS API types – Additional branch coverage ──────────────────────────────

describe('CMS API /api/cms/types - Branch Coverage', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	describe('GET /api/cms/types - error handling', () => {
		it('should handle internal errors', async () => {
			const { GET } = await import('../../src/routes/api/cms/types/+server.js');
			const mockDB = createMockDB();
			mockDB.all.mockRejectedValueOnce(new Error('DB error'));

			try {
				await GET(
					createMockEvent({
						user: adminUser,
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});
	});

	describe('POST /api/cms/types - branch coverage', () => {
		it('should return 400 when name is empty string', async () => {
			const { POST } = await import('../../src/routes/api/cms/types/+server.js');
			const mockDB = createMockDB();
			try {
				await POST(
					createMockEvent({
						user: adminUser,
						body: { name: '   ' },
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should handle validation errors', async () => {
			const { POST } = await import('../../src/routes/api/cms/types/+server.js');
			const mockDB = createMockDB();
			try {
				await POST(
					createMockEvent({
						user: adminUser,
						body: {
							name: 'Test',
							slug: 'INVALID SLUG!',
							fields: [{ name: '', label: '', type: '' }],
							settings: {}
						},
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should return 409 when slug already exists', async () => {
			const { POST } = await import('../../src/routes/api/cms/types/+server.js');
			const mockDB = createMockDB();
			// createContentTypeInDB: check slug → exists
			mockDB._firstQueue.push({ id: 'existing-id' });

			try {
				await POST(
					createMockEvent({
						user: adminUser,
						body: { name: 'Blog', slug: 'blog', fields: [], settings: {} },
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(409);
			}
		});

		it('should handle internal errors in POST', async () => {
			const { POST } = await import('../../src/routes/api/cms/types/+server.js');
			const mockDB = createMockDB();
			mockDB.first.mockRejectedValueOnce(new Error('DB error'));

			try {
				await POST(
					createMockEvent({
						user: adminUser,
						body: { name: 'Test', slug: 'test', fields: [], settings: {} },
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('should create type with default icon and fields when not provided', async () => {
			const { POST } = await import('../../src/routes/api/cms/types/+server.js');
			const mockDB = createMockDB();
			// slug check: not exists
			mockDB._firstQueue.push(null);
			// max sort_order
			mockDB._firstQueue.push({ max_order: 2 });
			// insert returning
			mockDB._firstQueue.push({
				id: 'new-id',
				slug: 'test',
				name: 'Test',
				description: null,
				fields: '[]',
				settings: '{}',
				icon: 'document',
				sort_order: 3,
				is_system: 0,
				created_at: '2026-01-01',
				updated_at: '2026-01-01'
			});

			const response = await POST(
				createMockEvent({
					user: adminUser,
					body: { name: 'Test' },
					db: mockDB
				})
			);

			expect(response.status).toBe(201);
		});
	});
});

// ─── CMS API types/[id] – Comprehensive coverage ─────────────────────────────

describe('CMS API /api/cms/types/[id] - Coverage', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	describe('GET /api/cms/types/[id]', () => {
		it('should require authentication', async () => {
			const { GET } = await import('../../src/routes/api/cms/types/[id]/+server.js');
			try {
				await GET(createMockEvent({ user: null, params: { id: 'type-1' } }));
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('should require admin privileges', async () => {
			const { GET } = await import('../../src/routes/api/cms/types/[id]/+server.js');
			try {
				await GET(createMockEvent({ user: regularUser, params: { id: 'type-1' } }));
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(403);
			}
		});

		it('should handle missing database', async () => {
			const { GET } = await import('../../src/routes/api/cms/types/[id]/+server.js');
			try {
				await GET({
					locals: { user: adminUser },
					params: { id: 'type-1' },
					platform: { env: {} }
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('should return 404 when content type not found', async () => {
			const { GET } = await import('../../src/routes/api/cms/types/[id]/+server.js');
			const mockDB = createMockDB();
			mockDB._firstQueue.push(null);

			try {
				await GET(
					createMockEvent({
						user: adminUser,
						params: { id: 'nonexistent' },
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(404);
			}
		});

		it('should return content type on success', async () => {
			const { GET } = await import('../../src/routes/api/cms/types/[id]/+server.js');
			const mockDB = createMockDB();
			mockDB._firstQueue.push(mockContentTypeRow);

			const response = await GET(
				createMockEvent({
					user: adminUser,
					params: { id: 'ct-1' },
					db: mockDB
				})
			);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.contentType).toBeTruthy();
		});

		it('should handle internal errors', async () => {
			const { GET } = await import('../../src/routes/api/cms/types/[id]/+server.js');
			const mockDB = createMockDB();
			mockDB.first.mockRejectedValueOnce(new Error('DB fail'));

			try {
				await GET(
					createMockEvent({
						user: adminUser,
						params: { id: 'type-1' },
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});
	});

	describe('PUT /api/cms/types/[id]', () => {
		it('should require authentication', async () => {
			const { PUT } = await import('../../src/routes/api/cms/types/[id]/+server.js');
			try {
				await PUT(createMockEvent({ user: null, params: { id: 'type-1' } }));
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('should require admin privileges', async () => {
			const { PUT } = await import('../../src/routes/api/cms/types/[id]/+server.js');
			try {
				await PUT(createMockEvent({ user: regularUser, params: { id: 'type-1' } }));
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(403);
			}
		});

		it('should handle missing database', async () => {
			const { PUT } = await import('../../src/routes/api/cms/types/[id]/+server.js');
			try {
				await PUT({
					locals: { user: adminUser },
					params: { id: 'type-1' },
					platform: { env: {} },
					request: { json: async () => ({}) }
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('should return 400 for invalid input', async () => {
			const { PUT } = await import('../../src/routes/api/cms/types/[id]/+server.js');
			const mockDB = createMockDB();
			try {
				await PUT(
					createMockEvent({
						user: adminUser,
						params: { id: 'type-1' },
						body: {
							name: 'Updated',
							slug: 'INVALID SLUG!',
							fields: [{ name: '', label: '', type: '' }]
						},
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should filter out name errors when name is not provided', async () => {
			const { PUT } = await import('../../src/routes/api/cms/types/[id]/+server.js');
			const mockDB = createMockDB();
			// updateContentTypeInDB returns the updated type
			mockDB._firstQueue.push(mockContentTypeRow);

			const response = await PUT(
				createMockEvent({
					user: adminUser,
					params: { id: 'type-1' },
					body: { description: 'Updated description' },
					db: mockDB
				})
			);

			expect(response.status).toBe(200);
		});

		it('should return 404 when content type not found for update', async () => {
			const { PUT } = await import('../../src/routes/api/cms/types/[id]/+server.js');
			const mockDB = createMockDB();
			// updateContentTypeInDB: return null
			mockDB._firstQueue.push(null);

			try {
				await PUT(
					createMockEvent({
						user: adminUser,
						params: { id: 'nonexistent' },
						body: { name: 'Test' },
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(404);
			}
		});

		it('should update content type and return 200', async () => {
			const { PUT } = await import('../../src/routes/api/cms/types/[id]/+server.js');
			const mockDB = createMockDB();
			mockDB._firstQueue.push({
				...mockContentTypeRow,
				name: 'Updated',
				slug: 'updated-slug',
				description: 'Updated desc',
				icon: 'star'
			});

			const response = await PUT(
				createMockEvent({
					user: adminUser,
					params: { id: 'ct-1' },
					body: {
						name: 'Updated',
						slug: 'updated-slug',
						description: 'Updated desc',
						icon: 'star',
						fields: [{ name: 'body', label: 'Body', type: 'text' }],
						settings: { routePrefix: '/updated' }
					},
					db: mockDB
				})
			);

			expect(response.status).toBe(200);
		});

		it('should handle internal errors in PUT', async () => {
			const { PUT } = await import('../../src/routes/api/cms/types/[id]/+server.js');
			const mockDB = createMockDB();
			mockDB.first.mockRejectedValueOnce(new Error('DB fail'));

			try {
				await PUT(
					createMockEvent({
						user: adminUser,
						params: { id: 'type-1' },
						body: { name: 'Test' },
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});
	});

	describe('DELETE /api/cms/types/[id]', () => {
		it('should require authentication', async () => {
			const { DELETE } = await import('../../src/routes/api/cms/types/[id]/+server.js');
			try {
				await DELETE(createMockEvent({ user: null, params: { id: 'type-1' } }));
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('should require admin privileges', async () => {
			const { DELETE } = await import('../../src/routes/api/cms/types/[id]/+server.js');
			try {
				await DELETE(createMockEvent({ user: regularUser, params: { id: 'type-1' } }));
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(403);
			}
		});

		it('should handle missing database', async () => {
			const { DELETE } = await import('../../src/routes/api/cms/types/[id]/+server.js');
			try {
				await DELETE({
					locals: { user: adminUser },
					params: { id: 'type-1' },
					platform: { env: {} }
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('should delete non-system content type', async () => {
			const { DELETE } = await import('../../src/routes/api/cms/types/[id]/+server.js');
			const mockDB = createMockDB();
			mockDB._firstQueue.push({ id: 'type-1', is_system: 0 });

			const response = await DELETE(
				createMockEvent({
					user: adminUser,
					params: { id: 'type-1' },
					db: mockDB
				})
			);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.success).toBe(true);
		});

		it('should return 403 for system content type deletion', async () => {
			const { DELETE } = await import('../../src/routes/api/cms/types/[id]/+server.js');
			const mockDB = createMockDB();
			mockDB._firstQueue.push({ id: 'type-1', is_system: 1 });

			try {
				await DELETE(
					createMockEvent({
						user: adminUser,
						params: { id: 'type-1' },
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(403);
			}
		});

		it('should return 404 when content type not found for deletion', async () => {
			const { DELETE } = await import('../../src/routes/api/cms/types/[id]/+server.js');
			const mockDB = createMockDB();
			mockDB._firstQueue.push(null);

			try {
				await DELETE(
					createMockEvent({
						user: adminUser,
						params: { id: 'nonexistent' },
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(404);
			}
		});

		it('should handle internal errors in DELETE', async () => {
			const { DELETE } = await import('../../src/routes/api/cms/types/[id]/+server.js');
			const mockDB = createMockDB();
			mockDB.first.mockRejectedValueOnce(new Error('DB fail'));

			try {
				await DELETE(
					createMockEvent({
						user: adminUser,
						params: { id: 'type-1' },
						db: mockDB
					})
				);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});
	});
});

// ─── CMS Service - Additional branch coverage ────────────────────────────────

describe('CMS Service - Additional Coverage', () => {
	let cms: any;

	beforeEach(async () => {
		vi.resetModules();
		cms = await import('../../src/lib/services/cms.js');
	});

	describe('isContentTypeSlug', () => {
		it('should return true when slug exists', async () => {
			const mockDB = createMockDB();
			mockDB._firstQueue.push({ id: 'ct-1' });

			const result = await cms.isContentTypeSlug(mockDB, 'blog');
			expect(result).toBe(true);
		});

		it('should return false when slug does not exist', async () => {
			const mockDB = createMockDB();
			mockDB._firstQueue.push(null);

			const result = await cms.isContentTypeSlug(mockDB, 'nonexistent');
			expect(result).toBe(false);
		});
	});

	describe('getContentTypeById', () => {
		it('should return parsed content type', async () => {
			const mockDB = createMockDB();
			mockDB._firstQueue.push(mockContentTypeRow);

			const result = await cms.getContentTypeById(mockDB, 'ct-1');
			expect(result).toBeTruthy();
			expect(result.id).toBe('ct-1');
			expect(result.slug).toBe('blog');
		});

		it('should return null when not found', async () => {
			const mockDB = createMockDB();
			mockDB._firstQueue.push(null);

			const result = await cms.getContentTypeById(mockDB, 'nonexistent');
			expect(result).toBeNull();
		});
	});

	describe('getAllContentTypeSlugs', () => {
		it('should return all slugs', async () => {
			const mockDB = createMockDB();
			mockDB._allQueue.push({ results: [{ slug: 'blog' }, { slug: 'faq' }] });

			const result = await cms.getAllContentTypeSlugs(mockDB);
			expect(result).toEqual(['blog', 'faq']);
		});
	});

	describe('getItemTags', () => {
		it('should return parsed tags for an item', async () => {
			const mockDB = createMockDB();
			mockDB._allQueue.push({ results: [mockTagRow] });

			const result = await cms.getItemTags(mockDB, 'item-1');
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('JavaScript');
		});

		it('should return empty array when no tags', async () => {
			const mockDB = createMockDB();
			mockDB._allQueue.push({ results: [] });

			const result = await cms.getItemTags(mockDB, 'item-1');
			expect(result).toEqual([]);
		});
	});

	describe('createContentItem - duplicate slug branch', () => {
		it('should append suffix when slug already exists', async () => {
			const mockDB = createMockDB();
			// get content type by slug
			mockDB._firstQueue.push(mockContentTypeRow);
			// check slug uniqueness: slug exists
			mockDB._firstQueue.push({ id: 'existing-item' });
			// insert with unique slug
			mockDB._firstQueue.push({
				...mockContentItemRow,
				slug: 'hello-world-abc12345'
			});

			const result = await cms.createContentItem(mockDB, {
				contentTypeSlug: 'blog',
				title: 'Hello World',
				slug: 'hello-world',
				fields: {}
			});

			expect(result).toBeTruthy();
		});
	});

	describe('createContentItem - with tag IDs', () => {
		it('should set tags after insert', async () => {
			const mockDB = createMockDB();
			// get content type
			mockDB._firstQueue.push(mockContentTypeRow);
			// check slug: no duplicate
			mockDB._firstQueue.push(null);
			// insert
			mockDB._firstQueue.push(mockContentItemRow);

			const result = await cms.createContentItem(mockDB, {
				contentTypeSlug: 'blog',
				title: 'Hello World',
				fields: {},
				tagIds: ['tag-1']
			});

			expect(result).toBeTruthy();
			expect(mockDB.batch).toHaveBeenCalled();
		});
	});

	describe('updateContentItem - publishing transition', () => {
		it('should set publishedAt when transitioning to published', async () => {
			const mockDB = createMockDB();
			// get existing (draft)
			mockDB._firstQueue.push({ ...mockContentItemRow, status: 'draft', published_at: null });
			// update returning
			mockDB._firstQueue.push({ ...mockContentItemRow, status: 'published' });

			const result = await cms.updateContentItem(mockDB, 'item-1', {
				status: 'published'
			});

			expect(result).toBeTruthy();
		});

		it('should set tags on update when tagIds provided', async () => {
			const mockDB = createMockDB();
			// get existing
			mockDB._firstQueue.push(mockContentItemRow);
			// update returning
			mockDB._firstQueue.push(mockContentItemRow);

			const result = await cms.updateContentItem(mockDB, 'item-1', {
				tagIds: ['tag-1', 'tag-2']
			});

			expect(result).toBeTruthy();
			expect(mockDB.batch).toHaveBeenCalled();
		});
	});

	describe('updateContentTypeInDB - empty update', () => {
		it('should return current type when nothing to update', async () => {
			const mockDB = createMockDB();
			// getContentTypeById called internally
			mockDB._firstQueue.push(mockContentTypeRow);

			const result = await cms.updateContentTypeInDB(mockDB, 'ct-1', {});
			expect(result).toBeTruthy();
		});
	});

	describe('createContentTypeInDB - with max sort_order', () => {
		it('should use next sort order after existing max', async () => {
			const mockDB = createMockDB();
			// check slug: not exists
			mockDB._firstQueue.push(null);
			// max sort_order = 5
			mockDB._firstQueue.push({ max_order: 5 });
			// insert returning
			mockDB._firstQueue.push({
				...mockContentTypeRow,
				id: 'new-id',
				sort_order: 6,
				is_system: 0
			});

			const result = await cms.createContentTypeInDB(mockDB, {
				name: 'Test',
				slug: 'test',
				fields: [],
				settings: {}
			});

			expect(result).toBeTruthy();
		});
	});

	describe('listContentItems - additional branches', () => {
		it('should handle search filter', async () => {
			const mockDB = createMockDB();
			mockDB._firstQueue.push({ count: 0 });
			mockDB._allQueue.push({ results: [] });

			const result = await cms.listContentItems(mockDB, 'ct-1', {
				search: 'test query',
				status: 'published',
				authorId: 'user-1',
				page: 2,
				pageSize: 5,
				sortBy: 'title',
				sortDirection: 'asc'
			});

			expect(result.items).toEqual([]);
			expect(result.page).toBe(2);
		});

		it('should handle invalid sort column', async () => {
			const mockDB = createMockDB();
			mockDB._firstQueue.push({ count: 0 });
			mockDB._allQueue.push({ results: [] });

			const result = await cms.listContentItems(mockDB, 'ct-1', {
				sortBy: 'DROP TABLE; --' as any, // SQL injection attempt
				sortDirection: 'desc'
			});

			expect(result.items).toEqual([]);
		});
	});

	describe('deleteContentTag', () => {
		it('should return true when tag is deleted', async () => {
			const mockDB = createMockDB();
			mockDB._runResult = { meta: { changes: 1 } };

			const result = await cms.deleteContentTag(mockDB, 'tag-1');
			expect(result).toBe(true);
		});

		it('should return false when tag not found', async () => {
			const mockDB = createMockDB();
			mockDB._runResult = { meta: { changes: 0 } };

			const result = await cms.deleteContentTag(mockDB, 'nonexistent');
			expect(result).toBe(false);
		});
	});
});

// ─── CMS Index (re-exports) ──────────────────────────────────────────────────

describe('CMS index re-exports', () => {
	it('should export all registry functions', async () => {
		const cmsIndex = await import('../../src/lib/cms/index.js');
		expect(cmsIndex.contentTypeRegistry).toBeDefined();
		expect(cmsIndex.getContentTypeDefinition).toBeDefined();
		expect(cmsIndex.getRegisteredSlugs).toBeDefined();
		expect(cmsIndex.isRegisteredContentType).toBeDefined();
	});

	it('should export all utility functions', async () => {
		const cmsIndex = await import('../../src/lib/cms/index.js');
		expect(cmsIndex.generateSlug).toBeDefined();
		expect(cmsIndex.getDefaultFieldValues).toBeDefined();
		expect(cmsIndex.parseContentItem).toBeDefined();
		expect(cmsIndex.parseContentTag).toBeDefined();
		expect(cmsIndex.parseContentType).toBeDefined();
		expect(cmsIndex.validateContentTypeInput).toBeDefined();
		expect(cmsIndex.validateFields).toBeDefined();
	});
});
