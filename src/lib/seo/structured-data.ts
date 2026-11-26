/**
 * Schema.org JSON-LD for the public pages.
 *
 * One `@graph` per page rather than a pile of loose nodes, so the page's own
 * node can point at the Organization and WebSite by `@id` instead of repeating
 * them. The `@id`s are built from {@link site.url} and never from the request
 * origin: a node's id is its identity across pages and crawls, and a preview
 * deployment emitting its own hostname would read as a second organisation.
 *
 * `SharingMeta.svelte` is the only renderer. Pages get structured data by
 * carrying on using that component and passing extra facts through its
 * `structured` prop. See docs/STRUCTURED_DATA.md.
 *
 * Honesty rule (AGENTS.md): nothing here claims what the site does not do. In
 * particular there is no `SearchAction` (the site has no public search route
 * with a shareable result URL), no `availability` the shop cannot back (the
 * shop keeps no stock count, so a product is `InStock` unless its owner set
 * otherwise), and no `aggregateRating`/`review` without real reviews (the
 * template has none, so none are emitted).
 *
 * Dependency-free apart from site.config, so tests and routes can import it.
 */
import { site } from '$lib/site.config';

/** One schema.org node. Values are whatever schema.org allows there. */
export type JsonLdNode = Record<string, unknown>;

/** A `{"@context": ..., "@graph": [...]}` document, ready to serialise. */
export type JsonLdGraph = {
	'@context': 'https://schema.org';
	'@graph': JsonLdNode[];
};

/** Stable node identities. Referenced across pages, so they are host-pinned. */
export const ORGANIZATION_ID = `${site.url}/#organization`;
export const WEBSITE_ID = `${site.url}/#website`;
export const LOGO_ID = `${site.url}/#logo`;

/** BCP 47 tag matching `<html lang>` in `src/app.html`. */
const LANGUAGE = 'en-US';

/** One crumb on the trail. `path` is root-relative. */
export type Breadcrumb = { name: string; path: string };

/** An entry in a listing page's `ItemList`. */
export type ListEntry = { name: string; url: string; description?: string };

/** One shipping destination, as listed in the Google settings. Prices are cents. */
export type ShippingInput = {
	country: string;
	priceCents: number;
	handlingDaysMin?: number | null;
	handlingDaysMax?: number | null;
	transitDaysMin?: number | null;
	transitDaysMax?: number | null;
};

/** The site's return policy, already resolved to the countries it applies to. */
export type ReturnPolicyInput = {
	category: 'finite' | 'none' | 'unlimited';
	days?: number | null;
	fees: 'free' | 'customer' | 'shipping_fee';
	shippingFeeCents?: number | null;
	methods?: ('mail' | 'kiosk' | 'store')[];
	countries: string[];
};

/** A shop product, as `/shop/[slug]` knows it. */
export type ProductInput = {
	name: string;
	description?: string;
	sku?: string;
	/**
	 * What the shopper pays today, in minor units (cents). The page, the feed
	 * and the cart take this from `priceNow` (`@nebulakit/commerce`), so the
	 * markup cannot name a price the page does not show.
	 */
	priceCents: number;
	/** ISO 4217 code, any case. */
	currency: string;
	/** The regular price while a sale is on; becomes a StrikethroughPrice. */
	listPriceCents?: number | null;
	/** ISO 8601 end of the sale; the offer is valid until then. */
	priceValidUntil?: string | null;
	/** Absolute https image URLs, primary first. When absent the page image node is referenced. */
	images?: string[];
	brand?: string | null;
	/** A valid GTIN-8/12/13/14. */
	gtin?: string | null;
	mpn?: string | null;
	condition?: 'new' | 'refurbished' | 'used' | null;
	availability?: 'in_stock' | 'out_of_stock' | 'preorder' | 'backorder' | null;
	color?: string | null;
	size?: string | null;
	material?: string | null;
	gender?: 'male' | 'female' | 'unisex' | null;
	itemGroupId?: string | null;
	category?: string | null;
	adult?: boolean;
	shipping?: ShippingInput[];
	returnPolicy?: ReturnPolicyInput | null;
	/** Emitted only when `reviewCount` > 0. The template has no reviews, so pages pass none. */
	aggregateRating?: { ratingValue: number; reviewCount: number } | null;
};

