/**
 * The decisions the commerce modules make, apart from the markup that shows
 * them: card number checks, money maths, star maths, uptime and countdowns.
 *
 * Pure functions. Time is always an argument (`now`), never read from the clock.
 * Money is whole minor units (cents) so nothing is ever added as a float.
 */

/* ------------------------------------------------------------------ money */

/** Format minor units as currency: `formatMoney(1999, 'USD')` is "$19.99". */
export function formatMoney(cents: number, currency = 'USD', locale = 'en-US'): string {
	let digits = 2;
	try {
		digits =
			new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions()
				.maximumFractionDigits ?? 2;
	} catch {
		return `${(cents / 100).toFixed(2)} ${currency}`;
	}
	return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
		cents / 10 ** digits
	);
}

export interface LineItem {
	id: string;
	name: string;
	/** Unit price in minor units. */
	unitCents: number;
	quantity: number;
	/** e.g. "Large / Blue". */
	variant?: string;
	image?: string;
}

/** Price of one line: unit price times quantity, never negative. */
export function lineTotal(item: Pick<LineItem, 'unitCents' | 'quantity'>): number {
	return Math.max(0, Math.round(item.unitCents)) * Math.max(0, Math.floor(item.quantity));
}

export function subtotalOf(items: readonly Pick<LineItem, 'unitCents' | 'quantity'>[]): number {
	return items.reduce((sum, item) => sum + lineTotal(item), 0);
}

/** Tax on an amount at a rate (0.2 is 20%), rounded half up to a whole cent. */
export function taxAmount(amountCents: number, rate: number): number {
	if (!(rate > 0) || !(amountCents > 0)) return 0;
	return Math.round(amountCents * rate);
}

export type Promo =
	| { code: string; kind: 'percent'; value: number; minSubtotalCents?: number }
	| { code: string; kind: 'fixed'; value: number; minSubtotalCents?: number }
	| { code: string; kind: 'shipping'; minSubtotalCents?: number };

export type PromoResult =
	| { ok: true; promo: Promo }
	| { ok: false; reason: 'empty' | 'unknown' | 'minimum'; minSubtotalCents?: number };

/** Look a code up (case and space insensitive) and check it applies to this cart. */
export function findPromo(
	input: string,
	promos: readonly Promo[],
	subtotalCents: number
): PromoResult {
	const code = input.trim().toUpperCase();
	if (!code) return { ok: false, reason: 'empty' };
	const promo = promos.find((p) => p.code.toUpperCase() === code);
	if (!promo) return { ok: false, reason: 'unknown' };
	if (promo.minSubtotalCents && subtotalCents < promo.minSubtotalCents) {
		return { ok: false, reason: 'minimum', minSubtotalCents: promo.minSubtotalCents };
	}
	return { ok: true, promo };
}

/** The money a promo takes off the goods (shipping promos take it off shipping instead). */
export function promoDiscount(subtotalCents: number, promo: Promo | null | undefined): number {
	if (!promo || promo.kind === 'shipping') return 0;
	if (promo.minSubtotalCents && subtotalCents < promo.minSubtotalCents) return 0;
	const raw =
		promo.kind === 'percent'
			? Math.round((subtotalCents * Math.min(100, Math.max(0, promo.value))) / 100)
			: Math.max(0, Math.round(promo.value));
	return Math.min(subtotalCents, raw);
}

export interface CartTotalsResult {
	subtotal: number;
	discount: number;
	shipping: number;
	tax: number;
	total: number;
}

/**
 * Cart totals. Tax is charged on goods after discount (and on shipping when
 * `taxShipping`). A shipping promo zeroes the shipping charge.
 */
export function cartTotals(
	items: readonly Pick<LineItem, 'unitCents' | 'quantity'>[],
	options: {
		taxRate?: number;
		shippingCents?: number;
		promo?: Promo | null;
		taxShipping?: boolean;
	} = {}
): CartTotalsResult {
	const subtotal = subtotalOf(items);
	const discount = promoDiscount(subtotal, options.promo);
	const freeShipping =
		options.promo?.kind === 'shipping' &&
		(!options.promo.minSubtotalCents || subtotal >= options.promo.minSubtotalCents);
	const shipping = subtotal === 0 || freeShipping ? 0 : Math.max(0, options.shippingCents ?? 0);
	const taxable = subtotal - discount + (options.taxShipping ? shipping : 0);
	const tax = taxAmount(taxable, options.taxRate ?? 0);
	return { subtotal, discount, shipping, tax, total: subtotal - discount + shipping + tax };
}

