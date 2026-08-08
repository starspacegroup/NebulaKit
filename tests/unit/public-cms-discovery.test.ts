import { describe, expect, it, vi } from 'vitest';
import {
	getCommandPaletteContentItems,
	listPublishedContentForSitemap
} from '../../src/lib/services/cms';

function dbReturning(rows: unknown[]) {
	const queries: string[] = [];
	return {
		queries,
		db: {
			prepare: vi.fn((sql: string) => {
				queries.push(sql);
				return {
					bind: () => ({ all: async () => ({ results: rows }) })
				};
			})
		} as never
	};
}

describe('public CMS discovery', () => {
	it('command palette discovery filters private types and emits canonical resolvable links', async () => {
		const { db, queries } = dbReturning([
			{
				content_type_slug: 'articles',
				content_type_name: 'Articles',
				item_id: 'public-item',
				item_slug: 'hello',
				item_title: 'Hello',
				item_description: null
			}
		]);

		const items = await getCommandPaletteContentItems(db);
		expect(queries[0]).toContain("json_extract(ct.settings, '$.isPublic')");
		expect(items).toEqual([
			{
				id: 'cms-public-item',
				label: 'Hello',
				description: 'Articles',
				href: '/articles/hello',
				contentTypeName: 'Articles'
			}
		]);
	});

	it('sitemap discovery selects published items only from public types', async () => {
		const { db, queries } = dbReturning([
			{ type_slug: 'articles', item_slug: 'hello', lastmod: null }
		]);

		expect(await listPublishedContentForSitemap(db)).toEqual([
			{ typeSlug: 'articles', itemSlug: 'hello', lastmod: null }
		]);
		expect(queries[0]).toContain("json_extract(t.settings, '$.isPublic')");
		expect(queries[0]).toContain("i.status = 'published'");
	});
});
