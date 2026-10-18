import { apiJson, siteApi } from '$lib/server/site-api';
import { describeSite } from '$lib/server/site-info';

/** GET /api/v1/site — name, template and package versions, update choices. Ammoura polls this. */
export const GET = siteApi('site:read', async ({ db }) => apiJson(await describeSite(db)));
