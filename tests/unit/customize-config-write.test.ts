import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSiteConfig } from '../../scripts/site-config-parse.mjs';
import { applySite, renderConfig } from '../../scripts/site-config-write.mjs';

const current = readFileSync(resolve(process.cwd(), 'src/lib/site.config.ts'), 'utf8');
const next = (over: Record<string, unknown> = {}) => ({
	...parseSiteConfig(current),
	name: 'Acme',
	shortName: 'Acme',
	slug: 'acme',
	tagline: "The fastest way to ship Acme's thing.",
	url: 'https://acme.example',
	...over
});

/** Everything after the `site` object: what customize must leave alone. */
const rest = (text: string) => text.slice(text.indexOf('} as const;') + '} as const;'.length);

describe('writing the site object back', () => {
	it('changes the site object and nothing after it (the regression: emailTheme was deleted)', () => {
		expect(current).toContain('export const emailTheme');
		const out = applySite(current, next());
		expect(out).toContain('export const emailTheme');
		expect(rest(out)).toBe(rest(current));
		expect(out).toContain("name: 'Acme'");
	});

	it('keeps the header comment of the existing file', () => {
		expect(
			applySite(current, next()).startsWith(current.slice(0, current.indexOf('export const site')))
		).toBe(true);
	});

	it('reads back as the values that were written, apostrophes included', () => {
		const parsed = parseSiteConfig(applySite(current, next()));
		expect(parsed).toMatchObject({
			name: 'Acme',
			slug: 'acme',
			url: 'https://acme.example',
			tagline: "The fastest way to ship Acme's thing."
		});
	});

	it('makes the share image description from the name and tagline', () => {
		const out = applySite(current, next());
		expect(out).toContain('ogImage: {');
		expect(out).toContain("src: '/og-image.png'");
		expect(out).toContain("alt: 'Acme — The fastest way to ship Acme\\'s thing.'");
		expect(out).toMatch(/width: 1200,\s*height: 630/);
	});

	it('updates the brand accent in the email theme, and only there', () => {
		const out = applySite(current, next({ accent: '#0e7c86' }));
		expect(parseSiteConfig(out).accent).toBe('#0e7c86');
		expect(out.match(/#0e7c86/g)).toHaveLength(1);
		expect(out.indexOf('#0e7c86')).toBeGreaterThan(out.indexOf('export const emailTheme'));
	});

	it('leaves the accent alone when none is given', () => {
		const before = parseSiteConfig(current).accent;
		expect(parseSiteConfig(applySite(current, next({ accent: undefined }))).accent).toBe(before);
	});

	it('writes a config that still parses to the same values when nothing changed', () => {
		const same = parseSiteConfig(current);
		expect(parseSiteConfig(applySite(current, same))).toEqual(same);
	});

	it('refuses a file with no site object instead of writing a broken one', () => {
		expect(() => applySite('export const other = 1;', next())).toThrow(/no `export const site/);
	});

	it('renders a complete canonical config as well, for a fresh file', () => {
		const text = renderConfig(next());
		expect(text).toContain('export const site = {');
		expect(text).toContain('export const repoUrl');
	});
});
