import {
	deleteProduct,
	getProduct,
	updateProduct,
	validateProductInput
} from '@nebulakit/commerce';
import { apiJson, invalid, notFound, readJson, siteApi } from '$lib/server/site-api';

/** GET /api/v1/products/:idOrSlug — public for active products; inactive ones need `products:read`. */
export const GET = siteApi(null, async ({ db, event, can }) => {
	const product = await getProduct(db, event.params.id as string);
	if (!product || (!product.active && !can('products:read'))) throw notFound('Product');
	return apiJson({ product });
});

/** PATCH /api/v1/products/:id — change the fields sent, leave the rest. */
export const PATCH = siteApi('products:write', async ({ db, event }) => {
	const parsed = validateProductInput(await readJson(event), true);
	if (!parsed.ok) throw invalid(parsed.errors);
	const existing = await getProduct(db, event.params.id as string);
	if (!existing) throw notFound('Product');
	return apiJson({ product: await updateProduct(db, existing.id, parsed.value) });
});

/** DELETE /api/v1/products/:id — orders keep their copied name and price. */
export const DELETE = siteApi('products:write', async ({ db, event }) => {
	const existing = await getProduct(db, event.params.id as string);
	if (!existing || !(await deleteProduct(db, existing.id))) throw notFound('Product');
	return new Response(null, { status: 204 });
});
