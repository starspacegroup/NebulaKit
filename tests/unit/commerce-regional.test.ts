import { describe, expect, it } from 'vitest';
import {
	appliesToProduct,
	countryMultiplier,
	DEFAULT_REGIONAL_PRICING,
	normalizeCountry,
	orderMultiplier,
	overrideLines,
	parseOverrideLines,
	parseRegionalPricing,
	PRICE_LEVEL_INDEX,
	previewMultiplier,
	priceCart,
	priceLevel,
	regionalNotice,
	regionalPriceCents,
	REGIONAL_PRICE_FLOOR_CENTS,
	validateQuoteInput,
	validateRegionalPricingInput,
	type Product,
	type RegionalPricingSettings
} from '@nebulakit/commerce';

const on = (patch: Partial<RegionalPricingSettings> = {}): RegionalPricingSettings => ({
	...DEFAULT_REGIONAL_PRICING,
	overrides: {},
	enabled: true,
	...patch
});

describe('the price level table', () => {
	it('is static data with a plausible range for every row', () => {
		const rows = Object.entries(PRICE_LEVEL_INDEX);
		expect(rows.length).toBeGreaterThan(150);
		for (const [code, [ratio, year]] of rows) {
			expect(code).toMatch(/^[A-Z]{2}$/);
			expect(ratio).toBeGreaterThanOrEqual(0.08);
			expect(ratio).toBeLessThanOrEqual(2);
			expect(year).toBeGreaterThan(2015);
		}
		expect(PRICE_LEVEL_INDEX.US[0]).toBe(1); // the base itself
	});
	it('looks countries up case-insensitively and returns null without data', () => {
		expect(priceLevel('in')).toBe(PRICE_LEVEL_INDEX.IN[0]);
		expect(priceLevel('ZZ')).toBeNull();
		expect(priceLevel(undefined)).toBeNull();
		expect(priceLevel('XX')).toBeNull();
	});
});

describe('normalizeCountry', () => {
	it.each([
		['in', 'IN'],
		[' de ', 'DE'],
		['XX', null],
		['T1', null],
		['USA', null],
		['1', null],
		['', null],
		[undefined, null],
		[5, null]
	])('%j -> %j', (input, expected) => {
		expect(normalizeCountry(input)).toBe(expected);
	});
});

describe('country multiplier', () => {
	it('is exactly 1 when disabled, whatever the other settings say', () => {
		const off = { ...on({ strength: 1, maxDiscount: 0.9 }), enabled: false };
		expect(countryMultiplier(off, 'IN')).toBe(1);
		expect(previewMultiplier(off, 'IN').source).toBe('disabled');
		expect(countryMultiplier(DEFAULT_REGIONAL_PRICING, 'IN')).toBe(1);
	});

	it('passes on `strength` of the gap, in steps of 5%, capped by maxDiscount', () => {
		// IN is at ~0.2-0.3 of US prices; at full strength that is a huge discount, capped.
		const full = on({ strength: 1, maxDiscount: 0.5 });
		expect(countryMultiplier(full, 'IN')).toBe(0.5);
		const half = on({ strength: 0.5, maxDiscount: 0.9 });
		const m = countryMultiplier(half, 'IN');
		expect(m).toBeGreaterThan(0.5);
		expect(m).toBeLessThan(1);
		expect(Math.round(m * 100) % 5).toBe(0);
		expect(countryMultiplier(on({ strength: 0, maxDiscount: 0.9 }), 'IN')).toBe(1);
	});

	it('NEVER raises a price: expensive countries, unknown countries and junk all pay base', () => {
		const settings = on({ strength: 1, maxDiscount: 0.9 });
		for (const country of ['CH', 'BM', 'ZZ', 'XX', null, undefined, '', 'nope', 12]) {
			expect(countryMultiplier(settings, country)).toBe(1);
		}
		// Across every country, every strength and every cap, the multiplier stays in (0, 1].
		for (const code of Object.keys(PRICE_LEVEL_INDEX)) {
			for (const strength of [0, 0.3, 1]) {
				for (const maxDiscount of [0, 0.25, 0.9]) {
					const m = countryMultiplier(on({ strength, maxDiscount }), code);
					expect(m).toBeLessThanOrEqual(1);
					expect(m).toBeGreaterThanOrEqual(1 - maxDiscount - 1e-9);
				}
			}
		}
	});

	it('honors a cap that is not a multiple of the step', () => {
		expect(countryMultiplier(on({ strength: 1, maxDiscount: 0.33 }), 'IN')).toBe(0.67);
	});

	it('lets an override win over the index but not over the cap', () => {
		const settings = on({ maxDiscount: 0.3, overrides: { IN: 0.6, DE: 0.9, CH: 1, FR: 0.1 } });
		expect(countryMultiplier(settings, 'IN')).toBe(0.7); // 0.6 is below the 0.7 floor
		expect(countryMultiplier(settings, 'DE')).toBe(0.9); // an override can lower a rich country
		expect(countryMultiplier(settings, 'CH')).toBe(1); // 1 pins full price
		expect(countryMultiplier(settings, 'FR')).toBe(0.7);
		expect(previewMultiplier(settings, 'DE')).toMatchObject({
			source: 'override',
			discountPercent: 10
		});
	});

	it('describes where the number came from', () => {
		const settings = on();
		expect(previewMultiplier(settings, 'in')).toMatchObject({ country: 'IN', source: 'index' });
		expect(previewMultiplier(settings, 'CH').source).toBe('none');
		expect(previewMultiplier(settings, null)).toMatchObject({ country: null, source: 'none' });
	});
});

