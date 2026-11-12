/**
 * Contrast guard for colours NebulaKit does not ship: a caller's email theme, a
 * site's brand palette, anything a person picks. The fixed themes in app.css are
 * proved to pass already (proofs/Proofs/Themes.lean) and never go through here.
 *
 * Guarantee (proofs/Proofs/Guard.lean): for any 8-bit fg and bg,
 * `ensureContrast(fg, bg, min)` has ratio ≥ min whenever min ≤ 4.5. The reason is
 * the fallback: every luminance L has either black or white at ratio ≥ 4.58 (the
 * worst L is √0.0525 − 0.05), and no colour beats the better of the two. Above
 * 4.5 the guard tries for `min` and, where nothing reaches it, returns that best
 * colour, which is the highest ratio any colour can have on that bg.
 */
import { getLuminance, hexToRgb, type RGB, type ThemeColors } from './contrast';

const BLACK: RGB = { r: 0, g: 0, b: 0 };
const WHITE: RGB = { r: 255, g: 255, b: 255 };
const SEARCH_STEPS = 16;

export function ratioRgb(a: RGB, b: RGB): number {
	const la = getLuminance(a);
	const lb = getLuminance(b);
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function rgbToHex({ r, g, b }: RGB): string {
	return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}

/** Black or white, whichever has the higher ratio on bg. Ties go to white. */
export function fallbackFor(bg: RGB): RGB {
	return ratioRgb(WHITE, bg) >= ratioRgb(BLACK, bg) ? WHITE : BLACK;
}

function mix(fg: RGB, to: RGB, t: number): RGB {
	return {
		r: Math.round(fg.r + (to.r - fg.r) * t),
		g: Math.round(fg.g + (to.g - fg.g) * t),
		b: Math.round(fg.b + (to.b - fg.b) * t)
	};
}

/**
 * The least mix of fg toward `to` that passes, or null when `to` itself fails.
 * `hi` passes at every step, so whatever is returned passes; monotonicity only
 * makes it the smallest change, it is not needed for correctness.
 */
function searchToward(fg: RGB, to: RGB, bg: RGB, min: number): RGB | null {
	if (ratioRgb(to, bg) < min) return null;
	let lo = 0;
	let hi = 1;
	let best = to;
	for (let i = 0; i < SEARCH_STEPS; i++) {
		const mid = (lo + hi) / 2;
		const candidate = mix(fg, to, mid);
		if (ratioRgb(candidate, bg) >= min) {
			hi = mid;
			best = candidate;
		} else {
			lo = mid;
		}
	}
	return best;
}

/**
 * Mixing toward black or white keeps the hue (up to 8-bit rounding); the side
 * with more headroom is tried first.
 */
export function ensureContrastRgb(fg: RGB, bg: RGB, min = 4.5): RGB {
	if (ratioRgb(fg, bg) >= min) return fg;
	const fallback = fallbackFor(bg);
	const other = fallback === WHITE ? BLACK : WHITE;
	for (const to of [fallback, other]) {
		const found = searchToward(fg, to, bg, min);
		if (found && ratioRgb(found, bg) >= min) return found;
	}
	return fallback;
}

export function ensureContrast(fg: string, bg: string, min = 4.5): string {
	const fgRgb = hexToRgb(fg);
	const out = ensureContrastRgb(fgRgb, hexToRgb(bg), min);
	return out === fgRgb ? fg : rgbToHex(out);
}

export interface ContrastAdjustment {
	token: string;
	against: string[];
	from: string;
	to: string;
}

export interface GuardedTheme<T> {
	theme: T;
	original: T;
	adjustments: ContrastAdjustment[];
	/** Tokens no single colour could fix against every listed background. */
	unmet: string[];
}

/**
 * A foreground that sits on several backgrounds must pass on all of them. Try
 * each background's fix and keep the first that passes everywhere; then black
 * and white; else keep the colour with the best worst-case ratio and report it.
 */
function ensureOnAll(fg: string, bgs: string[], min: number): { color: string; met: boolean } {
	const worst = (c: string) => Math.min(...bgs.map((bg) => ratioRgb(hexToRgb(c), hexToRgb(bg))));
	if (worst(fg) >= min) return { color: fg, met: true };
	const candidates = [...bgs.map((bg) => ensureContrast(fg, bg, min)), '#ffffff', '#000000'];
	const passing = candidates.find((c) => worst(c) >= min);
	if (passing) return { color: passing, met: true };
	const best = candidates.reduce((a, b) => (worst(b) > worst(a) ? b : a));
	return { color: best, met: false };
}

/**
 * Fix every foreground in `pairs` against its backgrounds. Backgrounds are never
 * changed: they are the brand. The input is returned untouched as `original`.
 */
export function guardTheme<T extends Record<string, string>>(
	theme: T,
	pairs: ReadonlyArray<readonly [keyof T & string, keyof T & string]>,
	min = 4.5
): GuardedTheme<T> {
	const backgroundsOf = new Map<string, string[]>();
	for (const [fg, bg] of pairs) backgroundsOf.set(fg, [...(backgroundsOf.get(fg) ?? []), bg]);
	const fixed: Record<string, string> = { ...theme };
	const adjustments: ContrastAdjustment[] = [];
	const unmet: string[] = [];
	for (const [token, against] of backgroundsOf) {
		const { color, met } = ensureOnAll(
			theme[token],
			against.map((bg) => theme[bg]),
			min
		);
		if (color !== theme[token]) {
			fixed[token] = color;
			adjustments.push({ token, against, from: theme[token], to: color });
		}
		if (!met) unmet.push(token);
	}
	return { theme: fixed as T, original: theme, adjustments, unmet };
}

/** The pairs `validateThemeContrast` checks, as [foreground, background]. */
export const SITE_THEME_PAIRS = [
	['text', 'background'],
	['textSecondary', 'background'],
	['primary', 'background'],
	['text', 'surface'],
	['textSecondary', 'surface']
] as const satisfies ReadonlyArray<readonly [keyof ThemeColors, keyof ThemeColors]>;

export function guardSiteTheme(theme: ThemeColors, min = 4.5): GuardedTheme<ThemeColors> {
	return guardTheme({ ...theme }, SITE_THEME_PAIRS, min);
}
