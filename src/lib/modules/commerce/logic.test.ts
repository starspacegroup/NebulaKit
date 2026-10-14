import { describe, expect, it } from 'vitest';
import {
	SHIPPING_COUNTRIES,
	DEFAULT_ADDRESS_MESSAGES,
	EMPTY_SHIPPING_ADDRESS,
	addressRule,
	averageFromCounts,
	cardGroups,
	cardMaxLength,
	cartTotals,
	changeTone,
	changeTypesIn,
	checkCardNumber,
	checkCvc,
	checkExpiry,
	checkWaitlistEmail,
	componentTone,
	countdownParts,
	countdownSpoken,
	countdownText,
	cvcLength,
	dayLabel,
	daysUntilDate,
	detectCardBrand,
	cardDigits,
	expiryLabel,
	expiryState,
	filterReleases,
	findPromo,
	formatCardNumber,
	formatCommerceDate,
	formatExpiry,
	formatMoney,
	formatUsageAmount,
	galleryIndex,
	invoiceTone,
	invoiceTotals,
	isValidCheckoutEmail,
	lineTotal,
	luhnValid,
	maskedCard,
	usageOverage,
	overallStatus,
	paginateInvoices,
	parseExpiry,
	positionText,
	promoDiscount,
	ratingDistribution,
	ratingText,
	roundToHalf,
	shareLink,
	sortReleases,
	sortReviews,
	starFill,
	starFills,
	stepRating,
	stepState,
	subtotalOf,
	taxAmount,
	uptimeCounts,
	uptimePercent,
	usagePercent,
	usageState,
	validateAddress,
	versionSlug,
	worstStatus,
	type CardBrand,
	type Invoice,
	type Promo,
	type Release,
	type Review,
	type UptimeDay
} from './logic';

const NOW = new Date('2026-10-13T12:00:00Z');

describe('money', () => {
	it('formats minor units with Intl', () => {
		expect(formatMoney(1999)).toBe('$19.99');
		expect(formatMoney(1999, 'EUR', 'de-DE')).toBe('19,99 €');
		expect(formatMoney(500, 'JPY', 'en-US')).toBe('¥500');
		expect(formatMoney(0)).toBe('$0.00');
	});
	it('falls back for an unknown currency code', () => {
		expect(formatMoney(1234, 'not-a-currency')).toBe('12.34 not-a-currency');
	});
	it('totals lines', () => {
		expect(lineTotal({ unitCents: 250, quantity: 3 })).toBe(750);
		expect(lineTotal({ unitCents: -5, quantity: 3 })).toBe(0);
		expect(lineTotal({ unitCents: 100, quantity: -2 })).toBe(0);
		expect(lineTotal({ unitCents: 100.4, quantity: 2.9 })).toBe(200);
		expect(subtotalOf([])).toBe(0);
		expect(
			subtotalOf([
				{ unitCents: 100, quantity: 2 },
				{ unitCents: 50, quantity: 1 }
			])
		).toBe(250);
	});
	it('computes tax rounding half up', () => {
		expect(taxAmount(1000, 0.2)).toBe(200);
		expect(taxAmount(999, 0.0825)).toBe(82);
		expect(taxAmount(1000, 0)).toBe(0);
		expect(taxAmount(0, 0.2)).toBe(0);
		expect(taxAmount(-100, 0.2)).toBe(0);
		expect(taxAmount(100, Number.NaN)).toBe(0);
	});
});

