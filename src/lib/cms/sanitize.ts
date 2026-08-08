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

const MAX_EMBED_PROPS_BYTES = 4096;
const MAX_EMBED_DEPTH = 6;
const MAX_EMBED_ENTRIES = 64;
const EMBED_PROP_KEY = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const FORBIDDEN_PROP_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

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

function decodeUrlEntities(value: string): string {
	return value
		.replace(/&#(?:x([0-9a-f]+)|(\d+));?/gi, (_match, hex: string, decimal: string) => {
			const codePoint = Number.parseInt(hex || decimal, hex ? 16 : 10);
			return Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
				? String.fromCodePoint(codePoint)
				: '\uFFFD';
		})
		.replace(/&(amp|apos|colon|gt|lt|newline|quot|tab);/gi, (_match, entity: string) => {
			const entities: Record<string, string> = {
				amp: '&',
				apos: "'",
				colon: ':',
				gt: '>',
				lt: '<',
				newline: '\n',
				quot: '"',
				tab: '\t'
			};
			return entities[entity.toLowerCase()];
		});
}

export function sanitizeCmsUrl(raw: string, image = false): string | null {
	const decoded = decodeUrlEntities(raw)
		.replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
		.trim();
	if (!decoded) return null;

	const normalized = decoded.replace(/\s/g, '').toLowerCase();
	if (/^[\\/]{2}/.test(normalized)) return null;

	const colon = normalized.indexOf(':');
	const firstPathCharacter = normalized.search(/[/?#]/);
	if (colon >= 0 && (firstPathCharacter < 0 || colon < firstPathCharacter)) {
		const scheme = normalized.slice(0, colon);
		const allowedSchemes = image ? ['http', 'https'] : ['http', 'https', 'mailto', 'tel'];
		if (!allowedSchemes.includes(scheme)) return null;
	}

	return decoded;
}

function isSafeEmbedValue(value: unknown, depth = 0): boolean {
	if (depth > MAX_EMBED_DEPTH) return false;
	if (value === null || typeof value === 'boolean') return true;
	if (typeof value === 'number') return Number.isFinite(value);
	if (typeof value === 'string') return value.length <= MAX_EMBED_PROPS_BYTES;
	if (Array.isArray(value)) {
		return (
			value.length <= MAX_EMBED_ENTRIES &&
			value.every((entry) => isSafeEmbedValue(entry, depth + 1))
		);
	}
	if (typeof value !== 'object') return false;

	const entries = Object.entries(value as Record<string, unknown>);
	return (
		entries.length <= MAX_EMBED_ENTRIES &&
		entries.every(
			([key, entry]) =>
				EMBED_PROP_KEY.test(key) &&
				!FORBIDDEN_PROP_KEYS.has(key) &&
				isSafeEmbedValue(entry, depth + 1)
		)
	);
}

const filter = new FilterXSS({
	whiteList: ALLOWED_TAGS,
	stripIgnoreTag: true,
	stripIgnoreTagBody: [
		'iframe',
		'math',
		'noscript',
		'object',
		'script',
		'style',
		'template'
	],
	onTagAttr(tag, name, value) {
		if (tag === 'div' && name === 'data-svelte-embed') {
			return EMBED_NAME_PATTERN.test(value)
				? `data-svelte-embed="${encodeAttrEntities(value)}"`
				: '';
		}
		if (tag === 'div' && name === 'data-props') {
			// The value arrives raw from the parser (entity-escaped as stored)
			if (value.length > MAX_EMBED_PROPS_BYTES) return '';
			try {
				const decoded = decodeAttrEntities(value);
				const parsed = JSON.parse(decoded);
				if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && isSafeEmbedValue(parsed)) {
					const serialized = JSON.stringify(parsed);
					if (serialized.length <= MAX_EMBED_PROPS_BYTES) {
						return `data-props="${encodeAttrEntities(serialized)}"`;
					}
				}
			} catch {
				// fall through — drop the attribute
			}
			return '';
		}
		if (name === 'href' || name === 'src') {
			const safeUrl = sanitizeCmsUrl(value, name === 'src');
			return safeUrl ? `${name}="${encodeAttrEntities(safeUrl)}"` : '';
		}
		if (name === 'target') {
			return value.toLowerCase() === '_blank' ? 'target="_blank"' : '';
		}
		if (name === 'rel') {
			const safeTokens = new Set(['nofollow', 'noopener', 'noreferrer', 'sponsored', 'ugc']);
			const rel = value
				.toLowerCase()
				.split(/\s+/)
				.filter((token, index, tokens) => safeTokens.has(token) && tokens.indexOf(token) === index)
				.join(' ');
			return rel ? `rel="${rel}"` : '';
		}
		if (name === 'width' || name === 'height' || (tag === 'ol' && name === 'start')) {
			const maximum = tag === 'ol' ? 1_000_000 : 4096;
			const number = Number(value);
			return Number.isInteger(number) && number >= 1 && number <= maximum
				? `${name}="${number}"`
				: '';
		}
		return undefined; // default handling
	}
});

/** Sanitize a rich text HTML string for storage */
export function sanitizeHtml(html: string): string {
	if (typeof html !== 'string' || !html) {
		return '';
	}
	return filter
		.process(html)
		.replace(/<div\b([^>]*)>/g, (tag, attributes: string) =>
			attributes.includes('data-props=') && !attributes.includes('data-svelte-embed=')
				? tag.replace(/\sdata-props="[^"]*"/, '')
				: tag
		)
		.replace(/<a\b[^>]*target="_blank"[^>]*>/g, (tag) => {
			const existingRel = tag.match(/\srel="([^"]*)"/)?.[1].split(/\s+/) ?? [];
			const rel = [...new Set(['noopener', 'noreferrer', ...existingRel])].join(' ');
			return tag.replace(/\srel="[^"]*"/, '').replace(/>$/, ` rel="${rel}">`);
		});
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

/** Render-boundary alias used for defense in depth over legacy/imported rows. */
export const sanitizeRichTextHtml = sanitizeHtml;

/** Service-boundary alias; CMS-v2 keeps sanitization centralized here. */
export const sanitizeContentFields = sanitizeRichtextFields;
