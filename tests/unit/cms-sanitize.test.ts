/**
 * Tests for CMS rich text sanitization ($lib/cms/sanitize)
 */
import { describe, expect, it } from 'vitest';

import { sanitizeHtml, sanitizeRichtextFields } from '../../src/lib/cms/sanitize';
import type { ContentFieldDefinition } from '../../src/lib/cms/types';

describe('sanitizeHtml', () => {
	it('passes through standard article markup', () => {
		const html =
			'<h2>Title</h2><p>Hello <strong>world</strong> and <em>more</em>.</p>' +
			'<ul><li>one</li><li>two</li></ul><blockquote><p>quote</p></blockquote>' +
			'<pre><code class="language-ts">const x = 1;</code></pre><hr />';
		expect(sanitizeHtml(html)).toContain('<h2>Title</h2>');
		expect(sanitizeHtml(html)).toContain('<strong>world</strong>');
		expect(sanitizeHtml(html)).toContain('<code class="language-ts">');
	});

	it('strips script tags and their bodies', () => {
		const out = sanitizeHtml('<p>ok</p><script>alert(1)</script><p>after</p>');
		expect(out).not.toContain('script');
		expect(out).not.toContain('alert(1)');
		expect(out).toContain('<p>after</p>');
	});

	it('strips inline event handlers', () => {
		const out = sanitizeHtml('<img src="/media/x.png" onerror="alert(1)" alt="x">');
		expect(out).toContain('src="/media/x.png"');
		expect(out).not.toContain('onerror');
	});

	it('blocks javascript: and data: URLs in href/src', () => {
		expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:');
		expect(sanitizeHtml('<a href="JAVASCRIPT:alert(1)">x</a>')).not.toContain('alert');
		expect(sanitizeHtml('<img src="data:text/html;base64,xxx">')).not.toContain('data:');
		expect(sanitizeHtml('<a href="https://example.com">x</a>')).toContain(
			'href="https://example.com"'
		);
		expect(sanitizeHtml('<img src="/media/uploads/a.png">')).toContain(
			'src="/media/uploads/a.png"'
		);
	});

	it('preserves valid embed placeholders', () => {
		const html =
			'<div data-svelte-embed="callout" data-props="{&quot;variant&quot;:&quot;info&quot;}"></div>';
		const out = sanitizeHtml(html);
		expect(out).toContain('data-svelte-embed="callout"');
		expect(out).toContain('data-props=');
	});

	it('drops invalid embed names', () => {
		const out = sanitizeHtml('<div data-svelte-embed="Bad Name!" data-props="{}"></div>');
		expect(out).not.toContain('data-svelte-embed');
	});

	it('drops non-object or malformed data-props', () => {
		expect(sanitizeHtml('<div data-svelte-embed="ok" data-props="{broken"></div>')).not.toContain(
			'data-props'
		);
		expect(sanitizeHtml('<div data-svelte-embed="ok" data-props="[1,2]"></div>')).not.toContain(
			'data-props'
		);
		expect(sanitizeHtml('<div data-svelte-embed="ok" data-props="42"></div>')).not.toContain(
			'data-props'
		);
	});

	it('strips unknown tags but keeps their text', () => {
		const out = sanitizeHtml(
			'<p>before</p><iframe src="https://evil"></iframe><marquee>hi</marquee>'
		);
		expect(out).not.toContain('<iframe');
		expect(out).not.toContain('<marquee');
		expect(out).toContain('hi');
	});

	it('preserves presentational inline SVG but strips executable SVG', () => {
		const svg =
			'<svg viewBox="0 0 10 10" aria-label="x"><path d="M0 0" fill="var(--color-accent)" />' +
			'<text x="1" y="2" font-size="10">hi</text></svg>';
		const out = sanitizeHtml(svg);
		expect(out).toContain('<path');
		expect(out).toContain('<text');
		expect(out).toContain('hi');

		const evil = sanitizeHtml(
			'<svg><foreignObject><body onload="x()"></body></foreignObject>' +
				'<use href="javascript:alert(1)"></use><script>bad()</script></svg>'
		);
		expect(evil).not.toContain('foreignObject');
		expect(evil).not.toContain('<use');
		expect(evil).not.toContain('onload');
		expect(evil).not.toContain('bad()');
	});

	it('handles empty and non-string input', () => {
		expect(sanitizeHtml('')).toBe('');
		expect(sanitizeHtml(undefined as unknown as string)).toBe('');
		expect(sanitizeHtml(null as unknown as string)).toBe('');
	});
});

describe('sanitizeRichtextFields', () => {
	const definitions = [
		{ name: 'body', label: 'Body', type: 'richtext', sortOrder: 1 },
		{ name: 'excerpt', label: 'Excerpt', type: 'textarea', sortOrder: 2 }
	] as ContentFieldDefinition[];

	it('sanitizes only richtext fields', () => {
		const result = sanitizeRichtextFields(
			{
				body: '<p>ok</p><script>alert(1)</script>',
				excerpt: '<script>kept verbatim because not richtext</script>',
				count: 5
			},
			definitions
		);
		expect(result.body).toBe('<p>ok</p>');
		expect(result.excerpt).toContain('script');
		expect(result.count).toBe(5);
	});

	it('leaves non-string richtext values untouched', () => {
		const result = sanitizeRichtextFields({ body: 42 }, definitions);
		expect(result.body).toBe(42);
	});

	it('does not mutate the input object', () => {
		const fields = { body: '<script>x</script>' };
		sanitizeRichtextFields(fields, definitions);
		expect(fields.body).toBe('<script>x</script>');
	});

	it('is idempotent — sanitizing already-sanitized output is byte-identical', () => {
		const raw = {
			body: '<p>Hello <strong>world</strong></p><ul><li>one</li></ul><script>x</script>'
		};
		const once = sanitizeRichtextFields(raw, definitions);
		const twice = sanitizeRichtextFields(once, definitions);
		expect(twice.body).toBe(once.body);
	});
});
