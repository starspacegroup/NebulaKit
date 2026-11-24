import { error, fail } from '@sveltejs/kit';
import {
	CommerceConflictError,
	createProduct,
	deleteProduct,
	formatMoney,
	getProduct,
	listProducts,
	updateProduct
} from '@nebulakit/commerce';
import { requirePermission } from '$lib/server/auth-guards';
import {
	parseProductValues,
	productToFormValues,
	readProductForm
} from '$lib/server/admin-products';
import type { Actions, PageServerLoad } from './$types';

/** /admin/products: the shop's catalog, including archived products. */
export const load: PageServerLoad = async ({ locals, platform }) => {
	requirePermission(locals, 'shop');
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'The site database is not available');
	const products = await listProducts(db, { includeInactive: true, limit: 500 });
	return {
		products: products.map((p) => ({
			id: p.id,
			slug: p.slug,
			active: p.active,
			price: formatMoney(p.priceCents, p.currency),
			values: productToFormValues(p)
		}))
	};
};

function database(platform: App.Platform | undefined) {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'The site database is not available');
	return db;
}

function productId(form: FormData): string | null {
	const id = String(form.get('id') ?? '');
	return id || null;
}

export const actions: Actions = {
	create: async ({ locals, platform, request }) => {
		requirePermission(locals, 'shop');
		const db = database(platform);
		const values = readProductForm(await request.formData());
		const parsed = parseProductValues(values);
		if (!parsed.ok) return fail(400, { action: 'create', problems: parsed.errors, values });
		try {
			await createProduct(db, parsed.value);
		} catch (err) {
			if (err instanceof CommerceConflictError) {
				return fail(409, {
					action: 'create',
					problems: ['That slug is already used by another product.'],
					values
				});
			}
			throw err;
		}
		return { action: 'create', message: `Added ${values.name}.` };
	},

	update: async ({ locals, platform, request }) => {
		requirePermission(locals, 'shop');
		const db = database(platform);
		const form = await request.formData();
		const id = productId(form);
		if (!id) return fail(400, { action: 'update', problems: ['Missing product.'] });
		const values = readProductForm(form);
		const parsed = parseProductValues(values);
		if (!parsed.ok) return fail(400, { action: 'update', id, problems: parsed.errors, values });
		try {
			const saved = await updateProduct(db, id, parsed.value);
			if (!saved) return fail(404, { action: 'update', id, problems: ['That product is gone.'] });
		} catch (err) {
			if (err instanceof CommerceConflictError) {
				return fail(409, {
					action: 'update',
					id,
					problems: ['That slug is already used by another product.'],
					values
				});
			}
			throw err;
		}
		return { action: 'update', id, message: `Saved ${values.name}.` };
	},

	/** Archive hides a product from the shop and keeps it, and every order that names it. */
	archive: async ({ locals, platform, request }) => toggle(locals, platform, request, false),
	restore: async ({ locals, platform, request }) => toggle(locals, platform, request, true),

	/** Only an archived product can be deleted: archive first, then remove. */
	delete: async ({ locals, platform, request }) => {
		requirePermission(locals, 'shop');
		const db = database(platform);
		const id = productId(await request.formData());
		if (!id) return fail(400, { action: 'delete', problems: ['Missing product.'] });
		const product = await getProduct(db, id);
		if (!product) return fail(404, { action: 'delete', problems: ['That product is gone.'] });
		if (product.active) {
			return fail(409, {
				action: 'delete',
				id,
				problems: ['Archive the product before deleting it.']
			});
		}
		await deleteProduct(db, id);
		return { action: 'delete', message: `Deleted ${product.name}. Past orders keep their lines.` };
	}
};

async function toggle(
	locals: App.Locals,
	platform: App.Platform | undefined,
	request: Request,
	active: boolean
) {
	requirePermission(locals, 'shop');
	const db = database(platform);
	const id = productId(await request.formData());
	const verb = active ? 'restore' : 'archive';
	if (!id) return fail(400, { action: verb, problems: ['Missing product.'] });
	const saved = await updateProduct(db, id, { active });
	if (!saved) return fail(404, { action: verb, id, problems: ['That product is gone.'] });
	return {
		action: verb,
		message: active
			? `${saved.name} is back in the shop.`
			: `${saved.name} is hidden from the shop.`
	};
}