describe('promos', () => {
	const promos: Promo[] = [
		{ code: 'TEN', kind: 'percent', value: 10 },
		{ code: 'FIVE', kind: 'fixed', value: 500, minSubtotalCents: 2000 },
		{ code: 'SHIPFREE', kind: 'shipping', minSubtotalCents: 3000 },
		{ code: 'OPENSHIP', kind: 'shipping' }
	];
	it('finds codes ignoring case and spaces', () => {
		expect(findPromo(' ten ', promos, 1000)).toEqual({ ok: true, promo: promos[0] });
	});
	it('rejects empty, unknown and under-minimum codes', () => {
		expect(findPromo('  ', promos, 1000)).toEqual({ ok: false, reason: 'empty' });
		expect(findPromo('nope', promos, 1000)).toEqual({ ok: false, reason: 'unknown' });
		expect(findPromo('five', promos, 1000)).toEqual({
			ok: false,
			reason: 'minimum',
			minSubtotalCents: 2000
		});
		expect(findPromo('five', promos, 2000).ok).toBe(true);
	});
	it('computes discounts', () => {
		expect(promoDiscount(1000, promos[0])).toBe(100);
		expect(promoDiscount(1000, { code: 'X', kind: 'percent', value: 150 })).toBe(1000);
		expect(promoDiscount(1000, { code: 'X', kind: 'percent', value: -5 })).toBe(0);
		expect(promoDiscount(3000, promos[1])).toBe(500);
		expect(promoDiscount(300, { code: 'X', kind: 'fixed', value: 500 })).toBe(300);
		expect(promoDiscount(1000, promos[1])).toBe(0);
		expect(promoDiscount(1000, promos[2])).toBe(0);
		expect(promoDiscount(1000, null)).toBe(0);
		expect(promoDiscount(1000, undefined)).toBe(0);
		expect(promoDiscount(1000, { code: 'X', kind: 'fixed', value: -3 })).toBe(0);
	});
});

describe('cartTotals', () => {
	const items = [{ unitCents: 1000, quantity: 2 }];
	it('adds shipping and tax on discounted goods', () => {
		expect(cartTotals(items, { taxRate: 0.1, shippingCents: 500 })).toEqual({
			subtotal: 2000,
			discount: 0,
			shipping: 500,
			tax: 200,
			total: 2700
		});
	});
	it('applies a percent promo before tax', () => {
		const t = cartTotals(items, {
			taxRate: 0.1,
			promo: { code: 'T', kind: 'percent', value: 50 }
		});
		expect(t).toMatchObject({ discount: 1000, tax: 100, total: 1100 });
	});
	it('can tax shipping', () => {
		const t = cartTotals(items, { taxRate: 0.1, shippingCents: 500, taxShipping: true });
		expect(t.tax).toBe(250);
	});
	it('zeroes shipping for a shipping promo, honouring its minimum', () => {
		const free = cartTotals(items, {
			shippingCents: 500,
			promo: { code: 'S', kind: 'shipping' }
		});
		expect(free.shipping).toBe(0);
		const gated = cartTotals(items, {
			shippingCents: 500,
			promo: { code: 'S', kind: 'shipping', minSubtotalCents: 9000 }
		});
		expect(gated.shipping).toBe(500);
		const met = cartTotals(items, {
			shippingCents: 500,
			promo: { code: 'S', kind: 'shipping', minSubtotalCents: 2000 }
		});
		expect(met.shipping).toBe(0);
	});
	it('charges nothing for an empty cart and defaults options', () => {
		expect(cartTotals([], { shippingCents: 500 })).toEqual({
			subtotal: 0,
			discount: 0,
			shipping: 0,
			tax: 0,
			total: 0
		});
		expect(cartTotals(items).total).toBe(2000);
		expect(cartTotals(items, { shippingCents: -5 }).shipping).toBe(0);
	});
});

describe('card brand', () => {
	const cases: [string, CardBrand][] = [
		['4242424242424242', 'visa'],
		['4', 'visa'],
		['378282246310005', 'amex'],
		['341111111111111', 'amex'],
		['5555555555554444', 'mastercard'],
		['2221000000000009', 'mastercard'],
		['2720990000000007', 'mastercard'],
		['6011111111111117', 'discover'],
		['6500000000000002', 'discover'],
		['6440000000000000', 'discover'],
		['6221260000000000', 'unionpay'],
		['6212345678901234', 'unionpay'],
		['30569309025904', 'diners'],
		['36227206271667', 'diners'],
		['3530111333300000', 'jcb'],
		['3528000000000000', 'jcb'],
		['', 'unknown'],
		['9', 'unknown']
	];
	it.each(cases)('detects %s as %s', (number, brand) => {
		expect(detectCardBrand(number)).toBe(brand);
	});
	it('ignores spaces', () => {
		expect(detectCardBrand('4242 4242')).toBe('visa');
	});
	it('has groups and lengths per brand', () => {
		expect(cardGroups('amex')).toEqual([4, 6, 5]);
		expect(cardGroups('diners')).toEqual([4, 6, 4]);
		expect(cardGroups('visa')).toEqual([4, 4, 4, 4, 3]);
		expect(cardMaxLength('amex')).toBe(15);
		expect(cardMaxLength('diners')).toBe(14);
		expect(cardMaxLength('unknown')).toBe(19);
		expect(cardMaxLength('visa')).toBe(16);
		expect(cvcLength('amex')).toBe(4);
		expect(cvcLength('visa')).toBe(3);
	});
	it('strips to digits', () => {
		expect(cardDigits('4242-4242 abc')).toBe('42424242');
	});
});

