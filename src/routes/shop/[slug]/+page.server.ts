import { error } from '@sveltejs/kit';
import { formatMoney, getProduct } from '@nebulakit/commerce';
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
		product: {
			id: product.id,
			slug: product.slug,
			name: product.name,
			description: product.description,
			price: formatMoney(product.priceCents, product.currency),
			priceCents: product.priceCents,
			currency: product.currency,
			imageUrl: product.imageUrl,
			physical: product.type === 'physical'
		}
	};
};