/** What a page tells {@link buildPageGraph} about itself. */
export type PageGraphInput = {
	/** Root-relative path of the page being rendered, e.g. `/blog/hello`. */
	path: string;
	/** Page title, without the site-name suffix. */
	title: string;
	description?: string;
	/** Share image, absolute or root-relative. */
	image?: string;
	imageAlt?: string;
	imageWidth?: number;
	imageHeight?: number;
	/** schema.org `WebPage` subtype. A listing is a `CollectionPage`, and so on. */
	pageType?: 'WebPage' | 'CollectionPage' | 'ContactPage' | 'AboutPage' | 'ItemPage';
	/** Trail from the home page down, home itself excluded. */
	breadcrumb?: Breadcrumb[];
	/** Entries of a listing page, in the order they render. */
	items?: ListEntry[];
	/** Emit an `Article`/`BlogPosting` alongside the page node. */
	article?: {
		type?: 'Article' | 'BlogPosting';
		datePublished?: string;
		dateModified?: string;
		/** Author's display name. Falls back to the organisation. */
		author?: string;
		keywords?: string[];
		section?: string;
	};
	/** Emit a `Product` with one `Offer` as the page's main entity. */
	product?: ProductInput;
};

/** Drop keys whose value is empty, so no node carries `"description": ""`. */
function compact(node: JsonLdNode): JsonLdNode {
	const out: JsonLdNode = {};
	for (const [key, value] of Object.entries(node)) {
		if (value === undefined || value === null || value === '') continue;
		out[key] = value;
	}
	return out;
}

/**
 * Resolve a path or root-relative asset against the canonical host
 * ({@link site.url}). An already-absolute http(s) URL is returned untouched.
 * Anything else with a scheme (`javascript:`, `data:`) is dropped: it has no
 * business in a crawler-facing document.
 */
export function absoluteUrl(pathOrUrl: string): string {
	if (!pathOrUrl) return '';
	if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
	if (/^[a-z][a-z0-9+.-]*:/i.test(pathOrUrl) || pathOrUrl.startsWith('//')) return '';
	const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
	return path === '/' ? `${site.url}/` : `${site.url}${path}`;
}

/** The organisation behind the site: every page node points `publisher` here. */
export function organizationNode(): JsonLdNode {
	return compact({
		'@type': 'Organization',
		'@id': ORGANIZATION_ID,
		name: site.name,
		url: `${site.url}/`,
		description: site.description,
		slogan: site.tagline,
		logo: {
			'@type': 'ImageObject',
			'@id': LOGO_ID,
			url: absoluteUrl('/icon-512.png'),
			contentUrl: absoluteUrl('/icon-512.png'),
			width: 512,
			height: 512,
			caption: site.name
		},
		image: { '@id': LOGO_ID },
		sameAs: [`https://github.com/${site.repo}`]
	});
}

/** The site. No `SearchAction`: see the module header. */
export function websiteNode(): JsonLdNode {
	return {
		'@type': 'WebSite',
		'@id': WEBSITE_ID,
		url: `${site.url}/`,
		name: site.name,
		description: site.description,
		inLanguage: LANGUAGE,
		publisher: { '@id': ORGANIZATION_ID }
	};
}

/** `BreadcrumbList` for a trail, with the home page prepended. */
export function breadcrumbNode(trail: Breadcrumb[], pageUrl: string): JsonLdNode {
	const crumbs: Breadcrumb[] = [{ name: 'Home', path: '/' }, ...trail];
	return {
		'@type': 'BreadcrumbList',
		'@id': `${pageUrl}#breadcrumb`,
		itemListElement: crumbs.map((crumb, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: crumb.name,
			item: absoluteUrl(crumb.path)
		}))
	};
}

/** `ItemList` for a listing page, in render order. */
export function itemListNode(items: ListEntry[], pageUrl: string): JsonLdNode {
	return {
		'@type': 'ItemList',
		'@id': `${pageUrl}#itemlist`,
		numberOfItems: items.length,
		itemListElement: items.map((entry, index) =>
			compact({
				'@type': 'ListItem',
				position: index + 1,
				name: entry.name,
				description: entry.description,
				url: absoluteUrl(entry.url)
			})
		)
	};
}