describe('order multiplier', () => {
	const settings = on({ strength: 1, maxDiscount: 0.6 });

	it('takes the LEAST generous country: a VPN into a cheap country alone buys nothing', () => {
		const cheap = countryMultiplier(settings, 'IN');
		expect(cheap).toBeLessThan(1);
		expect(orderMultiplier(settings, ['IN', 'US'])).toBe(1);
		expect(orderMultiplier(settings, ['US', 'IN', 'IN'])).toBe(1);
		expect(orderMultiplier(settings, ['IN', 'IN'])).toBe(cheap);
		const mid = countryMultiplier(settings, 'MX');
		expect(orderMultiplier(settings, ['IN', 'MX', 'IN'])).toBe(Math.max(cheap, mid));
	});

	it('counts a source that cannot be placed as full price', () => {
		expect(orderMultiplier(settings, ['IN', null])).toBe(1);
		expect(orderMultiplier(settings, ['IN', 'XX'])).toBe(1);
	});

	it('leaves out a source that does not apply (undefined)', () => {
		expect(orderMultiplier(settings, ['IN', undefined])).toBe(countryMultiplier(settings, 'IN'));
		expect(orderMultiplier(settings, [])).toBe(1);
		expect(orderMultiplier(settings, [undefined])).toBe(1);
	});

	it('is 1 when disabled', () => {
		expect(orderMultiplier({ ...settings, enabled: false }, ['IN'])).toBe(1);
	});
});

describe('scope', () => {
	it('covers digital products by default and physical ones only on request', () => {
		expect(appliesToProduct(on(), 'digital')).toBe(true);
		expect(appliesToProduct(on(), 'physical')).toBe(false);
		expect(appliesToProduct(on({ scope: 'all' }), 'physical')).toBe(true);
		expect(appliesToProduct({ ...on({ scope: 'all' }), enabled: false }, 'digital')).toBe(false);
	});
});

describe('regionalPriceCents', () => {
	it('rounds half up in whole cents, deterministically', () => {
		expect(regionalPriceCents(1000, 0.35)).toBe(350);
		expect(regionalPriceCents(10, 0.35)).toBe(10); // under the floor: left at its own price
		expect(regionalPriceCents(1999, 0.35)).toBe(700); // 699.65
		expect(regionalPriceCents(1001, 0.5)).toBe(501); // 500.5 rounds up
		expect(regionalPriceCents(1999, 0.35)).toBe(regionalPriceCents(1999, 0.35));
	});

	it('never goes below the floor, and never raises a cheap product to it', () => {
		expect(regionalPriceCents(100, 0.1)).toBe(REGIONAL_PRICE_FLOOR_CENTS);
		expect(regionalPriceCents(60, 0.5)).toBe(REGIONAL_PRICE_FLOOR_CENTS);
		expect(regionalPriceCents(30, 0.5)).toBe(30); // cheaper than the floor: left alone
		expect(regionalPriceCents(0, 0.5)).toBe(0); // free stays free
		expect(regionalPriceCents(100, 0.1, 10)).toBe(10); // a custom floor
	});

	it('ignores multipliers that would raise or are not usable', () => {
		for (const m of [1, 1.5, 0, -1, NaN, Infinity, 0.004]) {
			expect(regionalPriceCents(2500, m)).toBe(2500);
		}
	});

	it('never exceeds the base price for any base and multiplier', () => {
		for (const base of [0, 1, 49, 50, 51, 99, 1000, 123457]) {
			for (let pct = 0; pct <= 120; pct += 3) {
				const price = regionalPriceCents(base, pct / 100);
				expect(price).toBeLessThanOrEqual(base);
				expect(Number.isInteger(price)).toBe(true);
			}
		}
	});
});

