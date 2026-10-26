/**
 * Regional (purchasing-power) pricing: a site owner can lower prices for
 * buyers in countries where money buys more, using the World Bank's price
 * level index (`price-level-index.ts`, shipped as a static table, never
 * fetched at runtime).
 *
 * Ported from Ammoura's `regionalPricing.ts` (2026-10-25) and tightened:
 *
 * - Prices only ever go down. A country priced above the US, a country with
 *   no data, and a country nobody can name all pay the base price.
 * - An order is priced at the LEAST generous multiplier of every country it
 *   is tied to (where the request came from, the billing address, the
 *   shipping address), so a VPN or a borrowed address alone buys nothing.
 *   Ammoura ignored a source it could not resolve; here an unresolvable
 *   source counts as full price, because "we could not tell" is exactly what
 *   an anonymiser produces. A source that was not supplied at all (a digital
 *   order has no shipping address) is simply left out.
 * - Multipliers are whole percents in steps of 5, so prices stay steady and
 *   rounding is deterministic integer arithmetic (see `regionalPriceCents`).
 *
 * Framework-free: no SvelteKit, no D1. Storage lives in `store.ts`.
 */
import { PRICE_LEVEL_INDEX } from './price-level-index';
import type { ProductType } from './types';
import type { Validated } from './validation';

export interface RegionalPricingSettings {
	/** Off by default: a site that never opted in charges exactly what the catalog says. */
	enabled: boolean;
	/**
	 * How much of the gap to US prices is passed on, 0–1. At 0.5 a country
	 * whose prices are 40% of the US gets 30% off (half of the 60% gap).
	 */
	strength: number;
	/** The largest discount any country gets, 0–0.9. Protects the margin. */
	maxDiscount: number;
	/**
	 * Per-country multipliers the owner set by hand (`IN: 0.6` = 40% off).
	 * They win over the index and are still held to `maxDiscount`. `1` pins a
	 * country to full price.
	 */
	overrides: Record<string, number>;
	/**
	 * Which products it applies to. Digital products cost nothing to make
	 * again, so any discount is still margin. A printed tee costs the owner the
	 * same wherever the buyer lives, so `all` is a choice to make with care.
	 */
	scope: 'digital' | 'all';
}

export const DEFAULT_REGIONAL_PRICING: Readonly<RegionalPricingSettings> = Object.freeze({
	enabled: false,
	strength: 0.5,
	maxDiscount: 0.5,
	overrides: Object.freeze({}) as Record<string, number>,
	scope: 'digital'
});

/** Multipliers move in steps of this many percent. */
const STEP_PERCENT = 5;
const MAX_DISCOUNT_LIMIT = 0.9;
const OVERRIDE_MIN = 0.1;
export const MAX_OVERRIDES = 250;

/** Cloudflare reports these for anonymised or unknown origins; they name no country. */
const NON_COUNTRIES = new Set(['XX', 'T1']);

function clamp(n: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, n));
}

/** An ISO 3166-1 alpha-2 code, upper-cased, or null when the value names no country. */
export function normalizeCountry(code: unknown): string | null {
	if (typeof code !== 'string') return null;
	const upper = code.trim().toUpperCase();
	return /^[A-Z]{2}$/.test(upper) && !NON_COUNTRIES.has(upper) ? upper : null;
}

/** The price level ratio for a country (1 is US prices), or null when there is no data. */
export function priceLevel(country: unknown): number | null {
	const code = normalizeCountry(country);
	return code ? (PRICE_LEVEL_INDEX[code]?.[0] ?? null) : null;
}

export type MultiplierSource = 'disabled' | 'none' | 'index' | 'override';

export interface MultiplierPreview {
	country: string | null;
	/** The share of the base price this country pays: 1 is full price. */
	multiplier: number;
	discountPercent: number;
	source: MultiplierSource;
	/** The index figure the multiplier came from, when there is one. */
	priceLevel: number | null;
}

