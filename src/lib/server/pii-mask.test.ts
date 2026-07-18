import { describe, expect, it } from 'vitest';
import { maskName, maskEmail, maskGeneric, canRevealPii, isPiiRevealed } from './pii-mask';

describe('maskName', () => {
	it('keeps each word initial and stars the rest', () => {
		expect(maskName('Ada Lovelace')).toBe('A** L*******');
	});
	it('leaves single-character words intact', () => {
		expect(maskName('A B')).toBe('A B');
	});
	it('collapses extra spaces via filter', () => {
		expect(maskName('Ada  Lovelace')).toBe('A** L*******');
	});
	it('returns a placeholder for empty/nullish', () => {
		expect(maskName('')).toBe('*** ***');
		expect(maskName(null)).toBe('*** ***');
		expect(maskName(undefined)).toBe('*** ***');
	});
});

describe('maskEmail', () => {
	it('keeps first local char and full domain', () => {
		expect(maskEmail('ada@example.com')).toBe('a**@example.com');
	});
	it('enforces a minimum of two stars on short local parts', () => {
		expect(maskEmail('a@b.co')).toBe('a**@b.co');
	});
	it('masks strings without an @ (or leading @)', () => {
		expect(maskEmail('noat')).toBe('n***');
		expect(maskEmail('@domain')).toBe('@******');
	});
	it('returns a placeholder for empty/nullish', () => {
		expect(maskEmail('')).toBe('***@***.***');
		expect(maskEmail(null)).toBe('***@***.***');
	});
});

describe('maskGeneric', () => {
	it('masks long values keeping first two and last two', () => {
		expect(maskGeneric('abcdefgh')).toBe('ab****gh');
	});
	it('masks short values keeping only the first char', () => {
		expect(maskGeneric('abc')).toBe('a**');
		expect(maskGeneric('abcd')).toBe('a***');
	});
	it('returns a placeholder for empty/nullish', () => {
		expect(maskGeneric('')).toBe('***');
		expect(maskGeneric(undefined)).toBe('***');
	});
});

describe('canRevealPii', () => {
	it('allows only owners', () => {
		expect(canRevealPii({ isOwner: true })).toBe(true);
		expect(canRevealPii({ isOwner: true, isAdmin: true })).toBe(true);
	});
	it('denies plain admins and unknown users', () => {
		expect(canRevealPii({ isAdmin: true })).toBe(false);
		expect(canRevealPii({})).toBe(false);
		expect(canRevealPii(null)).toBe(false);
		expect(canRevealPii(undefined)).toBe(false);
	});
});

describe('isPiiRevealed', () => {
	it('is true only for an allowed user with the cookie set to "1"', () => {
		expect(isPiiRevealed({ isOwner: true }, '1')).toBe(true);
	});
	it('is false without the cookie, with a wrong value, or for disallowed users', () => {
		expect(isPiiRevealed({ isOwner: true }, undefined)).toBe(false);
		expect(isPiiRevealed({ isOwner: true }, '0')).toBe(false);
		expect(isPiiRevealed({ isAdmin: true }, '1')).toBe(false);
	});
});
