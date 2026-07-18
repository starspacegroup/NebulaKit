import { describe, expect, it } from 'vitest';
import { validateContactInput, CONTACT_MESSAGE_MIN_LENGTH } from './contact-validation';

describe('validateContactInput', () => {
	const valid = { name: 'Ada', email: 'ada@example.com', message: 'Hello there, this works.' };

	it('accepts and trims valid input', () => {
		const result = validateContactInput({
			name: '  Ada  ',
			email: '  ada@example.com ',
			message: '  Hello there, this works.  '
		});
		expect(result).toEqual({
			ok: true,
			value: { name: 'Ada', email: 'ada@example.com', message: 'Hello there, this works.' }
		});
	});

	it('rejects missing name', () => {
		expect(validateContactInput({ ...valid, name: '   ' })).toEqual({
			ok: false,
			error: 'Please fill in all required fields.'
		});
	});

	it('rejects missing email and message', () => {
		expect(validateContactInput({ name: 'Ada' }).ok).toBe(false);
		expect(validateContactInput({ name: 'Ada', email: 'ada@example.com' }).ok).toBe(false);
	});

	it('rejects non-string inputs', () => {
		expect(validateContactInput({ name: 5, email: {}, message: [] }).ok).toBe(false);
	});

	it('rejects an invalid email', () => {
		expect(validateContactInput({ ...valid, email: 'not-an-email' })).toEqual({
			ok: false,
			error: 'Please provide a valid email address.'
		});
	});

	it('rejects a too-short message', () => {
		const short = 'x'.repeat(CONTACT_MESSAGE_MIN_LENGTH - 1);
		expect(validateContactInput({ ...valid, message: short })).toEqual({
			ok: false,
			error: 'Message is too short.'
		});
	});

	it('accepts a message exactly at the minimum length', () => {
		const exact = 'x'.repeat(CONTACT_MESSAGE_MIN_LENGTH);
		expect(validateContactInput({ ...valid, message: exact }).ok).toBe(true);
	});
});