/* ------------------------------------------------------------ card numbers */

// prettier-ignore
export type CardBrand =
	'visa' | 'mastercard' | 'amex' | 'discover' | 'diners' | 'jcb' | 'unionpay' | 'unknown';

export const CARD_BRAND_LABELS: Record<CardBrand, string> = {
	visa: 'Visa',
	mastercard: 'Mastercard',
	amex: 'American Express',
	discover: 'Discover',
	diners: 'Diners Club',
	jcb: 'JCB',
	unionpay: 'UnionPay',
	unknown: 'Card'
};

export function cardDigits(value: string): string {
	return value.replace(/\D/g, '');
}

/** Brand from the leading digits. Works on a partial number. */
export function detectCardBrand(input: string): CardBrand {
	const n = cardDigits(input);
	if (/^4/.test(n)) return 'visa';
	if (/^3[47]/.test(n)) return 'amex';
	if (/^(5[1-5]|2(2[2-9][1-9]|2[3-9]|[3-6]|7[01]|720))/.test(n)) return 'mastercard';
	if (/^(6011|65|64[4-9]|622)/.test(n)) return n.startsWith('622') ? 'unionpay' : 'discover';
	if (/^3(0[0-5]|[689])/.test(n)) return 'diners';
	if (/^35(2[89]|[3-8])/.test(n)) return 'jcb';
	if (/^62/.test(n)) return 'unionpay';
	return 'unknown';
}

/** Digit-group sizes for a brand: Amex is 4-6-5, most others 4-4-4-4. */
export function cardGroups(brand: CardBrand): number[] {
	if (brand === 'amex') return [4, 6, 5];
	if (brand === 'diners') return [4, 6, 4];
	return [4, 4, 4, 4, 3];
}

/** Longest number a brand uses. */
export function cardMaxLength(brand: CardBrand): number {
	if (brand === 'amex') return 15;
	if (brand === 'diners') return 14;
	if (brand === 'unknown') return 19;
	return 16;
}

/** Group digits as typed: "4242424242424242" becomes "4242 4242 4242 4242". Caps the length. */
export function formatCardNumber(input: string): string {
	const brand = detectCardBrand(input);
	const digits = cardDigits(input).slice(0, cardMaxLength(brand));
	const groups = cardGroups(brand);
	const parts: string[] = [];
	let at = 0;
	for (const size of groups) {
		if (at >= digits.length) break;
		parts.push(digits.slice(at, at + size));
		at += size;
	}
	return parts.join(' ');
}

/** The Luhn checksum. True for a digit string whose check digit is right. */
export function luhnValid(input: string): boolean {
	const n = cardDigits(input);
	if (n.length < 2) return false;
	let sum = 0;
	let double = false;
	for (let i = n.length - 1; i >= 0; i--) {
		let d = n.charCodeAt(i) - 48;
		if (double) {
			d *= 2;
			if (d > 9) d -= 9;
		}
		sum += d;
		double = !double;
	}
	return sum % 10 === 0;
}

export type CardFieldCheck = { ok: true } | { ok: false; code: string };

export function checkCardNumber(input: string): CardFieldCheck {
	const n = cardDigits(input);
	if (!n) return { ok: false, code: 'required' };
	const brand = detectCardBrand(n);
	const lengthOk =
		brand === 'unknown'
			? n.length >= 12
			: brand === 'visa'
				? [13, 16, 19].includes(n.length)
				: n.length === cardMaxLength(brand);
	if (!lengthOk) return { ok: false, code: 'length' };
	if (!luhnValid(n)) return { ok: false, code: 'luhn' };
	return { ok: true };
}

/** CVC length: 4 for Amex, 3 for the rest. */
export function cvcLength(brand: CardBrand): number {
	return brand === 'amex' ? 4 : 3;
}

export function checkCvc(input: string, brand: CardBrand): CardFieldCheck {
	const n = cardDigits(input);
	if (!n) return { ok: false, code: 'required' };
	if (n.length !== cvcLength(brand) || n !== input.trim()) return { ok: false, code: 'length' };
	return { ok: true };
}

