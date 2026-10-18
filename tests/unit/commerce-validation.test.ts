import { describe, expect, it } from 'vitest';
import {
	safeUrl,
	validateCheckoutInput,
	validateProductInput,
	validateShippingAddress
} from '@nebulakit/commerce';

const address = {
	name: 'Ada',
	line1: '1 Main St',
	city: 'Lewiston',
	postalCode: '04240',
	country: 'US'
};

describe('validateProductInput', () => {
	it('accepts a full product', () => {
		const result = validateProductInput({
			slug: 'tee',
			name: ' Tee ',
			priceCents: 2500,
			description: 'Soft',
			currency: 'usd',
			imageUrl: 'https://cdn.example/tee.png',
			type: 'digital',
			printfulVariantId: 42,
			active: false
		});
		expect(result).toEqual({
			ok: true,
			value: {
				slug: 'tee',
				name: 'Tee',
				priceCents: 2500,
				description: 'Soft',
				currency: 'usd',
				imageUrl: 'https://cdn.example/tee.png',
				type: 'digital',
				printfulVariantId: 42,
				active: false
			}
		});
	});

	it('requires slug, name and price on create but not on patch', () => {
		const created = validateProductInput({});
		expect(created.ok).toBe(false);
		if (!created.ok) expect(created.errors).toHaveLength(3);
		expect(validateProductInput({}, true)).toEqual({ ok: true, value: {} });
		expect(validateProductInput({ imageUrl: null, printfulVariantId: null }, true)).toEqual({
			ok: true,
			value: { imageUrl: null, printfulVariantId: null }
		});
	});

	it('names every bad field', () => {
		const result = validateProductInput({
			slug: 'Bad Slug',
			name: '',
			priceCents: 1.5,
			description: 7,
			currency: 'USD',
			imageUrl: 'javascript:alert(1)',
			type: 'service',
			printfulVariantId: -1,
			active: 'yes'
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.errors).toHaveLength(9);
		expect(validateProductInput('nope').ok).toBe(false);
		expect(validateProductInput([]).ok).toBe(false);
	});

	it('keeps only http(s) URLs', () => {
		expect(safeUrl('http://x.test/a')).toBe('http://x.test/a');
		expect(safeUrl('data:text/html,hi')).toBeNull();
		expect(safeUrl('not a url')).toBeNull();
		expect(safeUrl('')).toBeNull();
		expect(safeUrl(5)).toBeNull();
	});
});

describe('validateCheckoutInput', () => {
	it('accepts a checkout and lowercases the email', () => {
		const result = validateCheckoutInput({
			email: ' Ada@Example.COM ',
			lines: [{ productId: 'p1', quantity: 2 }],
			shippingAddress: { ...address, line2: 'Apt 2', state: 'ME' }
		});
		expect(result).toEqual({
			ok: true,
			value: {
				email: 'ada@example.com',
				lines: [{ productId: 'p1', quantity: 2 }],
				shippingAddress: { ...address, line2: 'Apt 2', state: 'ME' }
			}
		});
	});

	it('allows a checkout with no address (digital goods)', () => {
		const result = validateCheckoutInput({ email: 'a@b.co', lines: [{ quantity: 1 }] });
		expect(result).toEqual({
			ok: true,
			value: { email: 'a@b.co', lines: [{ productId: '', quantity: 1 }], shippingAddress: null }
		});
	});

	it('refuses bad bodies', () => {
		expect(validateCheckoutInput(null).ok).toBe(false);
		const bad = validateCheckoutInput({ email: 7, lines: [], shippingAddress: {} });
		expect(bad.ok).toBe(false);
		if (!bad.ok) expect(bad.errors.length).toBeGreaterThanOrEqual(3);
		const badLine = validateCheckoutInput({ email: 'a@b.co', lines: ['x'] });
		expect(badLine).toEqual({ ok: false, errors: ['each line must be an object'] });
	});

	it('validates an address on its own', () => {
		expect(validateShippingAddress('x').ok).toBe(false);
		const result = validateShippingAddress({ ...address, country: 'usa' });
		expect(result).toEqual({
			ok: false,
			errors: ['shippingAddress.country must be an ISO 3166-1 alpha-2 code']
		});
		expect(validateShippingAddress({}).ok).toBe(false);
	});
});
