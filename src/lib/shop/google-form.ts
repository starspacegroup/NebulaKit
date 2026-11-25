/**
 * The Google listing fields of the product form, as typed (strings, so a
 * rejected form is shown back as typed), and the conversion to and from the
 * product's attributes. Pure and client-safe: the Svelte form imports the
 * blank values; the server action imports the parsing.
 */
import { validateGoogleInput, type GoogleAttributes } from '@nebulakit/commerce';
import { centsToDollars, dollarsToCents } from './money-input';

/** The Google listing fields as typed: strings, so a rejected form is shown back as typed. */
export interface GoogleFormValues {
	brand: string;
	gtin: string;
	mpn: string;
	condition: string;
	googleProductCategory: string;
	productType: string;
	availability: string;
	availabilityDate: string;
	salePrice: string;
	saleStartsAt: string;
	saleEndsAt: string;
	/** One address per line. */
	additionalImages: string;
	color: string;
	size: string;
	material: string;
	gender: string;
	ageGroup: string;
	itemGroupId: string;
	/** '' (unset), 'yes' or 'no'. */
	identifierExists: string;
	weightGrams: string;
	lengthCm: string;
	widthCm: string;
	heightCm: string;
	adult: boolean;
	excluded: boolean;
	customLabel0: string;
	customLabel1: string;
	customLabel2: string;
	customLabel3: string;
	customLabel4: string;
}

export const BLANK_GOOGLE_VALUES: GoogleFormValues = {
	brand: '',
	gtin: '',
	mpn: '',
	condition: '',
	googleProductCategory: '',
	productType: '',
	availability: '',
	availabilityDate: '',
	salePrice: '',
	saleStartsAt: '',
	saleEndsAt: '',
	additionalImages: '',
	color: '',
	size: '',
	material: '',
	gender: '',
	ageGroup: '',
	itemGroupId: '',
	identifierExists: '',
	weightGrams: '',
	lengthCm: '',
	widthCm: '',
	heightCm: '',
	adult: false,
	excluded: false,
	customLabel0: '',
	customLabel1: '',
	customLabel2: '',
	customLabel3: '',
	customLabel4: ''
};

/** Fields that are copied between the form and the product as plain text. */
const TEXT_FIELDS = [
	'brand',
	'gtin',
	'mpn',
	'condition',
	'googleProductCategory',
	'productType',
	'availability',
	'color',
	'size',
	'material',
	'gender',
	'ageGroup',
	'itemGroupId',
	'customLabel0',
	'customLabel1',
	'customLabel2',
	'customLabel3',
	'customLabel4'
] as const;

/**
 * Admin date-time fields are `<input type="datetime-local">` and mean UTC (the
 * label says so). The stored form is a full ISO instant with a zone.
 */
export function utcInputToIso(value: string): string | null {
	const v = value.trim();
	if (!v) return null;
	if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
	return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? `${v}:00Z` : v;
}

/** The inverse, for filling the input: `2026-12-01T00:00:00Z` -> `2026-12-01T00:00`. */
export function isoToUtcInput(value: string | null): string {
	if (!value) return '';
	const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?Z$/.exec(value);
	return m ? m[1] : value;
}

/** "12.5" centimetres to whole millimetres; null when it is not a plain number. */
export function cmToMm(input: string): number | null {
	const m = /^(\d{1,4})(?:\.(\d))?$/.exec(input.trim());
	return m ? Number(m[1]) * 10 + Number(m[2] ?? 0) : null;
}

export function mmToCm(mm: number | null): string {
	if (mm == null) return '';
	return mm % 10 ? `${Math.floor(mm / 10)}.${mm % 10}` : String(mm / 10);
}

export function googleToFormValues(g: GoogleAttributes): GoogleFormValues {
	const out: GoogleFormValues = { ...BLANK_GOOGLE_VALUES };
	for (const key of TEXT_FIELDS) out[key] = g[key] ?? '';
	out.availabilityDate = g.availabilityDate ?? '';
	out.salePrice = g.salePriceCents == null ? '' : centsToDollars(g.salePriceCents);
	out.saleStartsAt = isoToUtcInput(g.saleStartsAt);
	out.saleEndsAt = isoToUtcInput(g.saleEndsAt);
	out.additionalImages = g.additionalImages.join('\n');
	out.identifierExists = g.identifierExists == null ? '' : g.identifierExists ? 'yes' : 'no';
	out.weightGrams = g.weightGrams == null ? '' : String(g.weightGrams);
	out.lengthCm = mmToCm(g.lengthMm);
	out.widthCm = mmToCm(g.widthMm);
	out.heightCm = mmToCm(g.heightMm);
	out.adult = g.adult;
	out.excluded = g.excluded;
	return out;
}

export function readGoogleForm(form: FormData): GoogleFormValues {
	const field = (key: string) => String(form.get(`g_${key}`) ?? '').trim();
	const out: GoogleFormValues = { ...BLANK_GOOGLE_VALUES };
	for (const key of TEXT_FIELDS) out[key] = field(key);
	for (const key of [
		'availabilityDate',
		'salePrice',
		'saleStartsAt',
		'saleEndsAt',
		'identifierExists',
		'weightGrams',
		'lengthCm',
		'widthCm',
		'heightCm'
	] as const)
		out[key] = field(key);
	out.additionalImages = String(form.get('g_additionalImages') ?? '').trim();
	out.adult = form.get('g_adult') === 'on';
	out.excluded = form.get('g_excluded') === 'on';
	return out;
}

/** Typed Google fields to a full attribute set (every key present, so clearing a field clears the column). */
export function parseGoogleValues(
	v: GoogleFormValues
): { ok: true; value: Partial<GoogleAttributes> } | { ok: false; errors: string[] } {
	const errors: string[] = [];
	const body: Record<string, unknown> = {};
	for (const key of TEXT_FIELDS) body[key] = v[key] || null;
	body.availabilityDate = v.availabilityDate || null;
	body.saleStartsAt = utcInputToIso(v.saleStartsAt);
	body.saleEndsAt = utcInputToIso(v.saleEndsAt);
	body.additionalImages = v.additionalImages
		? v.additionalImages
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter(Boolean)
		: [];
	body.identifierExists =
		v.identifierExists === 'yes' ? true : v.identifierExists === 'no' ? false : null;
	body.adult = v.adult;
	body.excluded = v.excluded;

	if (v.salePrice) {
		const cents = dollarsToCents(v.salePrice);
		if (cents === null) errors.push('Sale price must be dollars and cents, like 9.99.');
		body.salePriceCents = cents;
	} else body.salePriceCents = null;

	if (v.weightGrams) {
		if (/^\d{1,7}$/.test(v.weightGrams)) body.weightGrams = Number(v.weightGrams);
		else errors.push('Weight must be a whole number of grams.');
	} else body.weightGrams = null;
	for (const [key, label, typed] of [
		['lengthMm', 'Length', v.lengthCm],
		['widthMm', 'Width', v.widthCm],
		['heightMm', 'Height', v.heightCm]
	] as const) {
		if (!typed) body[key] = null;
		else {
			const mm = cmToMm(typed);
			if (mm === null)
				errors.push(`${label} must be centimetres with at most one decimal, like 12.5.`);
			body[key] = mm;
		}
	}
	if (errors.length) return { ok: false, errors };
	const checked = validateGoogleInput(body, false);
	return checked.ok ? checked : { ok: false, errors: checked.errors };
}