/** "•••• 4242" style mask from a last-four. */
export function maskedCard(last4: string, brand?: CardBrand): string {
	const tail = cardDigits(last4).slice(-4).padStart(4, '•');
	return `${brand ? `${CARD_BRAND_LABELS[brand]} ` : ''}•••• ${tail}`;
}

/* ------------------------------------------------------------------ expiry */

/** Format typing as MM/YY: "1" stays, "2" becomes "02/", "1226" becomes "12/26". */
export function formatExpiry(input: string, previous = ''): string {
	let d = cardDigits(input).slice(0, 4);
	if (!d) return '';
	// Backspacing over the slash should not put it straight back.
	if (previous.length > input.length && previous.startsWith(input) && !input.includes('/')) {
		return d;
	}
	if (d[0] > '1') d = `0${d}`.slice(0, 4);
	if (d.length >= 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
	return d;
}

/** Parse "MM/YY" or "MM/YYYY" to a month and four-digit year, or null. */
export function parseExpiry(input: string): { month: number; year: number } | null {
	const m = /^\s*(\d{1,2})\s*[/\-.]?\s*(\d{2}|\d{4})\s*$/.exec(input);
	if (!m) return null;
	const month = Number(m[1]);
	if (month < 1 || month > 12) return null;
	const year = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
	return { month, year };
}

export type ExpiryState = 'valid' | 'expiring' | 'expired';

/**
 * A card works through the end of its expiry month. `expiring` is within
 * `soonMonths` months (default 2) of that end.
 */
export function expiryState(month: number, year: number, now: Date, soonMonths = 2): ExpiryState {
	const nowIndex = now.getUTCFullYear() * 12 + now.getUTCMonth();
	const cardIndex = year * 12 + (month - 1);
	if (cardIndex < nowIndex) return 'expired';
	if (cardIndex - nowIndex < soonMonths) return 'expiring';
	return 'valid';
}

export function checkExpiry(input: string, now: Date): CardFieldCheck {
	if (!input.trim()) return { ok: false, code: 'required' };
	const parsed = parseExpiry(input);
	if (!parsed) return { ok: false, code: 'format' };
	if (parsed.year > now.getUTCFullYear() + 20) return { ok: false, code: 'far' };
	if (expiryState(parsed.month, parsed.year, now) === 'expired') {
		return { ok: false, code: 'expired' };
	}
	return { ok: true };
}

/** "12/26" for display. */
export function expiryLabel(month: number, year: number): string {
	return `${String(month).padStart(2, '0')}/${String(year % 100).padStart(2, '0')}`;
}

/* ----------------------------------------------------------------- address */

export interface AddressRule {
	regionLabel: string;
	regionRequired: boolean;
	/** Options for a region select; empty means free text. */
	regions: { value: string; label: string }[];
	postalLabel: string;
	postalRequired: boolean;
	postalPattern: RegExp | null;
	postalExample: string;
	postalAutocomplete: string;
	regionAutocomplete: string;
}

const US_STATES = [
	'AL',
	'AK',
	'AZ',
	'AR',
	'CA',
	'CO',
	'CT',
	'DE',
	'FL',
	'GA',
	'HI',
	'ID',
	'IL',
	'IN',
	'IA',
	'KS',
	'KY',
	'LA',
	'ME',
	'MD',
	'MA',
	'MI',
	'MN',
	'MS',
	'MO',
	'MT',
	'NE',
	'NV',
	'NH',
	'NJ',
	'NM',
	'NY',
	'NC',
	'ND',
	'OH',
	'OK',
	'OR',
	'PA',
	'RI',
	'SC',
	'SD',
	'TN',
	'TX',
	'UT',
	'VT',
	'VA',
	'WA',
	'WV',
	'WI',
	'WY',
	'DC'
];

export const SHIPPING_COUNTRIES: { value: string; label: string }[] = [
	{ value: 'US', label: 'United States' },
	{ value: 'CA', label: 'Canada' },
	{ value: 'GB', label: 'United Kingdom' },
	{ value: 'DE', label: 'Germany' },
	{ value: 'FR', label: 'France' },
	{ value: 'AU', label: 'Australia' },
	{ value: 'IE', label: 'Ireland' }
];

const BASE_RULE: AddressRule = {
	regionLabel: 'Region',
	regionRequired: false,
	regions: [],
	postalLabel: 'Postal code',
	postalRequired: true,
	postalPattern: null,
	postalExample: '',
	postalAutocomplete: 'postal-code',
	regionAutocomplete: 'address-level1'
};

/** What the address form asks for in a country: region kind, postal label and shape. */
export function addressRule(country: string): AddressRule {
	switch (country.toUpperCase()) {
		case 'US':
			return {
				...BASE_RULE,
				regionLabel: 'State',
				regionRequired: true,
				regions: US_STATES.map((s) => ({ value: s, label: s })),
				postalLabel: 'ZIP code',
				postalPattern: /^\d{5}(-\d{4})?$/,
				postalExample: '04240'
			};
		case 'CA':
			return {
				...BASE_RULE,
				regionLabel: 'Province',
				regionRequired: true,
				regions: ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'].map(
					(s) => ({
						value: s,
						label: s
					})
				),
				postalPattern: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
				postalExample: 'K1A 0B1'
			};
		case 'GB':
			return {
				...BASE_RULE,
				regionLabel: 'County',
				postalLabel: 'Postcode',
				postalPattern: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/,
				postalExample: 'SW1A 1AA'
			};
		case 'DE':
			return {
				...BASE_RULE,
				postalLabel: 'Postleitzahl',
				postalPattern: /^\d{5}$/,
				postalExample: '10115'
			};
		case 'FR':
			return { ...BASE_RULE, postalPattern: /^\d{5}$/, postalExample: '75001' };
		case 'AU':
			return {
				...BASE_RULE,
				regionLabel: 'State or territory',
				regionRequired: true,
				regions: ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'].map((s) => ({
					value: s,
					label: s
				})),
				postalPattern: /^\d{4}$/,
				postalExample: '2000'
			};
		case 'IE':
			return {
				...BASE_RULE,
				regionLabel: 'County',
				postalLabel: 'Eircode',
				postalRequired: false,
				postalPattern: /^[A-Za-z]\d[\dWw]\s?[A-Za-z\d]{4}$/,
				postalExample: 'D02 AF30'
			};
		default:
			return { ...BASE_RULE, postalRequired: false };
	}
}

