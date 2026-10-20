import { error } from '@sveltejs/kit';
import { formatMoney, listProducts } from '@nebulakit/commerce';
import type { PageServerLoad } from './$types';

/** /shop — every active product. */
export const load: PageServerLoad = async ({ platform }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'The site database is not available');
	const products = await listProducts(db, { limit: 200 });
	return {
		products: products.map((p) => ({
			slug: p.slug,
			name: p.name,
			description: p.description,
			price: formatMoney(p.priceCents, p.currency),
			imageUrl: p.imageUrl
		}))
	};
};
