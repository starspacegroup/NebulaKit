import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
	EMPTY_GOOGLE,
	buildListing,
	decimalPrice,
	escapeXml,
	feedEffectiveCents,
	googleLength,
	googlePrice,
	gtinCheckDigit,
	gtinProperty,
	hasHtml,
	httpsUrl,
	isIso4217,
	isSaleActive,
	isValidGtin,
	parseIso,
	parseListingSettings,
	priceNow,
	renderRssItem,
	renderTsvRow,
	shippingLines,
	siteProblems,
	sortProblems,
	stripXmlIllegal,
	toMerchantApiAttributes,
	tsvCell,
	validateGoogleInput,
	validateListingSettings,
	validateProductInput,
	TSV_COLUMNS,
	type GoogleAttributes,
	type GoogleListingSettings,
	type ListingContext,
	type Product
} from '@nebulakit/commerce';

const NOW = Date.parse('2026-11-25T12:00:00Z');

function product(patch: Partial<Product> = {}, google: Partial<GoogleAttributes> = {}): Product {
	return {
		id: 'p1',
		slug: 'blue-mug',
		name: 'Blue mug',
		description: 'Holds coffee.',
		priceCents: 1299,
		currency: 'usd',
		imageUrl: 'https://cdn.example.com/mug.jpg',
		type: 'physical',
		printfulVariantId: null,
		active: true,
		google: { ...EMPTY_GOOGLE, brand: 'Acme', gtin: '036000291452', ...google },
		createdAt: '',
		updatedAt: '',
		...patch
	};
}

const settings = (patch: Partial<GoogleListingSettings> = {}): GoogleListingSettings => ({
	...parseListingSettings(null),
	...patch
});

const ctx = (patch: Partial<GoogleListingSettings> = {}): ListingContext => ({
	siteUrl: 'https://shop.example.com',
	nowMs: NOW,
	settings: settings({ shipCountries: ['US'], ...patch }),
	flatShippingCents: 500
});

const problemsOf = (p: Product, c = ctx()) =>
	buildListing(p, c).problems.map((x) => `${x.severity}:${x.attribute}`);

describe('GTIN check digit', () => {
	it.each(['036000291452', '4006381333931', '96385074', '00012345678905', '9780306406157'])(
		'accepts the real GTIN %s',
		(gtin) => expect(isValidGtin(gtin)).toBe(true)
	);

	it.each([
		'036000291453',
		'4006381333932',
		'123',
		'1234567',
		'123456789',
		'12345678901234567',
		'abcdefgh',
		'0360002914 2',
		''
	])('rejects %j', (gtin) => expect(isValidGtin(gtin)).toBe(false));

	it('rejects non strings', () => {
		for (const v of [null, undefined, 36000291452, {}, ['036000291452']]) {
			expect(isValidGtin(v)).toBe(false);
		}
	});

	const digits = (n: number) => fc.stringMatching(new RegExp(`^[0-9]{${n}}$`));

	it('property: a body plus its computed check digit is always valid (8, 12, 13, 14)', () => {
		for (const length of [7, 11, 12, 13]) {
			fc.assert(
				fc.property(digits(length), (body) => isValidGtin(body + gtinCheckDigit(body))),
				{ numRuns: 200 }
			);
		}
	});

	it('property: changing any single digit of a valid GTIN makes it invalid', () => {
		fc.assert(
			fc.property(
				digits(12),
				fc.nat({ max: 12 }),
				fc.integer({ min: 1, max: 9 }),
				(body, index, delta) => {
					const gtin = body + gtinCheckDigit(body);
					const changed =
						gtin.slice(0, index) + ((Number(gtin[index]) + delta) % 10) + gtin.slice(index + 1);
					return changed !== gtin && !isValidGtin(changed);
				}
			),
			{ numRuns: 300 }
		);
	});

	it('property: swapping two adjacent different digits is caught unless the weights hide it', () => {
		// mod 10 with weights 3,1 catches every adjacent swap whose digits differ by other than 5
		fc.assert(
			fc.property(digits(12), fc.nat({ max: 10 }), (body, i) => {
				const gtin = body + gtinCheckDigit(body);
				const a = Number(gtin[i]);
				const b = Number(gtin[i + 1]);
				fc.pre(Math.abs(a - b) !== 5 && a !== b);
				const swapped = gtin.slice(0, i) + gtin[i + 1] + gtin[i] + gtin.slice(i + 2);
				return !isValidGtin(swapped);
			}),
			{ numRuns: 300 }
		);
	});

	it('names the schema.org property by length', () => {
		expect(gtinProperty('96385074')).toBe('gtin8');
		expect(gtinProperty('036000291452')).toBe('gtin12');
		expect(gtinProperty('4006381333931')).toBe('gtin13');
		expect(gtinProperty('00012345678905')).toBe('gtin14');
	});
});