export interface ShippingAddress {
	name: string;
	line1: string;
	line2: string;
	city: string;
	region: string;
	postal: string;
	country: string;
}

export const EMPTY_SHIPPING_ADDRESS: ShippingAddress = {
	name: '',
	line1: '',
	line2: '',
	city: '',
	region: '',
	postal: '',
	country: 'US'
};

export type CheckoutFieldErrors<K extends string = string> = Partial<Record<K, string>>;

export type AddressMessages = Record<string, string>;

export const DEFAULT_ADDRESS_MESSAGES: AddressMessages = {
	name: 'Enter the recipient name.',
	line1: 'Enter the street address.',
	city: 'Enter the city.',
	region: 'Choose a {region}.',
	postal: 'Enter the {postal}.',
	postalFormat: 'Enter a valid {postal}, for example {example}.',
	country: 'Choose a country.'
};

function fill(template: string, values: Record<string, string>): string {
	return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
}

/** Validate an address against its country's rules. Returns field -> message. */
export function validateAddress(
	address: ShippingAddress,
	messages: AddressMessages = DEFAULT_ADDRESS_MESSAGES
): CheckoutFieldErrors<keyof ShippingAddress> {
	const m = { ...DEFAULT_ADDRESS_MESSAGES, ...messages };
	const rule = addressRule(address.country);
	const errors: CheckoutFieldErrors<keyof ShippingAddress> = {};
	if (!address.country) errors.country = m.country;
	if (!address.name.trim()) errors.name = m.name;
	if (!address.line1.trim()) errors.line1 = m.line1;
	if (!address.city.trim()) errors.city = m.city;
	if (rule.regionRequired && !address.region.trim()) {
		errors.region = fill(m.region, { region: rule.regionLabel.toLowerCase() });
	}
	const postal = address.postal.trim();
	const vars = { postal: rule.postalLabel, example: rule.postalExample };
	if (!postal) {
		if (rule.postalRequired) errors.postal = fill(m.postal, vars);
	} else if (rule.postalPattern && !rule.postalPattern.test(postal)) {
		errors.postal = fill(m.postalFormat, vars);
	}
	return errors;
}

