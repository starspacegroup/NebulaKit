/**
 * HTML → Markdown conversion for `Accept: text/markdown` content negotiation.
 *
 * Written in-house rather than pulling in turndown/jsdom: per AGENTS.md this
 * template keeps dependencies minimal, and the input here is not arbitrary web
 * HTML — it is this app's own server-rendered output. A small tokenizer plus a
 * tree walk covers it, runs in a Worker with no Node built-ins, and adds
 * nothing to the client bundle.
 *
 * Deliberately a *parser*, not a pile of regexes: nested lists, links inside
 * emphasis, and `<pre>` blocks all need structure to come out right, and regex
 * substitution silently mangles them.
 */

/** A parsed HTML node. */
type HtmlNode =
	| { type: 'text'; value: string }
	| { type: 'element'; tag: string; attrs: Record<string, string>; children: HtmlNode[] };

/** Elements with no closing tag. */
const VOID_TAGS = new Set([
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'param',
	'source',
	'track',
	'wbr'
]);

/**
 * Elements whose entire subtree is dropped — chrome, not content.
 *
 * `nav` is included deliberately: an in-page table of contents flattens into a
 * run-on line of link text, and every heading it points at is already in the
 * output. Interactive controls (`form`, `button`, `select`) go too — an agent
 * reading Markdown cannot operate them, and their labels read as stray words.
 */
const DROPPED_TAGS = new Set([
	'nav',
	'script',
	'style',
	'noscript',
	'template',
	'svg',
	'canvas',
	'iframe',
	'object',
	'form',
	'button',
	'select',
	'dialog'
]);

/** Elements whose content is raw text (never parsed as markup). */
const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title']);

/**
 * Tags that implicitly close an open element, per the HTML parsing rules.
 *
 * `<p>one<p>two` is two sibling paragraphs, not a paragraph nested in a
 * paragraph. Without this the inner element is absorbed into the outer one's
 * inline run and the two paragraphs render as `onetwo`. Same story for list
 * items and table cells, which markup in the wild routinely leaves unclosed.
 */
const CLOSED_BY: Record<string, ReadonlySet<string>> = {
	p: new Set([
		'p',
		'div',
		'section',
		'article',
		'main',
		'header',
		'footer',
		'aside',
		'ul',
		'ol',
		'pre',
		'blockquote',
		'table',
		'hr',
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6'
	]),
	li: new Set(['li']),
	tr: new Set(['tr']),
	td: new Set(['td', 'th', 'tr']),
	th: new Set(['td', 'th', 'tr'])
};

/** Named entities worth decoding; numeric refs are handled generically. */
const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
	mdash: '—',
	ndash: '–',
	hellip: '…',
	rsquo: '’',
	lsquo: '‘',
	rdquo: '”',
	ldquo: '“',
	middot: '·',
	bull: '•',
	copy: '©',
	reg: '®',
	trade: '™',
	deg: '°',
	times: '×',
	laquo: '«',
	raquo: '»'
};

/** Decode HTML character references in a text run. */
export function decodeEntities(text: string): string {
	return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, ref: string) => {
		if (ref.startsWith('#')) {
			const codePoint =
				ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
			return Number.isFinite(codePoint) && codePoint > 0 ? String.fromCodePoint(codePoint) : match;
		}
		return ENTITIES[ref] ?? match;
	});
}

/** Parse an attribute string (`href="x" target=_blank`) into a map. */
function parseAttributes(source: string): Record<string, string> {
	const attrs: Record<string, string> = {};
	const pattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(source)) !== null) {
		attrs[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
	}
	return attrs;
}

/**
 * Parse HTML into a node tree.
 *
 * Tolerant by design: unclosed tags are auto-closed at the end of their parent
 * rather than throwing, because a converter that fails on imperfect markup is
 * useless in a response path.
 */