describe('primitive validators', () => {
	it('knows ISO 4217 codes in any case and nothing else', () => {
		expect(isIso4217('usd')).toBe(true);
		expect(isIso4217('EUR')).toBe(true);
		for (const bad of ['usdd', 'US', 'XXX1', '', null, 12]) expect(isIso4217(bad)).toBe(false);
	});

	it('property: a code is accepted only when it is three letters', () => {
		fc.assert(fc.property(fc.string(), (code) => !isIso4217(code) || /^[a-zA-Z]{3}$/.test(code)));
	});

	it('only absolute https URLs pass', () => {
		expect(httpsUrl('https://a.example/x.png')).toBe('https://a.example/x.png');
		for (const bad of [
			'http://a.example/x.png',
			'/x.png',
			'javascript:alert(1)',
			'',
			'https://',
			null
		])
			expect(httpsUrl(bad)).toBeNull();
		expect(httpsUrl(`https://a.example/${'x'.repeat(2100)}`)).toBeNull();
	});

	it('detects markup, not plain angle brackets', () => {
		for (const html of [
			'<b>x</b>',
			'a <br/> b',
			'<!-- c -->',
			'<![CDATA[x]]>',
			'<a href="x">y</a>'
		])
			expect(hasHtml(html)).toBe(true);
		for (const plain of ['5 < 6 and 7 > 3', 'Tom & Jerry', 'a<3', ''])
			expect(hasHtml(plain)).toBe(false);
	});

	it('parses ISO dates and instants, and refuses impossible ones', () => {
		expect(parseIso('2026-12-01')).toBe(Date.parse('2026-12-01T00:00:00Z'));
		expect(parseIso('2026-12-01T10:30:00Z')).toBe(Date.parse('2026-12-01T10:30:00Z'));
		expect(parseIso('2026-12-01T10:30:00+02:00')).toBe(Date.parse('2026-12-01T08:30:00Z'));
		for (const bad of ['2026-02-30', '2026-12-01T10:30:00', 'tomorrow', '', '2026-13-01'])
			expect(Number.isNaN(parseIso(bad))).toBe(true);
	});

	it('prices are integer decimals', () => {
		expect(decimalPrice(5)).toBe('0.05');
		expect(decimalPrice(1299)).toBe('12.99');
		expect(decimalPrice(100000)).toBe('1000.00');
		expect(googlePrice(1299, 'usd')).toBe('12.99 USD');
		fc.assert(
			fc.property(fc.integer({ min: 0, max: 99_999_999 }), (cents) => {
				const [whole, frac] = decimalPrice(cents).split('.');
				return frac.length === 2 && Number(whole) * 100 + Number(frac) === cents;
			})
		);
	});

	it('lengths are centimetres with one decimal', () => {
		expect(googleLength(125)).toBe('12.5 cm');
		expect(googleLength(120)).toBe('12 cm');
		expect(googleLength(10)).toBe('1 cm');
	});
});