export function isValidCheckoutEmail(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/* ---------------------------------------------------------------- shipping */

export interface ShippingMethod {
	id: string;
	label: string;
	/** Price in minor units. 0 shows as "Free". */
	cents: number;
	/** e.g. "3-5 business days" */
	eta?: string;
}

/* ------------------------------------------------------------------- stars */

export type StarFill = 'full' | 'half' | 'empty';

/** Clamp a rating into [0, max] and round it to the nearest half star. */
export function roundToHalf(rating: number, max = 5): number {
	if (!Number.isFinite(rating)) return 0;
	return Math.round(Math.min(max, Math.max(0, rating)) * 2) / 2;
}

/** How star number `index` (0-based) is drawn for a rating. */
export function starFill(rating: number, index: number, max = 5): StarFill {
	const r = roundToHalf(rating, max);
	if (r >= index + 1) return 'full';
	if (r >= index + 0.5) return 'half';
	return 'empty';
}

export function starFills(rating: number, max = 5): StarFill[] {
	return Array.from({ length: max }, (_, i) => starFill(rating, i, max));
}

/** "4.5 out of 5 stars", with optional review count. */
export function ratingText(
	rating: number,
	max = 5,
	count?: number,
	template = '{rating} out of {max} stars'
): string {
	const value = roundToHalf(rating, max);
	const base = fill(template, { rating: String(value), max: String(max) });
	if (count === undefined) return base;
	return `${base}, ${count} ${count === 1 ? 'review' : 'reviews'}`;
}

/** Counts per star (index 0 is one star) to an average. 0 with no votes. */
export function averageFromCounts(counts: readonly number[]): number {
	const total = counts.reduce((a, b) => a + b, 0);
	if (total === 0) return 0;
	return counts.reduce((sum, c, i) => sum + c * (i + 1), 0) / total;
}

export interface DistributionRow {
	stars: number;
	count: number;
	/** Share of all reviews, 0 to 100, rounded to a whole percent. */
	percent: number;
}

/** Rows from five stars down to one, for the distribution bars. */
export function ratingDistribution(counts: readonly number[]): DistributionRow[] {
	const total = counts.reduce((a, b) => a + b, 0);
	return counts
		.map((count, i) => ({
			stars: i + 1,
			count,
			percent: total === 0 ? 0 : Math.round((count / total) * 100)
		}))
		.reverse();
}

export interface Review {
	id: string;
	author: string;
	rating: number;
	title?: string;
	body: string;
	/** ISO date. */
	date: string;
	helpful: number;
}

export type ReviewSort = 'newest' | 'oldest' | 'highest' | 'lowest' | 'helpful';

export function sortReviews(reviews: readonly Review[], sort: ReviewSort): Review[] {
	const byDate = (a: Review, b: Review) => b.date.localeCompare(a.date);
	const copy = reviews.slice();
	switch (sort) {
		case 'oldest':
			return copy.sort((a, b) => -byDate(a, b));
		case 'highest':
			return copy.sort((a, b) => b.rating - a.rating || byDate(a, b));
		case 'lowest':
			return copy.sort((a, b) => a.rating - b.rating || byDate(a, b));
		case 'helpful':
			return copy.sort((a, b) => b.helpful - a.helpful || byDate(a, b));
		default:
			return copy.sort(byDate);
	}
}

/** Move a star-rating value by an arrow key. Returns the new value (1 to max). */
export function stepRating(value: number, key: string, max = 5): number {
	switch (key) {
		case 'ArrowRight':
		case 'ArrowUp':
			return Math.min(max, value + 1);
		case 'ArrowLeft':
		case 'ArrowDown':
			return Math.max(1, value - 1);
		case 'Home':
			return 1;
		case 'End':
			return max;
		default:
			return value;
	}
}

/* ------------------------------------------------------------------- usage */

export interface UsageMeter {
	id: string;
	label: string;
	used: number;
	/** null or 0: no limit. */
	limit: number | null;
	unit?: string;
}

export type UsageState = 'ok' | 'warning' | 'over' | 'unlimited';

/** Where a quota stands. `limit` null or 0 means no limit. `warnAt` is a fraction (0.8). */
export function usageState(used: number, limit: number | null, warnAt = 0.8): UsageState {
	if (limit === null || limit <= 0) return 'unlimited';
	if (used > limit) return 'over';
	if (used >= limit * warnAt) return 'warning';
	return 'ok';
}

/** Fill of the bar, 0 to 100 (an usageOverage fills it). */
export function usagePercent(used: number, limit: number | null): number {
	if (limit === null || limit <= 0) return 0;
	return Math.min(100, Math.max(0, Math.round((used / limit) * 100)));
}

/** How far over the limit, 0 when within. */
export function usageOverage(used: number, limit: number | null): number {
	if (limit === null || limit <= 0) return 0;
	return Math.max(0, used - limit);
}

export function formatUsageAmount(value: number, unit = '', locale = 'en-US'): string {
	const n = new Intl.NumberFormat(locale, {
		maximumFractionDigits: 1,
		notation: value >= 100000 ? 'compact' : 'standard'
	}).format(value);
	return unit ? `${n} ${unit}` : n;
}

/** Whole days from `now` until `date`, minimum 0. */
export function daysUntilDate(date: Date | string, now: Date): number {
	const target = typeof date === 'string' ? new Date(date) : date;
	return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86_400_000));
}

