import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('CMS API - Content Types', () => {
	let mockPlatform: any;
	let mockLocals: any;
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
		mockPlatform = { env: { DB: mockDB } };
		mockLocals = {
			user: {
				id: 'user-1',
				login: 'admin',
				email: 'admin@test.com',
				isOwner: true,
				isAdmin: true
			}
		};
	});

	describe('GET /api/cms/types', () => {
		it('should require authentication', async () => {
			const { GET } = await import('../../src/routes/api/cms/types/+server.js');
			try {
				await GET({
					platform: mockPlatform,
					locals: { user: null }
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('should require admin privileges', async () => {
			const { GET } = await import('../../src/routes/api/cms/types/+server.js');
			try {
				await GET({
					platform: mockPlatform,
					locals: { user: { ...mockLocals.user, isOwner: false, isAdmin: false } }
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(403);
			}
		});

		it('should return content types', async () => {
			const { GET } = await import('../../src/routes/api/cms/types/+server.js');

			// syncContentTypes: existing types
			mockDB.all.mockResolvedValueOnce({
				results: [
					{
						id: 'ct-1',
						slug: 'blog',
						name: 'Blog Posts',
						description: 'Articles',
						fields: '[]',
						settings: '{}',
						icon: 'article'
					}
				]
			});
			// getContentTypes
			mockDB.all.mockResolvedValueOnce({
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

			const response = await GET({
				platform: mockPlatform,
				locals: mockLocals
			} as any);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.types).toBeTruthy();
			expect(Array.isArray(data.types)).toBe(true);
		});

		it('should handle missing database', async () => {
			const { GET } = await import('../../src/routes/api/cms/types/+server.js');
			try {
				await GET({
					platform: { env: {} },
					locals: mockLocals
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});
	});
});

describe('CMS API - Content Items', () => {
	let mockPlatform: any;
	let mockLocals: any;
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
		mockPlatform = { env: { DB: mockDB } };
		mockLocals = {
			user: {
				id: 'user-1',
				login: 'admin',
				email: 'admin@test.com',
				isOwner: true,
				isAdmin: true
			}
		};
	});

	describe('GET /api/cms/[type]', () => {
		it('should require authentication', async () => {
			const { GET } = await import('../../src/routes/api/cms/[type]/+server.js');
			try {
				await GET({
					platform: mockPlatform,
					locals: { user: null },
					params: { type: 'blog' },
					url: new URL('http://localhost/api/cms/blog')
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('should return 404 for unknown content type', async () => {
			const { GET } = await import('../../src/routes/api/cms/[type]/+server.js');

			mockDB.first.mockResolvedValue(null);

			try {
				await GET({
					platform: mockPlatform,
					locals: mockLocals,
					params: { type: 'nonexistent' },
					url: new URL('http://localhost/api/cms/nonexistent')
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(404);
			}
		});

		it('should list items for a content type', async () => {
			const { GET } = await import('../../src/routes/api/cms/[type]/+server.js');

			// getContentTypeBySlug
			mockDB.first.mockResolvedValueOnce({
				id: 'ct-1',
				slug: 'blog',
				name: 'Blog Posts',
				description: 'Articles',
				fields: '[]',
				settings: '{"listPageSize": 12}',
				icon: 'article',
				sort_order: 0,
				created_at: '2024-01-01',
				updated_at: '2024-01-01'
			});
			// listContentItems - count
			mockDB.first.mockResolvedValueOnce({ count: 1 });
			// listContentItems - items
			mockDB.all.mockResolvedValueOnce({
				results: [
					{
						id: 'ci-1',
						content_type_id: 'ct-1',
						slug: 'hello',
						title: 'Hello',
						status: 'published',
						fields: '{}',
						seo_title: null,
						seo_description: null,
						seo_image: null,
						author_id: null,
						show_in_command_palette: 1,
						published_at: null,
						created_at: '2024-01-01',
						updated_at: '2024-01-01'
					}
				]
			});

			const response = await GET({
				platform: mockPlatform,
				locals: mockLocals,
				params: { type: 'blog' },
				url: new URL('http://localhost/api/cms/blog')
			} as any);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.items).toHaveLength(1);
			expect(data.total).toBe(1);
			expect(data.items[0].showInCommandPalette).toBe(true);
		});
	});

	describe('POST /api/cms/[type]', () => {
		it('should create a content item', async () => {
			const { POST } = await import('../../src/routes/api/cms/[type]/+server.js');

			// getContentTypeBySlug
			mockDB.first.mockResolvedValueOnce({
				id: 'ct-1',
				slug: 'blog',
				name: 'Blog Posts',
				fields: JSON.stringify([{ name: 'body', label: 'Body', type: 'richtext', required: true }]),
				settings: '{}',
				icon: 'article',
				sort_order: 0,
				created_at: '2024-01-01',
				updated_at: '2024-01-01'
			});
			// createContentItem: get content type
			mockDB.first.mockResolvedValueOnce({
				id: 'ct-1',
				slug: 'blog',
				name: 'Blog Posts',
				fields: JSON.stringify([{ name: 'body', label: 'Body', type: 'richtext', required: true }]),
				settings: '{}',
				icon: 'article',
				sort_order: 0,
				created_at: '2024-01-01',
				updated_at: '2024-01-01'
			});
			// createContentItem: author existence
			mockDB.first.mockResolvedValueOnce({ id: 'user-1' });
			// slug check
			mockDB.first.mockResolvedValueOnce(null);
			// insert
			mockDB.first.mockResolvedValueOnce({
				id: 'ci-1',
				content_type_id: 'ct-1',
				slug: 'hello-world',
				title: 'Hello World',
				status: 'draft',
				fields: JSON.stringify({ body: 'Content here' }),
				seo_title: null,
				seo_description: null,
				seo_image: null,
				author_id: 'user-1',
				show_in_command_palette: 0,
				published_at: null,
				created_at: '2024-01-01',
				updated_at: '2024-01-01'
			});

			const request = new Request('http://localhost/api/cms/blog', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: 'Hello World',
					fields: { body: 'Content here' },
					showInCommandPalette: false
				})
			});

			const response = await POST({
				platform: mockPlatform,
				locals: mockLocals,
				params: { type: 'blog' },
				request
			} as any);

			expect(response.status).toBe(201);
			const data = await response.json();
			expect(data.item.title).toBe('Hello World');
			expect(data.item.showInCommandPalette).toBe(false);
		});

		it('should require title', async () => {
			const { POST } = await import('../../src/routes/api/cms/[type]/+server.js');

			// getContentTypeBySlug
			mockDB.first.mockResolvedValueOnce({
				id: 'ct-1',
				slug: 'blog',
				name: 'Blog Posts',
				fields: '[]',
				settings: '{}',
				icon: 'article',
				sort_order: 0,
				created_at: '2024-01-01',
				updated_at: '2024-01-01'
			});

			const request = new Request('http://localhost/api/cms/blog', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ fields: {} })
			});

			try {
				await POST({
					platform: mockPlatform,
					locals: mockLocals,
					params: { type: 'blog' },
					request
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});
	});

	describe('GET /api/cms/[type]/[id]', () => {
		it('should return a content item', async () => {
			const { GET } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');

			mockDB.first.mockResolvedValue({
				id: 'ci-1',
				content_type_id: 'ct-1',
				slug: 'hello',
				title: 'Hello',
				status: 'published',
				fields: '{"body":"Content"}',
				seo_title: null,
				seo_description: null,
				seo_image: null,
				author_id: null,
				show_in_command_palette: 1,
				published_at: '2024-01-01',
				created_at: '2024-01-01',
				updated_at: '2024-01-01'
			});

			const response = await GET({
				platform: mockPlatform,
				locals: mockLocals,
				params: { type: 'blog', id: 'ci-1' }
			} as any);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.item.id).toBe('ci-1');
		});

		it('should return 404 for non-existent item', async () => {
			const { GET } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');

			mockDB.first.mockResolvedValue(null);

			try {
				await GET({
					platform: mockPlatform,
					locals: mockLocals,
					params: { type: 'blog', id: 'nonexistent' }
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(404);
			}
		});
	});

	describe('PUT /api/cms/[type]/[id]', () => {
		it('should update a content item', async () => {
			const { PUT } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');

			// getContentTypeBySlug (for richtext sanitization)
			mockDB.first.mockResolvedValueOnce({
				id: 'ct-1',
				slug: 'blog',
				name: 'Blog Posts',
				fields: JSON.stringify([{ name: 'body', label: 'Body', type: 'richtext', required: true }]),
				settings: '{}',
				icon: 'article',
				sort_order: 0,
				created_at: '2024-01-01',
				updated_at: '2024-01-01'
			});
			// updateContentItem: get existing
			mockDB.first.mockResolvedValueOnce({
				id: 'ci-1',
				content_type_id: 'ct-1',
				slug: 'hello',
				title: 'Hello',
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
			// updateContentItem: update result
			mockDB.first.mockResolvedValueOnce({
				id: 'ci-1',
				content_type_id: 'ct-1',
				slug: 'hello',
				title: 'Updated',
				status: 'published',
				fields: '{"body":"New"}',
				seo_title: null,
				seo_description: null,
				seo_image: null,
				author_id: null,
				show_in_command_palette: 0,
				published_at: '2024-01-15',
				created_at: '2024-01-01',
				updated_at: '2024-01-15'
			});

			const request = new Request('http://localhost/api/cms/blog/ci-1', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: 'Updated',
					status: 'published',
					fields: { body: 'New' },
					showInCommandPalette: false
				})
			});

			const response = await PUT({
				platform: mockPlatform,
				locals: mockLocals,
				params: { type: 'blog', id: 'ci-1' },
				request
			} as any);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.item.title).toBe('Updated');
			expect(data.item.showInCommandPalette).toBe(false);
		});
	});

	describe('DELETE /api/cms/[type]/[id]', () => {
		it('should delete a content item', async () => {
			const { DELETE } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');

			mockDB.run.mockResolvedValue({ success: true, meta: { changes: 1 } });

			const response = await DELETE({
				platform: mockPlatform,
				locals: mockLocals,
				params: { type: 'blog', id: 'ci-1' }
			} as any);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.success).toBe(true);
		});

		it('should return 404 when item not found', async () => {
			const { DELETE } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');

			mockDB.run.mockResolvedValue({ success: true, meta: { changes: 0 } });

			try {
				await DELETE({
					platform: mockPlatform,
					locals: mockLocals,
					params: { type: 'blog', id: 'nonexistent' }
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(404);
			}
		});
	});
});

describe('CMS API - Tags', () => {
	let mockPlatform: any;
	let mockLocals: any;
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
		mockPlatform = { env: { DB: mockDB } };
		mockLocals = {
			user: {
				id: 'user-1',
				login: 'admin',
				email: 'admin@test.com',
				isOwner: true,
				isAdmin: true
			}
		};
	});

	describe('GET /api/cms/[type]/tags', () => {
		it('should return tags for a content type', async () => {
			const { GET } = await import('../../src/routes/api/cms/[type]/tags/+server.js');

			// getContentTypeBySlug
			mockDB.first.mockResolvedValueOnce({
				id: 'ct-1',
				slug: 'blog',
				name: 'Blog Posts',
				fields: '[]',
				settings: '{}',
				icon: 'article',
				sort_order: 0,
				created_at: '2024-01-01',
				updated_at: '2024-01-01'
			});
			// getTagsForType
			mockDB.all.mockResolvedValueOnce({
				results: [
					{
						id: 'tag-1',
						content_type_id: 'ct-1',
						name: 'JavaScript',
						slug: 'javascript',
						created_at: '2024-01-01'
					}
				]
			});

			const response = await GET({
				platform: mockPlatform,
				locals: mockLocals,
				params: { type: 'blog' }
			} as any);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.tags).toHaveLength(1);
		});
	});

	describe('POST /api/cms/[type]/tags', () => {
		it('should create a tag', async () => {
			const { POST } = await import('../../src/routes/api/cms/[type]/tags/+server.js');

			// getContentTypeBySlug
			mockDB.first.mockResolvedValueOnce({
				id: 'ct-1',
				slug: 'blog',
				name: 'Blog Posts',
				fields: '[]',
				settings: '{}',
				icon: 'article',
				sort_order: 0,
				created_at: '2024-01-01',
				updated_at: '2024-01-01'
			});
			// createContentTag
			mockDB.first.mockResolvedValueOnce({
				id: 'tag-1',
				content_type_id: 'ct-1',
				name: 'TypeScript',
				slug: 'typescript',
				created_at: '2024-01-01'
			});

			const request = new Request('http://localhost/api/cms/blog/tags', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'TypeScript' })
			});

			const response = await POST({
				platform: mockPlatform,
				locals: mockLocals,
				params: { type: 'blog' },
				request
			} as any);

			expect(response.status).toBe(201);
			const data = await response.json();
			expect(data.tag.name).toBe('TypeScript');
		});
	});
});
