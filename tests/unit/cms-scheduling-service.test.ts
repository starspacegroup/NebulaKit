import { beforeEach, describe, expect, it, vi } from 'vitest';

const FUTURE = '2999-01-01T09:00:00.000Z';
const PAST = '2020-01-01T09:00:00.000Z';

const typeRow = {
	id: 'ct-1',
	slug: 'blog',
	name: 'Blog',
	fields: JSON.stringify([{ name: 'body', label: 'Body', type: 'textarea', required: false }]),
	settings: '{}',
	icon: 'article',
	sort_order: 0,
	created_at: '2024-01-01',
	updated_at: '2024-01-01'
};

function itemRow(over: Record<string, unknown> = {}) {
	return {
		id: 'ci-1',
		content_type_id: 'ct-1',
		slug: 'post',
		title: 'Post',
		status: 'draft',
		fields: '{"body":"x"}',
		seo_title: null,
		seo_description: null,
		seo_image: null,
		author_id: null,
		show_in_command_palette: 1,
		published_at: null,
		created_at: '2024-01-01',
		updated_at: '2024-01-01',
		...over
	};
}

describe('scheduled publishing in the CMS service', () => {
	let db: any;

	beforeEach(() => {
		vi.resetModules();
		db = {
			prepare: vi.fn().mockReturnThis(),
			bind: vi.fn().mockReturnThis(),
			first: vi.fn(),
			all: vi.fn(),
			run: vi.fn(),
			batch: vi.fn()
		};
	});

	describe('createContentItem', () => {
		async function create(input: Record<string, unknown>) {
			const { createContentItem } = await import('../../src/lib/services/cms.js');
			db.first
				.mockResolvedValueOnce(typeRow)
				.mockResolvedValueOnce({ id: 'user-1' })
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce(itemRow());
			await createContentItem(db, {
				contentTypeSlug: 'blog',
				title: 'Post',
				fields: { body: 'x' },
				authorId: 'user-1',
				...input
			} as any);
			const insert = db.bind.mock.calls.find((c: unknown[]) => c.length === 12);
			return insert![11] as string | null;
		}

		it('stores a future date on an item created as published', async () => {
			expect(await create({ status: 'published', publishedAt: FUTURE })).toBe(FUTURE);
		});

		it('publishes now when no date is given', async () => {
			const stored = await create({ status: 'published' });
			expect(Date.parse(stored as string)).toBeGreaterThan(Date.parse('2026-01-01'));
		});

		it('ignores a date on a draft', async () => {
			expect(await create({ status: 'draft', publishedAt: FUTURE })).toBeNull();
		});

		it('rejects a date that is not a date', async () => {
			const { createContentItem } = await import('../../src/lib/services/cms.js');
			db.first.mockResolvedValueOnce(typeRow).mockResolvedValueOnce({ id: 'user-1' });
			await expect(
				createContentItem(db, {
					contentTypeSlug: 'blog',
					title: 'Post',
					status: 'published',
					publishedAt: 'soon',
					fields: { body: 'x' }
				} as any)
			).rejects.toMatchObject({ name: 'CmsFieldValidationError' });
		});
	});

	describe('updateContentItem', () => {
		async function update(existing: Record<string, unknown>, input: Record<string, unknown>) {
			const { updateContentItem } = await import('../../src/lib/services/cms.js');
			db.first
				.mockResolvedValueOnce(existing)
				.mockResolvedValueOnce({ fields: '[]', settings: '{"lockTitleAndSlugAfterPublish":true}' })
				.mockResolvedValueOnce(itemRow());
			await updateContentItem(db, 'ci-1', input as any);
			const call = db.bind.mock.calls.find((c: unknown[]) => c.length === 12);
			return call![8] as string | null; // published_at
		}

		it('schedules a draft by publishing it with a future date', async () => {
			const stored = await update(itemRow(), { status: 'published', publishedAt: FUTURE });
			expect(stored).toBe(FUTURE);
		});

		it('brings a scheduled item forward when told to publish now', async () => {
			const stored = await update(itemRow({ status: 'published', published_at: FUTURE }), {
				status: 'published',
				publishedAt: null
			});
			expect(Date.parse(stored as string)).toBeLessThan(Date.parse(FUTURE));
		});

		it('keeps the first-publish date of an item that is already live', async () => {
			const stored = await update(itemRow({ status: 'published', published_at: PAST }), {
				status: 'published',
				publishedAt: FUTURE
			});
			expect(stored).toBe(PAST);
		});

		it('does not treat a scheduled item as published for the lock on title and slug', async () => {
			await expect(
				update(itemRow({ status: 'published', published_at: FUTURE }), { title: 'Renamed' })
			).resolves.toBe(FUTURE);
		});

		it('still locks the title and slug once the item is live', async () => {
			await expect(
				update(itemRow({ status: 'published', published_at: PAST }), { title: 'Renamed' })
			).rejects.toThrow(/Cannot edit the title/);
		});
	});

	describe('deleteContentItem', () => {
		it('lets a scheduled item be deleted even with timestamp proof on', async () => {
			const { deleteContentItem } = await import('../../src/lib/services/cms.js');
			db.first.mockResolvedValueOnce({
				published_at: FUTURE,
				settings: '{"enableTimestampProof":true}'
			});
			db.run.mockResolvedValueOnce({ meta: { changes: 1 } });
			await expect(deleteContentItem(db, 'ci-1')).resolves.toBe(true);
		});

		it('still refuses once a proof-enabled item is live', async () => {
			const { deleteContentItem } = await import('../../src/lib/services/cms.js');
			db.first.mockResolvedValueOnce({
				published_at: PAST,
				settings: '{"enableTimestampProof":true}'
			});
			await expect(deleteContentItem(db, 'ci-1')).rejects.toThrow(/timestamp proof/);
		});
	});

	describe('public queries hide scheduled items', () => {
		it('adds the live condition to a list when liveOnly is set', async () => {
			const { listContentItems } = await import('../../src/lib/services/cms.js');
			db.first.mockResolvedValueOnce({ count: 0 });
			db.all.mockResolvedValueOnce({ results: [] });
			await listContentItems(db, 'ct-1', { status: 'published', liveOnly: true });
			const sql = db.prepare.mock.calls.map((c: string[]) => c[0]).join('\n');
			expect(sql).toContain("datetime(published_at) <= datetime('now')");
		});

		it('leaves the admin list unfiltered by date', async () => {
			const { listContentItems } = await import('../../src/lib/services/cms.js');
			db.first.mockResolvedValueOnce({ count: 0 });
			db.all.mockResolvedValueOnce({ results: [] });
			await listContentItems(db, 'ct-1', { status: 'published' });
			const sql = db.prepare.mock.calls.map((c: string[]) => c[0]).join('\n');
			expect(sql).not.toContain('datetime(');
		});

		it('filters the command palette and the sitemap', async () => {
			const { getCommandPaletteContentItems, listPublishedContentForSitemap } =
				await import('../../src/lib/services/cms.js');
			db.all.mockResolvedValue({ results: [] });
			await getCommandPaletteContentItems(db);
			await listPublishedContentForSitemap(db);
			const sql = db.prepare.mock.calls.map((c: string[]) => c[0]);
			expect(sql[0]).toContain("datetime(ci.published_at) <= datetime('now')");
			expect(sql[1]).toContain("datetime(i.published_at) <= datetime('now')");
		});
	});
});
