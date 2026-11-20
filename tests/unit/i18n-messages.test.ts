import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { en, t, type MessageKey } from '$lib/i18n/messages';

describe('message catalogue', () => {
	it('returns the English text for a key', () => {
		expect(t('nav.signIn')).toBe('Sign In');
		expect(t('nav.searchAndCommands')).toBe('Search & commands');
	});

	it('returns a non-empty string for every key', () => {
		for (const key of Object.keys(en) as MessageKey[]) {
			expect(t(key)).toBe(en[key]);
			expect(t(key).trim()).not.toBe('');
		}
	});

	it('keeps every key in the nav namespace used by the navigation', () => {
		const source = readFileSync('src/lib/components/Navigation.svelte', 'utf8');
		for (const key of Object.keys(en)) {
			expect(source, `Navigation.svelte never uses ${key}`).toContain(`'${key}'`);
		}
	});

	it('leaves no migrated English literal in the navigation markup', () => {
		const source = readFileSync('src/lib/components/Navigation.svelte', 'utf8');
		for (const literal of [
			'aria-label="Toggle menu"',
			'aria-label="Close menu"',
			'aria-label="User menu"'
		]) {
			expect(source).not.toContain(literal);
		}
	});
});