describe('formatCardNumber', () => {
	it('groups by brand', () => {
		expect(formatCardNumber('4242424242424242')).toBe('4242 4242 4242 4242');
		expect(formatCardNumber('378282246310005')).toBe('3782 822463 10005');
		expect(formatCardNumber('30569309025904')).toBe('3056 930902 5904');
		expect(formatCardNumber('4242')).toBe('4242');
		expect(formatCardNumber('42424')).toBe('4242 4');
		expect(formatCardNumber('')).toBe('');
	});
	it('caps the length', () => {
		expect(formatCardNumber('42424242424242429999')).toBe('4242 4242 4242 4242');
		expect(formatCardNumber('9'.repeat(25))).toBe('9999 9999 9999 9999 999');
	});
});

describe('luhn and card checks', () => {
	it('validates the checksum', () => {
		expect(luhnValid('4242424242424242')).toBe(true);
		expect(luhnValid('4242 4242 4242 4242')).toBe(true);
		expect(luhnValid('378282246310005')).toBe(true);
		expect(luhnValid('4242424242424241')).toBe(false);
		expect(luhnValid('0')).toBe(false);
		expect(luhnValid('')).toBe(false);
		expect(luhnValid('00')).toBe(true);
	});
	it('checks a whole number', () => {
		expect(checkCardNumber('')).toEqual({ ok: false, code: 'required' });
		expect(checkCardNumber('4242 4242')).toEqual({ ok: false, code: 'length' });
		expect(checkCardNumber('4242424242424241')).toEqual({ ok: false, code: 'luhn' });
		expect(checkCardNumber('4242 4242 4242 4242')).toEqual({ ok: true });
		expect(checkCardNumber('3782 822463 10005')).toEqual({ ok: true });
		expect(checkCardNumber('3782 822463 1000')).toEqual({ ok: false, code: 'length' });
		expect(checkCardNumber('9'.repeat(11))).toEqual({ ok: false, code: 'length' });
		expect(checkCardNumber('9'.repeat(12)).ok).toBe(false);
		expect(checkCardNumber('4222222222222')).toEqual({ ok: true });
	});
	it('checks the cvc against the brand', () => {
		expect(checkCvc('', 'visa')).toEqual({ ok: false, code: 'required' });
		expect(checkCvc('12', 'visa')).toEqual({ ok: false, code: 'length' });
		expect(checkCvc('123', 'visa')).toEqual({ ok: true });
		expect(checkCvc('123', 'amex')).toEqual({ ok: false, code: 'length' });
		expect(checkCvc('1234', 'amex')).toEqual({ ok: true });
		expect(checkCvc('12a', 'visa')).toEqual({ ok: false, code: 'length' });
	});
	it('masks', () => {
		expect(maskedCard('4242')).toBe('•••• 4242');
		expect(maskedCard('4242', 'visa')).toBe('Visa •••• 4242');
		expect(maskedCard('42', 'amex')).toBe('American Express •••• ••42');
		expect(maskedCard('1234567', undefined)).toBe('•••• 4567');
	});
});

