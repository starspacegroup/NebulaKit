import { isCents } from './money';
import type { CartLine } from './cart';
import type { ProductInput, ShippingAddress } from './types';

export type Validated<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
const CURRENCY = /^[a-z]{3}$/;
const COUNTRY = /^[A-Z]{2}$/;
// Deliberately loose: the payment provider and the confirmation email are the real check.
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

function text(value: unknown, max: number): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed && trimmed.length <= max ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Only http(s) image URLs; anything else (javascript:, data:) is dropped at the door. */
export function safeUrl(value: unknown): string | null {
	if (typeof value !== 'string' || !value) return null;
	try {
		const url = new URL(value);
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
	} catch {
		return null;
	}
}

/**
 * Validate a product body. `partial` is for PATCH: absent fields are left
 * alone, but every field that is present must be valid.
 */
export function validateProductInput(
	body: unknown,
	partial = false
): Validated<Partial<ProductInput>> {
	if (!isRecord(body)) return { ok: false, errors: ['Body must be an object'] };
	const errors: string[] = [];
	const out: Partial<ProductInput> = {};
	const has = (key: string) => body[key] !== undefined;

	if (has('slug') || !partial) {
		if (typeof body.slug === 'string' && SLUG.test(body.slug)) out.slug = body.slug;
		else errors.push('slug must be lowercase letters, digits and dashes');
	}
	if (has('name') || !partial) {
		const name = text(body.name, 200);
		if (name) out.name = name;
		else errors.push('name is required (200 characters at most)');
	}
	if (has('priceCents') || !partial) {
		if (isCents(body.priceCents)) out.priceCents = body.priceCents;
		else errors.push('priceCents must be a whole number of cents, zero or more');
	}
	if (has('description')) {
		if (typeof body.description === 'string' && body.description.length <= 5000)
			out.description = body.description;
		else errors.push('description must be text (5000 characters at most)');
	}
	if (has('currency')) {
		if (typeof body.currency === 'string' && CURRENCY.test(body.currency))
			out.currency = body.currency;
		else errors.push('currency must be a lowercase ISO 4217 code');
	}
	if (has('imageUrl')) {
		if (body.imageUrl === null) out.imageUrl = null;
		else {
			const url = safeUrl(body.imageUrl);
			if (url) out.imageUrl = url;
			else errors.push('imageUrl must be an http(s) URL');
		}
	}
	if (has('type')) {
		if (body.type === 'physical' || body.type === 'digital') out.type = body.type;
		else errors.push('type must be physical or digital');
	}
	if (has('printfulVariantId')) {
		const id = body.printfulVariantId;
		if (id === null || (typeof id === 'number' && Number.isSafeInteger(id) && id > 0))
			out.printfulVariantId = id as number | null;
		else errors.push('printfulVariantId must be a positive integer or null');
	}
	if (has('active')) {
		if (typeof body.active === 'boolean') out.active = body.active;
		else errors.push('active must be true or false');
	}
	return errors.length ? { ok: false, errors } : { ok: true, value: out };
}

export interface CheckoutInput {
	email: string;
	lines: CartLine[];
	shippingAddress: ShippingAddress | null;
}

export function validateShippingAddress(value: unknown): Validated<ShippingAddress> {
	if (!isRecord(value)) return { ok: false, errors: ['shippingAddress must be an object'] };
	const errors: string[] = [];
	const name = text(value.name, 200);
	const line1 = text(value.line1, 200);
	const city = text(value.city, 100);
	const postalCode = text(value.postalCode, 20);
	const country = typeof value.country === 'string' && COUNTRY.test(value.country);
	if (!name) errors.push('shippingAddress.name is required');
	if (!line1) errors.push('shippingAddress.line1 is required');
	if (!city) errors.push('shippingAddress.city is required');
	if (!postalCode) errors.push('shippingAddress.postalCode is required');
	if (!country) errors.push('shippingAddress.country must be an ISO 3166-1 alpha-2 code');
	if (errors.length) return { ok: false, errors };
	const address: ShippingAddress = {
		name: name as string,
		line1: line1 as string,
		city: city as string,
		postalCode: postalCode as string,
		country: value.country as string
	};
	const line2 = text(value.line2, 200);
	const state = text(value.state, 100);
	if (line2) address.line2 = line2;
	if (state) address.state = state;
	return { ok: true, value: address };
}

function parseLines(raw: unknown, errors: string[]): CartLine[] {
	const lines: CartLine[] = [];
	if (!Array.isArray(raw) || raw.length === 0) {
		errors.push('lines must be a non-empty array');
		return lines;
	}
	for (const line of raw) {
		if (!isRecord(line)) {
			errors.push('each line must be an object');
			break;
		}
		lines.push({ productId: String(line.productId ?? ''), quantity: line.quantity as number });
	}
	return lines;
}

export interface QuoteInput {
	lines: CartLine[];
	/** The country the shopper says they will ship to, if they have said. */
	shippingCountry?: string;
}

/** A quote body: lines and, optionally, the shipping country. No email, no address. */
export function validateQuoteInput(body: unknown): Validated<QuoteInput> {
	if (!isRecord(body)) return { ok: false, errors: ['Body must be an object'] };
	const errors: string[] = [];
	const lines = parseLines(body.lines, errors);
	let shippingCountry: string | undefined;
	if (body.shippingCountry !== undefined && body.shippingCountry !== null) {
		if (typeof body.shippingCountry === 'string' && COUNTRY.test(body.shippingCountry))
			shippingCountry = body.shippingCountry;
		else errors.push('shippingCountry must be an ISO 3166-1 alpha-2 code');
	}
	return errors.length
		? { ok: false, errors }
		: { ok: true, value: { lines, ...(shippingCountry ? { shippingCountry } : {}) } };
}

/** A checkout body. Prices in it, if any, are ignored — `priceCart` reads the catalog. */
export function validateCheckoutInput(body: unknown): Validated<CheckoutInput> {
	if (!isRecord(body)) return { ok: false, errors: ['Body must be an object'] };
	const errors: string[] = [];
	const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
	if (!EMAIL.test(email)) errors.push('email is not a valid address');

	const lines = parseLines(body.lines, errors);

	let shippingAddress: ShippingAddress | null = null;
	if (body.shippingAddress !== undefined && body.shippingAddress !== null) {
		const address = validateShippingAddress(body.shippingAddress);
		if (address.ok) shippingAddress = address.value;
		else errors.push(...address.errors);
	}
	return errors.length
		? { ok: false, errors }
		: { ok: true, value: { email, lines, shippingAddress } };
}
