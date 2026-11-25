import { error } from '@sveltejs/kit';
import { getGoogleListingSettings, getProduct } from '@nebulakit/commerce';
import { productPageModel } from '$lib/shop/listing';
import { flatShippingFromEnv, type CommerceEnv } from '$lib/server/site-info';
import { site } from '$lib/site.config';
import type { PageServerLoad } from './$types';

/** /shop/[slug] — one product. Inactive products are not shown. */
export const load: PageServerLoad = async ({ params, platform }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'The site database is not available');
	const product = await getProduct(db, params.slug);
	if (!product || !product.active || product.slug !== params.slug) {
		throw error(404, 'Product not found');
	}
	return {
		product: productPageModel(product, {
			settings: await getGoogleListingSettings(db),
			flatShippingCents: flatShippingFromEnv(platform.env as unknown as CommerceEnv),
			nowMs: Date.now(),
			siteUrl: site.url
		})
	};
};