describe('XML and TSV escaping', () => {
	const unescape = (s: string) =>
		s
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&apos;/g, "'")
			.replace(/&amp;/g, '&');

	it('property: escaped text has no raw markup characters and round-trips', () => {
		fc.assert(
			fc.property(fc.string({ unit: 'binary' }), (text) => {
				const out = escapeXml(text);
				return (
					!/[<>"']/.test(out) &&
					!/&(?!amp;|lt;|gt;|quot;|apos;)/.test(out) &&
					unescape(out) === stripXmlIllegal(text)
				);
			}),
			{ numRuns: 500 }
		);
	});

	it('property: nothing XML 1.0 forbids survives', () => {
		fc.assert(
			fc.property(fc.string({ unit: 'binary' }), (text) => {
				const out = escapeXml(text);
				// eslint-disable-next-line no-control-regex
				return (
					!/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/.test(out) &&
					!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(out)
				);
			}),
			{ numRuns: 500 }
		);
	});

	it('keeps emoji, right-to-left text and combining marks', () => {
		const text = 'Mug ☕ \u{1F600} שלום مرحبا é';
		expect(escapeXml(text)).toBe(text);
	});

	it('neutralises a CDATA terminator and a comment closer', () => {
		expect(escapeXml(']]> --> <![CDATA[')).toBe(']]&gt; --&gt; &lt;![CDATA[');
	});

	it('property: a TSV cell never holds a tab, a line break or a control character', () => {
		fc.assert(
			fc.property(
				fc.string({ unit: 'binary' }),
				(text) => !/[\t\r\n\u0000-\u001F\u007F\u2028\u2029]/.test(tsvCell(text))
			),
			{ numRuns: 500 }
		);
	});
});

describe('write validation', () => {
	it('accepts a complete, valid set', () => {
		const result = validateGoogleInput({
			brand: 'Acme',
			gtin: '036000291452',
			mpn: 'AC-100',
			condition: 'refurbished',
			availability: 'preorder',
			availabilityDate: '2026-12-20',
			salePriceCents: 900,
			saleStartsAt: '2026-12-01T00:00:00Z',
			saleEndsAt: '2026-12-31T00:00:00Z',
			additionalImages: ['https://a.example/1.jpg'],
			gender: 'female',
			ageGroup: 'adult',
			identifierExists: false,
			weightGrams: 300,
			lengthMm: 125,
			adult: false,
			customLabel0: 'summer'
		});
		expect(result).toMatchObject({ ok: true });
	});

	it.each([
		[{ gtin: '036000291453' }, /gtin/],
		[{ condition: 'broken' }, /condition/],
		[{ gender: 'x' }, /gender/],
		[{ ageGroup: 'old' }, /ageGroup/],
		[{ availability: 'soon' }, /availability/],
		[{ salePriceCents: -1 }, /salePriceCents/],
		[{ salePriceCents: 1.5 }, /salePriceCents/],
		[{ weightGrams: 0 }, /weightGrams/],
		[{ lengthMm: 5 }, /lengthMm/],
		[{ lengthMm: 40000 }, /lengthMm/],
		[{ brand: 'x'.repeat(71) }, /brand/],
		[{ customLabel2: 'x'.repeat(101) }, /customLabel2/],
		[{ mpn: '<script>' }, /mpn/],
		[{ itemGroupId: 'has space' }, /itemGroupId/],
		[{ additionalImages: Array(11).fill('https://a.example/x.jpg') }, /additionalImages/],
		[{ additionalImages: ['http://a.example/x.jpg'] }, /additionalImages/],
		[{ saleStartsAt: '2026-12-31T00:00:00Z', saleEndsAt: '2026-12-01T00:00:00Z' }, /before/],
		[{ saleStartsAt: 'soon', saleEndsAt: 'later' }, /ISO 8601/],
		[{ googleProductCategory: 'a > > b >' }, /googleProductCategory/],
		[{ adult: 'yes' }, /adult/],
		[{ identifierExists: 'no' }, /identifierExists/]
	])('rejects %j', (body, message) => {
		const result = validateGoogleInput(body);
		expect(result.ok).toBe(false);
		expect((result as { errors: string[] }).errors.join()).toMatch(message);
	});

	it('a sale window needs both ends, judged on a full write; a lone half in a PATCH is judged later', () => {
		const half = { saleStartsAt: '2026-12-01T00:00:00Z' };
		expect(validateGoogleInput(half, false)).toMatchObject({ ok: false });
		expect(validateGoogleInput(half, true)).toMatchObject({ ok: true });
		// the listing itself still refuses a half window, wherever it came from
		expect(buildListing(product({}, { salePriceCents: 900, ...half }), ctx()).item).toBeNull();
	});

	it('refuses a body that is not an object', () => {
		for (const bad of [null, 'x', [], 3])
			expect(validateGoogleInput(bad)).toMatchObject({ ok: false });
	});

	it('empty strings clear a field', () => {
		expect(validateGoogleInput({ brand: '', gtin: '', saleStartsAt: '', saleEndsAt: '' })).toEqual({
			ok: true,
			value: { brand: null, gtin: null, saleStartsAt: null, saleEndsAt: null }
		});
	});

	it('property: any string that is not a valid GTIN is refused', () => {
		fc.assert(
			fc.property(fc.string(), (gtin) => {
				const r = validateGoogleInput({ gtin });
				return gtin === '' ? r.ok : r.ok === isValidGtin(gtin);
			}),
			{ numRuns: 300 }
		);
	});

	it('product validation carries the google block', () => {
		const ok = validateProductInput({
			slug: 'a',
			name: 'A',
			priceCents: 1,
			google: { brand: 'B' }
		});
		expect(ok).toMatchObject({ ok: true, value: { google: { brand: 'B' } } });
		const bad = validateProductInput({
			slug: 'a',
			name: 'A',
			priceCents: 1,
			google: { gtin: '1' }
		});
		expect(bad).toMatchObject({ ok: false });
		expect((bad as { errors: string[] }).errors[0]).toMatch(/^google: gtin/);
	});
});

