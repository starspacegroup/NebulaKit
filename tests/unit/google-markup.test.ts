import fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import {
	createProduct,
	formatMoney,
	getProduct,
	priceCart,
	saveGoogleListingSettings,
	type GoogleAttributes,
	type ProductInput
} from '@nebulakit/commerce';
import {
	buildPageGraph,
	escapeJsonLd,
	jsonLdScript,
	productNode,
	returnPolicyNode,
	shippingDetailsNodes,
	type JsonLdNode
} from '../../src/lib/seo/structured-data';
import { productPageModel } from '../../src/lib/shop/listing';
import { load } from '../../src/routes/shop/[slug]/+page.server';
import { feedStream, listingContext } from '../../src/lib/server/google-feed';
import { site } from '../../src/lib/site.config';
import { createSqliteD1 } from '../helpers/sqlite-d1';

const MIGRATIONS = [
	'0016_commerce.sql',
	'0022_commerce_settings.sql',
	'0026_commerce_auctions.sql',
	'0027_commerce_auction_deadlines.sql',
	'0037_google_listings.sql'
];
let db: D1Database;
beforeEach(() => {
	db = createSqliteD1(MIGRATIONS);
});

const graphOf = (extra: Record<string, unknown>) =>
	buildPageGraph({
		path: '/shop/mug',
		title: 'Mug',
		image: '/mug.png',
		product: { name: 'Mug', sku: 'p1', priceCents: 1999, currency: 'usd', ...extra }
	});
const nodes = (graph: { '@graph': JsonLdNode[] }, type: string) =>
	graph['@graph'].filter((n) => n['@type'] === type);

