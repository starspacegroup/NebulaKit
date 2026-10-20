import { listPages } from '@nebulakit/builder';
import { apiJson, siteApi } from '$lib/server/site-api';

/** GET /api/v1/pages — public: published pages. `pages:read` also sees drafts. */
export const GET = siteApi(null, async ({ db, can }) =>
	apiJson({ pages: await listPages(db, { publishedOnly: !can('pages:read') }) })
);
