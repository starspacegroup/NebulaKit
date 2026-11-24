import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodePng, encodePng, pngInfo, toRgbPng } from '../../scripts/lib/png.mjs';
import {
	CARD_HEIGHT,
	CARD_WIDTH,
	cardSvg,
	escapeXml,
	estimateWidth,
	mix,
	nameLayout,
	wrapText
} from '../../scripts/lib/og-card.mjs';

/** A small RGBA test image whose pixel values differ everywhere, so a wrong filter shows. */
function rgba(width: number, height: number, alpha = 255) {
	const pixels = Buffer.alloc(width * height * 4);
	for (let i = 0; i < pixels.length; i += 4) {
		const p = i / 4;
		pixels[i] = (p * 37) & 0xff;
		pixels[i + 1] = (p * 91 + 7) & 0xff;
		pixels[i + 2] = (p * 13 + 200) & 0xff;
		pixels[i + 3] = alpha;
	}
	return pixels;
}

describe('png', () => {
	it('reads a header and refuses what is not a PNG', () => {
		const png = encodePng({ width: 3, height: 2, colorType: 6, pixels: rgba(3, 2) });
		expect(pngInfo(png)).toMatchObject({
			width: 3,
			height: 2,
			bitDepth: 8,
			colorType: 6,
			interlace: 0
		});
		expect(() => pngInfo(Buffer.from('not a png at all, nothing like one, really not'))).toThrow(
			'Not a PNG'
		);
		expect(() => pngInfo(Buffer.alloc(4))).toThrow('Not a PNG');
	});

	it.each([0, 1, 2])('round-trips pixels exactly with filter type %i', (filter) => {
		const pixels = rgba(17, 9);
		const png = encodePng({ width: 17, height: 9, colorType: 6, pixels, filter });
		expect(decodePng(png).pixels.equals(pixels)).toBe(true);
		const rgb = Buffer.alloc(17 * 9 * 3);
		for (let i = 0, o = 0; i < pixels.length; i += 4, o += 3) pixels.copy(rgb, o, i, i + 3);
		expect(
			decodePng(
				encodePng({ width: 17, height: 9, colorType: 2, pixels: rgb, filter })
			).pixels.equals(rgb)
		).toBe(true);
	});

	it('flattens RGBA to an opaque RGB file with the same colours', () => {
		const pixels = rgba(8, 8);
		const out = toRgbPng(encodePng({ width: 8, height: 8, colorType: 6, pixels }));
		const info = pngInfo(out);
		expect(info).toMatchObject({ width: 8, height: 8, colorType: 2 });
		const back = decodePng(out).pixels;
		expect([back[0], back[1], back[2]]).toEqual([pixels[0], pixels[1], pixels[2]]);
	});

	it('blends transparency onto the background instead of leaving it for a crawler to colour', () => {
		const half = Buffer.from([0, 0, 0, 128]); // black at ~50%
		const white = decodePng(
			toRgbPng(encodePng({ width: 1, height: 1, colorType: 6, pixels: half }))
		).pixels;
		expect([...white]).toEqual([127, 127, 127]);
		const onRed = decodePng(
			toRgbPng(
				encodePng({ width: 1, height: 1, colorType: 6, pixels: Buffer.from([0, 0, 0, 0]) }),
				[200, 10, 10]
			)
		).pixels;
		expect([...onRed]).toEqual([200, 10, 10]);
	});

	it('refuses a PNG it cannot read rather than writing a wrong one', () => {
		const palette = encodePng({
			width: 1,
			height: 1,
			colorType: 2,
			pixels: Buffer.from([1, 2, 3])
		});
		palette[25] = 3; // palette colour type
		expect(() => decodePng(palette)).toThrow(/Unsupported PNG/);
	});
});

