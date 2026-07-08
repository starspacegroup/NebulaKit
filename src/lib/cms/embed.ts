/**
 * CMS Svelte embed placeholders
 *
 * Embeds are stored inside richtext HTML as atom placeholder blocks:
 *
 *   <div data-svelte-embed="name" data-props="{&quot;key&quot;:1}"></div>
 *
 * This module is the single codec for that representation: building
 * placeholders, and parsing stored HTML into renderable segments. Pure
 * string logic — no DOM — so it runs in Workers, Vitest, and the browser.
 */

export interface EmbedSegment {
	type: 'embed';
	name: string;
	props: Record<string, unknown>;
}

export interface HtmlSegment {
	type: 'html';
	html: string;
}

export type ContentSegment = EmbedSegment | HtmlSegment;

export const EMBED_NAME_PATTERN = /^[a-z0-9-]+$/;

/** Decode the HTML attribute entities we emit when encoding props */
export function decodeAttrEntities(value: string): string {
	return value
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');
}

/** Encode a string for safe use inside a double-quoted HTML attribute */
export function encodeAttrEntities(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

/** Build the stored HTML placeholder for an embed */
export function embedPlaceholderHtml(name: string, props: Record<string, unknown> = {}): string {
	if (!EMBED_NAME_PATTERN.test(name)) {
		throw new Error(`Invalid embed name: ${name}`);
	}
	const propsAttr =
		Object.keys(props).length > 0
			? ` data-props="${encodeAttrEntities(JSON.stringify(props))}"`
			: '';
	return `<div data-svelte-embed="${name}"${propsAttr}></div>`;
}

/** Parse a data-props attribute value (raw, possibly entity-escaped) into an object */
export function parseEmbedProps(raw: string | undefined | null): Record<string, unknown> {
	if (!raw) {
		return {};
	}
	try {
		const parsed = JSON.parse(decodeAttrEntities(raw));
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
	} catch {
		// malformed props degrade to none
	}
	return {};
}

const EMBED_BLOCK_PATTERN = /<div\b[^>]*\bdata-svelte-embed="([a-z0-9-]+)"[^>]*>\s*<\/div>/g;

const PROPS_ATTR_PATTERN = /\bdata-props="([^"]*)"/;

/**
 * Split stored richtext HTML into renderable segments: plain HTML chunks and
 * embed placeholders. The public renderer maps embed segments to live Svelte
 * components and injects html segments with {@html}.
 */
export function parseContentSegments(html: string): ContentSegment[] {
	const segments: ContentSegment[] = [];
	if (typeof html !== 'string' || !html) {
		return segments;
	}

	let lastIndex = 0;
	EMBED_BLOCK_PATTERN.lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = EMBED_BLOCK_PATTERN.exec(html)) !== null) {
		if (match.index > lastIndex) {
			const chunk = html.slice(lastIndex, match.index);
			if (chunk.trim()) {
				segments.push({ type: 'html', html: chunk });
			}
		}

		const propsMatch = PROPS_ATTR_PATTERN.exec(match[0]);
		segments.push({
			type: 'embed',
			name: match[1],
			props: parseEmbedProps(propsMatch?.[1])
		});

		lastIndex = match.index + match[0].length;
	}

	if (lastIndex < html.length) {
		const chunk = html.slice(lastIndex);
		if (chunk.trim()) {
			segments.push({ type: 'html', html: chunk });
		}
	}

	return segments;
}