const SCHEMA = 'https://schema.org/';

const AVAILABILITY: Record<NonNullable<ProductInput['availability']>, string> = {
	in_stock: 'InStock',
	out_of_stock: 'OutOfStock',
	preorder: 'PreOrder',
	backorder: 'BackOrder'
};

const CONDITION: Record<NonNullable<ProductInput['condition']>, string> = {
	new: 'NewCondition',
	refurbished: 'RefurbishedCondition',
	used: 'UsedCondition'
};

/** Decimal string of the major unit from whole cents, with integer maths only. */
function decimal(cents: number): string {
	const whole = Math.floor(cents / 100);
	return `${whole}.${String(cents - whole * 100).padStart(2, '0')}`;
}

function days(
	min: number | null | undefined,
	max: number | null | undefined
): JsonLdNode | undefined {
	const lo = min ?? max;
	const hi = max ?? min;
	if (lo == null || hi == null) return undefined;
	return { '@type': 'QuantitativeValue', minValue: lo, maxValue: hi, unitCode: 'DAY' };
}

/**
 * One `OfferShippingDetails` per destination. Google requires `deliveryTime`,
 * so a destination with no handling or transit time set emits nothing rather
 * than a half-valid node. `currency` is the offer's, as Google requires.
 */
export function shippingDetailsNodes(shipping: ShippingInput[], currency: string): JsonLdNode[] {
	const nodes: JsonLdNode[] = [];
	for (const line of shipping) {
		const handlingTime = days(line.handlingDaysMin, line.handlingDaysMax);
		const transitTime = days(line.transitDaysMin, line.transitDaysMax);
		if (!handlingTime && !transitTime) continue;
		nodes.push({
			'@type': 'OfferShippingDetails',
			shippingRate: {
				'@type': 'MonetaryAmount',
				value: decimal(line.priceCents),
				currency: currency.toUpperCase()
			},
			shippingDestination: { '@type': 'DefinedRegion', addressCountry: line.country },
			deliveryTime: compact({ '@type': 'ShippingDeliveryTime', handlingTime, transitTime })
		});
	}
	return nodes;
}

const RETURN_CATEGORY = {
	finite: 'MerchantReturnFiniteReturnWindow',
	none: 'MerchantReturnNotPermitted',
	unlimited: 'MerchantReturnUnlimitedWindow'
} as const;
const RETURN_FEES = {
	free: 'FreeReturn',
	customer: 'ReturnFeesCustomerResponsibility',
	shipping_fee: 'ReturnShippingFees'
} as const;
const RETURN_METHOD = {
	mail: 'ReturnByMail',
	kiosk: 'ReturnAtKiosk',
	store: 'ReturnInStore'
} as const;

/** `MerchantReturnPolicy`, or undefined when the owner stated none or it has no country. */
export function returnPolicyNode(
	policy: ReturnPolicyInput | null | undefined,
	currency: string
): JsonLdNode | undefined {
	if (!policy || policy.countries.length === 0) return undefined;
	if (policy.category === 'finite' && policy.days == null) return undefined;
	const fees = policy.category === 'none' ? undefined : RETURN_FEES[policy.fees];
	return compact({
		'@type': 'MerchantReturnPolicy',
		applicableCountry: policy.countries,
		returnPolicyCategory: `${SCHEMA}${RETURN_CATEGORY[policy.category]}`,
		merchantReturnDays: policy.category === 'finite' ? (policy.days ?? undefined) : undefined,
		returnFees: fees ? `${SCHEMA}${fees}` : undefined,
		returnMethod: policy.methods?.length
			? policy.methods.map((m) => `${SCHEMA}${RETURN_METHOD[m]}`)
			: undefined,
		returnShippingFeesAmount:
			policy.fees === 'shipping_fee' && policy.shippingFeeCents && policy.category !== 'none'
				? {
						'@type': 'MonetaryAmount',
						value: decimal(policy.shippingFeeCents),
						currency: currency.toUpperCase()
					}
				: undefined
	});
}

/**
 * `Product` with a single `Offer`. The price is a decimal string of the major
 * unit, matching how `formatMoney` renders it. `availability` is the owner's
 * (or InStock: the shop keeps no stock count). Everything optional is left
 * out when it is not known: an empty claim is worse than none.
 */
