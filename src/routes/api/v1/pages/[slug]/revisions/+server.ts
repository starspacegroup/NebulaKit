import { listRevisions } from '@nebulakit/builder';
import { apiJson, notFound, siteApi } from '$lib/server/site-api';

/** GET /api/v1/pages/:slug/revisions — the page's saved revisions, newest first. */
export const GET = siteApi('pages:read', async ({ db, event }) => {
	const revisions = await listRevisions(db, event.params.slug as string);
	if (!revisions) throw notFound('Page');
	return apiJson({ revisions });
});
