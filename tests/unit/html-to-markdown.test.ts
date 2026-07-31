/**
 * Tests for the in-house HTML → Markdown converter used by
 * `Accept: text/markdown` negotiation (AGENTS.md §8).
 *
 * The cases here are the ones that actually broke, or would break silently:
 * doubled spaces from nested inline elements, `<pre>` inheriting the Svelte
 * template's indentation, shell prompts stranded on their own line, and site
 * chrome leaking into what should be page content.
 */
import { describe, expect, it } from 'vitest';
import {
	decodeEntities,
	dedentCode,
	estimateTokens,
	htmlToMarkdown,
	joinShellPrompts,
	normalizeCodeBlock,
	parseHtml
} from '../../src/lib/server/html-to-markdown';

/**
 * Wrap a fragment in the document shape the converter expects.
 *
 * The title is omitted unless a test asks for one: with a `<title>` present and
 * no heading in the body, the converter promotes it to an H1 (correctly), which
 * would prefix the expected output of every unrelated case.
 */
function page(body: string, title?: string): string {
	const head = title ? `<head><title>${title}</title></head>` : '<head></head>';
	return `<!doctype html><html>${head}<body><main>${body}</main></body></html>`;
}

describe('headings and paragraphs', () => {
	it('converts headings at every level', () => {
		expect(htmlToMarkdown(page('<h1>One</h1><h2>Two</h2><h3>Three</h3>'))).toBe(
			'# One\n\n## Two\n\n### Three'
		);
	});

	it('promotes the document title when the content has no heading', () => {
		expect(htmlToMarkdown(page('<p>Body text.</p>', 'My Page'))).toBe('# My Page\n\nBody text.');
	});

	it('does not add a title heading when the content already has one', () => {
		const markdown = htmlToMarkdown(page('<h1>Real</h1><p>Body.</p>', 'Doc Title'));
		expect(markdown).toBe('# Real\n\nBody.');
		expect(markdown).not.toContain('Doc Title');
	});

	it('collapses whitespace left by nested inline elements', () => {
		// The original defect: "A full-stack  SvelteKit +  Cloudflare" with doubled
		// spaces, because each <span> contributed its own surrounding whitespace.
		const markdown = htmlToMarkdown(page('<p>A <span>full-stack</span> <span>app</span></p>'));
		expect(markdown).toBe('A full-stack app');
	});

	it('keeps <br> as a Markdown hard break', () => {
		expect(htmlToMarkdown(page('<p>one<br>two</p>'))).toBe('one  \ntwo');
	});
});

describe('inline formatting', () => {
	it('converts emphasis, strong, strikethrough and code', () => {
		expect(
			htmlToMarkdown(page('<p><strong>b</strong> <em>i</em> <del>d</del> <code>c</code></p>'))
		).toBe('**b** _i_ ~~d~~ `c`');
	});

	it('converts links, keeping the destination', () => {
		expect(htmlToMarkdown(page('<p><a href="/docs">Docs</a></p>'))).toBe('[Docs](/docs)');
	});

	it('flattens in-page anchors to plain text', () => {
		// A "#section" jump is navigation noise for a reader that has the whole
		// document already.
		expect(htmlToMarkdown(page('<p><a href="#top">Top</a></p>'))).toBe('Top');
	});

	it('converts images with their alt text', () => {
		expect(htmlToMarkdown(page('<p><img src="/a.png" alt="A cat"></p>'))).toBe('![A cat](/a.png)');
	});

	it('escapes characters that would change structure', () => {
		expect(htmlToMarkdown(page('<p>a*b_c[d]</p>'))).toBe('a\\*b\\_c\\[d\\]');
	});
});

describe('lists', () => {
	it('converts unordered lists', () => {
		expect(htmlToMarkdown(page('<ul><li>one</li><li>two</li></ul>'))).toBe('- one\n- two');
	});

	it('numbers ordered lists and honours the start attribute', () => {
		expect(htmlToMarkdown(page('<ol start="3"><li>three</li><li>four</li></ol>'))).toBe(
			'3. three\n4. four'
		);
	});

	it('indents nested lists', () => {
		const markdown = htmlToMarkdown(page('<ul><li>outer<ul><li>inner</li></ul></li></ul>'));
		expect(markdown).toContain('- outer');
		expect(markdown).toContain('  - inner');
	});
});

