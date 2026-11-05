/**
 * Every one of the 16,777,216 8-bit backgrounds, through the real guard code.
 * Asserts: the black/white fallback reaches 4.5 (and reports the minimum it
 * reaches), and ensureContrast meets 4.5 for a spread of foregrounds.
 * Too slow for the normal suite. Run: bun run test:contrast-exhaustive
 */
import { ensureContrastRgb, fallbackFor, ratioRgb } from '../src/lib/utils/contrast-guard';
import type { RGB } from '../src/lib/utils/contrast';

const FOREGROUNDS: RGB[] = [
	{ r: 0, g: 0, b: 0 },
	{ r: 255, g: 255, b: 255 },
	{ r: 118, g: 118, b: 118 },
	{ r: 0, g: 102, b: 204 },
	{ r: 255, g: 204, b: 0 },
	{ r: 220, g: 38, b: 38 }
];
const MIN = 4.5;

const started = performance.now();
let worstFallback = Infinity;
let worstBg = 0;
let worstEnsure = Infinity;
let failures = 0;

for (let n = 0; n < 1 << 24; n++) {
	const bg: RGB = { r: n >> 16, g: (n >> 8) & 255, b: n & 255 };
	const f = ratioRgb(fallbackFor(bg), bg);
	if (f < worstFallback) {
		worstFallback = f;
		worstBg = n;
	}
	if (f < MIN) failures++;
	for (const fg of FOREGROUNDS) {
		const r = ratioRgb(ensureContrastRgb(fg, bg, MIN), bg);
		if (r < worstEnsure) worstEnsure = r;
		if (r < MIN && ++failures <= 10) console.log('FAIL', fg, bg, r);
	}
}

const seconds = ((performance.now() - started) / 1000).toFixed(1);
console.log(
	`16777216 backgrounds × (fallback + ${FOREGROUNDS.length} fg) in ${seconds}s: ` +
		`min fallback ratio ${worstFallback.toFixed(6)} at #${worstBg.toString(16).padStart(6, '0')}, ` +
		`min ensureContrast ratio ${worstEnsure.toFixed(6)}, ${failures} failures`
);
process.exit(failures ? 1 : 0);