describe('Product JSON-LD', () => {
	const full = {
		images: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
		brand: 'Acme',
		gtin: '036000291452',
		mpn: 'AC-1',
		condition: 'refurbished' as const,
		availability: 'preorder' as const,
		color: 'Blue',
		size: 'M',
		material: 'Ceramic',
		gender: 'unisex' as const,
		itemGroupId: 'mug-group',
		category: '1604',
		shipping: [
			{
				country: 'US',
				priceCents: 599,
				handlingDaysMin: 0,
				handlingDaysMax: 1,
				transitDaysMin: 2,
				transitDaysMax: 5
			}
		],
		returnPolicy: {
			category: 'finite' as const,
			days: 30,
			fees: 'shipping_fee' as const,
			shippingFeeCents: 500,
			methods: ['mail' as const],
			countries: ['US']
		}
	};

	it('carries what Google reads for a merchant listing', () => {
		const product = nodes(graphOf(full), 'Product')[0] as Record<string, any>;
		expect(product).toMatchObject({
			name: 'Mug',
			sku: 'p1',
			mpn: 'AC-1',
			gtin12: '036000291452',
			image: full.images,
			brand: { '@type': 'Brand', name: 'Acme' },
			color: 'Blue',
			size: 'M',
			material: 'Ceramic',
			inProductGroupWithID: 'mug-group',
			category: '1604',
			audience: { '@type': 'PeopleAudience', suggestedGender: 'unisex' }
		});
		expect(product.offers).toMatchObject({
			'@type': 'Offer',
			price: '19.99',
			priceCurrency: 'USD',
			availability: 'https://schema.org/PreOrder',
			itemCondition: 'https://schema.org/RefurbishedCondition',
			seller: { '@id': `${site.url}/#organization` }
		});
		expect(product.offers.shippingDetails).toEqual([
			{
				'@type': 'OfferShippingDetails',
				shippingRate: { '@type': 'MonetaryAmount', value: '5.99', currency: 'USD' },
				shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'US' },
				deliveryTime: {
					'@type': 'ShippingDeliveryTime',
					handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
					transitTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 5, unitCode: 'DAY' }
				}
			}
		]);
		expect(product.offers.hasMerchantReturnPolicy).toEqual({
			'@type': 'MerchantReturnPolicy',
			applicableCountry: ['US'],
			returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
			merchantReturnDays: 30,
			returnFees: 'https://schema.org/ReturnShippingFees',
			returnMethod: ['https://schema.org/ReturnByMail'],
			returnShippingFeesAmount: { '@type': 'MonetaryAmount', value: '5.00', currency: 'USD' }
		});
	});

	it('keeps a single Organization and a single WebSite, and one Product', () => {
		const graph = graphOf(full);
		expect(nodes(graph, 'Organization')).toHaveLength(1);
		expect(nodes(graph, 'WebSite')).toHaveLength(1);
		expect(nodes(graph, 'Product')).toHaveLength(1);
		expect(nodes(graph, 'Brand')).toHaveLength(0);
		const ids = graph['@graph'].map((n) => n['@id']).filter(Boolean);
		expect(new Set(ids).size).toBe(ids.length);
		// the product's seller and the page both point at the one Organization
		expect(JSON.stringify(graph).match(/"@type":"Organization"/g)).toHaveLength(1);
	});

	it('falls back to the organisation as brand and to the page image when none is given', () => {
		const product = nodes(graphOf({}), 'Product')[0];
		expect(product.brand).toEqual({ '@id': `${site.url}/#organization` });
		expect(product.image).toEqual({ '@id': `${site.url}/shop/mug#primaryimage` });
	});

	it('shows a sale as the real price with the regular one struck through', () => {
		const offer = nodes(
			graphOf({ priceCents: 900, listPriceCents: 1999, priceValidUntil: '2026-12-01T00:00:00Z' }),
			'Product'
		)[0].offers as Record<string, any>;
		expect(offer.price).toBe('9.00');
		expect(offer.priceValidUntil).toBe('2026-12-01T00:00:00Z');
		expect(offer.priceSpecification).toEqual({
			'@type': 'UnitPriceSpecification',
			priceType: 'https://schema.org/StrikethroughPrice',
			price: '19.99',
			priceCurrency: 'USD'
		});
	});

	it('says nothing about a sale that is not on, and claims no validity date', () => {
		const offer = nodes(graphOf({ listPriceCents: null }), 'Product')[0].offers as Record<
			string,
			unknown
		>;
		expect(offer).not.toHaveProperty('priceSpecification');
		expect(offer).not.toHaveProperty('priceValidUntil');
	});

	it('emits ratings only when there are real reviews', () => {
		const rated = nodes(
			graphOf({ aggregateRating: { ratingValue: 4.5, reviewCount: 12 } }),
			'Product'
		)[0];
		expect(rated.aggregateRating).toEqual({
			'@type': 'AggregateRating',
			ratingValue: 4.5,
			reviewCount: 12
		});
		for (const none of [null, undefined, { ratingValue: 5, reviewCount: 0 }]) {
			expect(nodes(graphOf({ aggregateRating: none }), 'Product')[0]).not.toHaveProperty(
				'aggregateRating'
			);
		}
		expect(JSON.stringify(graphOf({}))).not.toContain('"review"');
	});

	it('omits shipping with no delivery time, and a return policy with no country or window', () => {
		expect(shippingDetailsNodes([{ country: 'US', priceCents: 0 }], 'usd')).toEqual([]);
		expect(
			shippingDetailsNodes([{ country: 'US', priceCents: 0, transitDaysMin: 2 }], 'usd')
		).toHaveLength(1);
		expect(returnPolicyNode(null, 'usd')).toBeUndefined();
		expect(
			returnPolicyNode({ category: 'finite', days: 30, fees: 'free', countries: [] }, 'usd')
		).toBeUndefined();
		expect(
			returnPolicyNode({ category: 'finite', fees: 'free', countries: ['US'] }, 'usd')
		).toBeUndefined();
		expect(
			returnPolicyNode({ category: 'none', fees: 'free', countries: ['US'] }, 'usd')
		).toMatchObject({
			returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted'
		});
		expect(
			returnPolicyNode({ category: 'none', fees: 'free', countries: ['US'] }, 'usd')
		).not.toHaveProperty('returnFees');
		expect(
			returnPolicyNode({ category: 'unlimited', fees: 'free', countries: ['CA'] }, 'usd')
		).toMatchObject({
			returnPolicyCategory: 'https://schema.org/MerchantReturnUnlimitedWindow',
			returnFees: 'https://schema.org/FreeReturn'
		});
	});

	it('writes a GTIN only under the right schema.org property, and drops a malformed one', () => {
		for (const [gtin, key] of [
			['96385074', 'gtin8'],
			['4006381333931', 'gtin13'],
			['00012345678905', 'gtin14']
		]) {
			const product = productNode({ name: 'x', priceCents: 1, currency: 'usd', gtin }, 'u');
			expect(product[key]).toBe(gtin);
		}
		const bad = productNode({ name: 'x', priceCents: 1, currency: 'usd', gtin: '12-34' }, 'u');
		expect(Object.keys(bad).some((k) => k.startsWith('gtin'))).toBe(false);
	});
});