/** What a buyer in `country` pays as a share of the base price, and why. */
export function previewMultiplier(
	settings: RegionalPricingSettings,
	country: unknown
): MultiplierPreview {
	const code = normalizeCountry(country);
	const level = priceLevel(code);
	const full = (source: MultiplierSource): MultiplierPreview => ({
		country: code,
		multiplier: 1,
		discountPercent: 0,
		source,
		priceLevel: level
	});
	if (!settings.enabled) return full('disabled');
	if (!code) return full('none');

	const override = settings.overrides[code];
	let source: MultiplierSource = 'index';
	let raw: number;
	if (typeof override === 'number' && Number.isFinite(override)) {
		source = 'override';
		raw = override;
	} else if (level === null || level >= 1) {
		return full('none');
	} else {
		raw = 1 - clamp(settings.strength, 0, 1) * (1 - level);
	}
	const floorPercent = Math.round((1 - clamp(settings.maxDiscount, 0, MAX_DISCOUNT_LIMIT)) * 100);
	const stepped = Math.round((raw * 100) / STEP_PERCENT) * STEP_PERCENT;
	const percent = clamp(stepped, floorPercent, 100);
	return {
		country: code,
		multiplier: percent / 100,
		discountPercent: 100 - percent,
		source,
		priceLevel: level
	};
}

/** The multiplier for one country. Always between `1 - maxDiscount` and 1. */
export function countryMultiplier(settings: RegionalPricingSettings, country: unknown): number {
	return previewMultiplier(settings, country).multiplier;
}

/**
 * The multiplier for an order: the least generous (highest) of every country
 * the order is tied to. `undefined` means that source does not apply to this
 * order and is left out; `null` or an unusable code means it applies but
 * cannot be placed, which counts as full price.
 */
export function orderMultiplier(
	settings: RegionalPricingSettings,
	sources: readonly unknown[]
): number {
	if (!settings.enabled) return 1;
	const present = sources.filter((source) => source !== undefined);
	if (present.length === 0) return 1;
	return Math.max(...present.map((source) => countryMultiplier(settings, source)));
}

/** True when the settings lower this kind of product's price at all. */
export function appliesToProduct(settings: RegionalPricingSettings, type: ProductType): boolean {
	return settings.enabled && (settings.scope === 'all' || type === 'digital');
}

function overridesFrom(raw: unknown): Record<string, number> {
	const out: Record<string, number> = {};
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
	for (const [key, value] of Object.entries(raw as Record<string, unknown>).slice(
		0,
		MAX_OVERRIDES
	)) {
		const code = normalizeCountry(key);
		if (code && typeof value === 'number' && Number.isFinite(value)) {
			if (value >= OVERRIDE_MIN && value <= 1) out[code] = Math.round(value * 100) / 100;
		}
	}
	return out;
}

/**
 * Settings read from storage, made safe: anything missing or out of range
 * falls back to the default (or is clamped), and bad overrides are dropped.
 * Reading never throws, so a corrupt row degrades to "regional pricing off".
 */
export function parseRegionalPricing(raw: unknown): RegionalPricingSettings {
	const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const num = (value: unknown, fallback: number, lo: number, hi: number) =>
		typeof value === 'number' && Number.isFinite(value) ? clamp(value, lo, hi) : fallback;
	return {
		enabled: obj.enabled === true,
		strength: num(obj.strength, DEFAULT_REGIONAL_PRICING.strength, 0, 1),
		maxDiscount: num(obj.maxDiscount, DEFAULT_REGIONAL_PRICING.maxDiscount, 0, MAX_DISCOUNT_LIMIT),
		overrides: overridesFrom(obj.overrides),
		scope: obj.scope === 'all' ? 'all' : 'digital'
	};
}

/**
 * Settings from a request body. Unlike `parseRegionalPricing` this refuses
 * rather than repairs: an API caller who sends `maxDiscount: 3` should hear
 * about it, not have it quietly clamped. A partial body is merged over
 * `current`, so a caller can flip `enabled` without re-sending the rest.
 */
