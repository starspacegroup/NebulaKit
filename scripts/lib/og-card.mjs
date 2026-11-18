// @ts-nocheck -- a plain Node script, covered by tests/unit/og-card.test.ts rather than by types.
/**
 * The share card for a site: its name, its tagline and its address on a branded background,
 * as an SVG string. Pure, so the layout is testable without a browser. `generate-og-image.mjs`
 * rasterizes it.
 *
 * The point is relevance: a client site that never replaced the NebulaKit artwork shares as
 * NebulaKit. This card is made from the site's own `site.config.ts`, so it is always about the
 * site it ships with.
 */

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

const XML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
export const escapeXml = (text) => String(text).replace(/[&<>"']/g, (c) => XML_ENTITIES[c]);

/** `#rrggbb` mixed toward `target` by `amount` (0 keeps `hex`, 1 is `target`). */
export function mix(hex, target, amount) {
	const parse = (h) => {
		const m = /^#?([0-9a-f]{6})$/i.exec(h);
		if (!m) throw new Error(`Not a #rrggbb colour: ${h}`);
		return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
	};
	const [a, b] = [parse(hex), parse(target)];
	return (
		'#' +
		a
			.map((v, i) =>
				Math.round(v + (b[i] - v) * amount)
					.toString(16)
					.padStart(2, '0')
			)
			.join('')
	);
}

/**
 * How wide `text` is at `size` px in a bold sans, estimated from the kind of glyph. Real fonts
 * differ by a few percent; the layout leaves slack for that. Narrow letters (i, l, t) and wide
 * ones (m, w, capitals) are told apart because a name like "StillformGlass" is mostly narrow
 * letters and a flat per-character width would shrink it for no reason.
 */
export function estimateWidth(text, size) {
	let em = 0;
	for (const ch of String(text)) {
		if ("iljtfIr.,:;!|' ".includes(ch)) em += 0.3;
		else if ('mwMW@'.includes(ch)) em += 0.85;
		else if (/[A-Z0-9]/.test(ch)) em += 0.68;
		else em += 0.56;
	}
	return em * size;
}

/**
 * Break `text` into lines no wider than `maxWidth` at `size`, at spaces. A single word wider
 * than a line is cut as a last resort. At most `maxLines` come back; if there was more, the last
 * ends in an ellipsis.
 */
export function wrapText(text, size, maxWidth, maxLines) {
	const words = String(text).trim().split(/\s+/).filter(Boolean);
	const lines = [];
	let line = '';
	const push = () => {
		if (line) lines.push(line);
		line = '';
	};
	for (let word of words) {
		while (estimateWidth(word, size) > maxWidth) {
			push();
			let cut = word.length - 1;
			while (cut > 1 && estimateWidth(word.slice(0, cut), size) > maxWidth) cut--;
			lines.push(word.slice(0, cut));
			word = word.slice(cut);
		}
		if (!line) line = word;
		else if (estimateWidth(`${line} ${word}`, size) <= maxWidth) line += ` ${word}`;
		else {
			push();
			line = word;
		}
	}
	push();
	if (lines.length <= maxLines) return lines;
	const kept = lines.slice(0, maxLines);
	let last = kept[maxLines - 1];
	while (last.length > 1 && estimateWidth(`${last}…`, size) > maxWidth) last = last.slice(0, -1);
	kept[maxLines - 1] = `${last.replace(/[\s,.;:]+$/, '')}…`;
	return kept;
}

const NAME_SIZES = [128, 112, 100, 88, 76, 66, 58, 50];
export const CONTENT_WIDTH = 1000;

/**
 * The biggest size at which the name sits in two lines or fewer with no word cut. A short name
 * gets the biggest type; a long one steps down. If even the smallest is too big, it is
 * truncated with an ellipsis at that size.
 */
export function nameLayout(name) {
	for (const size of NAME_SIZES) {
		const lines = wrapText(name, size, CONTENT_WIDTH, 3);
		const words = String(name).trim().split(/\s+/);
		const wordCut = words.some((w) => estimateWidth(w, size) > CONTENT_WIDTH);
		if (lines.length <= 2 && !wordCut) return { size, lines };
	}
	const size = NAME_SIZES.at(-1);
	return { size, lines: wrapText(name, size, CONTENT_WIDTH, 2) };
}

const FONT = "Inter, 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";

/**
 * @param {{ name: string, tagline?: string, host?: string, accent: string, background?: string }} input
 */
export function cardSvg({ name, tagline = '', host = '', accent, background = '#0d0e1c' }) {
	const base = mix(background, '#000000', 0.15);
	const glow = mix(accent, '#ffffff', 0.15);
	const { size: nameSize, lines: nameLines } = nameLayout(name);
	const nameLineHeight = Math.round(nameSize * 1.08);
	// The first line's tops sit 44px under the accent bar.
	const nameTop = 150 + Math.round(nameSize * 0.72);
	const taglineTop = nameTop + (nameLines.length - 1) * nameLineHeight + 78;
	const taglineLineHeight = 52;
	const hostBaseline = 584;
	// As many tagline lines as fit above the address, at most three.
	const room = Math.floor((hostBaseline - 64 - taglineTop) / taglineLineHeight) + 1;
	const taglineLines = tagline
		? wrapText(tagline, 38, CONTENT_WIDTH, Math.max(1, Math.min(3, room)))
		: [];

	const text = (lines, x, y, size, lineHeight, attrs) =>
		lines
			.map(
				(line, i) =>
					`<text x="${x}" y="${y + i * lineHeight}" font-family="${FONT}" font-size="${size}" ${attrs}>${escapeXml(line)}</text>`
			)
			.join('\n  ');

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${background}"/>
      <stop offset="100%" stop-color="${base}"/>
    </linearGradient>
    <radialGradient id="glow-a" cx="85%" cy="15%" r="60%">
      <stop offset="0%" stop-color="${glow}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow-b" cx="10%" cy="105%" r="55%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#bg)"/>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#glow-a)"/>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#glow-b)"/>
  <rect x="80" y="96" width="96" height="10" rx="5" fill="${accent}"/>
  ${text(nameLines, 80, nameTop, nameSize, nameLineHeight, 'font-weight="800" fill="#ffffff"')}
  ${text(taglineLines, 80, taglineTop, 38, taglineLineHeight, 'font-weight="400" fill="#ffffff" fill-opacity="0.82"')}
  ${host ? `<text x="80" y="${hostBaseline}" font-family="${FONT}" font-size="30" font-weight="600" fill="#ffffff" fill-opacity="0.7">${escapeXml(host)}</text>` : ''}
</svg>
`;
}
