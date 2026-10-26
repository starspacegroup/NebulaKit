import { getRevision, restoreRevision } from '@nebulakit/builder';
import { apiJson, notFound, siteApi } from '$lib/server/site-api';

/** GET /api/v1/pages/:slug/revisions/:id — one revision with its document. */
export const GET = siteApi('pages:read', async ({ db, event }) => {
	const revision = await getRevision(db, event.params.slug as string, event.params.id as string);
	if (!revision) throw notFound('Revision');
	return apiJson({ revision });
});

/** POST /api/v1/pages/:slug/revisions/:id — put this revision back as the page. */
export const POST = siteApi('pages:write', async ({ db, event, principal }) => {
	const page = await restoreRevision(
		db,
		event.params.slug as string,
		event.params.id as string,
		principal?.name
	);
	if (!page) throw notFound('Revision');
	return apiJson({ page });
});