export function formatCommerceDate(
	date: Date | string,
	locale = 'en-US',
	timeZone = 'UTC',
	style: 'short' | 'medium' | 'long' = 'medium'
): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	if (Number.isNaN(d.getTime())) return '';
	return new Intl.DateTimeFormat(locale, { dateStyle: style, timeZone }).format(d);
}

/* ---------------------------------------------------------------- invoices */

export type InvoiceStatus = 'paid' | 'open' | 'overdue' | 'void' | 'refunded';

export interface Invoice {
	id: string;
	number: string;
	/** ISO date. */
	date: string;
	amountCents: number;
	currency?: string;
	status: InvoiceStatus;
	description?: string;
	downloadUrl?: string;
}

export function invoiceTone(status: InvoiceStatus): 'success' | 'info' | 'danger' | 'neutral' {
	switch (status) {
		case 'paid':
			return 'success';
		case 'open':
			return 'info';
		case 'overdue':
			return 'danger';
		default:
			return 'neutral';
	}
}

/** Sums: what has been paid, and what is still owed (open + overdue). */
export function invoiceTotals(invoices: readonly Invoice[]): {
	paid: number;
	outstanding: number;
	all: number;
} {
	let paid = 0;
	let outstanding = 0;
	let all = 0;
	for (const inv of invoices) {
		if (inv.status === 'void') continue;
		all += inv.amountCents;
		if (inv.status === 'paid') paid += inv.amountCents;
		else if (inv.status === 'open' || inv.status === 'overdue') outstanding += inv.amountCents;
	}
	return { paid, outstanding, all };
}

/** One page of items, 1-based. The page is clamped into range. */
export function paginateInvoices<T>(
	items: readonly T[],
	page: number,
	pageSize: number
): { items: T[]; page: number; pages: number } {
	const size = Math.max(1, Math.floor(pageSize));
	const pages = Math.max(1, Math.ceil(items.length / size));
	const current = Math.min(pages, Math.max(1, Math.floor(page) || 1));
	return { items: items.slice((current - 1) * size, current * size), page: current, pages };
}

/* ------------------------------------------------------------------ orders */

export type OrderStepState = 'done' | 'current' | 'upcoming';

/** State of step `index` when the order is at step `current`. current past the end means all done. */
export function stepState(index: number, current: number): OrderStepState {
	if (index < current) return 'done';
	if (index === current) return 'current';
	return 'upcoming';
}

/* ------------------------------------------------------------------ uptime */

export type DayStatus = 'up' | 'degraded' | 'down' | 'none';

export interface UptimeDay {
	/** ISO date, YYYY-MM-DD. */
	date: string;
	status: DayStatus;
	/** Minutes of trouble that day, if known. */
	minutes?: number;
}

const DAY_WEIGHT: Record<DayStatus, number> = { up: 1, degraded: 0.5, down: 0, none: 1 };

/**
 * Uptime over a run of days as a percentage with two decimals. Days with no
 * data are left out. `degraded` counts half. 100 with no data at all.
 */
