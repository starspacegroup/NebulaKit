import {
	getRegionalPricingSettings,
	previewMultiplier,
	regionalPriceCents
} from '@nebulakit/commerce';
import { apiJson, invalid, siteApi } from '$lib/server/site-api';

/**
 * GET /api/v1/pricing/preview?country=IN&priceCents=2000 — what a buyer in
 * that country would pay under the stored settings. `priceCents` is optional.
 */
export const GET = siteApi('pricing:read', async ({ db, event }) => {
	const country = event.url.searchParams.get('country');
	const preview = previewMultiplier(await getRegionalPricingSettings(db), country);
	if (!preview.country) throw invalid(['country must be an ISO 3166-1 alpha-2 code']);
	const raw = event.url.searchParams.get('priceCents');
	let priceCents: number | undefined;
	if (raw !== null) {
		const cents = Number(raw);
		if (!Number.isSafeInteger(cents) || cents < 0)
			throw invalid(['priceCents must be whole cents']);
		priceCents = cents;
	}
	return apiJson({
		preview: {
			...preview,
			...(priceCents !== undefined
				? { priceCents, regionalPriceCents: regionalPriceCents(priceCents, preview.multiplier) }
				: {})
		}
	});
});
