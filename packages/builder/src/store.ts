/** D1 storage for builder pages (`builder_pages`, migration 0017) and their revisions (0019). */
import type { D1Database } from '@cloudflare/workers-types';
import { countBlocks } from './ops';
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

export interface PageRevision {
	id: string;
	title: string;
	document: PageDocument;
	/** Who saved it: an API key's or a signed-in admin's name. */
	author: string | null;
	createdAt: string;
}

export type PageRevisionSummary = Omit<PageRevision, 'document'> & { blocks: number };

/** How many revisions a page keeps. Older ones are dropped on the next save. */
export const REVISION_LIMIT = 50;

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
	page: {
		slug: string;
		title: string;
		document: PageDocument;
		published: boolean;
		/** Recorded on the revision this save makes. */
		author?: string;
	}
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
	const saved = (await getPage(db, page.slug)) as BuilderPage;
	await recordRevision(db, saved, body, page.author ?? null);
	return { page: saved, created: !existing };
}

/** Keep a copy of this save, unless it is the same title and content as the last one. */
async function recordRevision(
	db: D1Database,
	page: BuilderPage,
	body: string,
	author: string | null
): Promise<void> {
	const last = await db
		.prepare(
			'SELECT title, document FROM builder_page_revisions WHERE page_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1'
		)
		.bind(page.id)
		.first<Row>();
	if (last && last.title === page.title && last.document === body) return;
	await db
		.prepare(
			'INSERT INTO builder_page_revisions (id, page_id, title, document, author) VALUES (?, ?, ?, ?, ?)'
		)
		.bind(crypto.randomUUID(), page.id, page.title, body, author)
		.run();
	await db
		.prepare(
			`DELETE FROM builder_page_revisions WHERE page_id = ? AND id NOT IN (
				SELECT id FROM builder_page_revisions WHERE page_id = ?
				ORDER BY created_at DESC, rowid DESC LIMIT ${REVISION_LIMIT}
			)`
		)
		.bind(page.id, page.id)
		.run();
}

function revision(row: Row): PageRevision {
	return {
		id: row.id as string,
		title: row.title as string,
		document: parseDocument(row.document),
		author: (row.author as string | null) ?? null,
		createdAt: row.created_at as string
	};
}

/** The page's saved revisions, newest first. Null when the page does not exist. */
export async function listRevisions(
	db: D1Database,
	slug: string
): Promise<PageRevisionSummary[] | null> {
	const page = await db
		.prepare('SELECT id FROM builder_pages WHERE slug = ?')
		.bind(slug)
		.first<Row>();
	if (!page) return null;
	const { results } = await db
		.prepare(
			'SELECT * FROM builder_page_revisions WHERE page_id = ? ORDER BY created_at DESC, rowid DESC'
		)
		.bind(page.id)
		.all<Row>();
	return results.map((row) => {
		const { document, ...rest } = revision(row);
		return { ...rest, blocks: countBlocks(document.blocks) };
	});
}

export async function getRevision(
	db: D1Database,
	slug: string,
	id: string
): Promise<PageRevision | null> {
	const row = await db
		.prepare(
			`SELECT r.* FROM builder_page_revisions r JOIN builder_pages p ON p.id = r.page_id
			 WHERE p.slug = ? AND r.id = ?`
		)
		.bind(slug, id)
		.first<Row>();
	return row ? revision(row) : null;
}

/**
 * Put a revision's title and content back as the page. The revision stays in
 * the timeline and the restore is saved as a new one, so a restore can be
 * undone by restoring again. Whether the page is published does not change.
 */
export async function restoreRevision(
	db: D1Database,
	slug: string,
	id: string,
	author?: string
): Promise<BuilderPage | null> {
	const [page, source] = await Promise.all([getPage(db, slug), getRevision(db, slug, id)]);
	if (!page || !source) return null;
	const { page: restored } = await savePage(db, {
		slug,
		title: source.title,
		document: source.document,
		published: page.published,
		author
	});
	return restored;
}

export async function deletePage(db: D1Database, slug: string): Promise<boolean> {
	await db
		.prepare(
			'DELETE FROM builder_page_revisions WHERE page_id IN (SELECT id FROM builder_pages WHERE slug = ?)'
		)
		.bind(slug)
		.run();
	const result = await db.prepare('DELETE FROM builder_pages WHERE slug = ?').bind(slug).run();
	return (result.meta?.changes ?? 0) > 0;
}
