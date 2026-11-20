#!/usr/bin/env node
/**
 * Make this site's default share image from its own identity, so a link to any page without a
 * picture of its own is shared with a card that is about THIS site: its name, tagline and
 * address, in its accent colour.
 *
 *   bun run og:generate
 *
 * Reads `src/lib/site.config.ts` (name, tagline, url, and `emailTheme.accent`), writes
 * `static/og-image.svg` (the layout) and `static/og-image.png` (1200 x 630, opaque RGB, what
 * crawlers actually use). Headless Chromium does the rasterizing; set CHROMIUM_PATH if
 * Playwright has not installed one (`bunx playwright install chromium`).
 *
 * Run it again after changing the site's name, tagline, URL or accent. `customize.mjs` runs it
 * for you. tests/unit/share-images.test.ts fails a renamed site that still ships the stock
 * artwork.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { emailTheme, site } from '../src/lib/site.config.ts';
import { CARD_HEIGHT, CARD_WIDTH, cardSvg } from './lib/og-card.mjs';
import { toRgbPng } from './lib/png.mjs';

/** The address as people read it: no scheme, no trailing slash. */
/** @param {string} url */
export const hostOf = (url) =>
	String(url)
		.replace(/^https?:\/\//, '')
		.replace(/\/+$/, '');

/**
 * Build the card and write both files into `outDir`. Returns the paths written.
 * @param {{ outDir?: string, config?: { name: string, tagline: string, url: string }, theme?: { accent: string } }} [options]
 */
export async function generate({ outDir = 'static', config = site, theme = emailTheme } = {}) {
	const svg = cardSvg({
		name: config.name,
		tagline: config.tagline,
		host: hostOf(config.url),
		accent: theme.accent
	});
	mkdirSync(outDir, { recursive: true });
	const svgPath = join(outDir, 'og-image.svg');
	const pngPath = join(outDir, 'og-image.png');
	writeFileSync(svgPath, svg);

	const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
	try {
		const page = await browser.newPage({ viewport: { width: CARD_WIDTH, height: CARD_HEIGHT } });
		await page.setContent(`<!doctype html><body style="margin:0;background:#000">${svg}</body>`);
		const screenshot = await page.screenshot({
			type: 'png',
			clip: { x: 0, y: 0, width: CARD_WIDTH, height: CARD_HEIGHT }
		});
		writeFileSync(pngPath, toRgbPng(screenshot));
	} finally {
		await browser.close();
	}
	return { svgPath, pngPath };
}

if (process.argv[1] && process.argv[1].endsWith('generate-og-image.mjs')) {
	try {
		const { pngPath } = await generate();
		console.log(`wrote ${pngPath} for ${site.name} (${hostOf(site.url)})`);
	} catch (error) {
		console.error(
			`Could not generate the share image: ${error instanceof Error ? error.message : error}\n` +
				'  Playwright needs a Chromium: `bunx playwright install chromium`, or set CHROMIUM_PATH.'
		);
		process.exit(1);
	}
}
