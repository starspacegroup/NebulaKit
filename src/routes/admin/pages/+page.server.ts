import { error, fail, redirect } from '@sveltejs/kit';
import { emptyPage, getPage, listPages, PAGE_SLUG, savePage } from '@nebulakit/builder';
import { requirePermission } from '$lib/server/auth-guards';
import type { Actions, PageServerLoad } from './$types';

/** /admin/pages — the builder's page list. Editing happens at /admin/pages/[slug]. */
export const load: PageServerLoad = async ({ locals, platform }) => {
	requirePermission(locals, 'pages');
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'The site database is not available');
	return { pages: await listPages(db) };
};

export const actions: Actions = {
	create: async ({ locals, platform, request }) => {
		requirePermission(locals, 'pages');
		const db = platform?.env?.DB;
		if (!db) throw error(503, 'The site database is not available');
		const form = await request.formData();
		const slug = String(form.get('slug') ?? '')
			.trim()
			.toLowerCase();
		const title = String(form.get('title') ?? '').trim();
		if (!PAGE_SLUG.test(slug))
			return fail(400, { error: 'Use lowercase letters, digits and dashes for the address.' });
		if (!title || title.length > 200) return fail(400, { error: 'Give the page a title.' });
		if (await getPage(db, slug))
			return fail(409, { error: `A page at /p/${slug} already exists.` });
		await savePage(db, { slug, title, document: emptyPage(), published: false });
		throw redirect(303, `/admin/pages/${slug}`);
	}
};