export function uptimePercent(days: readonly UptimeDay[]): number {
	const counted = days.filter((d) => d.status !== 'none');
	if (counted.length === 0) return 100;
	const score = counted.reduce((sum, d) => sum + DAY_WEIGHT[d.status], 0);
	return Math.round((score / counted.length) * 10000) / 100;
}

export function uptimeCounts(days: readonly UptimeDay[]): Record<DayStatus, number> {
	const counts: Record<DayStatus, number> = { up: 0, degraded: 0, down: 0, none: 0 };
	for (const d of days) counts[d.status] += 1;
	return counts;
}

const SEVERITY: DayStatus[] = ['none', 'up', 'degraded', 'down'];

/** The worst status in a set. */
export function worstStatus(statuses: readonly DayStatus[]): DayStatus {
	return statuses.reduce<DayStatus>(
		(worst, s) => (SEVERITY.indexOf(s) > SEVERITY.indexOf(worst) ? s : worst),
		'none'
	);
}

export const DAY_STATUS_LABELS: Record<DayStatus, string> = {
	up: 'No incidents',
	degraded: 'Degraded performance',
	down: 'Outage',
	none: 'No data'
};

/** Text alternative for one bar: "Jan 4, 2026: Outage, 42 minutes". */
export function dayLabel(
	day: UptimeDay,
	locale = 'en-US',
	labels: Record<DayStatus, string> = DAY_STATUS_LABELS
): string {
	const when = formatCommerceDate(`${day.date}T00:00:00Z`, locale, 'UTC');
	const base = `${when}: ${labels[day.status]}`;
	if (day.minutes && day.status !== 'up' && day.status !== 'none') {
		return `${base}, ${day.minutes} ${day.minutes === 1 ? 'minute' : 'minutes'}`;
	}
	return base;
}

export type ComponentStatus = 'operational' | 'degraded' | 'partial' | 'outage' | 'maintenance';

export const COMPONENT_STATUS_LABELS: Record<ComponentStatus, string> = {
	operational: 'Operational',
	degraded: 'Degraded performance',
	partial: 'Partial outage',
	outage: 'Major outage',
	maintenance: 'Under maintenance'
};

export function componentTone(status: ComponentStatus): 'success' | 'warning' | 'danger' | 'info' {
	switch (status) {
		case 'operational':
			return 'success';
		case 'degraded':
		case 'partial':
			return 'warning';
		case 'maintenance':
			return 'info';
		default:
			return 'danger';
	}
}

const COMPONENT_SEVERITY: ComponentStatus[] = [
	'operational',
	'maintenance',
	'degraded',
	'partial',
	'outage'
];

/** The headline for a whole system: its worst component. */
export function overallStatus(statuses: readonly ComponentStatus[]): ComponentStatus {
	return statuses.reduce<ComponentStatus>(
		(worst, s) => (COMPONENT_SEVERITY.indexOf(s) > COMPONENT_SEVERITY.indexOf(worst) ? s : worst),
		'operational'
	);
}

/* --------------------------------------------------------------- changelog */

export type ChangeType = 'feature' | 'improvement' | 'fix' | 'security' | 'breaking' | 'deprecated';

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
	feature: 'New',
	improvement: 'Improved',
	fix: 'Fixed',
	security: 'Security',
	breaking: 'Breaking',
	deprecated: 'Deprecated'
};

export interface ChangeEntry {
	type: ChangeType;
	text: string;
}

export interface Release {
	version: string;
	/** ISO date. */
	date: string;
	title?: string;
	changes: ChangeEntry[];
}

/** Keep only changes of the chosen types; releases left empty are dropped. No types means all. */
export function filterReleases(
	releases: readonly Release[],
	types: readonly ChangeType[]
): Release[] {
	if (types.length === 0) return releases.map((r) => ({ ...r, changes: r.changes.slice() }));
	return releases
		.map((r) => ({ ...r, changes: r.changes.filter((c) => types.includes(c.type)) }))
		.filter((r) => r.changes.length > 0);
}

/** Types that appear, in display order, for the filter. */
export function changeTypesIn(releases: readonly Release[]): ChangeType[] {
	const seen = new Set<ChangeType>();
	for (const r of releases) for (const c of r.changes) seen.add(c.type);
	return (Object.keys(CHANGE_TYPE_LABELS) as ChangeType[]).filter((t) => seen.has(t));
}