export function validateRegionalPricingInput(
	body: unknown,
	current: RegionalPricingSettings = DEFAULT_REGIONAL_PRICING
): Validated<RegionalPricingSettings> {
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		return { ok: false, errors: ['Body must be an object'] };
	}
	const b = body as Record<string, unknown>;
	const errors: string[] = [];
	const next: RegionalPricingSettings = { ...current, overrides: { ...current.overrides } };

	if (b.enabled !== undefined) {
		if (typeof b.enabled === 'boolean') next.enabled = b.enabled;
		else errors.push('enabled must be true or false');
	}
	if (b.strength !== undefined) {
		if (typeof b.strength === 'number' && b.strength >= 0 && b.strength <= 1)
			next.strength = b.strength;
		else errors.push('strength must be a number from 0 to 1');
	}
	if (b.maxDiscount !== undefined) {
		if (
			typeof b.maxDiscount === 'number' &&
			b.maxDiscount >= 0 &&
			b.maxDiscount <= MAX_DISCOUNT_LIMIT
		)
			next.maxDiscount = b.maxDiscount;
		else errors.push(`maxDiscount must be a number from 0 to ${MAX_DISCOUNT_LIMIT}`);
	}
	if (b.scope !== undefined) {
		if (b.scope === 'digital' || b.scope === 'all') next.scope = b.scope;
		else errors.push('scope must be "digital" or "all"');
	}
	if (b.overrides !== undefined) {
		const raw = b.overrides;
		if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
			errors.push('overrides must be an object of country code to multiplier');
		} else {
			const entries = Object.entries(raw as Record<string, unknown>);
			const overrides: Record<string, number> = {};
			if (entries.length > MAX_OVERRIDES) errors.push(`overrides holds at most ${MAX_OVERRIDES}`);
			for (const [key, value] of entries.slice(0, MAX_OVERRIDES)) {
				const code = normalizeCountry(key);
				if (!code) errors.push(`overrides: "${key}" is not a country code`);
				else if (typeof value !== 'number' || !(value >= OVERRIDE_MIN && value <= 1))
					errors.push(`overrides.${code} must be a number from ${OVERRIDE_MIN} to 1`);
				else overrides[code] = Math.round(value * 100) / 100;
			}
			next.overrides = overrides;
		}
	}
	return errors.length ? { ok: false, errors } : { ok: true, value: next };
}

/** How the shopper is told about it: honest, plain, and absent when nothing was lowered. */
export function regionalNotice(discountPercent: number): string | null {
	if (!(discountPercent > 0)) return null;
	return `Prices are ${discountPercent}% lower for your region, based on local purchasing power.`;
}

/**
 * The admin form edits overrides as lines of `CC percent-off` (`IN 40` is a
 * 40% discount), which is how an owner thinks about it. Blank lines and `#`
 * comments are skipped; a bad line is reported, never silently dropped.
 */
export function parseOverrideLines(text: string): {
	overrides: Record<string, number>;
	errors: string[];
} {
	const overrides: Record<string, number> = {};
	const errors: string[] = [];
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.replace(/#.*/, '').trim();
		if (!line) continue;
		const match = /^([A-Za-z]{2})\s*[:=,\s]\s*(\d{1,2}(?:\.\d+)?)\s*%?$/.exec(line);
		const code = match ? normalizeCountry(match[1]) : null;
		const off = match ? Number(match[2]) : NaN;
		// 0% off pins a country to full price; more than 90% off is never intended.
		if (!code || !(off >= 0 && off <= 90)) {
			errors.push(
				`"${raw.trim()}" should look like "IN 40" (a country code, then percent off, 0 to 90)`
			);
			continue;
		}
		overrides[code] = Math.round(100 - off) / 100;
	}
	return { overrides, errors };
}

/** The inverse of `parseOverrideLines`, for showing stored overrides in the form. */
export function overrideLines(overrides: Record<string, number>): string {
	return Object.entries(overrides)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([code, multiplier]) => `${code} ${Math.round((1 - multiplier) * 100)}`)
		.join('\n');
}