describe('buildListing', () => {
	it('builds a complete item for a well-formed product', () => {
		const { item, problems } = buildListing(product(), ctx());
		expect(item).toMatchObject({
			id: 'p1',
			title: 'Blue mug',
			link: 'https://shop.example.com/shop/blue-mug',
			imageLink: 'https://cdn.example.com/mug.jpg',
			availability: 'in_stock',
			condition: 'new',
			currency: 'USD',
			priceCents: 1299,
			brand: 'Acme',
			gtin: '036000291452'
		});
		expect(item?.shipping).toEqual([expect.objectContaining({ country: 'US', priceCents: 500 })]);
		expect(problems.filter((p) => p.severity === 'error')).toEqual([]);
	});

	it('makes a root-relative image absolute against the canonical host', () => {
		const { item } = buildListing(product({ imageUrl: '/media/mug.jpg' }), ctx());
		expect(item?.imageLink).toBe('https://shop.example.com/media/mug.jpg');
	});

	it.each([
		['no image', { imageUrl: null }, 'error:image_link'],
		['http image', { imageUrl: 'http://x.example/a.png' }, 'error:image_link'],
		['empty name', { name: '  ' }, 'error:title'],
		['long name', { name: 'x'.repeat(151) }, 'error:title'],
		['html name', { name: '<b>Mug</b>' }, 'error:title'],
		['empty description', { description: '' }, 'error:description'],
		['long description', { description: 'x'.repeat(5001) }, 'error:description'],
		['html description', { description: 'Great <br> mug' }, 'error:description'],
		['zero price', { priceCents: 0 }, 'error:price'],
		['bad currency', { currency: 'dollars' }, 'error:price'],
		['long id', { id: 'x'.repeat(51) }, 'error:id']
	] as const)('refuses a product with %s', (_name, patch, expected) => {
		const { item, problems } = buildListing(product(patch as Partial<Product>), ctx());
		expect(item).toBeNull();
		expect(problems.map((p) => `${p.severity}:${p.attribute}`)).toContain(expected);
	});

	it('accepts a title of exactly 150 characters and a description of exactly 5000', () => {
		const { item } = buildListing(
			product({ name: 'x'.repeat(150), description: 'y'.repeat(5000) }),
			ctx()
		);
		expect(item).not.toBeNull();
	});

	it('requires a brand for new products unless there are no identifiers', () => {
		expect(buildListing(product({}, { brand: null }), ctx()).item).toBeNull();
		expect(
			buildListing(product({}, { brand: null }), ctx({ defaultBrand: 'House' })).item?.brand
		).toBe('House');
		expect(
			buildListing(product({}, { brand: null, identifierExists: false, gtin: null }), ctx()).item
		).not.toBeNull();
		expect(
			buildListing(product({}, { brand: null, condition: 'used' }), ctx()).item
		).not.toBeNull();
	});

	it('refuses a wrong GTIN rather than sending a guess', () => {
		const r = buildListing(product({}, { gtin: '036000291453' }), ctx());
		expect(r.item).toBeNull();
		expect(r.problems.map((p) => p.attribute)).toContain('gtin');
	});

	it('warns, but still lists, a product with no identifiers', () => {
		const r = buildListing(product({}, { gtin: null, mpn: null }), ctx());
		expect(r.item).not.toBeNull();
		expect(r.problems.map((p) => `${p.severity}:${p.attribute}`)).toContain('warning:gtin');
	});

	it('requires apparel attributes for an apparel category', () => {
		const r = buildListing(
			product({}, { googleProductCategory: 'Apparel & Accessories > Clothing' }),
			ctx()
		);
		expect(r.item).toBeNull();
		expect(
			r.problems
				.filter((p) => p.severity === 'error')
				.map((p) => p.attribute)
				.sort()
		).toEqual(['age_group', 'color', 'gender', 'size']);
		const full = buildListing(
			product(
				{},
				{
					googleProductCategory: '1604',
					color: 'Red',
					size: 'M',
					gender: 'female',
					ageGroup: 'adult'
				}
			),
			ctx()
		);
		expect(full.item).not.toBeNull();
	});

	it('checks the sale', () => {
		const sale = (g: Partial<GoogleAttributes>) => buildListing(product({}, g), ctx());
		expect(sale({ salePriceCents: 1299 }).item).toBeNull();
		expect(sale({ salePriceCents: 2000 }).item).toBeNull();
		expect(sale({ salePriceCents: 900 }).item?.salePriceCents).toBe(900);
		expect(
			sale({
				salePriceCents: 900,
				saleStartsAt: '2026-12-01T00:00:00Z',
				saleEndsAt: '2026-11-01T00:00:00Z'
			}).item
		).toBeNull();
		expect(sale({ salePriceCents: 900, saleStartsAt: '2026-12-01T00:00:00Z' }).item).toBeNull();
		const ended = sale({
			salePriceCents: 900,
			saleStartsAt: '2026-10-01T00:00:00Z',
			saleEndsAt: '2026-11-01T00:00:00Z'
		});
		expect(ended.item).not.toBeNull();
		expect(ended.problems.map((p) => p.severity)).toContain('warning');
	});

	it('needs an availability date for a preorder, within a year', () => {
		const pre = (date: string | null) =>
			buildListing(product({}, { availability: 'preorder', availabilityDate: date }), ctx());
		expect(pre(null).item).toBeNull();
		expect(pre('2026-01-01').item).toBeNull();
		expect(pre('2028-01-01').item).toBeNull();
		expect(pre('2026-12-20').item?.availabilityDate).toBe('2026-12-20');
		// a plain in-stock product never carries a stale date
		expect(
			buildListing(product({}, { availabilityDate: '2026-12-20' }), ctx()).item?.availabilityDate
		).toBeNull();
	});

	it('limits additional images to ten https addresses', () => {
		const imgs = (list: string[]) => buildListing(product({}, { additionalImages: list }), ctx());
		expect(
			imgs(Array.from({ length: 10 }, (_, i) => `https://a.example/${i}.jpg`)).item
		).not.toBeNull();
		expect(
			imgs(Array.from({ length: 11 }, (_, i) => `https://a.example/${i}.jpg`)).item
		).toBeNull();
		expect(imgs(['http://a.example/1.jpg']).item).toBeNull();
		expect(imgs(['/media/x.jpg']).item?.additionalImageLinks).toEqual([
			'https://shop.example.com/media/x.jpg'
		]);
	});

	it('leaves excluded products out silently', () => {
		expect(buildListing(product({}, { excluded: true }), ctx())).toEqual({
			item: null,
			problems: []
		});
	});

	it('gives physical products shipping lines and digital ones none', () => {
		const c = ctx({ shipCountries: ['US', 'CA'], handlingDaysMin: 1, handlingDaysMax: 2 });
		expect(buildListing(product(), c).item?.shipping.map((s) => s.country)).toEqual(['US', 'CA']);
		expect(buildListing(product({ type: 'digital' }), c).item?.shipping).toEqual([]);
		expect(shippingLines({ type: 'physical' }, settings(), 0)).toEqual([]);
	});

	it('warns when a physical product has no weight or ship-to country', () => {
		const r = buildListing(product(), ctx({ shipCountries: [] }));
		expect(r.problems.map((p) => p.attribute)).toEqual(
			expect.arrayContaining(['shipping', 'shipping_weight'])
		);
	});

	it('property: whatever the text, a built item never carries a character XML forbids', () => {
		fc.assert(
			fc.property(
				fc.string({ unit: 'binary', maxLength: 140 }),
				fc.string({ unit: 'binary', maxLength: 400 }),
				(name, description) => {
					const { item } = buildListing(product({ name, description }), ctx());
					if (!item) return true;
					const xml = renderRssItem(item);
					// eslint-disable-next-line no-control-regex
					return !/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/.test(xml);
				}
			),
			{ numRuns: 300 }
		);
	});
});