describe('settings parsing and validation', () => {
	it('parse repairs stored junk and never throws', () => {
		expect(parseRegionalPricing(null)).toEqual({ ...DEFAULT_REGIONAL_PRICING, overrides: {} });
		expect(parseRegionalPricing('x')).toMatchObject({ enabled: false });
		expect(
			parseRegionalPricing({
				enabled: 'yes',
				strength: 9,
				maxDiscount: 5,
				scope: 'nope',
				overrides: { in: 0.6, IN2: 0.5, DE: 'x', FR: 0.05, ES: 2, XX: 0.5, BR: 0.456, UK: NaN }
			})
		).toEqual({
			enabled: false,
			strength: 1,
			maxDiscount: 0.9,
			scope: 'digital',
			overrides: { IN: 0.6, BR: 0.46 }
		});
		expect(parseRegionalPricing({ overrides: [1] }).overrides).toEqual({});
		expect(parseRegionalPricing({ strength: 'x' }).strength).toBe(0.5);
		expect(parseRegionalPricing({ enabled: true, scope: 'all' })).toMatchObject({
			enabled: true,
			scope: 'all'
		});
	});

	it('caps the number of overrides', () => {
		const many: Record<string, number> = {};
		for (const a of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') for (const b of 'ABCDEFGHIJ') many[a + b] = 0.5;
		expect(
			Object.keys(parseRegionalPricing({ overrides: many }).overrides).length
		).toBeLessThanOrEqual(250);
		const refused = validateRegionalPricingInput({ overrides: many });
		expect(refused).toMatchObject({ ok: false });
	});

	it('validate refuses bad values instead of clamping them', () => {
		const result = validateRegionalPricingInput({
			enabled: 'yes',
			strength: 2,
			maxDiscount: 0.95,
			scope: 'some',
			overrides: { IN: 0.05, xyz: 0.5, DE: 'a' }
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors).toEqual(
				expect.arrayContaining([
					'enabled must be true or false',
					'strength must be a number from 0 to 1',
					'maxDiscount must be a number from 0 to 0.9',
					'scope must be "digital" or "all"',
					'overrides.IN must be a number from 0.1 to 1',
					'overrides: "xyz" is not a country code',
					'overrides.DE must be a number from 0.1 to 1'
				])
			);
		}
		expect(validateRegionalPricingInput(null)).toMatchObject({ ok: false });
		expect(validateRegionalPricingInput([])).toMatchObject({ ok: false });
		expect(validateRegionalPricingInput({ overrides: [] })).toMatchObject({ ok: false });
	});

	it('validate merges a partial body over the current settings', () => {
		const current = on({ strength: 0.7, overrides: { IN: 0.6 } });
		const result = validateRegionalPricingInput({ maxDiscount: 0.4 }, current);
		expect(result).toEqual({ ok: true, value: { ...current, maxDiscount: 0.4 } });
		const full = validateRegionalPricingInput({
			enabled: true,
			strength: 0.25,
			maxDiscount: 0.6,
			scope: 'all',
			overrides: { in: 0.555 }
		});
		expect(full).toEqual({
			ok: true,
			value: {
				enabled: true,
				strength: 0.25,
				maxDiscount: 0.6,
				scope: 'all',
				overrides: { IN: 0.56 }
			}
		});
		// merging must not mutate what it was given
		expect(current.overrides).toEqual({ IN: 0.6 });
	});
});

describe('override lines (the admin form)', () => {
	it('parses "CC percent-off" lines', () => {
		expect(parseOverrideLines('IN 40\n# a comment\n\nbr: 25%  # inline\nCH 0\nde=10.4')).toEqual({
			overrides: { IN: 0.6, BR: 0.75, CH: 1, DE: 0.9 },
			errors: []
		});
	});
	it('reports bad lines instead of dropping them', () => {
		const { overrides, errors } = parseOverrideLines('IN 40\nnonsense\nXX 10\nFR 95\nUS');
		expect(overrides).toEqual({ IN: 0.6 });
		expect(errors).toHaveLength(4);
	});
	it('round-trips', () => {
		const stored = { IN: 0.6, BR: 0.75, CH: 1 };
		expect(overrideLines(stored)).toBe('BR 25\nCH 0\nIN 40');
		expect(parseOverrideLines(overrideLines(stored)).overrides).toEqual(stored);
		expect(overrideLines({})).toBe('');
	});
});

describe('notice', () => {
	it('says nothing when nothing was lowered, and says how much when it was', () => {
		expect(regionalNotice(0)).toBeNull();
		expect(regionalNotice(NaN)).toBeNull();
		expect(regionalNotice(30)).toBe(
			'Prices are 30% lower for your region, based on local purchasing power.'
		);
	});
});

describe('quote input', () => {
	it('needs lines and accepts an optional shipping country', () => {
		expect(validateQuoteInput({ lines: [{ productId: 'a', quantity: 1 }] })).toEqual({
			ok: true,
			value: { lines: [{ productId: 'a', quantity: 1 }] }
		});
		expect(
			validateQuoteInput({ lines: [{ productId: 'a', quantity: 1 }], shippingCountry: 'IN' })
		).toMatchObject({ ok: true, value: { shippingCountry: 'IN' } });
		expect(
			validateQuoteInput({ lines: [{ productId: 'a', quantity: 1 }], shippingCountry: null })
		).toMatchObject({ ok: true });
		for (const body of [
			null,
			{ lines: [] },
			{ lines: ['x'] },
			{ lines: [{ productId: 'a', quantity: 1 }], shippingCountry: 'india' }
		]) {
			expect(validateQuoteInput(body)).toMatchObject({ ok: false });
		}
	});
});

describe('priceCart with a regional multiplier', () => {
	const product = (id: string, type: Product['type'], priceCents: number): Product => ({
		id,
		slug: id,
		name: id,
		description: '',
		priceCents,
		currency: 'usd',
		imageUrl: null,
		type,
		printfulVariantId: null,
		active: true,
		createdAt: '',
		updatedAt: ''
	});
	const catalog: Record<string, Product> = {
		ebook: product('ebook', 'digital', 2000),
		tee: product('tee', 'physical', 3000)
	};
	const lookup = async (id: string) => catalog[id] ?? null;
	const lines = [
		{ productId: 'ebook', quantity: 2 },
		{ productId: 'tee', quantity: 1 }
	];

	it('with no multiplier is identical to today, and reports base == charged', async () => {
		const cart = await priceCart(lines, lookup);
		expect(cart.subtotalCents).toBe(7000);
		expect(cart.baseSubtotalCents).toBe(7000);
		expect(cart.lines.every((l) => l.unitPriceCents === l.baseUnitPriceCents)).toBe(true);
		const explicit = await priceCart(lines, lookup, {
			regionalMultiplier: 1,
			regionalScope: 'digital'
		});
		expect(explicit).toEqual(cart);
	});

	it('lowers only digital lines under the digital scope, all lines under all', async () => {
		const digital = await priceCart(lines, lookup, {
			regionalMultiplier: 0.5,
			regionalScope: 'digital'
		});
		expect(digital.lines.map((l) => l.unitPriceCents)).toEqual([1000, 3000]);
		expect(digital.subtotalCents).toBe(5000);
		expect(digital.baseSubtotalCents).toBe(7000);
		const all = await priceCart(lines, lookup, { regionalMultiplier: 0.5, regionalScope: 'all' });
		expect(all.subtotalCents).toBe(3500);
		expect((await priceCart(lines, lookup, { regionalMultiplier: 0.5 })).subtotalCents).toBe(3500);
	});

	it('taxes and totals work from the lowered subtotal', async () => {
		const cart = await priceCart(lines, lookup, {
			regionalMultiplier: 0.5,
			regionalScope: 'all',
			shippingCents: 500,
			taxRule: { enabled: true, ratePercent: 10, pricesIncludeTax: false }
		});
		expect(cart.taxCents).toBe(350);
		expect(cart.totalCents).toBe(3500 + 500 + 350);
	});

	it('never raises a price, whatever multiplier it is handed', async () => {
		for (const m of [1.5, 2, NaN, -3, 0]) {
			const cart = await priceCart(lines, lookup, { regionalMultiplier: m, regionalScope: 'all' });
			expect(cart.subtotalCents).toBe(7000);
		}
	});
});
