import {
	getRegionalPricingSettings,
	PRICE_LEVEL_INDEX_UPDATED,
	saveRegionalPricingSettings,
	validateRegionalPricingInput
} from '@nebulakit/commerce';
import { apiJson, invalid, readJson, siteApi } from '$lib/server/site-api';

/** GET /api/v1/pricing — the regional (purchasing-power) pricing settings. */
export const GET = siteApi('pricing:read', async ({ db }) =>
	apiJson({
		settings: await getRegionalPricingSettings(db),
		priceLevelIndexUpdated: PRICE_LEVEL_INDEX_UPDATED
	})
);

/**
 * PUT /api/v1/pricing — change them. A partial body is merged over what is
 * stored, so `{ "enabled": true }` turns it on and leaves the rest alone.
 * Invalid values are refused, not clamped.
 */
export const PUT = siteApi('pricing:write', async ({ db, event }) => {
	const parsed = validateRegionalPricingInput(
		await readJson(event),
		await getRegionalPricingSettings(db)
	);
	if (!parsed.ok) throw invalid(parsed.errors);
	return apiJson({
		settings: await saveRegionalPricingSettings(db, parsed.value),
		priceLevelIndexUpdated: PRICE_LEVEL_INDEX_UPDATED
	});
});