describe('site level problems', () => {
	const c = (countries: string[]) => ({
		settings: settings({ shipCountries: countries }),
		flatShippingCents: 0
	});
	const tax = (pricesIncludeTax: boolean) => ({ enabled: true, ratePercent: 8, pricesIncludeTax });

	it('rejects tax-inclusive prices for US shipping and tax-exclusive prices elsewhere', () => {
		expect(
			siteProblems(c(['US']), tax(true), 'https://a.example').map((p) => p.severity)
		).toContain('error');
		expect(
			siteProblems(c(['DE']), tax(false), 'https://a.example').map((p) => p.severity)
		).toContain('error');
		expect(siteProblems(c(['DE']), tax(true), 'https://a.example')).toEqual([]);
		expect(siteProblems(c(['US']), tax(false), 'https://a.example')[0].severity).toBe('warning');
	});

	it('warns about a site that is not https, and sorts errors first', () => {
		const out = siteProblems(
			c([]),
			{ enabled: false, ratePercent: 0, pricesIncludeTax: false },
			'http://a.example'
		);
		expect(out).toHaveLength(1);
		expect(
			sortProblems([
				{ severity: 'warning', attribute: 'a', message: '' },
				{ severity: 'error', attribute: 'b', message: '' }
			])[0].severity
		).toBe('error');
	});
});