describe('expiry', () => {
	it('formats while typing', () => {
		expect(formatExpiry('')).toBe('');
		expect(formatExpiry('1')).toBe('1');
		expect(formatExpiry('0')).toBe('0');
		expect(formatExpiry('2')).toBe('02/');
		expect(formatExpiry('12')).toBe('12/');
		expect(formatExpiry('122')).toBe('12/2');
		expect(formatExpiry('1226')).toBe('12/26');
		expect(formatExpiry('12/2699')).toBe('12/26');
		expect(formatExpiry('3')).toBe('03/');
		expect(formatExpiry('325')).toBe('03/25');
	});
	it('treats a replaced value as typing, not a backspace', () => {
		expect(formatExpiry('3', '12/28')).toBe('03/');
	});
	it('lets backspace remove the slash', () => {
		expect(formatExpiry('12', '12/')).toBe('12');
		expect(formatExpiry('12/', '12/2')).toBe('12/');
	});
	it('parses', () => {
		expect(parseExpiry('12/26')).toEqual({ month: 12, year: 2026 });
		expect(parseExpiry('1/2030')).toEqual({ month: 1, year: 2030 });
		expect(parseExpiry('0126')).toEqual({ month: 1, year: 2026 });
		expect(parseExpiry('13/26')).toBeNull();
		expect(parseExpiry('00/26')).toBeNull();
		expect(parseExpiry('ab')).toBeNull();
		expect(parseExpiry('12/2')).toBeNull();
	});
	it('works out state, valid through the month end', () => {
		expect(expiryState(9, 2026, NOW)).toBe('expired');
		expect(expiryState(10, 2026, NOW)).toBe('expiring');
		expect(expiryState(11, 2026, NOW)).toBe('expiring');
		expect(expiryState(12, 2026, NOW)).toBe('valid');
		expect(expiryState(1, 2025, NOW)).toBe('expired');
		expect(expiryState(12, 2026, NOW, 3)).toBe('expiring');
		expect(expiryState(12, 2030, NOW)).toBe('valid');
	});
	it('checks input', () => {
		expect(checkExpiry('', NOW)).toEqual({ ok: false, code: 'required' });
		expect(checkExpiry('99/99', NOW)).toEqual({ ok: false, code: 'format' });
		expect(checkExpiry('09/26', NOW)).toEqual({ ok: false, code: 'expired' });
		expect(checkExpiry('10/26', NOW)).toEqual({ ok: true });
		expect(checkExpiry('12/60', NOW)).toEqual({ ok: false, code: 'far' });
	});
	it('labels', () => {
		expect(expiryLabel(3, 2027)).toBe('03/27');
		expect(expiryLabel(12, 2105)).toBe('12/05');
	});
});

describe('addresses', () => {
	it('has rules per country', () => {
		const us = addressRule('us');
		expect(us.regionLabel).toBe('State');
		expect(us.regions.length).toBe(51);
		expect(us.postalLabel).toBe('ZIP code');
		expect(addressRule('CA').regionLabel).toBe('Province');
		expect(addressRule('GB').postalLabel).toBe('Postcode');
		expect(addressRule('DE').postalPattern?.test('10115')).toBe(true);
		expect(addressRule('FR').postalExample).toBe('75001');
		expect(addressRule('AU').regions).toHaveLength(8);
		expect(addressRule('IE').postalRequired).toBe(false);
		expect(addressRule('ZZ').postalRequired).toBe(false);
		expect(addressRule('ZZ').regions).toEqual([]);
		expect(SHIPPING_COUNTRIES.length).toBeGreaterThan(5);
	});
	const good = {
		name: 'Ada',
		line1: '1 Main St',
		line2: '',
		city: 'Lewiston',
		region: 'ME',
		postal: '04240',
		country: 'US'
	};
	it('accepts a good address', () => {
		expect(validateAddress(good)).toEqual({});
		expect(validateAddress({ ...good, postal: '04240-1234' })).toEqual({});
	});
	it('reports each missing field with country-aware wording', () => {
		const errors = validateAddress({ ...EMPTY_SHIPPING_ADDRESS });
		expect(errors.name).toBe(DEFAULT_ADDRESS_MESSAGES.name);
		expect(errors.line1).toBeTruthy();
		expect(errors.city).toBeTruthy();
		expect(errors.region).toBe('Choose a state.');
		expect(errors.postal).toBe('Enter the ZIP code.');
		expect(errors.country).toBeUndefined();
	});
	it('checks postal shape and optional postal', () => {
		expect(validateAddress({ ...good, postal: '1234' }).postal).toBe(
			'Enter a valid ZIP code, for example 04240.'
		);
		expect(validateAddress({ ...good, country: 'GB', region: '', postal: '' }).postal).toBe(
			'Enter the Postcode.'
		);
		expect(validateAddress({ ...good, country: 'IE', region: '', postal: '' })).toEqual({});
		expect(validateAddress({ ...good, country: 'ZZ', region: '', postal: 'anything' })).toEqual({});
		expect(validateAddress({ ...good, country: 'CA', region: 'ON', postal: 'K1A 0B1' })).toEqual(
			{}
		);
	});
	it('needs a country and takes translated messages', () => {
		expect(validateAddress({ ...good, country: '' }).country).toBeTruthy();
		const t = validateAddress({ ...EMPTY_SHIPPING_ADDRESS }, { name: 'Nom requis.' });
		expect(t.name).toBe('Nom requis.');
		expect(t.line1).toBe(DEFAULT_ADDRESS_MESSAGES.line1);
	});
	it('validates email', () => {
		expect(isValidCheckoutEmail('a@b.co')).toBe(true);
		expect(isValidCheckoutEmail(' a@b.co ')).toBe(true);
		expect(isValidCheckoutEmail('a@b')).toBe(false);
		expect(isValidCheckoutEmail('a b@c.com')).toBe(false);
		expect(isValidCheckoutEmail('')).toBe(false);
	});
});

