/**
 * Which image a page is shared with, decided in one place so a shared link is never imageless
 * and never carries an image a platform will not show.
 *
 * The rule, in order:
 *   1. The page's own image, when it is usable: a product photo, a CMS item's featured image.
 *   2. The site's default share image (`site.ogImage`, generated for this site by
 *      `bun run og:generate`), when the page has none or its image cannot be used.
 *   3. The shipped `/og-image.png`, if the site config itself lost its default.
 *
 * "Usable" means an http(s) URL (or a root-relative path) that is not an SVG. Facebook, X and
 * LinkedIn do not render an SVG as a share image, so one would show as a blank card; falling
 * back to the site image is better than a link with nothing.
 *
 * Pure: no `$app`, no DOM. `SharingMeta.svelte` is the only caller that emits tags.
 */
import { site } from '$lib/site.config';

export interface ShareImage {
	/** Absolute URL. */
	src: string;
	alt: string;
	/** 0 when unknown: the dimension tags are left out rather than guessed. */
	width: number;
	height: number;
	/** True when the page's own image was not used. */
	isDefault: boolean;
}

export interface ShareImageInput {
	image?: string | null;
	imageAlt?: string;
	imageWidth?: number;
	imageHeight?: number;
	/** The page title: the alt text when the image has none. */
	title: string;
	/** The site's origin (`https://example.com`), to make a root-relative path absolute. */
	origin: string;
}

/** What a site always has, even if `site.ogImage` is deleted from its config. */
export const FALLBACK_SHARE_IMAGE = {
	src: '/og-image.png',
	alt: '',
	width: 1200,
	height: 630
} as const;

const MAX_URL_LENGTH = 2000;
const SVG = /\.svgz?(?:[?#]|$)/i;

/** An absolute http(s) URL for a candidate image, or null when it cannot be used. */
export function usableImageUrl(candidate: unknown, origin: string): string | null {
	if (typeof candidate !== 'string') return null;
	const value = candidate.trim();
	if (!value || value.length > MAX_URL_LENGTH) return null;
	// `//host/x.png` is protocol-relative: not a path on this site, and not worth guessing at.
	if (value.startsWith('//')) return null;
	let url: URL;
	try {
		url = new URL(value, origin);
	} catch {
		return null;
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
	if (SVG.test(url.pathname + url.search)) return null;
	return url.href;
}

const positive = (n: unknown): number =>
	typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : 0;

export function resolveShareImage(
	input: ShareImageInput,
	defaults: { src: string; alt: string; width: number; height: number } = site.ogImage ??
		FALLBACK_SHARE_IMAGE
): ShareImage {
	const own = usableImageUrl(input.image, input.origin);
	if (own) {
		return {
			src: own,
			alt: input.imageAlt || input.title,
			width: positive(input.imageWidth),
			height: positive(input.imageHeight),
			isDefault: false
		};
	}
	const fallback =
		usableImageUrl(defaults.src, input.origin) ??
		usableImageUrl(FALLBACK_SHARE_IMAGE.src, input.origin) ??
		new URL(FALLBACK_SHARE_IMAGE.src, input.origin).href;
	return {
		src: fallback,
		alt: defaults.alt || input.title,
		width: positive(defaults.width),
		height: positive(defaults.height),
		isDefault: true
	};
}

/** Any origin works for judging a candidate; only its shape matters here. */
const PROBE_ORIGIN = 'https://share-image.invalid';

/**
 * The first candidate that is a usable image, as given (not made absolute), or '' when none
 * is. For a page with several possible images in order of preference: a CMS item's SEO image,
 * then its featured image. An unusable first choice (an SVG) hands over to the next instead
 * of sending the page straight to the site default.
 */
export function firstShareImage(...candidates: unknown[]): string {
	for (const candidate of candidates) {
		if (usableImageUrl(candidate, PROBE_ORIGIN)) return String(candidate).trim();
	}
	return '';
}

/** The minimum of a builder block this needs, so this file does not import the builder package. */
interface BlockLike {
	type: string;
	props?: object;
	children?: BlockLike[];
}

/**
 * The first usable image in a builder page, in reading order (depth first), with its alt text.
 * A page with no picture of its own has none, and falls back to the site default.
 */
export function firstDocumentImage(document: {
	blocks: BlockLike[];
}): { src: string; alt: string } | null {
	const visit = (blocks: BlockLike[]): { src: string; alt: string } | null => {
		for (const block of blocks) {
			const props = (block.props ?? {}) as Record<string, unknown>;
			if (block.type === 'image' && usableImageUrl(props.src, PROBE_ORIGIN)) {
				return {
					src: String(props.src).trim(),
					alt: typeof props.alt === 'string' ? props.alt : ''
				};
			}
			const inner = block.children ? visit(block.children) : null;
			if (inner) return inner;
		}
		return null;
	};
	return visit(document.blocks);
}
