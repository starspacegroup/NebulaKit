/**
 * CMS rich text sanitization
 *
 * Server-side HTML sanitization for richtext fields, run on every CMS write
 * (POST and PUT). Uses js-xss (pure JS — works identically in Cloudflare
 * Workers, Vitest, and the browser). The whitelist covers standard article
 * markup plus the Svelte embed placeholder:
 *
 *   <div data-svelte-embed="name" data-props="{...}"></div>
 *
 * Content is rendered with {@html} on the public site, so this sanitizer is
 * the write-time defense (writes are additionally owner/admin-gated).
 */

// xss is CommonJS — import the namespace and unwrap the interop default so
// this works under Vite SSR, Workers bundling, and Vitest alike.
import * as xssModule from 'xss';
import { decodeAttrEntities, encodeAttrEntities, EMBED_NAME_PATTERN } from './embed';
import type { ContentFieldDefinition } from './types';

const FilterXSS = ((xssModule as unknown as { default?: typeof xssModule }).default ?? xssModule)
	.FilterXSS as typeof xssModule.FilterXSS;

// Presentational SVG subset for inline illustrations. Deliberately absent:
// script, foreignObject, use, image, animate*, and any href/xlink:href —
// the tags/attrs that can execute or fetch.
const SVG_PAINT = [
	'fill',
	'stroke',
	'stroke-width',
	'opacity',
	'fill-opacity',
	'stroke-opacity',
	'stroke-dasharray',
	'stroke-linecap',
	'stroke-linejoin',
	'transform',
	'class'
];

const ALLOWED_TAGS: Record<string, string[]> = {
	h2: ['class'],
	h3: ['class'],
	h4: ['class'],
	p: ['class'],
	a: ['href', 'title', 'target', 'rel'],
	strong: [],
	b: [],
	em: [],
	i: [],
	s: [],
	u: [],
	code: ['class'],
	pre: ['class'],
	blockquote: [],
	ul: [],
	ol: ['start'],
	li: [],
	hr: [],
	br: [],
	img: ['src', 'alt', 'title', 'width', 'height'],
	figure: [],
	figcaption: [],
	table: [],
	thead: [],
	tbody: [],
	tr: [],
	th: [],
	td: [],
	span: ['class'],
	div: ['data-svelte-embed', 'data-props', 'class'],
	// SVG illustrations (inline, presentational only)
	svg: [
		'viewbox',
		'xmlns',
		'width',
		'height',
		'fill',
		'aria-label',
		'role',
		'class',
		'preserveaspectratio'
	],
	g: [...SVG_PAINT],
	path: ['d', ...SVG_PAINT],
	rect: ['x', 'y', 'width', 'height', 'rx', 'ry', ...SVG_PAINT],
	circle: ['cx', 'cy', 'r', ...SVG_PAINT],
	ellipse: ['cx', 'cy', 'rx', 'ry', ...SVG_PAINT],
	line: ['x1', 'y1', 'x2', 'y2', ...SVG_PAINT],
	polyline: ['points', ...SVG_PAINT],
	polygon: ['points', ...SVG_PAINT],
	text: [
		'x',
		'y',
		'dx',
		'dy',
		'font-size',
		'font-family',
		'font-weight',
		'font-style',
		'text-anchor',
		'dominant-baseline',
		'lengthadjust',
		'textlength',
		...SVG_PAINT
	],
	tspan: ['x', 'y', 'dx', 'dy', 'font-size', 'font-weight', 'text-anchor', ...SVG_PAINT],
	defs: [],
	lineargradient: ['id', 'x1', 'y1', 'x2', 'y2', 'gradientunits', 'gradienttransform'],
	radialgradient: ['id', 'cx', 'cy', 'r', 'fx', 'fy', 'gradientunits', 'gradienttransform'],
	stop: ['offset', 'stop-color', 'stop-opacity']
};

function isSafeUrl(value: string): boolean {
	const trimmed = value.trim().toLowerCase();
	if (trimmed.startsWith('javascript:') || trimmed.startsWith('vbscript:')) {
		return false;
	}
	if (trimmed.startsWith('data:')) {
		return false;
	}
	return true;
}

const filter = new FilterXSS({
	whiteList: ALLOWED_TAGS,
	stripIgnoreTag: true,
	stripIgnoreTagBody: ['script', 'style'],
	onTagAttr(tag, name, value) {
		if (tag === 'div' && name === 'data-svelte-embed') {
			return EMBED_NAME_PATTERN.test(value)
				? `data-svelte-embed="${encodeAttrEntities(value)}"`
				: '';
		}
		if (tag === 'div' && name === 'data-props') {
			// The value arrives raw from the parser (entity-escaped as stored)
			try {
				const decoded = decodeAttrEntities(value);
				const parsed = JSON.parse(decoded);
				if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
					return `data-props="${encodeAttrEntities(JSON.stringify(parsed))}"`;
				}
			} catch {
				// fall through — drop the attribute
			}
			return '';
		}
		if ((name === 'href' || name === 'src') && !isSafeUrl(value)) {
			return '';
		}
		return undefined; // default handling
	}
});

/** Sanitize a rich text HTML string for storage */
export function sanitizeHtml(html: string): string {
	if (typeof html !== 'string' || !html) {
		return '';
	}
	return filter.process(html);
}

/**
 * Return a copy of a CMS item's fields with every richtext field sanitized.
 * Non-richtext fields pass through untouched.
 */
export function sanitizeRichtextFields(
	fields: Record<string, unknown>,
	definitions: ContentFieldDefinition[]
): Record<string, unknown> {
	const result: Record<string, unknown> = { ...fields };
	for (const def of definitions) {
		if (def.type === 'richtext' && typeof result[def.name] === 'string') {
			result[def.name] = sanitizeHtml(result[def.name] as string);
		}
	}
	return result;
}