export function productNode(product: ProductInput, pageUrl: string, imageId?: string): JsonLdNode {
	const currency = product.currency.toUpperCase();
	const onSale = product.listPriceCents != null && product.listPriceCents > product.priceCents;
	const shippingDetails = product.shipping?.length
		? shippingDetailsNodes(product.shipping, currency)
		: [];
	const returnPolicy = returnPolicyNode(product.returnPolicy, currency);
	const images = product.images?.filter(Boolean) ?? [];
	const gtin = product.gtin && /^\d{8}$|^\d{12,14}$/.test(product.gtin) ? product.gtin : undefined;
	return compact({
		'@type': 'Product',
		'@id': `${pageUrl}#product`,
		name: product.name,
		description: product.description,
		sku: product.sku,
		mpn: product.mpn,
		[gtin ? `gtin${gtin.length}` : 'gtin']: gtin,
		image: images.length ? images : imageId ? { '@id': imageId } : undefined,
		brand: product.brand ? { '@type': 'Brand', name: product.brand } : { '@id': ORGANIZATION_ID },
		category: product.category,
		color: product.color,
		size: product.size,
		material: product.material,
		inProductGroupWithID: product.itemGroupId,
		audience: product.gender
			? { '@type': 'PeopleAudience', suggestedGender: product.gender }
			: undefined,
		hasAdultConsideration: product.adult ? `${SCHEMA}AdultConsideration` : undefined,
		aggregateRating:
			product.aggregateRating && product.aggregateRating.reviewCount > 0
				? {
						'@type': 'AggregateRating',
						ratingValue: product.aggregateRating.ratingValue,
						reviewCount: product.aggregateRating.reviewCount
					}
				: undefined,
		offers: compact({
			'@type': 'Offer',
			'@id': `${pageUrl}#offer`,
			url: pageUrl,
			price: decimal(product.priceCents),
			priceCurrency: currency,
			priceValidUntil: product.priceValidUntil || undefined,
			availability: `${SCHEMA}${AVAILABILITY[product.availability ?? 'in_stock']}`,
			itemCondition: `${SCHEMA}${CONDITION[product.condition ?? 'new']}`,
			priceSpecification: onSale
				? {
						'@type': 'UnitPriceSpecification',
						priceType: `${SCHEMA}StrikethroughPrice`,
						price: decimal(product.listPriceCents as number),
						priceCurrency: currency
					}
				: undefined,
			seller: { '@id': ORGANIZATION_ID },
			shippingDetails: shippingDetails.length ? shippingDetails : undefined,
			hasMerchantReturnPolicy: returnPolicy
		})
	});
}

/**
 * Build the whole graph for one page.
 *
 * Always: the Organization, the WebSite, and this page. Then a
 * `BreadcrumbList`, an `ItemList`, an `Article` or a `Product` when the page
 * has them.
 */
