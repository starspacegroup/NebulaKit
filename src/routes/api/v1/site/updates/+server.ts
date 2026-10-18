import { apiJson, invalid, readJson, siteApi } from '$lib/server/site-api';
import {
	getUpdatePreferences,
	saveUpdatePreferences,
	validateUpdatePreferences
} from '$lib/server/site-info';

/** GET /api/v1/site/updates — which feature updates this site takes. */
export const GET = siteApi('site:read', async ({ db }) => apiJson(await getUpdatePreferences(db)));

/**
 * PUT /api/v1/site/updates — the owner's choice. `site:admin` only, so an
 * ordinary admin's session cannot change it. Security updates are not
 * choosable and are not in the body.
 */
export const PUT = siteApi('site:admin', async ({ db, event }) => {
	const parsed = validateUpdatePreferences(await readJson(event));
	if (!parsed.ok) throw invalid(parsed.errors);
	return apiJson(await saveUpdatePreferences(db, parsed.value));
});