describe('settings', () => {
	it('reads garbage as the defaults, never throwing', () => {
		for (const raw of [null, undefined, 'nope', '[]', 42, '{"shipCountries":"US"}']) {
			expect(parseListingSettings(raw).shipCountries).toEqual([]);
		}
		expect(
			parseListingSettings('{"shipCountries":["US","us","USA","CA","US"]}').shipCountries
		).toEqual(['US', 'CA']);
	});

	it('validates the admin form strictly', () => {
		expect(
			validateListingSettings({
				defaultBrand: 'Acme',
				contentLanguage: 'en',
				shipCountries: ['US'],
				handlingDaysMin: 1,
				handlingDaysMax: 2,
				transitDaysMin: 2,
				transitDaysMax: 5,
				returns: { category: 'finite', days: 30, fees: 'free', methods: ['mail'], countries: [] }
			})
		).toMatchObject({ ok: true });
		for (const body of [
			{ shipCountries: ['USA'] },
			{ contentLanguage: 'english' },
			{ handlingDaysMin: 5, handlingDaysMax: 1 },
			{ transitDaysMin: -1 },
			{ returns: { category: 'finite', fees: 'free' } },
			{ returns: { category: 'sometimes' } },
			{ returns: { category: 'finite', days: 30, fees: 'shipping_fee' } },
			'x'
		]) {
			expect(validateListingSettings(body)).toMatchObject({ ok: false });
		}
	});
});

