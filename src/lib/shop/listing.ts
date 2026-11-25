/**
 * What a product page shows, in one place, so the visible price, the JSON-LD
 * offer and the Google feed are derived from the same numbers
 * (docs/GOOGLE_LISTINGS.md, "Which price Google sees").
 *
 * Pure: the caller supplies the product, the site's Google settings, the flat
 * shipping charge and a clock. `tests/unit/google-price-agreement.test.ts`
 * fails if the page, the markup and the feed ever name different prices.
 */
import {
	absoluteImage,
	formatMoney,
	priceNow,
	shippingLines,
	type GoogleListingSettings,
	type Product
} from '@nebulakit/commerce';
import type { ProductInput as StructuredProduct } from '$lib/seo/structured-data';

export interface ProductPageModel {
	id: string;
	slug: string;
	name: string;
	description: string;
	/** The price shown on the page, formatted. */
	price: string;
	/** The price per unit the cart starts from (the page's price, in cents). */
	priceCents: number;
	/** The regular price while a sale is on, formatted; null otherwise. */
	listPrice: string | null;
	currency: string;
	imageUrl: string | null;
	physical: boolean;
	/** The JSON-LD input for this product. */
	structured: StructuredProduct;
}

export function productPageModel(
	product: Product,
	opts: {
		settings: GoogleListingSettings;
		flatShippingCents: number;
		nowMs: number;
		siteUrl: string;
	}
): ProductPageModel {
	const { priceCents, listPriceCents, saleEndsAt } = priceNow(product, opts.nowMs);
	const g = product.google;
	const images = [product.imageUrl, ...g.additionalImages]
		.map((url) => absoluteImage(url, opts.siteUrl))
		.filter((url): url is string => Boolean(url));
	const returns = opts.settings.returns;
	return {
		id: product.id,
		slug: product.slug,
		name: product.name,
		description: product.description,
		price: formatMoney(priceCents, product.currency),
		priceCents,
		listPrice: listPriceCents == null ? null : formatMoney(listPriceCents, product.currency),
		currency: product.currency,
		imageUrl: product.imageUrl,
		physical: product.type === 'physical',
		structured: {
			name: product.name,
			description: product.description,
			sku: product.id,
			priceCents,
			currency: product.currency,
			listPriceCents,
			priceValidUntil: saleEndsAt,
			images,
			brand: g.brand ?? opts.settings.defaultBrand,
			gtin: g.gtin,
			mpn: g.mpn,
			condition: g.condition,
			availability: g.availability,
			color: g.color,
			size: g.size,
			material: g.material,
			gender: g.gender,
			itemGroupId: g.itemGroupId,
			category: g.googleProductCategory,
			adult: g.adult,
			shipping: shippingLines(product, opts.settings, opts.flatShippingCents),
			returnPolicy: returns
				? {
						...returns,
						countries: returns.countries.length ? returns.countries : opts.settings.shipCountries
					}
				: null
		}
	};
}
