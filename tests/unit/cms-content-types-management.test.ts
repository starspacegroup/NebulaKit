/**
 * Tests for CMS Content Types Management
 *
 * Tests for creating, updating, and deleting content types through the admin UI/API.
 * Covers the service layer functions, API endpoints, and admin page server loads.
 * Following TDD - tests written first.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Service Layer Tests ───────────────────────────────────────────────────────

describe('CMS Service - Content Type Management', () => {
	let createContentTypeInDB: any;
	let updateContentTypeInDB: any;
	let deleteContentTypeFromDB: any;
	let getContentTypeById: any;
	let getAllContentTypeSlugs: any;
	let mockDB: any;

	beforeEach(async () => {
		vi.resetModules();
		const module = await import('../../src/lib/services/cms.js');
		createContentTypeInDB = module.createContentTypeInDB;
		updateContentTypeInDB = module.updateContentTypeInDB;
		deleteContentTypeFromDB = module.deleteContentTypeFromDB;
		getContentTypeById = module.getContentTypeById;
		getAllContentTypeSlugs = module.getAllContentTypeSlugs;

		mockDB = {
			prepare: vi.fn().mockReturnThis(),
			bind: vi.fn().mockReturnThis(),
			first: vi.fn(),
			all: vi.fn(),
			run: vi.fn(),
			batch: vi.fn()
		};
	});

	describe('createContentTypeInDB', () => {
		it('should create a new content type with all fields', async () => {
			const input = {
				name: 'FAQ',
				slug: 'faq',
				description: 'Frequently asked questions',
				icon: 'help-circle',
				fields: [
					{ name: 'question', label: 'Question', type: 'text', required: true, sortOrder: 1 },
					{ name: 'answer', label: 'Answer', type: 'richtext', required: true, sortOrder: 2 }
				],
				settings: {
					hasDrafts: true,
					hasTags: false,
					hasSEO: false,
					hasAuthor: false,
					routePrefix: '/faq',
					listPageSize: 50,
					isPublic: true
				}
			};

			// createContentTypeInDB calls first() 3 times:
			// 1. Check slug doesn't exist → null
			// 2. Get max sort_order → { max_order: null }
			// 3. INSERT RETURNING → the new row
			mockDB.first
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce({ max_order: null })
				.mockResolvedValueOnce({
					id: 'new-id',
					slug: 'faq',
					name: 'FAQ',
					description: 'Frequently asked questions',
					fields: JSON.stringify(input.fields),
					settings: JSON.stringify(input.settings),
					icon: 'help-circle',
					sort_order: 0,
					is_system: 0,
					created_at: '2026-01-01',
					updated_at: '2026-01-01'
				});

			const result = await createContentTypeInDB(mockDB, input);

			expect(result).toBeTruthy();
			expect(result.slug).toBe('faq');
			expect(result.name).toBe('FAQ');
			expect(result.fields).toHaveLength(2);
			expect(result.settings.routePrefix).toBe('/faq');
		});

		it('should default command palette visibility on when not provided', async () => {
			mockDB.first
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce({ max_order: null })
				.mockResolvedValueOnce({
					id: 'new-id',
					slug: 'faq',
					name: 'FAQ',
					description: null,
					fields: '[]',
					settings: '{}',
					icon: 'document',
					sort_order: 0,
					is_system: 0,
					created_at: '2026-01-01',
					updated_at: '2026-01-01'
				});

			const result = await createContentTypeInDB(mockDB, {
				name: 'FAQ',
				fields: [],
				settings: {}
			});

			expect(result).toBeTruthy();
			expect(result.settings.showInCommandPalette).toBe(true);
		});

		it('should return null if slug already exists', async () => {
			// First call checks for existing slug
			mockDB.first.mockResolvedValueOnce({ id: 'existing-id' });

			const result = await createContentTypeInDB(mockDB, {
				name: 'Blog',
				slug: 'blog',
				description: 'Already exists',
				icon: 'article',
				fields: [],
				settings: {}
			});

			expect(result).toBeNull();
		});

		it('should auto-generate slug from name if not provided', async () => {
			mockDB.first
				.mockResolvedValueOnce(null) // no existing slug
				.mockResolvedValueOnce({ max_order: null }) // max sort_order
				.mockResolvedValueOnce({
					id: 'new-id',
					slug: 'knowledge-base',
					name: 'Knowledge Base',
					description: 'KB articles',
					fields: '[]',
					settings: '{}',
					icon: 'document',
					sort_order: 0,
					is_system: 0,
					created_at: '2026-01-01',
					updated_at: '2026-01-01'
				});

			const result = await createContentTypeInDB(mockDB, {
				name: 'Knowledge Base',
				description: 'KB articles',
				icon: 'document',
				fields: [],
				settings: {}
			});

			expect(result).toBeTruthy();
			expect(result.slug).toBe('knowledge-base');
		});
	});

	describe('updateContentTypeInDB', () => {
		it('should update content type name and description', async () => {
			mockDB.first.mockResolvedValue({
				id: 'type-1',
				slug: 'faq',
				name: 'Updated FAQ',
				description: 'Updated description',
				fields: '[]',
				settings: '{}',
				icon: 'help-circle',
				sort_order: 0,
				is_system: 0,
				created_at: '2026-01-01',
				updated_at: '2026-01-01'
			});

			const result = await updateContentTypeInDB(mockDB, 'type-1', {
				name: 'Updated FAQ',
				description: 'Updated description'
			});

			expect(result).toBeTruthy();
			expect(result.name).toBe('Updated FAQ');
		});

		it('should update content type fields', async () => {
			const newFields = [
				{ name: 'question', label: 'Question', type: 'text', required: true, sortOrder: 1 },
				{ name: 'answer', label: 'Answer', type: 'richtext', required: true, sortOrder: 2 },
				{ name: 'category', label: 'Category', type: 'select', sortOrder: 3 }
			];

			mockDB.first.mockResolvedValue({
				id: 'type-1',
				slug: 'faq',
				name: 'FAQ',
				description: null,
				fields: JSON.stringify(newFields),
				settings: '{}',
				icon: 'help-circle',
				sort_order: 0,
				is_system: 0,
				created_at: '2026-01-01',
				updated_at: '2026-01-01'
			});

			const result = await updateContentTypeInDB(mockDB, 'type-1', { fields: newFields });

			expect(result).toBeTruthy();
			expect(result.fields).toHaveLength(3);
		});

		it('should update content type settings including URL prefix', async () => {
			const newSettings = {
				routePrefix: '/questions',
				hasDrafts: true,
				hasTags: true,
				listPageSize: 25
			};

			mockDB.first.mockResolvedValue({
				id: 'type-1',
				slug: 'faq',
				name: 'FAQ',
				description: null,
				fields: '[]',
				settings: JSON.stringify(newSettings),
				icon: 'help-circle',
				sort_order: 0,
				is_system: 0,
				created_at: '2026-01-01',
				updated_at: '2026-01-01'
			});

			const result = await updateContentTypeInDB(mockDB, 'type-1', { settings: newSettings });

			expect(result).toBeTruthy();
			expect(result.settings.routePrefix).toBe('/questions');
		});

		it('should return null when content type not found', async () => {
			mockDB.first.mockResolvedValue(null);

			const result = await updateContentTypeInDB(mockDB, 'nonexistent', {
				name: 'Test'
			});

			expect(result).toBeNull();
		});
	});

	describe('deleteContentTypeFromDB', () => {
		it('should delete a non-system content type', async () => {
			// First checks if it's a system type
			mockDB.first.mockResolvedValueOnce({ id: 'type-1', is_system: 0 });
			mockDB.run.mockResolvedValue({ meta: { changes: 1 } });

			const result = await deleteContentTypeFromDB(mockDB, 'type-1');

			expect(result).toEqual({ success: true });
		});

		it('should refuse to delete a system content type', async () => {
			mockDB.first.mockResolvedValueOnce({ id: 'type-1', is_system: 1 });

			const result = await deleteContentTypeFromDB(mockDB, 'type-1');

			expect(result).toEqual({ success: false, reason: 'Cannot delete system content type' });
		});

		it('should return failure when content type not found', async () => {
			mockDB.first.mockResolvedValueOnce(null);

			const result = await deleteContentTypeFromDB(mockDB, 'nonexistent');

			expect(result).toEqual({ success: false, reason: 'Content type not found' });
		});
	});

	describe('getContentTypeById', () => {
		it('should return parsed content type by ID', async () => {
			mockDB.first.mockResolvedValue({
				id: 'type-1',
				slug: 'faq',
				name: 'FAQ',
				description: 'Questions',
				fields: '[{"name":"q","label":"Q","type":"text"}]',
				settings: '{"routePrefix":"/faq"}',
				icon: 'help-circle',
				sort_order: 0,
				is_system: 0,
				created_at: '2026-01-01',
				updated_at: '2026-01-01'
			});

			const result = await getContentTypeById(mockDB, 'type-1');

			expect(result).toBeTruthy();
			expect(result.id).toBe('type-1');
			expect(result.fields).toHaveLength(1);
			expect(result.settings.routePrefix).toBe('/faq');
		});

		it('should default command palette visibility on when absent in stored settings', async () => {
			mockDB.first.mockResolvedValue({
				id: 'type-1',
				slug: 'faq',
				name: 'FAQ',
				description: 'Questions',
				fields: '[]',
				settings: '{}',
				icon: 'help-circle',
				sort_order: 0,
				is_system: 0,
				created_at: '2026-01-01',
				updated_at: '2026-01-01'
			});

			const result = await getContentTypeById(mockDB, 'type-1');

			expect(result).toBeTruthy();
			expect(result?.settings.showInCommandPalette).toBe(true);
		});

		it('should return null when not found', async () => {
			mockDB.first.mockResolvedValue(null);

			const result = await getContentTypeById(mockDB, 'nonexistent');

			expect(result).toBeNull();
		});
	});

	describe('getAllContentTypeSlugs', () => {
		it('should return all content type slugs from DB', async () => {
			mockDB.all.mockResolvedValue({
				results: [{ slug: 'blog' }, { slug: 'faq' }, { slug: 'kb' }]
			});

			const result = await getAllContentTypeSlugs(mockDB);

			expect(result).toEqual(['blog', 'faq', 'kb']);
		});

		it('should return empty array when no types exist', async () => {
			mockDB.all.mockResolvedValue({ results: [] });

			const result = await getAllContentTypeSlugs(mockDB);

			expect(result).toEqual([]);
		});
	});
});

// ─── API Endpoint Tests ────────────────────────────────────────────────────────

describe('CMS Content Types API - POST /api/cms/types', () => {
	let POST: any;

	beforeEach(async () => {
		vi.resetModules();
		const module = await import('../../src/routes/api/cms/types/+server.js');
		POST = module.POST;
	});

	it('should require authentication', async () => {
		const event = createMockEvent({ user: null });

		await expect(POST(event)).rejects.toThrow();
	});

	it('should require admin privileges', async () => {
		const event = createMockEvent({ user: { id: '1', isOwner: false, isAdmin: false } });

		await expect(POST(event)).rejects.toThrow();
	});

	it('should require a name field', async () => {
		const event = createMockEvent({
			user: { id: '1', isOwner: true, isAdmin: true },
			body: { description: 'No name' }
		});

		await expect(POST(event)).rejects.toThrow();
	});

	it('should create a new content type', async () => {
		const mockDB = createMockDB();
		// createContentTypeInDB calls first() 3 times:
		// 1. Check slug doesn't exist
		mockDB._firstResults.push(null);
		// 2. Get max sort_order
		mockDB._firstResults.push({ max_order: null });
		// 3. INSERT RETURNING - the created type
		mockDB._firstResults.push({
			id: 'new-type-id',
			slug: 'faq',
			name: 'FAQ',
			description: 'Questions',
			fields: '[{"name":"q","label":"Q","type":"text"}]',
			settings: '{"routePrefix":"/faq"}',
			icon: 'help-circle',
			sort_order: 0,
			is_system: 0,
			created_at: '2026-01-01',
			updated_at: '2026-01-01'
		});

		const event = createMockEvent({
			user: { id: '1', isOwner: true, isAdmin: true },
			body: {
				name: 'FAQ',
				slug: 'faq',
				description: 'Questions',
				icon: 'help-circle',
				fields: [{ name: 'q', label: 'Q', type: 'text' }],
				settings: { routePrefix: '/faq' }
			},
			db: mockDB
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(201);
		expect(data.contentType).toBeTruthy();
		expect(data.contentType.slug).toBe('faq');
	});

	it('should persist command palette visibility when creating a content type', async () => {
		const mockDB = createMockDB();
		mockDB._firstResults.push(null);
		mockDB._firstResults.push({ max_order: null });
		mockDB._firstResults.push({
			id: 'new-type-id',
			slug: 'faq',
			name: 'FAQ',
			description: 'Questions',
			fields: '[]',
			settings: '{"showInCommandPalette":false}',
			icon: 'help-circle',
			sort_order: 0,
			is_system: 0,
			created_at: '2026-01-01',
			updated_at: '2026-01-01'
		});

		const event = createMockEvent({
			user: { id: '1', isOwner: true, isAdmin: true },
			body: {
				name: 'FAQ',
				fields: [],
				settings: { showInCommandPalette: false }
			},
			db: mockDB
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(201);
		expect(data.contentType.settings.showInCommandPalette).toBe(false);
	});
});

describe('CMS Content Types API - PUT /api/cms/types/[id]', () => {
	let PUT: any;

	beforeEach(async () => {
		vi.resetModules();
		const module = await import('../../src/routes/api/cms/types/[id]/+server.js');
		PUT = module.PUT;
	});

	it('should require authentication', async () => {
		const event = createMockEvent({ user: null, params: { id: 'type-1' } });

		await expect(PUT(event)).rejects.toThrow();
	});

	it('should update content type', async () => {
		const mockDB = createMockDB();
		// Return updated type
		mockDB._firstResults.push({
			id: 'type-1',
			slug: 'faq',
			name: 'Updated FAQ',
			description: 'Updated',
			fields: '[]',
			settings: '{"routePrefix":"/questions"}',
			icon: 'help-circle',
			sort_order: 0,
			is_system: 0,
			created_at: '2026-01-01',
			updated_at: '2026-01-01'
		});

		const event = createMockEvent({
			user: { id: '1', isOwner: true, isAdmin: true },
			params: { id: 'type-1' },
			body: {
				name: 'Updated FAQ',
				description: 'Updated',
				settings: { routePrefix: '/questions' }
			},
			db: mockDB
		});

		const response = await PUT(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.contentType.name).toBe('Updated FAQ');
	});

	it('should update content type command palette visibility', async () => {
		const mockDB = createMockDB();
		mockDB._firstResults.push({
			id: 'type-1',
			slug: 'faq',
			name: 'FAQ',
			description: 'Updated',
			fields: '[]',
			settings: '{"showInCommandPalette":false}',
			icon: 'help-circle',
			sort_order: 0,
			is_system: 0,
			created_at: '2026-01-01',
			updated_at: '2026-01-01'
		});

		const event = createMockEvent({
			user: { id: '1', isOwner: true, isAdmin: true },
			params: { id: 'type-1' },
			body: {
				settings: { showInCommandPalette: false }
			},
			db: mockDB
		});

		const response = await PUT(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.contentType.settings.showInCommandPalette).toBe(false);
	});
});

describe('CMS Content Types API - DELETE /api/cms/types/[id]', () => {
	let DELETE: any;

	beforeEach(async () => {
		vi.resetModules();
		const module = await import('../../src/routes/api/cms/types/[id]/+server.js');
		DELETE = module.DELETE;
	});

	it('should require authentication', async () => {
		const event = createMockEvent({ user: null, params: { id: 'type-1' } });

		await expect(DELETE(event)).rejects.toThrow();
	});

	it('should delete a non-system content type', async () => {
		const mockDB = createMockDB();
		// Check type exists and is not system
		mockDB._firstResults.push({ id: 'type-1', is_system: 0 });
		mockDB._runResult = { meta: { changes: 1 } };

		const event = createMockEvent({
			user: { id: '1', isOwner: true, isAdmin: true },
			params: { id: 'type-1' },
			db: mockDB
		});

		const response = await DELETE(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
	});

	it('should refuse to delete system content types', async () => {
		const mockDB = createMockDB();
		mockDB._firstResults.push({ id: 'type-1', is_system: 1 });

		const event = createMockEvent({
			user: { id: '1', isOwner: true, isAdmin: true },
			params: { id: 'type-1' },
			db: mockDB
		});

		await expect(DELETE(event)).rejects.toThrow();
	});
});

// ─── Utility Types Tests ───────────────────────────────────────────────────────

describe('CMS Content Type Field Builder Validation', () => {
	let validateContentTypeInput: any;

	beforeEach(async () => {
		vi.resetModules();
		const module = await import('../../src/lib/cms/utils.js');
		validateContentTypeInput = module.validateContentTypeInput;
	});

	it('should pass validation for valid input', () => {
		const errors = validateContentTypeInput({
			name: 'FAQ',
			slug: 'faq',
			fields: [{ name: 'question', label: 'Question', type: 'text' }],
			settings: { routePrefix: '/faq' }
		});

		expect(errors).toHaveLength(0);
	});

	it('should require name', () => {
		const errors = validateContentTypeInput({
			name: '',
			slug: 'faq',
			fields: [],
			settings: {}
		});

		expect(errors.some((e: string) => e.includes('name'))).toBe(true);
	});

	it('should validate slug format', () => {
		const errors = validateContentTypeInput({
			name: 'Test',
			slug: 'Invalid Slug!',
			fields: [],
			settings: {}
		});

		expect(errors.some((e: string) => e.includes('slug'))).toBe(true);
	});

	it('should validate field definitions have required properties', () => {
		const errors = validateContentTypeInput({
			name: 'Test',
			slug: 'test',
			fields: [{ name: '', label: '', type: '' }],
			settings: {}
		});

		expect(errors.length).toBeGreaterThan(0);
	});

	it('should validate field names are unique', () => {
		const errors = validateContentTypeInput({
			name: 'Test',
			slug: 'test',
			fields: [
				{ name: 'body', label: 'Body', type: 'text' },
				{ name: 'body', label: 'Body 2', type: 'textarea' }
			],
			settings: {}
		});

		expect(errors.some((e: string) => e.includes('unique') || e.includes('duplicate'))).toBe(true);
	});

	it('should validate route prefix starts with /', () => {
		const errors = validateContentTypeInput({
			name: 'Test',
			slug: 'test',
			fields: [],
			settings: { routePrefix: 'no-slash' }
		});

		expect(errors.some((e: string) => e.includes('/'))).toBe(true);
	});
});

// ─── Helper Functions ──────────────────────────────────────────────────────────

function createMockDB(): any {
	const db: any = {
		_firstResults: [] as any[],
		_allResults: { results: [] },
		_runResult: { meta: { changes: 0 } },
		_batchResults: [],
		prepare: vi.fn().mockReturnThis(),
		bind: vi.fn().mockReturnThis(),
		first: vi.fn(function (this: any) {
			return Promise.resolve(db._firstResults.shift() ?? null);
		}),
		all: vi.fn(function (this: any) {
			return Promise.resolve(db._allResults);
		}),
		run: vi.fn(function (this: any) {
			return Promise.resolve(db._runResult);
		}),
		batch: vi.fn(function (this: any) {
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
}): any {
	const db = options.db || createMockDB();
	return {
		locals: {
			user: options.user || null
		},
		params: options.params || {},
		platform: {
			env: {
				DB: db
			}
		},
		request: {
			json: async () => options.body || {}
		}
	};
}
