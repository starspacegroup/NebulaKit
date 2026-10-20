import { error } from '@sveltejs/kit';
import { getPage } from '@nebulakit/builder';
import { formatMoney, listProducts } from '@nebulakit/commerce';
import type { PageServerLoad } from './$types';

/**
 * /p/[slug] — a page built in the builder. Drafts are visible to admins only,
 * so an admin can preview before publishing.
 */
export const load: PageServerLoad = async ({ params, platform, locals }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'The site database is not available');
	const page = await getPage(db, params.slug);
	const isAdmin = !!(locals.user?.isOwner || locals.user?.isAdmin || locals.user?.isSuperAdmin);
	if (!page || (!page.published && !isAdmin)) throw error(404, 'Page not found');

	const grids = page.document.blocks.filter((b) => b.type === 'product-grid');
	const limit = Math.max(0, ...grids.map((b) => (b.type === 'product-grid' ? b.props.limit : 0)));
	const products = limit
		? (await listProducts(db, { limit })).map((p) => ({
				slug: p.slug,
				name: p.name,
				price: formatMoney(p.priceCents, p.currency),
				imageUrl: p.imageUrl
			}))
		: [];
	return { page, products };
};
