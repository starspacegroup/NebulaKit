import { validateProductInput, type Product, type ProductInput } from '@nebulakit/commerce';

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
}

const DOLLARS = /^\$?\s*(\d{1,7})(?:\.(\d{1,2}))?$/;

/**
 * Dollars as an admin types them ("12", "12.5", "$12.50") to whole cents.
 * Null for anything else: money never goes through a float.
 */
export function dollarsToCents(input: string): number | null {
	const match = DOLLARS.exec(input.trim());
	if (!match) return null;
	return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0') || 0);
}

export function centsToDollars(cents: number): string {
	return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
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
		active: product.active
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
		active: form.get('active') === 'on'
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
	return errors.length || !checked.ok
		? { ok: false, errors }
		: { ok: true, value: checked.value as ProductInput };
}
