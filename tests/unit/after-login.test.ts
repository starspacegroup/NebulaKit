import { beforeEach, describe, expect, it } from 'vitest';
import { rememberNext, safeNext, takeNext } from '../../src/lib/utils/after-login';

describe('safeNext', () => {
	it('keeps a plain path on this site', () => {
		expect(safeNext('/shop/orders')).toBe('/shop/orders');
		expect(safeNext('/cart?x=1#y')).toBe('/cart?x=1#y');
	});

	it('refuses anything that could leave the site', () => {
		for (const bad of [
			'https://evil.example/',
			'//evil.example/x',
			'/\\evil.example',
			'\\\\evil.example',
			'javascript:alert(1)',
			'shop/orders',
			'/shop\n/orders',
			'',
			null,
			undefined,
			'/' + 'a'.repeat(600)
		]) {
			expect(safeNext(bad as string)).toBeNull();
		}
	});
});

describe('remembering the path across the OAuth round trip', () => {
	beforeEach(() => sessionStorage.clear());

	it('keeps a safe path once and forgets an unsafe or stale one', () => {
		rememberNext('/shop/orders');
		expect(takeNext()).toBe('/shop/orders');
		expect(takeNext()).toBeNull();

		rememberNext('/first');
		rememberNext('//evil.example');
		expect(takeNext()).toBeNull();
	});

	it('does not throw when storage is blocked', () => {
		const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
		Object.defineProperty(window, 'sessionStorage', {
			configurable: true,
			get() {
				throw new Error('blocked');
			}
		});
		expect(() => rememberNext('/x')).not.toThrow();
		expect(takeNext()).toBeNull();
		if (original) Object.defineProperty(window, 'sessionStorage', original);
	});
});