export function parseHtml(html: string): HtmlNode[] {
	const root: HtmlNode = { type: 'element', tag: '#root', attrs: {}, children: [] };
	const stack: Extract<HtmlNode, { type: 'element' }>[] = [root];
	const tagPattern = /<(\/)?([a-zA-Z][-a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|<!--[\s\S]*?-->/g;

	let cursor = 0;
	let match: RegExpExecArray | null;

	const pushText = (raw: string) => {
		if (!raw) return;
		stack[stack.length - 1].children.push({ type: 'text', value: decodeEntities(raw) });
	};

	while ((match = tagPattern.exec(html)) !== null) {
		pushText(html.slice(cursor, match.index));
		cursor = tagPattern.lastIndex;

		// Comment — already skipped by advancing the cursor.
		if (match[0].startsWith('<!--')) continue;

		const closing = Boolean(match[1]);
		const tag = match[2].toLowerCase();

		if (closing) {
			// Unwind to the matching open tag, tolerating stray close tags.
			const index = stack.findIndex((node) => node.tag === tag);
			if (index > 0) stack.length = index;
			continue;
		}

		// Implicitly close anything this tag ends (`<p>a<p>b`, `<li>a<li>b`).
		while (stack.length > 1 && CLOSED_BY[stack[stack.length - 1].tag]?.has(tag)) {
			stack.pop();
		}

		const attrs = parseAttributes(match[3] ?? '');
		const selfClosing = (match[3] ?? '').trimEnd().endsWith('/');
		const element: Extract<HtmlNode, { type: 'element' }> = {
			type: 'element',
			tag,
			attrs,
			children: []
		};
		stack[stack.length - 1].children.push(element);

		if (VOID_TAGS.has(tag) || selfClosing) continue;

		// Raw-text elements swallow everything up to their close tag, so markup
		// inside a <script> can never be mistaken for real structure.
		if (RAW_TEXT_TAGS.has(tag)) {
			const close = new RegExp(`</${tag}\\s*>`, 'i');
			const rest = html.slice(cursor);
			const end = rest.search(close);
			const inner = end === -1 ? rest : rest.slice(0, end);
			element.children.push({ type: 'text', value: inner });
			const consumed = end === -1 ? rest.length : end + rest.slice(end).indexOf('>') + 1;
			cursor += consumed;
			tagPattern.lastIndex = cursor;
			continue;
		}

		stack.push(element);
	}

	pushText(html.slice(cursor));
	return root.children;
}

/** Find the first element with the given tag, depth-first. */
function findElement(
	nodes: HtmlNode[],
	tag: string
): Extract<HtmlNode, { type: 'element' }> | undefined {
	for (const node of nodes) {
		if (node.type !== 'element') continue;
		if (node.tag === tag) return node;
		const nested = findElement(node.children, tag);
		if (nested) return nested;
	}
	return undefined;
}

/** Concatenate the visible text of a subtree, for headings and table cells. */
function textOf(nodes: HtmlNode[]): string {
	return nodes
		.map((node) => (node.type === 'text' ? node.value : textOf(node.children)))
		.join('')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Escape the few characters that would otherwise change Markdown structure. */
function escapeText(text: string): string {
	return text.replace(/([\\`*_[\]])/g, '\\$1');
}

/** Rendering state threaded through the walk. */
interface RenderContext {
	/** Nesting depth for lists, used for indentation. */
	depth: number;
	/** When inside an ordered list, the next item number. */
	ordered?: { counter: number };
}

/**
 * Placeholder for a `<br>` while inline text is being assembled.
 *
 * A Markdown hard break is two trailing spaces, which the whitespace-collapsing
 * pass below would eat. Carrying the break as a non-whitespace sentinel and
 * expanding it afterwards keeps both behaviours intact.
 */
const BR_SENTINEL = '\u0000';

/** The sentinel plus any horizontal whitespace hugging it. */
const BR_PATTERN = new RegExp(`[^\\S\\n]*${BR_SENTINEL}[^\\S\\n]*`, 'g');

/**
 * Finish an inline run: collapse the whitespace that nested elements leave
 * behind (`<span>a</span> <span>b</span>` renders with doubled spaces), then
 * expand hard-break sentinels.
 */
function finalizeInline(text: string): string {
	return text
		.replace(/[^\S\n]{2,}/g, ' ')
		.replace(BR_PATTERN, '  \n')
		.trim();
}

/**
 * Strip the indentation a `<pre>` inherits from the Svelte template it lives in.
 *
 * Source-formatted markup indents the *markup*, but `<pre>` preserves every one
 * of those tabs, so a verbatim copy renders as a deeply-indented mess. Removing
 * the longest common leading whitespace keeps the code's own relative
 * indentation while dropping the template's.
 */
export function dedentCode(code: string): string {
	const lines = code.split('\n');
	while (lines.length && !lines[0].trim()) lines.shift();
	while (lines.length && !lines[lines.length - 1].trim()) lines.pop();

	const indents = lines.filter((line) => line.trim()).map((line) => /^[ \t]*/.exec(line)![0]);
	let common = indents[0] ?? '';
	for (const indent of indents) {
		let i = 0;
		while (i < common.length && i < indent.length && common[i] === indent[i]) i++;
		common = common.slice(0, i);
	}

	return (
		lines
			.map((line) => (line.startsWith(common) ? line.slice(common.length) : line.trimStart()))
			.join('\n')
			// Blank-line runs inside a rendered block are layout, not meaning.
			.replace(/\n{3,}/g, '\n\n')
	);
}

/**
 * Rejoin a shell prompt with the command it belongs to.
 *
 * UI components commonly render the `$` in its own element, which leaves the
 * prompt stranded on a line of its own inside `<pre>`. Copy-pasting that runs an
 * empty command followed by a naked one, so put the two back together.
 */
export function joinShellPrompts(code: string): string {
	return code.replace(/^[ \t]*([$>])[ \t]*\n[ \t]*(?=\S)/gm, '$1 ');
}

/** Everything applied to a `<pre>` block before it is fenced. */
export function normalizeCodeBlock(code: string): string {
	return joinShellPrompts(dedentCode(code));
}

/**
 * Collapse 3+ blank lines and trim trailing whitespace.
 *
 * A Markdown hard break *is* two trailing spaces, so the trim has to spare it —
 * stripping them turns `<br>` into a soft wrap and silently merges the lines.
 */
function tidy(markdown: string): string {
	return markdown
		.split('\n')
		.map((line) => {
			const isHardBreak = /\S {2,}$/.test(line);
			const trimmed = line.replace(/[ \t]+$/, '');
			return isHardBreak && trimmed ? `${trimmed}  ` : trimmed;
		})
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

/** Render inline children (text, links, emphasis) to a single line. */
function renderInline(nodes: HtmlNode[]): string {
	let out = '';
	for (const node of nodes) {
		if (node.type === 'text') {
			out += escapeText(node.value.replace(/\s+/g, ' '));
			continue;
		}
		if (DROPPED_TAGS.has(node.tag)) continue;

		switch (node.tag) {
			case 'br':
				out += BR_SENTINEL;
				break;
			case 'strong':
			case 'b': {
				const inner = renderInline(node.children).trim();
				if (inner) out += `**${inner}**`;
				break;
			}
			case 'em':
			case 'i': {
				const inner = renderInline(node.children).trim();
				if (inner) out += `_${inner}_`;
				break;
			}
			case 'del':
			case 's': {
				const inner = renderInline(node.children).trim();
				if (inner) out += `~~${inner}~~`;
				break;
			}
			case 'code': {
				// Unescape: backticks already protect the span.
				const inner = textOf(node.children);
				if (inner) out += `\`${inner}\``;
				break;
			}
			case 'a': {
				const inner = renderInline(node.children).trim() || node.attrs.href || '';
				const href = node.attrs.href;
				// Anchors with no destination, or in-page jumps, add noise for an
				// agent — keep the words, drop the link.
				out += href && !href.startsWith('#') ? `[${inner}](${href})` : inner;
				break;
			}
			case 'img': {
				const alt = node.attrs.alt ?? '';
				const src = node.attrs.src;
				if (src) out += `![${alt}](${src})`;
				break;
			}
			default:
				out += renderInline(node.children);
		}
	}
	return out;
}

/** Render a list, handling nesting and ordered/unordered markers. */
function renderList(node: Extract<HtmlNode, { type: 'element' }>, context: RenderContext): string {
	const ordered = node.tag === 'ol';
	const start = Number(node.attrs.start ?? '1') || 1;
	let counter = start;
	const indent = '  '.repeat(context.depth);
	const lines: string[] = [];

	for (const child of node.children) {
		if (child.type !== 'element' || child.tag !== 'li') continue;
		const marker = ordered ? `${counter++}.` : '-';
		const body = renderBlocks(child.children, { depth: context.depth + 1 }).trim();
		if (!body) continue;
		// Continuation lines align under the marker so nested blocks stay in the item.
		const [first, ...rest] = body.split('\n');
		lines.push(`${indent}${marker} ${first}`);
		for (const line of rest) {
			lines.push(line.trim() ? `${indent}  ${line}` : '');
		}
	}

	return lines.join('\n');
}

/** Render a table as a GFM pipe table when it has usable rows. */
function renderTable(node: Extract<HtmlNode, { type: 'element' }>): string {
	const rows: string[][] = [];
	const collectRows = (nodes: HtmlNode[]) => {
		for (const child of nodes) {
			if (child.type !== 'element') continue;
			if (child.tag === 'tr') {
				const cells = child.children
					.filter(
						(cell): cell is Extract<HtmlNode, { type: 'element' }> =>
							cell.type === 'element' && (cell.tag === 'td' || cell.tag === 'th')
					)
					.map((cell) => finalizeInline(renderInline(cell.children)).replace(/\|/g, '\\|'));
				if (cells.length) rows.push(cells);
			} else {
				collectRows(child.children);
			}
		}
	};
	collectRows(node.children);

	if (!rows.length) return '';

	const width = Math.max(...rows.map((row) => row.length));
	const pad = (row: string[]) => {
		const padded = [...row];
		while (padded.length < width) padded.push('');
		return `| ${padded.join(' | ')} |`;
	};

	const [header, ...body] = rows;
	return [pad(header), `| ${Array(width).fill('---').join(' | ')} |`, ...body.map(pad)].join('\n');
}

/** Render block-level children, separating them with blank lines. */
function renderBlocks(nodes: HtmlNode[], context: RenderContext): string {
	const blocks: string[] = [];
	/** Inline runs are buffered so loose text becomes one paragraph. */
	let inlineBuffer: HtmlNode[] = [];

	const flushInline = () => {
		if (!inlineBuffer.length) return;
		const text = finalizeInline(renderInline(inlineBuffer));
		inlineBuffer = [];
		if (text) blocks.push(text);
	};

	for (const node of nodes) {
		if (node.type === 'text') {
			if (node.value.trim()) inlineBuffer.push(node);
			continue;
		}
		if (DROPPED_TAGS.has(node.tag)) continue;

		switch (node.tag) {
			case 'h1':
			case 'h2':
			case 'h3':
			case 'h4':
			case 'h5':
			case 'h6': {
				flushInline();
				const level = Number(node.tag[1]);
				const text = finalizeInline(renderInline(node.children));
				if (text) blocks.push(`${'#'.repeat(level)} ${text}`);
				break;
			}
			case 'p': {
				flushInline();
				const text = finalizeInline(renderInline(node.children));
				if (text) blocks.push(text);
				break;
			}
			case 'ul':
			case 'ol': {
				flushInline();
				const list = renderList(node, context);
				if (list) blocks.push(list);
				break;
			}
			case 'pre': {
				flushInline();
				const codeNode = findElement(node.children, 'code');
				// textOf() collapses whitespace, which would destroy a code block —
				// pull the raw text instead, then strip the template's own indentation.
				const raw = rawTextOf(codeNode ? codeNode.children : node.children);
				const language =
					/language-([\w+-]+)/.exec(codeNode?.attrs.class ?? node.attrs.class ?? '')?.[1] ?? '';
				const content = normalizeCodeBlock(raw);
				if (content.trim()) blocks.push(`\`\`\`${language}\n${content}\n\`\`\``);
				break;
			}
			case 'blockquote': {
				flushInline();
				const inner = renderBlocks(node.children, context).trim();
				if (inner) {
					blocks.push(
						inner
							.split('\n')
							.map((line) => (line ? `> ${line}` : '>'))
							.join('\n')
					);
				}
				break;
			}
			case 'hr':
				flushInline();
				blocks.push('---');
				break;
			case 'table': {
				flushInline();
				const table = renderTable(node);
				if (table) blocks.push(table);
				break;
			}
			case 'li':
				// A stray <li> outside a list — render its contents rather than drop it.
				flushInline();
				blocks.push(renderBlocks(node.children, context));
				break;
			case 'br':
				break;
			default: {
				// Structural wrappers (div, section, article, main, span…). Recurse and
				// let the children decide whether they are blocks or inline.
				if (isInlineOnly(node)) {
					inlineBuffer.push(node);
				} else {
					flushInline();
					const inner = renderBlocks(node.children, context);
					if (inner.trim()) blocks.push(inner);
				}
			}
		}
	}

	flushInline();
	return blocks.join('\n\n');
}

/** Raw text of a subtree, preserving whitespace (used for code blocks). */
function rawTextOf(nodes: HtmlNode[]): string {
	return nodes
		.map((node) => (node.type === 'text' ? node.value : rawTextOf(node.children)))
		.join('');
}

/** True when a subtree contains no block-level elements. */
function isInlineOnly(node: Extract<HtmlNode, { type: 'element' }>): boolean {
	const BLOCK = new Set([
		'p',
		'div',
		'section',
		'article',
		'main',
		'header',
		'footer',
		'nav',
		'aside',
		'ul',
		'ol',
		'li',
		'table',
		'pre',
		'blockquote',
		'hr',
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6'
	]);
	const walk = (nodes: HtmlNode[]): boolean =>
		nodes.every(
			(child) => child.type === 'text' || (!BLOCK.has(child.tag) && walk(child.children))
		);
	return walk(node.children);
}

/**
 * Convert a full HTML document to Markdown.
 *
 * Scopes to `<main>` when present — this app's layout puts navigation and the
 * footer outside it, so that one choice removes site chrome without
 * tag-blocklisting. Falls back to `<body>`, then the whole document.
 *
 * The `<title>` is promoted to an H1 when the content has no heading of its
 * own, so an agent always knows what page it is reading.
 */
export function htmlToMarkdown(html: string): string {
	const tree = parseHtml(html);

	const titleElement = findElement(tree, 'title');
	const title = titleElement ? textOf(titleElement.children) : '';

	const scope = findElement(tree, 'main') ?? findElement(tree, 'body');
	const body = renderBlocks(scope ? scope.children : tree, { depth: 0 });

	const hasHeading = /^#{1,6}\s/m.test(body);
	const heading = title && !hasHeading ? `# ${title}\n\n` : '';

	return tidy(heading + body);
}

/**
 * Approximate token count for the `x-markdown-tokens` header.
 *
 * ~4 characters per token is the usual English rule of thumb. It is an estimate
 * and labelled as such — the header exists so an agent can budget context
 * before fetching, not for billing.
 */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}
