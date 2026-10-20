import { deletePage, getPage, PAGE_SLUG, savePage, validatePageDocument } from '@nebulakit/builder';
import { apiJson, invalid, notFound, readJson, siteApi } from '$lib/server/site-api';

/** GET /api/v1/pages/:slug — the page document. Drafts need `pages:read`. */
export const GET = siteApi(null, async ({ db, event, can }) => {
	const page = await getPage(db, event.params.slug as string);
	if (!page || (!page.published && !can('pages:read'))) throw notFound('Page');
	return apiJson({ page });
});

/**
 * PUT /api/v1/pages/:slug — create or replace a page:
 * `{ title, document, published }`. The document is validated and rebuilt
 * from known fields before it is stored (packages/builder/src/schema.ts).
 */
export const PUT = siteApi('pages:write', async ({ db, event, principal }) => {
	const slug = event.params.slug as string;
	const body = (await readJson(event)) as Record<string, unknown> | null;
	const errors: string[] = [];
	if (!PAGE_SLUG.test(slug)) errors.push('slug must be lowercase letters, digits and dashes');
	const title = typeof body?.title === 'string' ? body.title.trim() : '';
	if (!title || title.length > 200) errors.push('title is required (200 characters at most)');
	const published = body?.published ?? false;
	if (typeof published !== 'boolean') errors.push('published must be true or false');
	const document = validatePageDocument(body?.document);
	if (!document.ok) errors.push(...document.errors);
	if (errors.length || !document.ok) throw invalid(errors);
	const { page, created } = await savePage(db, {
		slug,
		title,
		document: document.value,
		published: published as boolean,
		author: principal?.name
	});
	return apiJson({ page }, created ? 201 : 200);
});

export const DELETE = siteApi('pages:write', async ({ db, event }) => {
	if (!(await deletePage(db, event.params.slug as string))) throw notFound('Page');
	return new Response(null, { status: 204 });
});