describe('hostile product text', () => {
	const hostile = [
		'</script><script>alert(1)</script>',
		'<!-- <script> -->',
		'a & b < c > d',
		'line\u2028sep\u2029',
		'"quote" \\ backslash \u0000 nul',
		'emoji \u{1F600} ‮rlo שלום',
		']]></script>'
	];

	it.each(hostile)('cannot close the script element or escape the JSON: %j', (text) => {
		const graph = buildPageGraph({
			path: '/shop/x',
			title: text,
			description: text,
			product: {
				name: text,
				description: text,
				priceCents: 100,
				currency: 'usd',
				brand: text,
				mpn: text,
				color: text,
				images: ['https://cdn.example.com/a.jpg?x=' + encodeURIComponent(text)]
			}
		});
		const script = jsonLdScript(graph);
		const inner = script.slice('<script type="application/ld+json">'.length, -'</script>'.length);
		expect(inner).not.toMatch(/[<>&\u2028\u2029]/);
		expect(script.match(/<\/script>/g)).toHaveLength(1);
		expect(JSON.parse(inner)).toEqual(JSON.parse(JSON.stringify(graph)));
	});

	it('property: any text survives the round trip and never leaks a markup character', () => {
		fc.assert(
			fc.property(fc.string({ unit: 'binary' }), (text) => {
				const node = productNode(
					{ name: text, description: text, priceCents: 1, currency: 'usd' },
					'u'
				);
				const escaped = escapeJsonLd(JSON.stringify(node));
				return (
					!/[<>&\u2028\u2029]/.test(escaped) &&
					JSON.parse(escaped).name === (text === '' ? undefined : text)
				);
			}),
			{ numRuns: 300 }
		);
	});
});

async function add(
	slug: string,
	patch: Partial<ProductInput> = {},
	google: Partial<GoogleAttributes> = {}
) {
	return createProduct(db, {
		slug,
		name: `Product ${slug}`,
		description: 'About it.',
		priceCents: 2000,
		imageUrl: 'https://cdn.example.com/a.jpg',
		google: { brand: 'Acme', gtin: '036000291452', ...google },
		...patch
	});
}

const SALE = {
	salePriceCents: 1500,
	saleStartsAt: '2000-01-01T00:00:00Z',
	saleEndsAt: '2999-01-01T00:00:00Z'
};

/** The price on the page, in the markup, in the feed, and charged at checkout, for one product. */
async function pricesOf(slug: string) {
	const data = (await load({ params: { slug }, platform: { env: { DB: db } } } as never)) as {
		product: ReturnType<typeof productPageModel>;
	};
	const graph = buildPageGraph({
		path: `/shop/${slug}`,
		title: data.product.name,
		product: data.product.structured
	});
	const offer = nodes(graph, 'Product')[0].offers as { price: string; priceCurrency: string };
	const ctx = await listingContext(db, {}, Date.now());
	const xml = await new Response(feedStream('rss', db, ctx)).text();
	const feed = new RegExp(
		`/shop/${slug}<[\\s\\S]*?<g:price>([^<]+)</g:price>(?:\\s*<g:sale_price>([^<]+)</g:sale_price>)?`
	).exec(xml);
	const product = (await getProduct(db, slug))!;
	const cart = await priceCart([{ productId: product.id, quantity: 1 }], (id) =>
		getProduct(db, id)
	);
	return { data, offer, feed, cart };
}

