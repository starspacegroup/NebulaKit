/** D1 storage for builder pages (`builder_pages`, migration 0017). */
import type { D1Database } from '@cloudflare/workers-types';
import { emptyPage, validatePageDocument, type PageDocument } from './schema';

export interface BuilderPage {
	id: string;
	slug: string;
	title: string;
	document: PageDocument;
	published: boolean;
	createdAt: string;
	updatedAt: string;
}

export type BuilderPageSummary = Omit<BuilderPage, 'document'>;

type Row = Record<string, unknown>;

export const PAGE_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

function parseDocument(raw: unknown): PageDocument {
	try {
		const parsed = validatePageDocument(JSON.parse(String(raw)));
		// A row that no longer validates renders as an empty page instead of
		// breaking the route; the admin editor shows it and saving repairs it.
		return parsed.ok ? parsed.value : emptyPage();
	} catch {
		return emptyPage();
	}
}

function summary(row: Row): BuilderPageSummary {
	return {
		id: row.id as string,
		slug: row.slug as string,
		title: row.title as string,
		published: Number(row.published) === 1,
		createdAt: row.created_at as string,
		updatedAt: row.updated_at as string
	};
}

export async function listPages(
	db: D1Database,
	options: { publishedOnly?: boolean } = {}
): Promise<BuilderPageSummary[]> {
	const where = options.publishedOnly ? 'WHERE published = 1' : '';
	const { results } = await db
		.prepare(
			`SELECT id, slug, title, published, created_at, updated_at FROM builder_pages ${where} ORDER BY slug`
		)
		.all<Row>();
	return results.map(summary);
}

export async function getPage(db: D1Database, slug: string): Promise<BuilderPage | null> {
	const row = await db
		.prepare('SELECT * FROM builder_pages WHERE slug = ?')
		.bind(slug)
		.first<Row>();
	return row ? { ...summary(row), document: parseDocument(row.document) } : null;
}

/** Create or replace the page at `slug`. The document must already be validated. */
export async function savePage(
	db: D1Database,
	page: { slug: string; title: string; document: PageDocument; published: boolean }
): Promise<{ page: BuilderPage; created: boolean }> {
	const existing = await db
		.prepare('SELECT id FROM builder_pages WHERE slug = ?')
		.bind(page.slug)
		.first<Row>();
	const body = JSON.stringify(page.document);
	if (existing) {
		await db
			.prepare(
				"UPDATE builder_pages SET title = ?, document = ?, published = ?, updated_at = datetime('now') WHERE slug = ?"
			)
			.bind(page.title, body, page.published ? 1 : 0, page.slug)
			.run();
	} else {
		await db
			.prepare(
				'INSERT INTO builder_pages (id, slug, title, document, published) VALUES (?, ?, ?, ?, ?)'
			)
			.bind(crypto.randomUUID(), page.slug, page.title, body, page.published ? 1 : 0)
			.run();
	}
	return { page: (await getPage(db, page.slug)) as BuilderPage, created: !existing };
}

export async function deletePage(db: D1Database, slug: string): Promise<boolean> {
	const result = await db.prepare('DELETE FROM builder_pages WHERE slug = ?').bind(slug).run();
	return (result.meta?.changes ?? 0) > 0;
}