export function changeTone(
	type: ChangeType
): 'success' | 'info' | 'warning' | 'danger' | 'neutral' {
	switch (type) {
		case 'feature':
			return 'success';
		case 'improvement':
			return 'info';
		case 'fix':
			return 'neutral';
		case 'security':
		case 'breaking':
			return 'danger';
		default:
			return 'warning';
	}
}

/** Releases newest first by date, then by version string as a tiebreak. */
export function sortReleases(releases: readonly Release[]): Release[] {
	return releases
		.slice()
		.sort(
			(a, b) =>
				b.date.localeCompare(a.date) ||
				b.version.localeCompare(a.version, undefined, { numeric: true })
		);
}

/** A slug safe for an anchor id: "v1.2.0" becomes "v1-2-0". */
export function versionSlug(version: string): string {
	const slug = version
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return slug || 'release';
}

/* --------------------------------------------------------------- countdown */

export interface CountdownParts {
	/** Milliseconds left, never negative. */
	total: number;
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
	done: boolean;
}

export function countdownParts(target: Date | string | number, now: Date): CountdownParts {
	const end = target instanceof Date ? target.getTime() : new Date(target).getTime();
	const total = Number.isNaN(end) ? 0 : Math.max(0, end - now.getTime());
	const s = Math.floor(total / 1000);
	return {
		total,
		days: Math.floor(s / 86400),
		hours: Math.floor((s % 86400) / 3600),
		minutes: Math.floor((s % 3600) / 60),
		seconds: s % 60,
		done: total === 0
	};
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** "2 days 03:04:05" style text, for a screen reader or a compact label. */
export function countdownText(c: CountdownParts): string {
	const clock = `${pad2(c.hours)}:${pad2(c.minutes)}:${pad2(c.seconds)}`;
	if (c.days > 0) return `${c.days} ${c.days === 1 ? 'day' : 'days'} ${clock}`;
	return clock;
}

/** Spoken form: "2 days, 3 hours, 4 minutes". Seconds only when under an hour. */
export function countdownSpoken(c: CountdownParts): string {
	const unit = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
	const parts: string[] = [];
	if (c.days) parts.push(unit(c.days, 'day', 'days'));
	if (c.hours) parts.push(unit(c.hours, 'hour', 'hours'));
	if (c.minutes) parts.push(unit(c.minutes, 'minute', 'minutes'));
	if (!c.days && !c.hours) parts.push(unit(c.seconds, 'second', 'seconds'));
	return parts.join(', ');
}

/* ---------------------------------------------------------------- waitlist */

// prettier-ignore
export type WaitlistCheck =
	{ ok: true; email: string } | { ok: false; code: 'required' | 'format' };

export function checkWaitlistEmail(input: string): WaitlistCheck {
	const email = input.trim();
	if (!email) return { ok: false, code: 'required' };
	if (!isValidCheckoutEmail(email)) return { ok: false, code: 'format' };
	return { ok: true, email: email.toLowerCase() };
}

/** Add a referral code to a share link without clobbering the query. */
export function shareLink(base: string, code: string): string {
	if (!code) return base;
	const hash = base.indexOf('#');
	const head = hash === -1 ? base : base.slice(0, hash);
	const tail = hash === -1 ? '' : base.slice(hash);
	return `${head}${head.includes('?') ? '&' : '?'}ref=${encodeURIComponent(code)}${tail}`;
}

/** "You are #1,204" with locale grouping. */
export function positionText(position: number, locale = 'en-US'): string {
	return `#${new Intl.NumberFormat(locale).format(position)}`;
}

/* ----------------------------------------------------------------- gallery */

/** Previous/next index for a gallery; `wrap` loops, otherwise clamps. */
export function galleryIndex(current: number, delta: number, length: number, wrap = true): number {
	if (length <= 0) return 0;
	const next = current + delta;
	if (wrap) return ((next % length) + length) % length;
	return Math.min(length - 1, Math.max(0, next));
}

/* ------------------------------------------------------------ status page */

export interface SystemComponent {
	id: string;
	name: string;
	status: ComponentStatus;
	description?: string;
	days: UptimeDay[];
}

export interface IncidentUpdate {
	at: string;
	text: string;
	status?: string;
}

export interface Incident {
	id: string;
	title: string;
	status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
	startedAt: string;
	updates: IncidentUpdate[];
}
