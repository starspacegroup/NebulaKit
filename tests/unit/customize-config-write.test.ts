import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSiteConfig } from '../../scripts/site-config-parse.mjs';
import { applyCronTarget, applySite, renderConfig } from '../../scripts/site-config-write.mjs';
import { site } from '../../src/lib/site.config';

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

describe('the cron Worker', () => {
	const toml = readFileSync(resolve(process.cwd(), 'cron-worker/wrangler.toml'), 'utf8');
	const placeholder = 'TARGET_URL = "https://REPLACE_ME.example"';

	it('is named for the site, so two sites on one Cloudflare account do not overwrite each other', () => {
		expect(toml).toMatch(new RegExp(`^name = "${site.slug}-cron"$`, 'm'));
	});

	it('gets the site origin in place of the shipped placeholder', () => {
		expect(toml).toContain(placeholder);
		const out = applyCronTarget(toml, 'https://acme.example/some/path?x=1');
		expect(out).toContain('TARGET_URL = "https://acme.example"');
		expect(out).not.toContain('REPLACE_ME');
		// nothing else in the file moved
		expect(out.replace('TARGET_URL = "https://acme.example"', placeholder)).toBe(toml);
	});

	it('leaves a value someone already chose alone', () => {
		const chosen = toml.replace(placeholder, 'TARGET_URL = "https://www.chosen.example"');
		expect(applyCronTarget(chosen, 'https://acme.example')).toBe(chosen);
	});

	it('changes nothing when the URL is not one, rather than writing a broken value', () => {
		for (const bad of ['', 'not a url', 'acme.example']) {
			expect(applyCronTarget(toml, bad)).toBe(toml);
		}
	});

	it('is idempotent', () => {
		const once = applyCronTarget(toml, 'https://acme.example');
		expect(applyCronTarget(once, 'https://other.example')).toBe(once);
	});
});