describe('code blocks', () => {
	it('strips the template indentation a <pre> inherits', () => {
		const html = page('<pre><code>\n\t\t\t\tnpm install\n\t\t\t\tnpm test\n\t\t\t</code></pre>');
		expect(htmlToMarkdown(html)).toBe('```\nnpm install\nnpm test\n```');
	});

	it('preserves relative indentation inside the block', () => {
		expect(dedentCode('    if (x) {\n      y();\n    }')).toBe('if (x) {\n  y();\n}');
	});

	it('rejoins a shell prompt with its command', () => {
		// Terminal components render the "$" in its own element, which strands it.
		expect(joinShellPrompts('$\n\tbun install')).toBe('$ bun install');
		expect(normalizeCodeBlock('\t\t$\n\t\t\tbun run dev')).toBe('$ bun run dev');
	});

	it('records the language from a class name', () => {
		const html = page('<pre><code class="language-ts">const a = 1;</code></pre>');
		expect(htmlToMarkdown(html)).toBe('```ts\nconst a = 1;\n```');
	});

	it('does not collapse whitespace inside code', () => {
		const html = page('<pre><code>a    b</code></pre>');
		expect(htmlToMarkdown(html)).toContain('a    b');
	});
});

describe('blocks', () => {
	it('converts blockquotes', () => {
		expect(htmlToMarkdown(page('<blockquote><p>quoted</p></blockquote>'))).toBe('> quoted');
	});

	it('converts horizontal rules', () => {
		expect(htmlToMarkdown(page('<p>a</p><hr><p>b</p>'))).toBe('a\n\n---\n\nb');
	});

	it('converts tables to GFM pipe tables', () => {
		const html = page(
			'<table><tr><th>Name</th><th>Value</th></tr><tr><td>a</td><td>1</td></tr></table>'
		);
		expect(htmlToMarkdown(html)).toBe('| Name | Value |\n| --- | --- |\n| a | 1 |');
	});

	it('escapes pipes inside table cells', () => {
		const html = page('<table><tr><td>a|b</td></tr></table>');
		expect(htmlToMarkdown(html)).toContain('a\\|b');
	});
});

describe('chrome removal', () => {
	it('drops scripts, styles and SVG', () => {
		const html = page('<script>evil()</script><style>.a{}</style><svg><path/></svg><p>kept</p>');
		expect(htmlToMarkdown(html)).toBe('kept');
	});

	it('drops navigation', () => {
		// An in-page table of contents flattens into a run-on line of link text and
		// duplicates headings that follow.
		const html = page('<nav><a href="#a">A</a><a href="#b">B</a></nav><h2>A</h2>');
		expect(htmlToMarkdown(html)).toBe('## A');
	});

	it('scopes to <main>, leaving header and footer behind', () => {
		const html =
			'<html><body><header>Site name</header><main><p>content</p></main><footer>© 2026</footer></body></html>';
		expect(htmlToMarkdown(html)).toBe('content');
	});

	it('falls back to <body> when there is no <main>', () => {
		expect(htmlToMarkdown('<html><body><p>loose</p></body></html>')).toBe('loose');
	});
});

describe('parsing robustness', () => {
	it('tolerates unclosed tags', () => {
		expect(htmlToMarkdown(page('<p>one<p>two'))).toBe('one\n\ntwo');
	});

	it('ignores comments', () => {
		expect(htmlToMarkdown(page('<!-- hidden --><p>shown</p>'))).toBe('shown');
	});

	it('never treats markup inside a script as structure', () => {
		const html = page('<script>var s = "<h1>not a heading</h1>";</script><p>real</p>');
		expect(htmlToMarkdown(html)).toBe('real');
	});

	it('parses attributes in quoted and bare forms', () => {
		const nodes = parseHtml('<a href="/x" target=_blank rel=\'me\'>x</a>');
		const anchor = nodes.find((node) => node.type === 'element');
		expect(anchor && anchor.type === 'element' && anchor.attrs).toMatchObject({
			href: '/x',
			target: '_blank',
			rel: 'me'
		});
	});

	it('handles void and self-closing elements', () => {
		expect(htmlToMarkdown(page('<p>a<br/>b</p><hr/>'))).toContain('a  \nb');
	});
});

describe('entities', () => {
	it('decodes named references', () => {
		expect(decodeEntities('a &amp; b &nbsp;c &mdash; d')).toBe('a & b  c — d');
	});

	it('decodes numeric references, decimal and hex', () => {
		expect(decodeEntities('&#65;&#x42;')).toBe('AB');
	});

	it('leaves unknown references untouched', () => {
		expect(decodeEntities('&notareal;')).toBe('&notareal;');
	});
});

describe('token estimation', () => {
	it('scales with length', () => {
		expect(estimateTokens('')).toBe(0);
		expect(estimateTokens('abcd')).toBe(1);
		expect(estimateTokens('a'.repeat(401))).toBe(101);
	});
});
