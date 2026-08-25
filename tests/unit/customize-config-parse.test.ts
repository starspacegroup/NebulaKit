import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSiteConfig } from '../../scripts/site-config-parse.mjs';
import { site } from '../../src/lib/site.config';

const root = resolve(import.meta.dirname, '../..');

/**
 * `bun run customize` reads site.config.ts as text, because it also has to
 * rewrite it. When the reader missed a value it returned undefined, and the
 * rewrite stamped the literal string "undefined" into the downstream app's
 * config — silently, on the one command a new user runs first.
 */
describe('customize config parsing', () => {
	it('reads this repository’s own config', () => {
		const parsed = parseSiteConfig(readFileSync(resolve(root, 'src/lib/site.config.ts'), 'utf8'));

		expect(parsed.name).toBe(site.name);
		expect(parsed.slug).toBe(site.slug);
		expect(parsed.tagline).toBe(site.tagline);
		expect(parsed.description).toBe(site.description);
		expect(parsed.devPort).toBe(site.devPort);
		expect(parsed.repo).toBe(site.repo);
	});

	it('reads a value in either quote style', () => {
		// Prettier writes double quotes as soon as the value holds an apostrophe.
		const parsed = parseSiteConfig(`
			export const site = {
				name: 'Acme',
				tagline:
					"Acme's full stack, in one place.",
				slug: 'acme',
				devPort: 3100
			} as const;
		`);

		expect(parsed.name).toBe('Acme');
		expect(parsed.tagline).toBe("Acme's full stack, in one place.");
		expect(parsed.slug).toBe('acme');
		expect(parsed.devPort).toBe(3100);
	});

	it('reads an escaped quote without losing it', () => {
		const parsed = parseSiteConfig(`tagline: 'Acme\\'s full stack.',`);

		expect(parsed.tagline).toBe("Acme's full stack.");
	});

	it('returns undefined rather than a wrong value when a key is absent', () => {
		const parsed = parseSiteConfig(`name: 'Acme',`);

		expect(parsed.tagline).toBeUndefined();
	});
});
