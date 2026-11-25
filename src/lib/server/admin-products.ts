import { validateProductInput, type Product, type ProductInput } from '@nebulakit/commerce';
import {
	googleToFormValues,
	parseGoogleValues,
	readGoogleForm,
	type GoogleFormValues
} from '$lib/shop/google-form';
import { centsToDollars, dollarsToCents } from '$lib/shop/money-input';

export { centsToDollars, dollarsToCents };

/** What an admin typed, kept so a rejected form can be shown back as typed. */
export interface ProductFormValues {
	name: string;
	slug: string;
	description: string;
	price: string;
	currency: string;
	imageUrl: string;
	type: string;
	printfulVariantId: string;
	active: boolean;
	google: GoogleFormValues;
}

export function productToFormValues(product: Product): ProductFormValues {
	return {
		name: product.name,
		slug: product.slug,
		description: product.description,
		price: centsToDollars(product.priceCents),
		currency: product.currency,
		imageUrl: product.imageUrl ?? '',
		type: product.type,
		printfulVariantId: product.printfulVariantId == null ? '' : String(product.printfulVariantId),
		active: product.active,
		google: googleToFormValues(product.google)
	};
}

export function readProductForm(form: FormData): ProductFormValues {
	const field = (key: string) => String(form.get(key) ?? '').trim();
	return {
		name: field('name'),
		slug: field('slug').toLowerCase(),
		description: String(form.get('description') ?? '').trim(),
		price: field('price'),
		currency: field('currency').toLowerCase() || 'usd',
		imageUrl: field('image_url'),
		type: field('type') || 'physical',
		printfulVariantId: field('printful_variant_id'),
		active: form.get('active') === 'on',
		google: readGoogleForm(form)
	};
}

export type ParsedProduct = { ok: true; value: ProductInput } | { ok: false; errors: string[] };

/** The typed values as a validated `ProductInput`, or every reason it was refused. */
export function parseProductValues(values: ProductFormValues): ParsedProduct {
	const errors: string[] = [];
	const priceCents = dollarsToCents(values.price);
	if (priceCents === null) errors.push('Price must be dollars and cents, like 12.50.');

	let printfulVariantId: number | null = null;
	if (values.printfulVariantId) {
		const id = Number(values.printfulVariantId);
		if (/^\d+$/.test(values.printfulVariantId) && Number.isSafeInteger(id) && id > 0) {
			printfulVariantId = id;
		} else errors.push('Printful variant id must be a whole number.');
	}

	const checked = validateProductInput({
		slug: values.slug,
		name: values.name,
		description: values.description,
		priceCents: priceCents ?? -1,
		currency: values.currency,
		imageUrl: values.imageUrl || null,
		type: values.type,
		printfulVariantId,
		active: values.active
	});
	if (!checked.ok) {
		// The price is already reported in the admin's own words above.
		errors.push(
			...checked.errors.filter((e) => !(priceCents === null && e.startsWith('priceCents')))
		);
	}
	const google = parseGoogleValues(values.google);
	if (!google.ok) errors.push(...google.errors);
	return errors.length || !checked.ok || !google.ok
		? { ok: false, errors }
		: { ok: true, value: { ...(checked.value as ProductInput), google: google.value } };
}