describe('the price is one number (page, markup, feed, checkout)', () => {
	it('agrees for a regular price', async () => {
		await add('plain');
		const { data, offer, feed, cart } = await pricesOf('plain');
		expect(data.product.price).toBe('$20.00');
		expect(offer).toEqual(expect.objectContaining({ price: '20.00', priceCurrency: 'USD' }));
		expect(feed?.[1]).toBe('20.00 USD');
		expect(feed?.[2]).toBeUndefined();
		expect(cart.lines[0].unitPriceCents).toBe(2000);
	});

	it('agrees during a sale: the page, the markup and checkout all take the sale price, and the feed states both', async () => {
		await add('sale', {}, SALE);
		const { data, offer, feed, cart } = await pricesOf('sale');
		expect(data.product.price).toBe('$15.00');
		expect(data.product.listPrice).toBe('$20.00');
		expect(offer.price).toBe('15.00');
		expect(feed?.[1]).toBe('20.00 USD');
		expect(feed?.[2]).toBe('15.00 USD');
		expect(cart.lines[0].unitPriceCents).toBe(1500);
		expect(cart.subtotalCents).toBe(1500);
	});

	it('reverts everywhere once the sale has ended', async () => {
		await add('over', {}, { ...SALE, saleEndsAt: '2001-01-01T00:00:00Z' });
		const { data, offer, cart } = await pricesOf('over');
		expect(data.product.price).toBe('$20.00');
		expect(offer.price).toBe('20.00');
		expect(cart.lines[0].unitPriceCents).toBe(2000);
	});

	it('uses the catalog price in the product currency; regional pricing only changes the checkout', async () => {
		await add('eu', { currency: 'eur' });
		const { data, offer, feed, cart } = await pricesOf('eu');
		expect(offer.priceCurrency).toBe('EUR');
		expect(feed?.[1]).toBe('20.00 EUR');
		expect(data.product.price).toBe(formatMoney(2000, 'eur'));
		const product = (await getProduct(db, 'eu'))!;
		const regional = await priceCart(
			[{ productId: product.id, quantity: 1 }],
			(id) => getProduct(db, id),
			{
				regionalMultiplier: 0.7
			}
		);
		expect(regional.lines[0].unitPriceCents).toBe(1400);
		expect(regional.lines[0].baseUnitPriceCents).toBe(cart.lines[0].unitPriceCents);
	});

	it('property: for any price, sale and moment, page = markup = feed-effective = cart', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.integer({ min: 100, max: 500000 }),
				fc.integer({ min: 1, max: 99 }),
				fc.integer({ min: 0, max: 2 }),
				async (price, percent, phase) => {
					const local = createSqliteD1(MIGRATIONS);
					const sale = Math.max(1, Math.floor((price * percent) / 100));
					const window = [
						{ saleStartsAt: '2000-01-01T00:00:00Z', saleEndsAt: '2999-01-01T00:00:00Z' },
						{ saleStartsAt: '2000-01-01T00:00:00Z', saleEndsAt: '2001-01-01T00:00:00Z' },
						{ saleStartsAt: '2998-01-01T00:00:00Z', saleEndsAt: '2999-01-01T00:00:00Z' }
					][phase];
					const p = await createProduct(local, {
						slug: 's',
						name: 'S',
						description: 'd',
						priceCents: price,
						imageUrl: 'https://cdn.example.com/a.jpg',
						google: { brand: 'B', salePriceCents: sale, ...window }
					});
					const loaded = (await load({
						params: { slug: 's' },
						platform: { env: { DB: local } }
					} as never)) as {
						product: ReturnType<typeof productPageModel>;
					};
					const cart = await priceCart([{ productId: p.id, quantity: 1 }], (id) =>
						getProduct(local, id)
					);
					const expected = phase === 0 ? sale : price;
					const offer = nodes(
						buildPageGraph({ path: '/shop/s', title: 'S', product: loaded.product.structured }),
						'Product'
					)[0].offers as { price: string };
					return (
						loaded.product.priceCents === expected &&
						cart.lines[0].unitPriceCents === expected &&
						offer.price ===
							`${Math.floor(expected / 100)}.${String(expected % 100).padStart(2, '0')}` &&
						loaded.product.price === formatMoney(expected, 'usd')
					);
				}
			),
			{ numRuns: 40 }
		);
	});
});

describe('the product page load', () => {
	it('puts the site settings into the markup', async () => {
		await saveGoogleListingSettings(db, {
			defaultBrand: 'House',
			shipCountries: ['US'],
			handlingDaysMin: 0,
			handlingDaysMax: 1,
			transitDaysMin: 2,
			transitDaysMax: 5,
			returns: { category: 'finite', days: 14, fees: 'free', methods: ['mail'], countries: [] }
		});
		await add('settings', {}, { brand: null });
		const data = (await load({
			params: { slug: 'settings' },
			platform: { env: { DB: db, COMMERCE_FLAT_SHIPPING_CENTS: '799' } }
		} as never)) as { product: ReturnType<typeof productPageModel> };
		const product = nodes(
			buildPageGraph({ path: '/shop/settings', title: 'x', product: data.product.structured }),
			'Product'
		)[0] as Record<string, any>;
		expect(product.brand).toEqual({ '@type': 'Brand', name: 'House' });
		expect(product.offers.shippingDetails[0].shippingRate.value).toBe('7.99');
		expect(product.offers.hasMerchantReturnPolicy.applicableCountry).toEqual(['US']);
		expect(product.sku).toBe(data.product.id);
	});

	it('404s an archived product and an unknown one, and 503s without a database', async () => {
		await add('gone', { active: false });
		await expect(
			load({ params: { slug: 'gone' }, platform: { env: { DB: db } } } as never)
		).rejects.toMatchObject({ status: 404 });
		await expect(
			load({ params: { slug: 'nope' }, platform: { env: { DB: db } } } as never)
		).rejects.toMatchObject({ status: 404 });
		await expect(
			load({ params: { slug: 'x' }, platform: { env: {} } } as never)
		).rejects.toMatchObject({ status: 503 });
	});

	it('makes a root-relative image absolute for the markup', async () => {
		await add('rel', { imageUrl: '/media/a.jpg' });
		const data = (await load({
			params: { slug: 'rel' },
			platform: { env: { DB: db } }
		} as never)) as {
			product: ReturnType<typeof productPageModel>;
		};
		expect(data.product.structured.images).toEqual([`${site.url}/media/a.jpg`]);
	});
});
