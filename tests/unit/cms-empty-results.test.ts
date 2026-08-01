/**
 * D1 returns `{ results: [...] }` on success, but a query that matches nothing
 * can come back without a `results` key at all. Every read path guards with
 * `results || []` or a null-row check; these tests hold those guards in place,
 * because the failure mode is a TypeError thrown from a page load rather than
 * an empty list rendered.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

let db: any;

beforeEach(() => {
	vi.resetModules();
	db = {
		prepare: vi.fn().mockReturnThis(),
		bind: vi.fn().mockReturnThis(),
		first: vi.fn().mockResolvedValue(null),
		all: vi.fn().mockResolvedValue({}),
		run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
		batch: vi.fn().mockResolvedValue([])
	};
});

const cms = () => import('../../src/lib/services/cms.js');

describe('list reads with no results key', () => {
	it('getContentTypes returns an empty list', async () => {
		expect(await (await cms()).getContentTypes(db)).toEqual([]);
	});

	it('listContentItems returns an empty list', async () => {
		const result = await (await cms()).listContentItems(db, 'blog');
		expect(Array.isArray(result) ? result : result.items).toEqual([]);
	});

	it('getCommandPaletteContentItems returns an empty list', async () => {
		expect(await (await cms()).getCommandPaletteContentItems(db)).toEqual([]);
	});

	it('getTagsForType returns an empty list', async () => {
		expect(await (await cms()).getTagsForType(db, 'blog')).toEqual([]);
	});

	it('getItemTags returns an empty list', async () => {
		expect(await (await cms()).getItemTags(db, 'item-1')).toEqual([]);
	});

	it('getAllContentTypeSlugs returns an empty list', async () => {
		expect(await (await cms()).getAllContentTypeSlugs(db)).toEqual([]);
	});
});

describe('single-row reads with no matching row', () => {
	it('getContentItem returns null', async () => {
		expect(await (await cms()).getContentItem(db, 'missing')).toBeNull();
	});

	it('getContentItemBySlug returns null', async () => {
		expect(await (await cms()).getContentItemBySlug(db, 'blog', 'missing')).toBeNull();
	});

	it('getContentTypeBySlug returns null', async () => {
		expect(await (await cms()).getContentTypeBySlug(db, 'missing')).toBeNull();
	});

	it('getContentTypeById returns null', async () => {
		expect(await (await cms()).getContentTypeById(db, 'missing')).toBeNull();
	});

	it('isContentTypeSlug reports false rather than throwing', async () => {
		expect(await (await cms()).isContentTypeSlug(db, 'missing')).toBe(false);
	});
});

describe('syncContentTypes against an empty table', () => {
	it('treats a missing results key as no existing rows', async () => {
		await (await cms()).syncContentTypes(db);
		// Every registry type is new, so the sync has inserts to batch.
		expect(db.batch).toHaveBeenCalled();
	});
});

describe('deletes that match nothing', () => {
	it('deleteContentItem reports that nothing was removed', async () => {
		expect(await (await cms()).deleteContentItem(db, 'missing')).toBe(false);
	});

	it('deleteContentTag reports that nothing was removed', async () => {
		expect(await (await cms()).deleteContentTag(db, 'missing')).toBe(false);
	});
});
