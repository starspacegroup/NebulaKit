/**
 * Google product listings: the attributes, the rules, and the one place a
 * product becomes a "listing" (docs/GOOGLE_LISTINGS.md).
 *
 * PURE. No database, no clock (callers pass `now`), no environment, no
 * framework. Everything that decides what Google sees lives here, in this
 * order, so the feed, the on-page JSON-LD, the admin health panel and the
 * Merchant API sync cannot disagree about a product:
 *
 *   product row  --buildListing-->  ListingItem + problems
 *   ListingItem  --renderRssItem / renderTsvRow / toMerchantApiProduct--> bytes
 *
 * `priceNow` is the only place a price is chosen. The shop page, the cart,
 * the feed and the JSON-LD all call it; a sale price therefore cannot be
 * advertised to Google and then not charged at checkout (and the reverse).
 *
 * Money is integer cents, weight is grams, dimensions are millimetres.
 *
 * Every limit below is from Google's product data specification
 * (https://support.google.com/merchants/answer/7052112) as fetched on
 * 2026-11-25. Where a rule could not be checked against the live document it
 * says so next to the constant.
 */
import type { Product } from './types';

import type { Validated } from './validation';

// ---------------------------------------------------------------- vocabulary

export const GOOGLE_AVAILABILITY = ['in_stock', 'out_of_stock', 'preorder', 'backorder'] as const;
export type GoogleAvailability = (typeof GOOGLE_AVAILABILITY)[number];

export const GOOGLE_CONDITIONS = ['new', 'refurbished', 'used'] as const;
export type GoogleCondition = (typeof GOOGLE_CONDITIONS)[number];

export const GOOGLE_GENDERS = ['male', 'female', 'unisex'] as const;
export type GoogleGender = (typeof GOOGLE_GENDERS)[number];

export const GOOGLE_AGE_GROUPS = ['newborn', 'infant', 'toddler', 'kids', 'adult'] as const;
export type GoogleAgeGroup = (typeof GOOGLE_AGE_GROUPS)[number];

/** Limits from the specification. */
export const LIMITS = {
	id: 50,
	title: 150,
	description: 5000,
	link: 2000,
	additionalImages: 10,
	brand: 70,
	mpn: 70,
	color: 100,
	size: 100,
	material: 200,
	itemGroupId: 50,
	productType: 750,
	customLabel: 100,
	/** Specification: 0-2000 lb / 0-1000 kg. Held to the metric bound. */
	weightGramsMax: 1_000_000,
	/** Specification: 1-3000 cm. */
	dimensionMmMin: 10,
	dimensionMmMax: 30_000
} as const;

// ---------------------------------------------------------------- attributes

/** The Google-facing attributes of one product. All optional; see migration 0037. */
export interface GoogleAttributes {
	brand: string | null;
	gtin: string | null;
	mpn: string | null;
	condition: GoogleCondition | null;
	googleProductCategory: string | null;
	productType: string | null;
	availability: GoogleAvailability | null;
	availabilityDate: string | null;
	salePriceCents: number | null;
	saleStartsAt: string | null;
	saleEndsAt: string | null;
	additionalImages: string[];
	color: string | null;
	size: string | null;
	material: string | null;
	gender: GoogleGender | null;
	ageGroup: GoogleAgeGroup | null;
	itemGroupId: string | null;
	identifierExists: boolean | null;
	weightGrams: number | null;
	lengthMm: number | null;
	widthMm: number | null;
	heightMm: number | null;
	adult: boolean;
	customLabel0: string | null;
	customLabel1: string | null;
	customLabel2: string | null;
	customLabel3: string | null;
	customLabel4: string | null;
	/** In the shop, out of the feed. */
	excluded: boolean;
}

export const EMPTY_GOOGLE: Readonly<GoogleAttributes> = Object.freeze({
	brand: null,
	gtin: null,
	mpn: null,
	condition: null,
	googleProductCategory: null,
	productType: null,
	availability: null,
	availabilityDate: null,
	salePriceCents: null,
	saleStartsAt: null,
	saleEndsAt: null,
	additionalImages: [],
	color: null,
	size: null,
	material: null,
	gender: null,
	ageGroup: null,
	itemGroupId: null,
	identifierExists: null,
	weightGrams: null,
	lengthMm: null,
	widthMm: null,
	heightMm: null,
	adult: false,
	customLabel0: null,
	customLabel1: null,
	customLabel2: null,
	customLabel3: null,
	customLabel4: null,
	excluded: false
});

// ------------------------------------------------------------ primitive rules

/**
 * GTIN-8/12/13/14 check digit: from the right, weight 3,1,3,1... over the
 * digits before the check digit; the check digit tops the sum up to a
 * multiple of ten (GS1 General Specifications, "Check digit calculation").
 * `body` is the GTIN without its last digit.
 */
export function gtinCheckDigit(body: string): number {
	let sum = 0;
	for (let i = 0; i < body.length; i++) {
		const digit = body.charCodeAt(body.length - 1 - i) - 48;
		sum += digit * (i % 2 === 0 ? 3 : 1);
	}
	return (10 - (sum % 10)) % 10;
}

/** A real GTIN: 8, 12, 13 or 14 ASCII digits whose last digit is the right check digit. */
export function isValidGtin(value: unknown): value is string {
	if (typeof value !== 'string' || !/^(?:\d{8}|\d{12,14})$/.test(value)) return false;
	return gtinCheckDigit(value.slice(0, -1)) === value.charCodeAt(value.length - 1) - 48;
}

/** Active ISO 4217 codes. A closed list: "usd" and "usdd" must not reach Google. */
const ISO_4217 = new Set(
	(
		'AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD ' +
		'CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD ' +
		'GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT ' +
		'LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR ' +
		'NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP ' +
		'STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XOF ' +
		'XPF YER ZAR ZMW ZWL'
	).split(' ')
);

export function isIso4217(code: unknown): boolean {
	return typeof code === 'string' && ISO_4217.has(code.toUpperCase());
}

