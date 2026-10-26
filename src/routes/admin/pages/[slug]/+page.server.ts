import { error } from '@sveltejs/kit';
import { getPage, listRevisions } from '@nebulakit/builder';
import { requirePermission } from '$lib/server/auth-guards';
import type { PageServerLoad } from './$types';

/** /admin/pages/[slug] — the editor. It saves through PUT /api/v1/pages/[slug], like any API client. */
export const load: PageServerLoad = async ({ locals, platform, params }) => {
	requirePermission(locals, 'pages');
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'The site database is not available');
	const page = await getPage(db, params.slug);
	if (!page) throw error(404, 'Page not found');
	return { page, revisions: (await listRevisions(db, params.slug)) ?? [] };
};