export function buildPageGraph(input: PageGraphInput): JsonLdGraph {
	const path = input.path || '/';
	const pageUrl = absoluteUrl(path);
	const pageId = `${pageUrl}#webpage`;
	const isHome = path === '/';
	const image = input.image ? absoluteUrl(input.image) : '';
	const imageId = image ? `${pageUrl}#primaryimage` : '';

	const graph: JsonLdNode[] = [organizationNode(), websiteNode()];

	if (image) {
		graph.push(
			compact({
				'@type': 'ImageObject',
				'@id': imageId,
				url: image,
				contentUrl: image,
				width: input.imageWidth || undefined,
				height: input.imageHeight || undefined,
				caption: input.imageAlt || input.title
			})
		);
	}

	const hasBreadcrumb = Boolean(input.breadcrumb?.length) || !isHome;
	const hasItems = Boolean(input.items?.length);
	graph.push(
		compact({
			'@type': input.product ? 'ItemPage' : input.pageType || 'WebPage',
			'@id': pageId,
			url: pageUrl,
			name: input.title,
			description: input.description,
			isPartOf: { '@id': WEBSITE_ID },
			inLanguage: LANGUAGE,
			// The home page is about the organisation; a sub-page is not.
			about: isHome ? { '@id': ORGANIZATION_ID } : undefined,
			primaryImageOfPage: imageId ? { '@id': imageId } : undefined,
			breadcrumb: hasBreadcrumb ? { '@id': `${pageUrl}#breadcrumb` } : undefined,
			mainEntity: hasItems
				? { '@id': `${pageUrl}#itemlist` }
				: input.product
					? { '@id': `${pageUrl}#product` }
					: undefined,
			datePublished: input.article?.datePublished,
			dateModified: input.article?.dateModified || input.article?.datePublished
		})
	);

	if (hasBreadcrumb) graph.push(breadcrumbNode(input.breadcrumb ?? [], pageUrl));
	if (hasItems) graph.push(itemListNode(input.items ?? [], pageUrl));
	if (input.product) graph.push(productNode(input.product, pageUrl, imageId || undefined));

	if (input.article) {
		graph.push(
			compact({
				'@type': input.article.type || 'Article',
				'@id': `${pageUrl}#article`,
				isPartOf: { '@id': pageId },
				mainEntityOfPage: { '@id': pageId },
				headline: input.title,
				description: input.description,
				image: imageId ? { '@id': imageId } : undefined,
				datePublished: input.article.datePublished,
				dateModified: input.article.dateModified || input.article.datePublished,
				author: input.article.author
					? { '@type': 'Person', name: input.article.author }
					: { '@id': ORGANIZATION_ID },
				publisher: { '@id': ORGANIZATION_ID },
				keywords: input.article.keywords?.length ? input.article.keywords.join(', ') : undefined,
				articleSection: input.article.section,
				inLanguage: LANGUAGE
			})
		);
	}

	return { '@context': 'https://schema.org', '@graph': graph };
}

/**
 * Escape a JSON payload for embedding in an inline `<script>`.
 *
 * The graph carries CMS titles and descriptions and reaches the page through
 * `{@html}`, so `</script>` in an item title would otherwise close the element.
 * JSON's `\uXXXX` escapes are decoded by the JSON parser, not the HTML
 * tokeniser, so the payload stays identical while becoming inert. U+2028/2029
 * are legal in JSON strings but break some JavaScript consumers.
 */
export function escapeJsonLd(json: string): string {
	return json
		.replace(/</g, '\\u003c')
		.replace(/>/g, '\\u003e')
		.replace(/&/g, '\\u0026')
		.replace(/\u2028/g, '\\u2028')
		.replace(/\u2029/g, '\\u2029');
}

/** The full `<script type="application/ld+json">` element for a graph. */
export function jsonLdScript(graph: JsonLdGraph | null): string {
	if (!graph) return '';
	return `<script type="application/ld+json">${escapeJsonLd(JSON.stringify(graph))}</script>`;
}

/** What `SharingMeta` knows about a page, before any page-specific extras. */
export type SharingGraphInput = {
	path: string;
	title: string;
	description?: string;
	image?: string;
	imageAlt?: string;
	imageWidth?: number;
	imageHeight?: number;
	type?: 'website' | 'article' | 'profile';
	publishedTime?: string;
	modifiedTime?: string;
	author?: string;
	noindex?: boolean;
	/** Extras a page passes through: breadcrumb, items, product, article tweaks. */
	extra?: Partial<Omit<PageGraphInput, 'path' | 'title'>> | null;
};

/**
 * The graph `SharingMeta` renders, or `null` when it should render none.
 * A `noindex` page gets no graph (describing a page crawlers are told to skip
 * is noise), and `extra: null` is an explicit opt-out.
 */
export function sharingGraph(input: SharingGraphInput): JsonLdGraph | null {
	if (input.noindex || input.extra === null) return null;
	const extra = input.extra ?? {};
	const article =
		extra.article ??
		(input.type === 'article'
			? {
					datePublished: input.publishedTime || undefined,
					dateModified: input.modifiedTime || undefined,
					author: input.author || undefined
				}
			: undefined);
	return buildPageGraph({
		path: input.path,
		title: input.title,
		description: input.description || undefined,
		image: input.image || undefined,
		imageAlt: input.imageAlt || undefined,
		imageWidth: input.imageWidth || undefined,
		imageHeight: input.imageHeight || undefined,
		...extra,
		article
	});
}