/** ISO 3166-1 alpha-2 shape. The kit does not carry the full country list. */
export function isCountryCode(code: unknown): code is string {
	return typeof code === 'string' && /^[A-Z]{2}$/.test(code);
}

/** Any markup at all: a tag, a comment, a doctype, or a CDATA opener. Plain text may use "<" and ">" alone. */
export function hasHtml(text: string): boolean {
	return /<\/?[a-zA-Z][^>]*>|<!--|<!\[CDATA\[|<![a-zA-Z]/.test(text);
}

/** Control characters other than tab/newline/carriage return, and unpaired surrogates. */
const XML_ILLEGAL =
	/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Characters XML 1.0 cannot carry are dropped, never escaped: there is no escape for them. */
export function stripXmlIllegal(text: string): string {
	return text.replace(XML_ILLEGAL, '');
}

/** Text for an XML node or attribute: illegal characters dropped, the five specials escaped. */
export function escapeXml(text: string): string {
	return stripXmlIllegal(text)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/** One TSV cell: tabs, line breaks and control characters become single spaces. */
export function tsvCell(text: string): string {
	return stripXmlIllegal(text)
		.replace(/[\u0000-\u001F\u007F\u2028\u2029]+/g, ' ')
		.replace(/ {2,}/g, ' ')
		.trim();
}

/** Whole cents as the decimal Google and schema.org both want: "12.99". Integer math only. */
export function decimalPrice(cents: number): string {
	const whole = Math.floor(cents / 100);
	return `${whole}.${String(cents - whole * 100).padStart(2, '0')}`;
}

/** "12.99 USD" */
export function googlePrice(cents: number, currency: string): string {
	return `${decimalPrice(cents)} ${currency.toUpperCase()}`;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Milliseconds for an ISO 8601 date or instant with an explicit zone; NaN otherwise. */
export function parseIso(value: string): number {
	if (ISO_DATE.test(value)) {
		const ms = Date.parse(`${value}T00:00:00Z`);
		return Number.isFinite(ms) && new Date(ms).toISOString().startsWith(value) ? ms : NaN;
	}
	return ISO_INSTANT.test(value) ? Date.parse(value) : NaN;
}

/** Google's own limit: a preorder date up to a year ahead. */
const YEAR_MS = 366 * 24 * 60 * 60 * 1000;

/** An absolute https URL, or null. */
export function httpsUrl(value: unknown, max: number = LIMITS.link): string | null {
	if (typeof value !== 'string' || !value || value.length > max) return null;
	try {
		const url = new URL(value);
		return url.protocol === 'https:' && url.hostname ? url.toString() : null;
	} catch {
		return null;
	}
}

// --------------------------------------------------------------- write checks

function optionalText(
	body: Record<string, unknown>,
	key: string,
	max: number,
	label: string,
	errors: string[],
	out: Record<string, unknown>
) {
	if (body[key] === undefined) return;
	if (body[key] === null || body[key] === '') {
		out[key] = null;
		return;
	}
	const value = body[key];
	if (typeof value !== 'string' || value.trim().length > max || /[\u0000-\u001F]/.test(value)) {
		errors.push(`${label} must be plain text of ${max} characters or fewer`);
		return;
	}
	out[key] = value.trim();
}

function wholeNumber(
	body: Record<string, unknown>,
	key: string,
	min: number,
	max: number,
	label: string,
	errors: string[],
	out: Record<string, unknown>
) {
	if (body[key] === undefined) return;
	if (body[key] === null) {
		out[key] = null;
		return;
	}
	const value = body[key];
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
		errors.push(`${label} must be a whole number from ${min} to ${max}`);
		return;
	}
	out[key] = value;
}

function oneOf<T extends string>(
	body: Record<string, unknown>,
	key: string,
	allowed: readonly T[],
	label: string,
	errors: string[],
	out: Record<string, unknown>
) {
	if (body[key] === undefined) return;
	if (body[key] === null) {
		out[key] = null;
		return;
	}
	if (typeof body[key] === 'string' && (allowed as readonly string[]).includes(body[key] as string))
		out[key] = body[key];
	else errors.push(`${label} must be one of ${allowed.join(', ')}`);
}

/**
 * Check what an admin or an API client wrote. Shape and vocabulary are
 * refused here (a typo in a GTIN is caught when it is typed); the rules that
 * need the whole product (price, images, apparel attributes) are reported by
 * {@link buildListing} instead, because a row that predates a rule must be
 * shown to the admin rather than rejected by the database.
 *
 * `partial` is PATCH: absent keys are left alone, present ones must be valid.
 */
export function validateGoogleInput(
	body: unknown,
	partial = true
): Validated<Partial<GoogleAttributes>> {
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		return { ok: false, errors: ['google must be an object'] };
	}
	const b = body as Record<string, unknown>;
	const errors: string[] = [];
	const out: Record<string, unknown> = {};

	optionalText(b, 'brand', LIMITS.brand, 'brand', errors, out);
	optionalText(b, 'mpn', LIMITS.mpn, 'mpn', errors, out);
	optionalText(b, 'color', LIMITS.color, 'color', errors, out);
	optionalText(b, 'size', LIMITS.size, 'size', errors, out);
	optionalText(b, 'material', LIMITS.material, 'material', errors, out);
	optionalText(b, 'productType', LIMITS.productType, 'productType', errors, out);
	optionalText(
		b,
		'googleProductCategory',
		LIMITS.productType,
		'googleProductCategory',
		errors,
		out
	);
	for (let i = 0; i < 5; i++) {
		optionalText(b, `customLabel${i}`, LIMITS.customLabel, `customLabel${i}`, errors, out);
	}

	if (
		b.mpn &&
		typeof b.mpn === 'string' &&
		!/^[A-Za-z0-9][A-Za-z0-9 ._/\\-]*$/.test(b.mpn.trim())
	) {
		errors.push('mpn may contain letters, digits and . _ / - only');
	}
	if (
		typeof out.googleProductCategory === 'string' &&
		!/^(?:\d{1,8}|[^>\n]+(?: > [^>\n]+)*)$/.test(out.googleProductCategory)
	) {
		errors.push('googleProductCategory must be a taxonomy id (1604) or a full path (A > B > C)');
	}

	if (b.gtin !== undefined) {
		if (b.gtin === null || b.gtin === '') out.gtin = null;
		else if (isValidGtin(b.gtin)) out.gtin = b.gtin;
		else errors.push('gtin must be 8, 12, 13 or 14 digits with a correct check digit');
	}
	if (b.itemGroupId !== undefined) {
		if (b.itemGroupId === null || b.itemGroupId === '') out.itemGroupId = null;
		else if (typeof b.itemGroupId === 'string' && /^[A-Za-z0-9_-]{1,50}$/.test(b.itemGroupId))
			out.itemGroupId = b.itemGroupId;
		else errors.push('itemGroupId must be 1-50 letters, digits, dashes or underscores');
	}

	oneOf(b, 'condition', GOOGLE_CONDITIONS, 'condition', errors, out);
	oneOf(b, 'availability', GOOGLE_AVAILABILITY, 'availability', errors, out);
	oneOf(b, 'gender', GOOGLE_GENDERS, 'gender', errors, out);
	oneOf(b, 'ageGroup', GOOGLE_AGE_GROUPS, 'ageGroup', errors, out);

	for (const key of ['identifierExists'] as const) {
		if (b[key] === undefined) continue;
		if (b[key] === null || typeof b[key] === 'boolean') out[key] = b[key];
		else errors.push(`${key} must be true, false or null`);
	}
	for (const key of ['adult', 'excluded'] as const) {
		if (b[key] === undefined) continue;
		if (typeof b[key] === 'boolean') out[key] = b[key];
		else errors.push(`${key} must be true or false`);
	}

	wholeNumber(b, 'salePriceCents', 0, 99_999_999, 'salePriceCents', errors, out);
	wholeNumber(b, 'weightGrams', 1, LIMITS.weightGramsMax, 'weightGrams', errors, out);
	for (const key of ['lengthMm', 'widthMm', 'heightMm']) {
		wholeNumber(b, key, LIMITS.dimensionMmMin, LIMITS.dimensionMmMax, key, errors, out);
	}

	for (const key of ['availabilityDate', 'saleStartsAt', 'saleEndsAt'] as const) {
		if (b[key] === undefined) continue;
		if (b[key] === null || b[key] === '') out[key] = null;
		else if (typeof b[key] === 'string' && Number.isFinite(parseIso(b[key] as string)))
			out[key] = b[key];
		else errors.push(`${key} must be an ISO 8601 date or date-time with a zone`);
	}
	if (b.additionalImages !== undefined) {
		const list = b.additionalImages;
		if (list === null) out.additionalImages = [];
		else if (
			Array.isArray(list) &&
			list.length <= LIMITS.additionalImages &&
			list.every((u) => httpsUrl(u))
		)
			out.additionalImages = list.map((u) => httpsUrl(u));
		else
			errors.push(
				`additionalImages must be a list of at most ${LIMITS.additionalImages} absolute https URLs`
			);
	}

	// A sale window needs both ends, and the start must come before the end.
	const starts = (out.saleStartsAt ?? (partial ? undefined : null)) as string | null | undefined;
	const ends = (out.saleEndsAt ?? (partial ? undefined : null)) as string | null | undefined;
	if (starts !== undefined && ends !== undefined) {
		if (Boolean(starts) !== Boolean(ends))
			errors.push('A sale window needs both a start and an end');
		else if (starts && ends && parseIso(starts) >= parseIso(ends))
			errors.push('The sale must start before it ends');
	}

	return errors.length
		? { ok: false, errors }
		: { ok: true, value: out as Partial<GoogleAttributes> };
}

// ------------------------------------------------------------------- pricing

export interface PriceNow {
	/** What the shopper pays per unit today. */
	priceCents: number;
	/** The price the sale is measured against; null when nothing is on sale. */
	listPriceCents: number | null;
	onSale: boolean;
	/** End of the active sale, as an instant; null when none, or when it never ends. */
	saleEndsAt: string | null;
}

/** A sale applies now when it is lower than the price and `now` is inside its window. */
export function isSaleActive(
	product: Pick<Product, 'priceCents' | 'google'>,
	nowMs: number
): boolean {
	// A product built without `google` (an old fixture, a stored row from before 0037) has no sale.
	const g = product.google ?? EMPTY_GOOGLE;
	if (g.salePriceCents == null || g.salePriceCents >= product.priceCents) return false;
	if (g.saleStartsAt && !(parseIso(g.saleStartsAt) <= nowMs)) return false;
	if (g.saleEndsAt && !(nowMs < parseIso(g.saleEndsAt))) return false;
	return true;
}

/**
 * THE price of a product at a moment. The shop page, the cart, checkout, the
 * feed's effective price and the JSON-LD offer all come from this. Regional
 * (purchasing-power) pricing is NOT applied here: it is decided per shopper at
 * checkout, so neither Google nor the page's markup ever sees it
 * (docs/GOOGLE_LISTINGS.md, "Which price Google sees").
 */
export function priceNow(product: Pick<Product, 'priceCents' | 'google'>, nowMs: number): PriceNow {
	if (isSaleActive(product, nowMs)) {
		return {
			priceCents: product.google.salePriceCents as number,
			listPriceCents: product.priceCents,
			onSale: true,
			saleEndsAt: product.google.saleEndsAt
		};
	}
	return { priceCents: product.priceCents, listPriceCents: null, onSale: false, saleEndsAt: null };
}

// ------------------------------------------------------------------ settings

export const RETURN_CATEGORIES = ['finite', 'none', 'unlimited'] as const;
export type ReturnCategory = (typeof RETURN_CATEGORIES)[number];
export const RETURN_FEES = ['free', 'customer', 'shipping_fee'] as const;
export type ReturnFees = (typeof RETURN_FEES)[number];
export const RETURN_METHODS = ['mail', 'kiosk', 'store'] as const;
export type ReturnMethod = (typeof RETURN_METHODS)[number];

/** Owner-chosen listing settings, kept as JSON under `commerce_settings.google_listings`. */
export interface GoogleListingSettings {
	/** Used when a product has no brand of its own. Never guessed: null stays null. */
	defaultBrand: string | null;
	/** ISO 639-1. */
	contentLanguage: string;
	/** Countries the shop ships to; drives feed shipping and JSON-LD shippingDetails. */
	shipCountries: string[];
	handlingDaysMin: number | null;
	handlingDaysMax: number | null;
	transitDaysMin: number | null;
	transitDaysMax: number | null;
	/** Null = no return policy stated; nothing is claimed in the markup. */
	returns: {
		category: ReturnCategory;
		days: number | null;
		fees: ReturnFees;
		shippingFeeCents: number | null;
		methods: ReturnMethod[];
		/** Falls back to the ship-to countries. */
		countries: string[];
	} | null;
}

export const DEFAULT_LISTING_SETTINGS: GoogleListingSettings = {
	defaultBrand: null,
	contentLanguage: 'en',
	shipCountries: [],
	handlingDaysMin: null,
	handlingDaysMax: null,
	transitDaysMin: null,
	transitDaysMax: null,
	returns: null
};

function days(value: unknown): number | null {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 365
		? value
		: null;
}

function countryList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return [...new Set(value.filter(isCountryCode))].slice(0, 50);
}

/** Read stored settings leniently: anything unusable falls back to the default, never throws. */
export function parseListingSettings(raw: unknown): GoogleListingSettings {
	let data: unknown = raw;
	if (typeof raw === 'string') {
		try {
			data = JSON.parse(raw);
		} catch {
			return { ...DEFAULT_LISTING_SETTINGS };
		}
	}
	if (typeof data !== 'object' || data === null || Array.isArray(data))
		return { ...DEFAULT_LISTING_SETTINGS };
	const d = data as Record<string, unknown>;
	const r = d.returns;
	let returns: GoogleListingSettings['returns'] = null;
	if (typeof r === 'object' && r !== null && !Array.isArray(r)) {
		const x = r as Record<string, unknown>;
		const category = RETURN_CATEGORIES.find((c) => c === x.category);
		if (category) {
			returns = {
				category,
				days: days(x.days),
				fees: RETURN_FEES.find((f) => f === x.fees) ?? 'customer',
				shippingFeeCents:
					typeof x.shippingFeeCents === 'number' &&
					Number.isSafeInteger(x.shippingFeeCents) &&
					x.shippingFeeCents > 0
						? x.shippingFeeCents
						: null,
				methods: RETURN_METHODS.filter((m) => Array.isArray(x.methods) && x.methods.includes(m)),
				countries: countryList(x.countries)
			};
		}
	}
	return {
		defaultBrand:
			typeof d.defaultBrand === 'string' && d.defaultBrand.trim()
				? d.defaultBrand.trim().slice(0, LIMITS.brand)
				: null,
		contentLanguage:
			typeof d.contentLanguage === 'string' && /^[a-z]{2}$/.test(d.contentLanguage)
				? d.contentLanguage
				: 'en',
		shipCountries: countryList(d.shipCountries),
		handlingDaysMin: days(d.handlingDaysMin),
		handlingDaysMax: days(d.handlingDaysMax),
		transitDaysMin: days(d.transitDaysMin),
		transitDaysMax: days(d.transitDaysMax),
		returns
	};
}

/** Strict check for the admin form and API; returns the normalised settings. */
export function validateListingSettings(body: unknown): Validated<GoogleListingSettings> {
	if (typeof body !== 'object' || body === null || Array.isArray(body))
		return { ok: false, errors: ['Settings must be an object'] };
	const b = body as Record<string, unknown>;
	const errors: string[] = [];
	if (
		b.defaultBrand != null &&
		(typeof b.defaultBrand !== 'string' || b.defaultBrand.length > LIMITS.brand)
	)
		errors.push(`Default brand must be ${LIMITS.brand} characters or fewer`);
	if (b.contentLanguage != null && !/^[a-z]{2}$/.test(String(b.contentLanguage)))
		errors.push('Content language must be a two-letter ISO 639-1 code like en');
	if (
		b.shipCountries != null &&
		(!Array.isArray(b.shipCountries) || !b.shipCountries.every(isCountryCode))
	)
		errors.push('Ship-to countries must be two-letter ISO 3166 codes like US');
	for (const key of ['handlingDaysMin', 'handlingDaysMax', 'transitDaysMin', 'transitDaysMax']) {
		if (b[key] != null && days(b[key]) === null)
			errors.push(`${key} must be a whole number of days, 0 to 365`);
	}
	const settings = parseListingSettings(b);
	if (
		settings.handlingDaysMin != null &&
		settings.handlingDaysMax != null &&
		settings.handlingDaysMin > settings.handlingDaysMax
	)
		errors.push('Handling time: the minimum is above the maximum');
	if (
		settings.transitDaysMin != null &&
		settings.transitDaysMax != null &&
		settings.transitDaysMin > settings.transitDaysMax
	)
		errors.push('Transit time: the minimum is above the maximum');
	if (b.returns != null) {
		if (!settings.returns) errors.push('Return policy category must be finite, none or unlimited');
		else {
			if (settings.returns.category === 'finite' && settings.returns.days == null)
				errors.push('A finite return window needs a number of days');
			if (settings.returns.fees === 'shipping_fee' && !settings.returns.shippingFeeCents)
				errors.push('Return shipping fees need a non-zero amount');
		}
	}
	return errors.length ? { ok: false, errors } : { ok: true, value: settings };
}

// ------------------------------------------------------------------- listing

export type Severity = 'error' | 'warning';

/** One thing Google would reject (`error`) or that weakens the listing (`warning`). */
export interface ListingProblem {
	severity: Severity;
	/** The Google attribute, for grouping. */
	attribute: string;
	message: string;
}

export interface ShippingLine {
	country: string;
	priceCents: number;
	handlingDaysMin: number | null;
	handlingDaysMax: number | null;
	transitDaysMin: number | null;
	transitDaysMax: number | null;
}

/** A product as Google receives it. Built once, rendered three ways. */
export interface ListingItem {
	id: string;
	title: string;
	description: string;
	link: string;
	imageLink: string;
	additionalImageLinks: string[];
	availability: GoogleAvailability;
	availabilityDate: string | null;
	condition: GoogleCondition;
	currency: string;
	/** The regular price. A sale is `salePriceCents`, never a replacement of this. */
	priceCents: number;
	salePriceCents: number | null;
	saleWindow: { start: string; end: string } | null;
	brand: string | null;
	gtin: string | null;
	mpn: string | null;
	identifierExists: boolean | null;
	adult: boolean;
	color: string | null;
	size: string | null;
	material: string | null;
	gender: GoogleGender | null;
	ageGroup: GoogleAgeGroup | null;
	itemGroupId: string | null;
	weightGrams: number | null;
	lengthMm: number | null;
	widthMm: number | null;
	heightMm: number | null;
	productType: string | null;
	googleProductCategory: string | null;
	customLabels: (string | null)[];
	shipping: ShippingLine[];
}

export interface ListingContext {
	/** Canonical origin, no trailing slash: `site.url`, never the request host. */
	siteUrl: string;
	nowMs: number;
	settings: GoogleListingSettings;
	/** Flat per-order shipping the checkout charges, in cents. */
	flatShippingCents: number;
}

/** Root-relative images (R2 media) are made absolute against the canonical host. */
export function absoluteImage(value: string | null, siteUrl: string): string | null {
	if (!value) return null;
	if (value.startsWith('/') && !value.startsWith('//')) return `${siteUrl}${value}`;
	return value;
}

/** The product page address, identical to the one the JSON-LD names. */
export function productLink(siteUrl: string, slug: string): string {
	return `${siteUrl}/shop/${slug}`;
}

/** The shipping lines a physical product gets from the site's settings. */
export function shippingLines(
	product: Pick<Product, 'type'>,
	settings: GoogleListingSettings,
	flatShippingCents: number
): ShippingLine[] {
	if (product.type !== 'physical') return [];
	return settings.shipCountries.map((country) => ({
		country,
		priceCents: flatShippingCents,
		handlingDaysMin: settings.handlingDaysMin,
		handlingDaysMax: settings.handlingDaysMax,
		transitDaysMin: settings.transitDaysMin,
		transitDaysMax: settings.transitDaysMax
	}));
}

const APPAREL = /^(?:1604|187|Apparel & Accessories(?: >|$))/;

/**
 * Turn a product into what Google would receive, and say what is wrong with
 * it. `item` is null when `problems` holds an error: such a product is left
 * out of the feed (a rejected item costs the whole account standing; a
 * missing one costs one sale) and shown to the admin instead.
 */
export function buildListing(
	product: Product,
	ctx: ListingContext
): { item: ListingItem | null; problems: ListingProblem[] } {
	const g = product.google;
	const problems: ListingProblem[] = [];
	const error = (attribute: string, message: string) =>
		problems.push({ severity: 'error', attribute, message });
	const warn = (attribute: string, message: string) =>
		problems.push({ severity: 'warning', attribute, message });

	if (g.excluded) {
		return { item: null, problems: [] };
	}

	if (!product.id || product.id.length > LIMITS.id)
		error('id', `id is longer than ${LIMITS.id} characters`);

	const title = stripXmlIllegal(product.name).trim();
	if (!title) error('title', 'The product has no name');
	else if (title.length > LIMITS.title)
		error('title', `The name is ${title.length} characters; Google allows ${LIMITS.title}`);
	else if (hasHtml(title)) error('title', 'The name contains HTML; Google wants plain text');

	const description = stripXmlIllegal(product.description).trim();
	if (!description) error('description', 'The description is empty; Google requires one');
	else if (description.length > LIMITS.description)
		error(
			'description',
			`The description is ${description.length} characters; Google allows ${LIMITS.description}`
		);
	else if (hasHtml(description))
		error('description', 'The description contains HTML; Google wants plain text');

	const link = productLink(ctx.siteUrl, product.slug);
	if (link.length > LIMITS.link) error('link', 'The product address is too long');
	if (!ctx.siteUrl.startsWith('https://'))
		warn('link', 'The site address is not https; Google expects the landing page on https');

	const imageLink = absoluteImage(product.imageUrl, ctx.siteUrl);
	if (!imageLink) error('image_link', 'The product has no image; Google requires one');
	else if (!httpsUrl(imageLink)) error('image_link', 'The image must be an absolute https address');

	const additional: string[] = [];
	if (g.additionalImages.length > LIMITS.additionalImages)
		error('additional_image_link', `At most ${LIMITS.additionalImages} extra images`);
	for (const url of g.additionalImages.slice(0, LIMITS.additionalImages)) {
		const abs = absoluteImage(url, ctx.siteUrl);
		if (httpsUrl(abs)) additional.push(abs as string);
		else
			error(
				'additional_image_link',
				`Extra image "${url.slice(0, 60)}" is not an absolute https address`
			);
	}

	const currency = product.currency.toUpperCase();
	if (!isIso4217(currency))
		error('price', `"${product.currency}" is not an ISO 4217 currency code`);
	if (!Number.isSafeInteger(product.priceCents) || product.priceCents <= 0)
		error('price', 'The price must be greater than zero; Google rejects free listings');

	let salePriceCents: number | null = null;
	let saleWindow: ListingItem['saleWindow'] = null;
	if (g.salePriceCents != null) {
		if (g.salePriceCents >= product.priceCents)
			error('sale_price', 'The sale price is not below the regular price');
		else if (g.salePriceCents <= 0) error('sale_price', 'The sale price must be greater than zero');
		else salePriceCents = g.salePriceCents;
		if (Boolean(g.saleStartsAt) !== Boolean(g.saleEndsAt)) {
			error('sale_price_effective_date', 'A sale window needs both a start and an end');
		} else if (g.saleStartsAt && g.saleEndsAt) {
			const start = parseIso(g.saleStartsAt);
			const end = parseIso(g.saleEndsAt);
			if (!(start < end)) error('sale_price_effective_date', 'The sale must start before it ends');
			else {
				saleWindow = { start: g.saleStartsAt, end: g.saleEndsAt };
				if (end <= ctx.nowMs)
					warn('sale_price_effective_date', 'The sale has ended; clear it so the feed stays tidy');
			}
		}
	} else if (g.saleStartsAt || g.saleEndsAt) {
		warn('sale_price', 'A sale window is set but there is no sale price');
	}

	const availability = g.availability ?? 'in_stock';
	let availabilityDate: string | null = g.availabilityDate;
	if (availability === 'preorder' || availability === 'backorder') {
		if (!availabilityDate) error('availability_date', `${availability} needs an availability date`);
		else {
			const when = parseIso(availabilityDate);
			if (when < ctx.nowMs - 86_400_000)
				error('availability_date', 'The availability date is in the past');
			else if (when > ctx.nowMs + YEAR_MS)
				error('availability_date', 'Google accepts an availability date up to one year ahead');
		}
	} else {
		availabilityDate = null;
	}

	const condition = g.condition ?? 'new';
	const brand = g.brand ?? ctx.settings.defaultBrand;
	if (g.gtin && !isValidGtin(g.gtin))
		error('gtin', 'The GTIN check digit is wrong; Google rejects a guessed GTIN');
	if (g.identifierExists !== false) {
		if (!brand && condition === 'new')
			error(
				'brand',
				'Brand is required for new products; set one here or a default brand in Google settings'
			);
		if (!g.gtin && !g.mpn)
			warn(
				'gtin',
				'No GTIN or MPN; add one, or mark "no identifiers exist" if the product has none'
			);
		else if (!g.gtin)
			warn('gtin', 'A GTIN is strongly recommended; the MPN alone limits where it shows');
	}
	if (g.identifierExists === false && (g.gtin || g.mpn))
		warn('identifier_exists', 'Identifiers are set but the product is marked as having none');

	const apparel = g.googleProductCategory ? APPAREL.test(g.googleProductCategory) : false;
	if (apparel) {
		for (const [field, value] of [
			['color', g.color],
			['size', g.size],
			['gender', g.gender],
			['age_group', g.ageGroup]
		] as const) {
			if (!value) error(field, `${field} is required for apparel`);
		}
	}
	if (!g.googleProductCategory)
		warn('google_product_category', 'No Google product category; Google will guess one');
	if (g.itemGroupId && !g.size && !g.color)
		warn('item_group_id', 'Variants share an item group id but this one sets no color or size');

	const physical = product.type === 'physical';
	const shipping = shippingLines(product, ctx.settings, ctx.flatShippingCents);
	if (physical && ctx.settings.shipCountries.length === 0)
		warn(
			'shipping',
			'No ship-to countries in Google settings; set shipping in Merchant Center instead'
		);
	if (physical && g.weightGrams == null)
		warn('shipping_weight', 'No weight; carrier-calculated shipping needs one');

	const dims = [g.lengthMm, g.widthMm, g.heightMm];
	if (dims.some((d) => d != null) && dims.some((d) => d == null))
		warn('product_length', 'Set length, width and height together');

	for (let i = 0; i < 5; i++) {
		const label = g[`customLabel${i}` as 'customLabel0'];
		if (label && label.length > LIMITS.customLabel)
			error(`custom_label_${i}`, `Custom label ${i} is over ${LIMITS.customLabel} characters`);
	}
	for (const [attr, value, max] of [
		['brand', brand, LIMITS.brand],
		['mpn', g.mpn, LIMITS.mpn],
		['color', g.color, LIMITS.color],
		['size', g.size, LIMITS.size],
		['material', g.material, LIMITS.material],
		['product_type', g.productType, LIMITS.productType],
		['item_group_id', g.itemGroupId, LIMITS.itemGroupId]
	] as const) {
		if (value && value.length > max) error(attr, `${attr} is over ${max} characters`);
	}

	if (problems.some((p) => p.severity === 'error')) return { item: null, problems };

	const item: ListingItem = {
		id: product.id,
		title,
		description,
		link,
		imageLink: imageLink as string,
		additionalImageLinks: additional,
		availability,
		availabilityDate,
		condition,
		currency,
		priceCents: product.priceCents,
		salePriceCents,
		saleWindow,
		brand: brand ?? null,
		gtin: g.gtin,
		mpn: g.mpn,
		identifierExists: g.identifierExists,
		adult: g.adult,
		color: g.color,
		size: g.size,
		material: g.material,
		gender: g.gender,
		ageGroup: g.ageGroup,
		itemGroupId: g.itemGroupId,
		weightGrams: g.weightGrams,
		lengthMm: g.lengthMm,
		widthMm: g.widthMm,
		heightMm: g.heightMm,
		productType: g.productType,
		googleProductCategory: g.googleProductCategory,
		customLabels: [g.customLabel0, g.customLabel1, g.customLabel2, g.customLabel3, g.customLabel4],
		shipping
	};
	return { item, problems };
}

/**
 * Problems that belong to the whole site, not one product: how tax and
 * shipping are set up against Google's rules. `taxRule` is the checkout's.
 */
export function siteProblems(
	ctx: Pick<ListingContext, 'settings' | 'flatShippingCents'>,
	taxRule: { enabled: boolean; ratePercent: number; pricesIncludeTax: boolean },
	siteUrl: string
): ListingProblem[] {
	const out: ListingProblem[] = [];
	const countries = ctx.settings.shipCountries;
	const usLike = countries.some((c) => c === 'US' || c === 'CA');
	const other = countries.some((c) => c !== 'US' && c !== 'CA');
	if (taxRule.enabled && taxRule.pricesIncludeTax && usLike)
		out.push({
			severity: 'error',
			attribute: 'price',
			message:
				'Prices include tax, but Google wants US and Canadian prices without tax. Turn off COMMERCE_PRICES_INCLUDE_TAX or stop shipping there.'
		});
	if (taxRule.enabled && !taxRule.pricesIncludeTax && other)
		out.push({
			severity: 'error',
			attribute: 'price',
			message:
				'Prices exclude tax, but Google wants VAT/GST included outside the US and Canada. Set COMMERCE_PRICES_INCLUDE_TAX=true or stop shipping there.'
		});
	if (taxRule.enabled && !taxRule.pricesIncludeTax && usLike)
		out.push({
			severity: 'warning',
			attribute: 'tax',
			message:
				'US sales tax is a state-by-state rule. Set it in Merchant Center (Tax settings); the feed does not claim a flat rate.'
		});
	if (!siteUrl.startsWith('https://'))
		out.push({
			severity: 'warning',
			attribute: 'link',
			message: 'The site address is not https. Merchant Center wants a secure website.'
		});
	return out;
}

// ---------------------------------------------------------- feed-level values

/** The sale as Google evaluates it at `nowMs`, for the agreement test. */
export function feedEffectiveCents(item: ListingItem, nowMs: number): number {
	if (item.salePriceCents == null) return item.priceCents;
	if (!item.saleWindow) return item.salePriceCents;
	const inside = parseIso(item.saleWindow.start) <= nowMs && nowMs < parseIso(item.saleWindow.end);
	return inside ? item.salePriceCents : item.priceCents;
}

/** Grams as the "12.5 g"/"2 kg" form Google takes (whole grams, so no float). */
export function googleWeight(grams: number): string {
	return `${grams} g`;
}

/** Millimetres as centimetres with at most one decimal: 125 -> "12.5 cm". */
export function googleLength(mm: number): string {
	const whole = Math.floor(mm / 10);
	const tenth = mm % 10;
	return `${tenth ? `${whole}.${tenth}` : whole} cm`;
}

/** ISO 8601 window as Google writes it: `start/end`. */
export function googleWindow(window: { start: string; end: string }): string {
	return `${window.start}/${window.end}`;
}

/** schema.org `gtin*` property name for a GTIN's length. */
export function gtinProperty(gtin: string): 'gtin8' | 'gtin12' | 'gtin13' | 'gtin14' {
	return `gtin${gtin.length}` as 'gtin8' | 'gtin12' | 'gtin13' | 'gtin14';
}

// ------------------------------------------------------------------ renderers

export const RSS_NAMESPACE = 'http://base.google.com/ns/1.0';

/** `[attribute, value]` pairs for the flat attributes, in a stable order. Shipping is separate. */
function flatFields(item: ListingItem): [string, string][] {
	const fields: [string, string | null][] = [
		['id', item.id],
		['title', item.title],
		['description', item.description],
		['link', item.link],
		['image_link', item.imageLink],
		['availability', item.availability],
		['availability_date', item.availabilityDate],
		['price', googlePrice(item.priceCents, item.currency)],
		[
			'sale_price',
			item.salePriceCents == null ? null : googlePrice(item.salePriceCents, item.currency)
		],
		['sale_price_effective_date', item.saleWindow ? googleWindow(item.saleWindow) : null],
		['condition', item.condition],
		['brand', item.brand],
		['gtin', item.gtin],
		['mpn', item.mpn],
		[
			'identifier_exists',
			item.identifierExists == null ? null : item.identifierExists ? 'yes' : 'no'
		],
		['adult', item.adult ? 'yes' : null],
		['google_product_category', item.googleProductCategory],
		['product_type', item.productType],
		['color', item.color],
		['size', item.size],
		['material', item.material],
		['gender', item.gender],
		['age_group', item.ageGroup],
		['item_group_id', item.itemGroupId],
		['shipping_weight', item.weightGrams == null ? null : googleWeight(item.weightGrams)],
		['product_length', item.lengthMm == null ? null : googleLength(item.lengthMm)],
		['product_width', item.widthMm == null ? null : googleLength(item.widthMm)],
		['product_height', item.heightMm == null ? null : googleLength(item.heightMm)],
		...item.customLabels.map((v, i): [string, string | null] => [`custom_label_${i}`, v])
	];
	return fields.filter((f): f is [string, string] => f[1] != null && f[1] !== '');
}

/** The `<?xml ...?><rss>...<channel>` opening. Channel text is escaped like any other. */
export function renderRssHead(channel: {
	title: string;
	link: string;
	description: string;
}): string {
	return (
		`<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<rss xmlns:g="${RSS_NAMESPACE}" version="2.0">\n<channel>\n` +
		`<title>${escapeXml(channel.title)}</title>\n` +
		`<link>${escapeXml(channel.link)}</link>\n` +
		`<description>${escapeXml(channel.description)}</description>\n`
	);
}

export const RSS_FOOT = '</channel>\n</rss>\n';

/** One `<item>`. Every value is escaped; every element name comes from this file. */
export function renderRssItem(item: ListingItem): string {
	const lines: string[] = [];
	for (const [name, value] of flatFields(item)) {
		lines.push(`<g:${name}>${escapeXml(value)}</g:${name}>`);
	}
	for (const url of item.additionalImageLinks) {
		lines.push(`<g:additional_image_link>${escapeXml(url)}</g:additional_image_link>`);
	}
	for (const line of item.shipping) {
		const parts = [
			`<g:country>${escapeXml(line.country)}</g:country>`,
			`<g:service>Standard</g:service>`,
			`<g:price>${escapeXml(googlePrice(line.priceCents, item.currency))}</g:price>`
		];
		if (line.handlingDaysMin != null)
			parts.push(`<g:min_handling_time>${line.handlingDaysMin}</g:min_handling_time>`);
		if (line.handlingDaysMax != null)
			parts.push(`<g:max_handling_time>${line.handlingDaysMax}</g:max_handling_time>`);
		if (line.transitDaysMin != null)
			parts.push(`<g:min_transit_time>${line.transitDaysMin}</g:min_transit_time>`);
		if (line.transitDaysMax != null)
			parts.push(`<g:max_transit_time>${line.transitDaysMax}</g:max_transit_time>`);
		lines.push(`<g:shipping>${parts.join('')}</g:shipping>`);
	}
	// RSS requires title, link and description as plain elements as well.
	return (
		`<item>\n<title>${escapeXml(item.title)}</title>\n<link>${escapeXml(item.link)}</link>\n` +
		`<description>${escapeXml(item.description)}</description>\n${lines.join('\n')}\n</item>\n`
	);
}

/** Header row of the tab-separated feed. `additional_image_link` repeats as a comma list. */
export const TSV_COLUMNS = [
	'id',
	'title',
	'description',
	'link',
	'image_link',
	'additional_image_link',
	'availability',
	'availability_date',
	'price',
	'sale_price',
	'sale_price_effective_date',
	'condition',
	'brand',
	'gtin',
	'mpn',
	'identifier_exists',
	'adult',
	'google_product_category',
	'product_type',
	'color',
	'size',
	'material',
	'gender',
	'age_group',
	'item_group_id',
	'shipping_weight',
	'product_length',
	'product_width',
	'product_height',
	'custom_label_0',
	'custom_label_1',
	'custom_label_2',
	'custom_label_3',
	'custom_label_4',
	'shipping'
] as const;

export function renderTsvHeader(): string {
	return `${TSV_COLUMNS.join('\t')}\n`;
}

/**
 * One TSV row. Shipping uses Google's colon form `country:region:service:price`
 * (the specification's example is `US:CA:Overnight:16.00 USD`); several
 * destinations are comma-separated.
 */
export function renderTsvRow(item: ListingItem): string {
	const flat = new Map(flatFields(item));
	const shipping = item.shipping
		.map((s) => `${s.country}::Standard:${googlePrice(s.priceCents, item.currency)}`)
		.join(',');
	const cells = TSV_COLUMNS.map((column) => {
		if (column === 'additional_image_link') return item.additionalImageLinks.join(',');
		if (column === 'shipping') return shipping;
		return flat.get(column) ?? '';
	});
	return `${cells.map(tsvCell).join('\t')}\n`;
}

// --------------------------------------------------------------- merchant api

const MICROS_PER_CENT = 10_000;

function money(cents: number, currency: string) {
	return { amountMicros: String(cents * MICROS_PER_CENT), currencyCode: currency };
}

/**
 * The Merchant API `ProductInput.productAttributes` for an item
 * (https://developers.google.com/merchant/api/reference/rest/products_v1/ProductAttributes).
 * Field names were checked against that page on 2026-11-25; the `Price`
 * (`amountMicros` string + `currencyCode`) and `Interval` (`startTime`,
 * `endTime`) shapes were NOT readable in the fetched copy and follow Google's
 * published `Price`/`Interval` types as recalled: UNVERIFIED until a real call.
 */
export function toMerchantApiAttributes(item: ListingItem): Record<string, unknown> {
	const enumOf = (v: string | null) => (v ? v.toUpperCase() : undefined);
	const attrs: Record<string, unknown> = {
		title: item.title,
		description: item.description,
		link: item.link,
		imageLink: item.imageLink,
		additionalImageLinks: item.additionalImageLinks.length ? item.additionalImageLinks : undefined,
		availability: item.availability.toUpperCase(),
		availabilityDate: item.availabilityDate ?? undefined,
		condition: item.condition.toUpperCase(),
		price: money(item.priceCents, item.currency),
		salePrice: item.salePriceCents == null ? undefined : money(item.salePriceCents, item.currency),
		salePriceEffectiveDate: item.saleWindow
			? { startTime: item.saleWindow.start, endTime: item.saleWindow.end }
			: undefined,
		brand: item.brand ?? undefined,
		gtins: item.gtin ? [item.gtin] : undefined,
		mpn: item.mpn ?? undefined,
		identifierExists: item.identifierExists ?? undefined,
		adult: item.adult || undefined,
		color: item.color ?? undefined,
		size: item.size ?? undefined,
		material: item.material ?? undefined,
		gender: enumOf(item.gender),
		ageGroup: enumOf(item.ageGroup),
		itemGroupId: item.itemGroupId ?? undefined,
		productWeight: item.weightGrams == null ? undefined : { value: item.weightGrams, unit: 'g' },
		productLength: item.lengthMm == null ? undefined : { value: item.lengthMm / 10, unit: 'cm' },
		productWidth: item.widthMm == null ? undefined : { value: item.widthMm / 10, unit: 'cm' },
		productHeight: item.heightMm == null ? undefined : { value: item.heightMm / 10, unit: 'cm' },
		productTypes: item.productType ? [item.productType] : undefined,
		googleProductCategory: item.googleProductCategory ?? undefined,
		shipping: item.shipping.length
			? item.shipping.map((s) => ({
					country: s.country,
					price: money(s.priceCents, item.currency),
					minHandlingTime: s.handlingDaysMin == null ? undefined : String(s.handlingDaysMin),
					maxHandlingTime: s.handlingDaysMax == null ? undefined : String(s.handlingDaysMax),
					minTransitTime: s.transitDaysMin == null ? undefined : String(s.transitDaysMin),
					maxTransitTime: s.transitDaysMax == null ? undefined : String(s.transitDaysMax)
				}))
			: undefined
	};
	item.customLabels.forEach((v, i) => {
		if (v) attrs[`customLabel${i}`] = v;
	});
	return JSON.parse(JSON.stringify(attrs)) as Record<string, unknown>;
}

/** Sort problems errors-first, for display. */
export function sortProblems(problems: ListingProblem[]): ListingProblem[] {
	return [...problems].sort(
		(a, b) => Number(b.severity === 'error') - Number(a.severity === 'error')
	);
}