describe('stars', () => {
	it('rounds to halves and clamps', () => {
		expect(roundToHalf(4.3)).toBe(4.5);
		expect(roundToHalf(4.2)).toBe(4);
		expect(roundToHalf(7)).toBe(5);
		expect(roundToHalf(-1)).toBe(0);
		expect(roundToHalf(Number.NaN)).toBe(0);
		expect(roundToHalf(8, 10)).toBe(8);
	});
	it('fills', () => {
		expect(starFill(3.5, 0)).toBe('full');
		expect(starFill(3.5, 3)).toBe('half');
		expect(starFill(3.5, 4)).toBe('empty');
		expect(starFills(2.5)).toEqual(['full', 'full', 'half', 'empty', 'empty']);
		expect(starFills(0, 3)).toEqual(['empty', 'empty', 'empty']);
	});
	it('words the rating', () => {
		expect(ratingText(4.5)).toBe('4.5 out of 5 stars');
		expect(ratingText(4.5, 5, 1)).toBe('4.5 out of 5 stars, 1 review');
		expect(ratingText(4, 5, 12)).toBe('4 out of 5 stars, 12 reviews');
		expect(ratingText(4, 5, undefined, '{rating}/{max}')).toBe('4/5');
	});
	it('averages and distributes', () => {
		expect(averageFromCounts([0, 0, 0, 0, 0])).toBe(0);
		expect(averageFromCounts([0, 0, 0, 0, 2])).toBe(5);
		expect(averageFromCounts([1, 0, 0, 0, 1])).toBe(3);
		const d = ratingDistribution([1, 0, 0, 1, 2]);
		expect(d.map((r) => r.stars)).toEqual([5, 4, 3, 2, 1]);
		expect(d[0]).toEqual({ stars: 5, count: 2, percent: 50 });
		expect(ratingDistribution([0, 0]).every((r) => r.percent === 0)).toBe(true);
	});
	it('steps by key', () => {
		expect(stepRating(3, 'ArrowRight')).toBe(4);
		expect(stepRating(5, 'ArrowUp')).toBe(5);
		expect(stepRating(3, 'ArrowLeft')).toBe(2);
		expect(stepRating(1, 'ArrowDown')).toBe(1);
		expect(stepRating(3, 'Home')).toBe(1);
		expect(stepRating(3, 'End')).toBe(5);
		expect(stepRating(3, 'x')).toBe(3);
	});
	const reviews: Review[] = [
		{ id: 'a', author: 'A', rating: 3, body: '', date: '2026-01-02', helpful: 1 },
		{ id: 'b', author: 'B', rating: 5, body: '', date: '2026-03-01', helpful: 0 },
		{ id: 'c', author: 'C', rating: 5, body: '', date: '2026-02-01', helpful: 9 },
		{ id: 'd', author: 'D', rating: 1, body: '', date: '2026-02-01', helpful: 1 }
	];
	it('sorts reviews without mutating', () => {
		const ids = (s: Parameters<typeof sortReviews>[1]) => sortReviews(reviews, s).map((r) => r.id);
		expect(ids('newest')).toEqual(['b', 'c', 'd', 'a']);
		expect(ids('oldest')).toEqual(['a', 'c', 'd', 'b']);
		expect(ids('highest')).toEqual(['b', 'c', 'a', 'd']);
		expect(ids('lowest')).toEqual(['d', 'a', 'b', 'c']);
		expect(ids('helpful')).toEqual(['c', 'd', 'a', 'b']);
		expect(reviews.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
	});
});

describe('usage', () => {
	it('states', () => {
		expect(usageState(10, null)).toBe('unlimited');
		expect(usageState(10, 0)).toBe('unlimited');
		expect(usageState(10, 100)).toBe('ok');
		expect(usageState(80, 100)).toBe('warning');
		expect(usageState(100, 100)).toBe('warning');
		expect(usageState(101, 100)).toBe('over');
		expect(usageState(50, 100, 0.5)).toBe('warning');
	});
	it('percent and usageOverage', () => {
		expect(usagePercent(50, 200)).toBe(25);
		expect(usagePercent(500, 200)).toBe(100);
		expect(usagePercent(-5, 200)).toBe(0);
		expect(usagePercent(5, null)).toBe(0);
		expect(usagePercent(5, 0)).toBe(0);
		expect(usageOverage(150, 100)).toBe(50);
		expect(usageOverage(50, 100)).toBe(0);
		expect(usageOverage(50, null)).toBe(0);
		expect(usageOverage(50, 0)).toBe(0);
	});
	it('formats quantities and dates', () => {
		expect(formatUsageAmount(1234.56)).toBe('1,234.6');
		expect(formatUsageAmount(1200000, 'calls')).toMatch(/1\.2M calls/);
		expect(formatUsageAmount(12, 'GB')).toBe('12 GB');
		expect(formatCommerceDate('2026-11-01T00:00:00Z')).toBe('Nov 1, 2026');
		expect(formatCommerceDate(new Date('2026-11-01T00:00:00Z'), 'en-US', 'UTC', 'long')).toBe(
			'November 1, 2026'
		);
		expect(formatCommerceDate('garbage')).toBe('');
		expect(daysUntilDate('2026-10-20T12:00:00Z', NOW)).toBe(7);
		expect(daysUntilDate(new Date('2026-10-13T12:00:01Z'), NOW)).toBe(1);
		expect(daysUntilDate('2020-01-01', NOW)).toBe(0);
	});
});

describe('invoices', () => {
	const invoices: Invoice[] = [
		{ id: '1', number: 'A', date: '2026-01-01', amountCents: 1000, status: 'paid' },
		{ id: '2', number: 'B', date: '2026-02-01', amountCents: 2000, status: 'open' },
		{ id: '3', number: 'C', date: '2026-03-01', amountCents: 400, status: 'overdue' },
		{ id: '4', number: 'D', date: '2026-04-01', amountCents: 9999, status: 'void' },
		{ id: '5', number: 'E', date: '2026-05-01', amountCents: 300, status: 'refunded' }
	];
	it('totals', () => {
		expect(invoiceTotals(invoices)).toEqual({ paid: 1000, outstanding: 2400, all: 3700 });
		expect(invoiceTotals([])).toEqual({ paid: 0, outstanding: 0, all: 0 });
	});
	it('tones', () => {
		expect(invoiceTone('paid')).toBe('success');
		expect(invoiceTone('open')).toBe('info');
		expect(invoiceTone('overdue')).toBe('danger');
		expect(invoiceTone('void')).toBe('neutral');
		expect(invoiceTone('refunded')).toBe('neutral');
	});
	it('paginates and clamps', () => {
		const items = [1, 2, 3, 4, 5];
		expect(paginateInvoices(items, 1, 2)).toEqual({ items: [1, 2], page: 1, pages: 3 });
		expect(paginateInvoices(items, 3, 2)).toEqual({ items: [5], page: 3, pages: 3 });
		expect(paginateInvoices(items, 99, 2).page).toBe(3);
		expect(paginateInvoices(items, 0, 2).page).toBe(1);
		expect(paginateInvoices(items, Number.NaN, 2).page).toBe(1);
		expect(paginateInvoices([], 1, 10)).toEqual({ items: [], page: 1, pages: 1 });
		expect(paginateInvoices(items, 1, 0).pages).toBe(5);
	});
});

describe('order steps', () => {
	it('states', () => {
		expect(stepState(0, 1)).toBe('done');
		expect(stepState(1, 1)).toBe('current');
		expect(stepState(2, 1)).toBe('upcoming');
		expect(stepState(3, 9)).toBe('done');
	});
});

describe('uptime', () => {
	const day = (status: UptimeDay['status'], minutes?: number): UptimeDay => ({
		date: '2026-01-04',
		status,
		minutes
	});
	it('aggregates', () => {
		expect(uptimePercent([])).toBe(100);
		expect(uptimePercent([day('none')])).toBe(100);
		expect(uptimePercent([day('up'), day('up'), day('up'), day('down')])).toBe(75);
		expect(uptimePercent([day('up'), day('degraded')])).toBe(75);
		expect(uptimePercent([day('up'), day('none'), day('down')])).toBe(50);
		expect(uptimePercent([day('up'), day('up'), day('degraded')])).toBe(83.33);
	});
	it('counts and finds the worst', () => {
		expect(uptimeCounts([day('up'), day('up'), day('down'), day('none')])).toEqual({
			up: 2,
			degraded: 0,
			down: 1,
			none: 1
		});
		expect(worstStatus([])).toBe('none');
		expect(worstStatus(['up', 'degraded'])).toBe('degraded');
		expect(worstStatus(['up', 'down', 'degraded'])).toBe('down');
		expect(worstStatus(['none', 'up'])).toBe('up');
	});
	it('words a day', () => {
		expect(dayLabel(day('up'))).toBe('Jan 4, 2026: No incidents');
		expect(dayLabel(day('down', 42))).toBe('Jan 4, 2026: Outage, 42 minutes');
		expect(dayLabel(day('degraded', 1))).toBe('Jan 4, 2026: Degraded performance, 1 minute');
		expect(dayLabel(day('none', 5))).toBe('Jan 4, 2026: No data');
		expect(dayLabel(day('up', 5))).toBe('Jan 4, 2026: No incidents');
		expect(dayLabel(day('down'))).toBe('Jan 4, 2026: Outage');
		expect(dayLabel(day('down'), 'en-US', { up: 'a', degraded: 'b', down: 'c', none: 'd' })).toBe(
			'Jan 4, 2026: c'
		);
	});
	it('rolls up components', () => {
		expect(overallStatus([])).toBe('operational');
		expect(overallStatus(['operational', 'maintenance'])).toBe('maintenance');
		expect(overallStatus(['degraded', 'maintenance'])).toBe('degraded');
		expect(overallStatus(['degraded', 'outage', 'partial'])).toBe('outage');
		expect(overallStatus(['partial', 'degraded'])).toBe('partial');
		expect(componentTone('operational')).toBe('success');
		expect(componentTone('degraded')).toBe('warning');
		expect(componentTone('partial')).toBe('warning');
		expect(componentTone('maintenance')).toBe('info');
		expect(componentTone('outage')).toBe('danger');
	});
});

describe('changelog', () => {
	const releases: Release[] = [
		{
			version: '1.0.0',
			date: '2026-01-01',
			changes: [
				{ type: 'feature', text: 'a' },
				{ type: 'fix', text: 'b' }
			]
		},
		{ version: '1.1.0', date: '2026-02-01', changes: [{ type: 'fix', text: 'c' }] },
		{ version: '1.10.0', date: '2026-02-01', changes: [{ type: 'security', text: 'd' }] }
	];
	it('filters and drops empty releases', () => {
		expect(filterReleases(releases, []).length).toBe(3);
		const fixes = filterReleases(releases, ['fix']);
		expect(fixes.map((r) => r.version)).toEqual(['1.0.0', '1.1.0']);
		expect(fixes[0].changes).toHaveLength(1);
		expect(releases[0].changes).toHaveLength(2);
		expect(filterReleases(releases, ['breaking'])).toEqual([]);
	});
	it('lists types in display order', () => {
		expect(changeTypesIn(releases)).toEqual(['feature', 'fix', 'security']);
		expect(changeTypesIn([])).toEqual([]);
	});
	it('tones', () => {
		expect(changeTone('feature')).toBe('success');
		expect(changeTone('improvement')).toBe('info');
		expect(changeTone('fix')).toBe('neutral');
		expect(changeTone('security')).toBe('danger');
		expect(changeTone('breaking')).toBe('danger');
		expect(changeTone('deprecated')).toBe('warning');
	});
	it('sorts newest first, numeric version tiebreak', () => {
		expect(sortReleases(releases).map((r) => r.version)).toEqual(['1.10.0', '1.1.0', '1.0.0']);
	});
	it('slugs', () => {
		expect(versionSlug('v1.2.0')).toBe('v1-2-0');
		expect(versionSlug(' 2.0.0-beta.1 ')).toBe('2-0-0-beta-1');
		expect(versionSlug('***')).toBe('release');
	});
});

describe('countdown', () => {
	it('splits', () => {
		const c = countdownParts('2026-10-15T15:04:05Z', NOW);
		expect(c).toMatchObject({ days: 2, hours: 3, minutes: 4, seconds: 5, done: false });
		expect(countdownParts(new Date('2026-10-13T12:00:30Z'), NOW).seconds).toBe(30);
		expect(countdownParts(NOW.getTime() + 1000, NOW).seconds).toBe(1);
	});
	it('is done at and after the end, and for bad dates', () => {
		expect(countdownParts(NOW, NOW).done).toBe(true);
		expect(countdownParts('2020-01-01', NOW)).toMatchObject({ total: 0, done: true });
		expect(countdownParts('nonsense', NOW).done).toBe(true);
	});
	it('words', () => {
		expect(countdownText(countdownParts('2026-10-15T15:04:05Z', NOW))).toBe('2 days 03:04:05');
		expect(countdownText(countdownParts('2026-10-14T12:00:00Z', NOW))).toBe('1 day 00:00:00');
		expect(countdownText(countdownParts('2026-10-13T12:00:09Z', NOW))).toBe('00:00:09');
		expect(countdownSpoken(countdownParts('2026-10-15T15:04:05Z', NOW))).toBe(
			'2 days, 3 hours, 4 minutes'
		);
		expect(countdownSpoken(countdownParts('2026-10-14T13:01:00Z', NOW))).toBe(
			'1 day, 1 hour, 1 minute'
		);
		expect(countdownSpoken(countdownParts('2026-10-13T12:00:01Z', NOW))).toBe('1 second');
		expect(countdownSpoken(countdownParts('2026-10-13T12:05:09Z', NOW))).toBe(
			'5 minutes, 9 seconds'
		);
	});
});

describe('waitlist', () => {
	it('checks email', () => {
		expect(checkWaitlistEmail('')).toEqual({ ok: false, code: 'required' });
		expect(checkWaitlistEmail('nope')).toEqual({ ok: false, code: 'format' });
		expect(checkWaitlistEmail(' Ada@Example.COM ')).toEqual({ ok: true, email: 'ada@example.com' });
	});
	it('builds share links', () => {
		expect(shareLink('https://x.dev/', 'abc')).toBe('https://x.dev/?ref=abc');
		expect(shareLink('https://x.dev/?a=1', 'a b')).toBe('https://x.dev/?a=1&ref=a%20b');
		expect(shareLink('https://x.dev/#top', 'abc')).toBe('https://x.dev/?ref=abc#top');
		expect(shareLink('https://x.dev/', '')).toBe('https://x.dev/');
	});
	it('words position', () => {
		expect(positionText(1204)).toBe('#1,204');
		expect(positionText(1204, 'de-DE')).toBe('#1.204');
	});
});

describe('gallery', () => {
	it('wraps or clamps', () => {
		expect(galleryIndex(0, -1, 4)).toBe(3);
		expect(galleryIndex(3, 1, 4)).toBe(0);
		expect(galleryIndex(1, 1, 4)).toBe(2);
		expect(galleryIndex(0, -1, 4, false)).toBe(0);
		expect(galleryIndex(3, 1, 4, false)).toBe(3);
		expect(galleryIndex(2, 1, 4, false)).toBe(3);
		expect(galleryIndex(0, 1, 0)).toBe(0);
	});
});
