import {
	createProduct,
	listProducts,
	validateProductInput,
	type ProductInput
} from '@nebulakit/commerce';
import { apiJson, invalid, readJson, siteApi } from '$lib/server/site-api';

/**
 * GET /api/v1/products — public: the active catalog. A caller holding
 * `products:read` may add `?all=1` to include inactive products.
 */
export const GET = siteApi(null, async ({ db, event, can }) => {
	const includeInactive = event.url.searchParams.get('all') === '1' && can('products:read');
	const limit = Number(event.url.searchParams.get('limit') ?? 100) || 100;
	return apiJson({ products: await listProducts(db, { includeInactive, limit }) });
});

/** POST /api/v1/products — create a product. */
export const POST = siteApi('products:write', async ({ db, event }) => {
	const parsed = validateProductInput(await readJson(event));
	if (!parsed.ok) throw invalid(parsed.errors);
	return apiJson({ product: await createProduct(db, parsed.value as ProductInput) }, 201);
});