describe('the card layout', () => {
	it('measures narrow letters as narrow and capitals as wide', () => {
		expect(estimateWidth('illi', 100)).toBeLessThan(estimateWidth('MWMW', 100) / 2);
		expect(estimateWidth('', 100)).toBe(0);
		expect(estimateWidth('abc', 200)).toBe(2 * estimateWidth('abc', 100));
	});

	it('wraps at spaces within the width, and never exceeds the line count', () => {
		const lines = wrapText('the quick brown fox jumps over the lazy dog', 40, 500, 3);
		expect(lines.length).toBeLessThanOrEqual(3);
		for (const line of lines) expect(estimateWidth(line, 40)).toBeLessThanOrEqual(500 + 1);
	});
	it('ends the last line with an ellipsis when it had to drop words', () => {
		const lines = wrapText(
			'one two three four five six seven eight nine ten eleven twelve',
			40,
			300,
			2
		);
		expect(lines).toHaveLength(2);
		expect(lines[1].endsWith('…')).toBe(true);
		expect(estimateWidth(lines[1], 40)).toBeLessThanOrEqual(300 + 1);
	});
	it('cuts a single word that is wider than the card as a last resort', () => {
		const lines = wrapText('Supercalifragilisticexpialidocious', 100, 400, 3);
		expect(lines.length).toBeGreaterThan(1);
		for (const line of lines) expect(estimateWidth(line, 100)).toBeLessThanOrEqual(400 + 1);
	});
	it('returns nothing for empty text', () => {
		expect(wrapText('   ', 40, 500, 2)).toEqual([]);
	});

	it('gives a short name the biggest type, and never breaks a word of a name that can fit', () => {
		expect(nameLayout('Acme').size).toBe(128);
		const glass = nameLayout('StillformGlass');
		expect(glass.lines).toEqual(['StillformGlass']);
		const long = nameLayout('The Extraordinarily Long Named Company & Sons, Incorporated');
		expect(long.lines.length).toBeLessThanOrEqual(2);
		expect(long.size).toBeLessThan(100);
	});
	it('always fits the name in two lines at some size, whatever it is', () => {
		for (const name of [
			'A',
			'MMMMMMMMMMMMMMM',
			'x'.repeat(80),
			'word '.repeat(30),
			'Ü'.repeat(40)
		]) {
			const { lines, size } = nameLayout(name);
			expect(lines.length).toBeLessThanOrEqual(2);
			for (const line of lines) expect(estimateWidth(line, size)).toBeLessThanOrEqual(1000 + 1);
		}
	});

	it('mixes colours, and refuses one that is not #rrggbb', () => {
		expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
		expect(mix('#102030', '#ffffff', 0)).toBe('#102030');
		expect(mix('#102030', '#ffffff', 1)).toBe('#ffffff');
		expect(() => mix('blue', '#ffffff', 0.5)).toThrow('Not a #rrggbb colour');
	});

	it('escapes what a person typed, so a name cannot break the markup', () => {
		expect(escapeXml(`<b>"A" & 'B'</b>`)).toBe(
			'&lt;b&gt;&quot;A&quot; &amp; &apos;B&apos;&lt;/b&gt;'
		);
		const svg = cardSvg({
			name: '<script>alert(1)</script> & Co',
			tagline: 'a "quoted" tagline',
			host: 'x.test',
			accent: '#3b3f8f'
		});
		expect(svg).not.toContain('<script>');
		expect(svg).toContain('&lt;script&gt;');
	});

	it('is a 1200 x 630 card carrying the name, tagline and address', () => {
		const svg = cardSvg({
			name: 'Acme',
			tagline: 'We make anvils.',
			host: 'acme.test',
			accent: '#c92a35'
		});
		expect(svg).toContain(`width="${CARD_WIDTH}" height="${CARD_HEIGHT}"`);
		expect([CARD_WIDTH, CARD_HEIGHT]).toEqual([1200, 630]);
		for (const text of ['Acme', 'We make anvils.', 'acme.test', '#c92a35'])
			expect(svg).toContain(text);
	});
	it('omits the tagline and address when the site has none', () => {
		const svg = cardSvg({ name: 'Acme', accent: '#c92a35' });
		expect(svg.match(/<text /g)).toHaveLength(1);
	});
});

// Rasterizing needs a Chromium. Skipped where there is none (CI); the layout and PNG pieces
// above are what is tested everywhere.
function chromium(): string | null {
	if (process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH))
		return process.env.CHROMIUM_PATH;
	const base = join(homedir(), '.cache', 'ms-playwright');
	if (!existsSync(base)) return null;
	for (const dir of readdirSync(base).filter((d) => d.startsWith('chromium_headless_shell'))) {
		for (const sub of readdirSync(join(base, dir))) {
			const exe = join(base, dir, sub, 'chrome-headless-shell');
			if (existsSync(exe)) return exe;
		}
	}
	return null;
}

describe('generate-og-image', () => {
	const exe = chromium();
	it.skipIf(!exe)(
		'writes an opaque 1200 x 630 PNG and its SVG for the site it is given',
		async () => {
			const dir = mkdtempSync(join(tmpdir(), 'og-'));
			try {
				process.env.CHROMIUM_PATH = exe!;
				const { generate, hostOf } = await import('../../scripts/generate-og-image.mjs');
				expect(hostOf('https://acme.test/')).toBe('acme.test');
				const { pngPath, svgPath } = await generate({
					outDir: dir,
					config: { name: 'Acme', tagline: 'We make anvils.', url: 'https://acme.test/' },
					theme: { accent: '#c92a35' }
				});
				expect(pngInfo(readFileSync(pngPath))).toMatchObject({
					width: 1200,
					height: 630,
					colorType: 2
				});
				expect(readFileSync(svgPath, 'utf8')).toContain('Acme');
			} finally {
				rmSync(dir, { recursive: true, force: true });
			}
		},
		60_000
	);
	it('is wired as a package script', () => {
		const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
		expect(pkg.scripts['og:generate']).toBe('bun scripts/generate-og-image.mjs');
	});
});
