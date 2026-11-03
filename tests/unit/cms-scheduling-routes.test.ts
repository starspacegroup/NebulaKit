import { beforeEach, describe, expect, it, vi } from 'vitest';

const FUTURE = '2999-01-01T09:00:00.000Z';
const PAST = '2020-01-01T09:00:00.000Z';

function createMockDB(): any {
	const db: any = {
		_first: [] as any[],
		_all: [] as any[],
		prepare: vi.fn().mockReturnThis(),
		bind: vi.fn().mockReturnThis(),
		first: vi.fn(() => Promise.resolve(db._first.shift() ?? null)),
		all: vi.fn(() => Promise.resolve(db._all.shift() ?? { results: [] })),
		run: vi.fn(() => Promise.resolve({ meta: { changes: 1 } })),
		batch: vi.fn(() => Promise.resolve([]))
	};
	return db;
}

const typeRow = {
	id: 'ct-1',
	slug: 'blog',
	name: 'Blog Posts',
	description: 'Articles',
	fields: '[]',
	settings: '{"listPageSize":12,"hasTags":false,"enableTimestampProof":true}',
	icon: 'article',
	sort_order: 0,
	is_system: 1,
	created_at: '2026-01-01',
	updated_at: '2026-01-01'
};

const itemRow = (over: Record<string, unknown> = {}) => ({
	id: 'item-1',
	content_type_id: 'ct-1',
	slug: 'hello',
	title: 'Hello',
	status: 'published',
	fields: '{}',
	seo_title: null,
	seo_description: null,
	seo_image: null,
	author_id: 'user-1',
	published_at: PAST,
	created_at: '2026-01-01',
	updated_at: '2026-01-01',
	...over
});

const admin = { id: 'user-1', login: 'a', email: 'a@b.com', isOwner: true, isAdmin: true };

describe('scheduled publishing in routes', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	describe('public item page', () => {
		async function load(row: Record<string, unknown>) {
			const { load } = await import('../../src/routes/[contentType]/[slug]/+page.server.js');
			const db = createMockDB();
			db._all.push({ results: [] });
			db._first.push({ id: 'ct-1' }, typeRow, row);
			return load({
				params: { contentType: 'blog', slug: 'hello' },
				platform: { env: { DB: db } },
				locals: {}
			} as any);
		}

		it('returns 404 for an item scheduled for later', async () => {
			await expect(load(itemRow({ published_at: FUTURE }))).rejects.toMatchObject({
				status: 404
			});
		});

		it('serves an item whose date has arrived', async () => {
			await expect(load(itemRow())).resolves.toMatchObject({ item: { slug: 'hello' } });
		});
	});

	describe('public list', () => {
		it('asks the database for live items only', async () => {
			const { load } = await import('../../src/routes/[contentType]/+page.server.js');
			const db = createMockDB();
			db._all.push({ results: [typeRow] });
			db._first.push({ id: 'ct-1' }, typeRow, { count: 0 });
			await load({
				params: { contentType: 'blog' },
				platform: { env: { DB: db } },
				url: new URL('http://localhost/blog')
			} as any);
			const sql = db.prepare.mock.calls.map((c: string[]) => c[0]).join('\n');
			expect(sql).toContain("datetime(published_at) <= datetime('now')");
		});
	});

	describe('admin API', () => {
		const waitUntil = vi.fn();

		beforeEach(() => {
			waitUntil.mockReset();
			vi.doMock('$lib/content-proof/proof-job', () => ({
				runTimestampProofJob: vi.fn().mockResolvedValue(undefined)
			}));
		});

		async function post(body: Record<string, unknown>, created: Record<string, unknown>) {
			const { POST } = await import('../../src/routes/api/cms/[type]/+server.js');
			const db = createMockDB();
			// type lookup (route), type lookup (service), author check, slug check, insert
			db._first.push(typeRow, typeRow, { id: 'user-1' }, null, created);
			const res = await POST({
				params: { type: 'blog' },
				locals: { user: admin },
				platform: { env: { DB: db }, context: { waitUntil } },
				request: { json: async () => ({ title: 'Hello', fields: {}, ...body }) },
				url: new URL('http://localhost/api/cms/blog')
			} as any);
			return { res, db };
		}

		it('passes a future publishedAt through and holds the proof back', async () => {
			const { res, db } = await post(
				{ status: 'published', publishedAt: FUTURE },
				itemRow({ published_at: FUTURE })
			);
			expect(res.status).toBe(201);
			const insert = db.bind.mock.calls.find((c: unknown[]) => c.length === 12);
			expect(insert![11]).toBe(FUTURE);
			expect(waitUntil).not.toHaveBeenCalled();
		});

		it('starts the proof for an item published now', async () => {
			await post({ status: 'published' }, itemRow());
			expect(waitUntil).toHaveBeenCalledTimes(1);
		});

		it('answers 400 for a publishedAt that is not a date', async () => {
			await expect(
				post({ status: 'published', publishedAt: 'soon' }, itemRow())
			).rejects.toMatchObject({ status: 400 });
		});

		async function put(existing: Record<string, unknown>, updated: Record<string, unknown>) {
			const { PUT } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');
			const db = createMockDB();
			// type, existing (route), existing (service), type row (service), update
			db._first.push(typeRow, existing, existing, { fields: '[]', settings: '{}' }, updated);
			await PUT({
				params: { type: 'blog', id: 'item-1' },
				locals: { user: admin },
				platform: { env: { DB: db }, context: { waitUntil } },
				request: { json: async () => ({ status: 'published', publishedAt: null }) },
				url: new URL('http://localhost/api/cms/blog/item-1')
			} as any);
		}

		it('starts the proof when a scheduled item is brought forward to now', async () => {
			await put(itemRow({ published_at: FUTURE }), itemRow({ published_at: PAST }));
			expect(waitUntil).toHaveBeenCalledTimes(1);
		});

		it('does not start a second proof for an item that was already live', async () => {
			await put(itemRow({ published_at: PAST }), itemRow({ published_at: PAST }));
			expect(waitUntil).not.toHaveBeenCalled();
		});
	});
});
