import { error, fail } from '@sveltejs/kit';
import {
	getRegionalPricingSettings,
	parseOverrideLines,
	PRICE_LEVEL_INDEX_UPDATED,
	saveRegionalPricingSettings,
	validateRegionalPricingInput
} from '@nebulakit/commerce';
import { requireOwner } from '$lib/server/auth-guards';
import { requestCountry } from '$lib/server/checkout-pricing';
import type { Actions, PageServerLoad } from './$types';

/**
 * /admin/settings/pricing — regional (purchasing-power) pricing. The same
 * settings the site API exposes at /api/v1/pricing, so the owner's screen and
 * Ammoura drive one store with one set of rules.
 */
function database(platform: App.Platform | undefined) {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'The site database is not available');
	return db;
}

export const load: PageServerLoad = async ({ locals, platform, request }) => {
	requireOwner(locals);
	return {
		settings: await getRegionalPricingSettings(database(platform)),
		priceLevelIndexUpdated: PRICE_LEVEL_INDEX_UPDATED,
		// So the owner can see what their own shoppers see, where they are.
		yourCountry: requestCountry({ request, platform })
	};
};

/** A percentage field (0-100) as a fraction; NaN when blank or not a number. */
function fraction(value: FormDataEntryValue | null): number {
	if (value === null || String(value).trim() === '') return NaN;
	return Number(value) / 100;
}

export const actions: Actions = {
	save: async ({ locals, platform, request }) => {
		requireOwner(locals);
		const db = database(platform);
		const form = await request.formData();
		const { overrides, errors } = parseOverrideLines(String(form.get('overrides') ?? ''));
		if (errors.length) return fail(400, { errors });
		const parsed = validateRegionalPricingInput({
			enabled: form.get('enabled') === 'on',
			strength: fraction(form.get('strength')),
			maxDiscount: fraction(form.get('maxDiscount')),
			scope: form.get('scope'),
			overrides
		});
		if (!parsed.ok) return fail(400, { errors: parsed.errors });
		await saveRegionalPricingSettings(db, parsed.value);
		return { saved: true };
	}
};
