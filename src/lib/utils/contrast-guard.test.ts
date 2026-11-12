import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { getContrastRatio, hexToRgb, validateThemeContrast, type ThemeColors } from './contrast';
import {
	ensureContrast,
	ensureContrastRgb,
	fallbackFor,
	guardSiteTheme,
	ratioRgb,
	rgbToHex,
	SITE_THEME_PAIRS
} from './contrast-guard';
import { guardEmailTheme, notice } from '$lib/emails/templates';
import { emailTheme } from '$lib/site.config';

const channel = fc.integer({ min: 0, max: 255 });
const rgb = fc.record({ r: channel, g: channel, b: channel });
const hex = rgb.map(rgbToHex);

describe('ensureContrast', () => {
	it('meets min ≤ 4.5 for any fg and bg', () => {
		fc.assert(
			fc.property(rgb, rgb, fc.double({ min: 1, max: 4.5, noNaN: true }), (fg, bg, min) => {
				expect(ratioRgb(ensureContrastRgb(fg, bg, min), bg)).toBeGreaterThanOrEqual(min);
			}),
			{ numRuns: 5000 }
		);
	});

	it('returns a passing fg unchanged', () => {
		fc.assert(
			fc.property(hex, hex, (fg, bg) => {
				if (getContrastRatio(fg, bg) >= 4.5) expect(ensureContrast(fg, bg)).toBe(fg);
			})
		);
		expect(ensureContrast('#FFF', '#000')).toBe('#FFF');
	});

	it('above 4.5 meets min where any colour can, else returns the best possible', () => {
		fc.assert(
			fc.property(rgb, rgb, fc.double({ min: 4.5, max: 21, noNaN: true }), (fg, bg, min) => {
				const out = ratioRgb(ensureContrastRgb(fg, bg, min), bg);
				const best = ratioRgb(fallbackFor(bg), bg);
				if (best >= min) expect(out).toBeGreaterThanOrEqual(min);
				else expect(out).toBe(best);
			}),
			{ numRuns: 3000 }
		);
	});

	it('the fallback clears 4.58 on every bg', () => {
		fc.assert(
			fc.property(rgb, (bg) => {
				expect(ratioRgb(fallbackFor(bg), bg)).toBeGreaterThan(4.58);
			})
		);
	});

	it('keeps hue when darkening toward black', () => {
		const out = hexToRgb(ensureContrast('#3366ff', '#3355ee'));
		expect(out.b).toBeGreaterThan(out.g);
		expect(out.g).toBeGreaterThan(out.r);
		expect(getContrastRatio(rgbToHex(out), '#3355ee')).toBeGreaterThanOrEqual(4.5);
	});

	it('is a no-op on the shipped site themes', () => {
		const css = readFileSync('src/app.css', 'utf8');
		const blocks = [
			css.match(/:root\s*\{([\s\S]*?)\n\}/)![1],
			css.match(/\[data-theme=['"]dark['"]\]\s*\{([\s\S]*?)\n\}/)![1]
		];
		for (const block of blocks) {
			const v = (name: string) =>
				block.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{3,6});`))![1];
			const t: ThemeColors = {
				background: v('background'),
				surface: v('surface'),
				text: v('text'),
				textSecondary: v('text-secondary'),
				primary: v('primary'),
				border: v('border')
			};
			const g = guardSiteTheme(t);
			expect(g.adjustments).toEqual([]);
			expect(g.theme).toEqual(t);
		}
	});
});

describe('guardSiteTheme', () => {
	const theme = fc.record({
		background: hex,
		surface: hex,
		text: hex,
		textSecondary: hex,
		primary: hex,
		border: hex
	});

	it('checks the same pairs as validateThemeContrast', () => {
		const names = validateThemeContrast(
			{
				background: '#fff',
				surface: '#fff',
				text: '#000',
				textSecondary: '#000',
				primary: '#000',
				border: '#000'
			},
			'x'
		).checks.map((c) => c.pair);
		const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
		expect(SITE_THEME_PAIRS.map(([f, b]) => `${kebab(f)}/${kebab(b)}`)).toEqual(names);
	});

	it('every fixed theme validates unless a token is reported unmet', () => {
		fc.assert(
			fc.property(theme, (t) => {
				const g = guardSiteTheme(t);
				expect(g.original).toEqual(t);
				expect(g.theme.background).toBe(t.background);
				expect(g.theme.surface).toBe(t.surface);
				const failing = validateThemeContrast(g.theme, 'x').failedChecks.map((c) => c.pair);
				for (const pair of failing) {
					const token =
						pair.split('/')[0] === 'text-secondary' ? 'textSecondary' : pair.split('/')[0];
					expect(g.unmet).toContain(token);
				}
				for (const a of g.adjustments) expect(a.from).toBe(t[a.token as keyof ThemeColors]);
			}),
			{ numRuns: 2000 }
		);
	});

	it('reports a token no colour can fix on every background', () => {
		const g = guardSiteTheme(
			{
				background: '#000000',
				surface: '#ffffff',
				text: '#808080',
				textSecondary: '#000000',
				primary: '#ffffff',
				border: '#000000'
			},
			7
		);
		expect(g.unmet).toContain('text');
	});
});

describe('email theme guard', () => {
	it('fixes a caller theme with unreadable text and leaves the default alone', () => {
		const bad = { ...emailTheme, accent: '#ffcc00', onAccent: '#ffffff', muted: '#eeeeee' };
		const g = guardEmailTheme(bad);
		expect(getContrastRatio(g.theme.onAccent, g.theme.accent)).toBeGreaterThanOrEqual(4.5);
		expect(getContrastRatio(g.theme.muted, g.theme.surface)).toBeGreaterThanOrEqual(4.5);
		expect(g.adjustments.map((a) => a.token).sort()).toEqual(['muted', 'onAccent']);
		expect(guardEmailTheme(emailTheme).adjustments).toEqual([]);
	});

	it('renders the fixed colour, not the requested one', () => {
		const html = notice(
			{
				subject: 'Hi',
				heading: 'Hi',
				paragraphs: ['Body'],
				cta: { label: 'Go', href: 'https://example.com' }
			},
			{ theme: { ...emailTheme, accent: '#ffcc00', onAccent: '#ffffff' } }
		).html;
		expect(html).not.toMatch(/color:#ffffff/);
	});
});