describe('prices', () => {
	const on = product(
		{},
		{
			salePriceCents: 900,
			saleStartsAt: '2026-11-01T00:00:00Z',
			saleEndsAt: '2026-12-01T00:00:00Z'
		}
	);

	it('uses the sale price only inside its window', () => {
		expect(priceNow(on, NOW)).toMatchObject({
			priceCents: 900,
			listPriceCents: 1299,
			onSale: true
		});
		expect(priceNow(on, Date.parse('2026-10-31T23:59:59Z')).priceCents).toBe(1299);
		expect(priceNow(on, Date.parse('2026-12-01T00:00:00Z')).priceCents).toBe(1299);
		expect(isSaleActive(on, NOW)).toBe(true);
	});

	it('ignores a sale price that is not lower, and a product without google data', () => {
		expect(priceNow(product({}, { salePriceCents: 1299 }), NOW).onSale).toBe(false);
		expect(priceNow({ priceCents: 5 } as Product, NOW).priceCents).toBe(5);
	});

	it('property: the price paid is never above the regular price', () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 1, max: 100000 }),
				fc.option(fc.integer({ min: 0, max: 120000 }), { nil: null }),
				fc.integer({ min: Date.parse('2026-01-01'), max: Date.parse('2027-01-01') }),
				(price, sale, now) => {
					const p = product({ priceCents: price }, { salePriceCents: sale });
					return priceNow(p, now).priceCents <= price;
				}
			)
		);
	});

	it("property: the feed's effective price at any time equals the page's price", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 100, max: 100000 }),
				fc.integer({ min: 1, max: 99 }),
				fc.integer({ min: Date.parse('2026-10-01'), max: Date.parse('2027-02-01') }),
				(price, percent, now) => {
					const p = product(
						{ priceCents: price },
						{
							salePriceCents: Math.max(1, Math.floor((price * percent) / 100)),
							saleStartsAt: '2026-11-01T00:00:00Z',
							saleEndsAt: '2026-12-15T00:00:00Z'
						}
					);
					const { item } = buildListing(p, { ...ctx(), nowMs: now });
					return item !== null && feedEffectiveCents(item, now) === priceNow(p, now).priceCents;
				}
			),
			{ numRuns: 300 }
		);
	});
});

describe('renderers', () => {
	const item = buildListing(
		product(
			{},
			{
				salePriceCents: 900,
				saleStartsAt: '2026-11-01T00:00:00Z',
				saleEndsAt: '2026-12-01T00:00:00Z',
				additionalImages: ['https://a.example/2.jpg'],
				weightGrams: 300,
				lengthMm: 125,
				customLabel1: 'winter',
				adult: true,
				identifierExists: true
			}
		),
		ctx({ handlingDaysMin: 0, handlingDaysMax: 1, transitDaysMin: 2, transitDaysMax: 5 })
	).item!;

	it('writes the RSS attributes in the g: namespace', () => {
		const xml = renderRssItem(item);
		for (const expected of [
			'<g:id>p1</g:id>',
			'<g:price>12.99 USD</g:price>',
			'<g:sale_price>9.00 USD</g:sale_price>',
			'<g:sale_price_effective_date>2026-11-01T00:00:00Z/2026-12-01T00:00:00Z</g:sale_price_effective_date>',
			'<g:availability>in_stock</g:availability>',
			'<g:condition>new</g:condition>',
			'<g:gtin>036000291452</g:gtin>',
			'<g:additional_image_link>https://a.example/2.jpg</g:additional_image_link>',
			'<g:shipping_weight>300 g</g:shipping_weight>',
			'<g:product_length>12.5 cm</g:product_length>',
			'<g:custom_label_1>winter</g:custom_label_1>',
			'<g:adult>yes</g:adult>',
			'<g:identifier_exists>yes</g:identifier_exists>',
			'<g:country>US</g:country>',
			'<g:min_transit_time>2</g:min_transit_time>'
		])
			expect(xml).toContain(expected);
	});

	it('writes a TSV row with one cell per column and no stray separators', () => {
		const row = renderTsvRow(item).replace(/\n$/, '').split('\t');
		expect(row).toHaveLength(TSV_COLUMNS.length);
		expect(row[TSV_COLUMNS.indexOf('price')]).toBe('12.99 USD');
		expect(row[TSV_COLUMNS.indexOf('shipping')]).toBe('US::Standard:5.00 USD');
	});

	it('builds Merchant API attributes with micros and upper-case enums', () => {
		const attrs = toMerchantApiAttributes(item) as Record<string, any>;
		expect(attrs.price).toEqual({ amountMicros: '12990000', currencyCode: 'USD' });
		expect(attrs.salePrice.amountMicros).toBe('9000000');
		expect(attrs.availability).toBe('IN_STOCK');
		expect(attrs.condition).toBe('NEW');
		expect(attrs.gtins).toEqual(['036000291452']);
		expect(attrs.productLength).toEqual({ value: 12.5, unit: 'cm' });
		expect(attrs.customLabel1).toBe('winter');
		expect(attrs).not.toHaveProperty('gender');
	});
});
