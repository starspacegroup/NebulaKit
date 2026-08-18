import { describe, expect, it } from 'vitest';
import {
	sanitizeCmsUrl,
	sanitizeContentFields,
	sanitizeRichTextHtml
} from '../../src/lib/cms/sanitize';

describe('CMS rich-text sanitization', () => {
	it('provides the same safe URL policy to typed CMS renderers', () => {
		expect(sanitizeCmsUrl('https://example.com/docs')).toBe('https://example.com/docs');
		expect(sanitizeCmsUrl('/docs')).toBe('/docs');
		expect(sanitizeCmsUrl('mailto:user@example.com')).toBe('mailto:user@example.com');
		expect(sanitizeCmsUrl('mailto:user@example.com', true)).toBeNull();
		expect(sanitizeCmsUrl('javascript:alert(1)')).toBeNull();
		expect(sanitizeCmsUrl('data:image/svg+xml,<svg />', true)).toBeNull();
	});

	it('removes executable markup, event handlers, and script URLs', () => {
		const sanitized = sanitizeRichTextHtml(
			'<p onclick="steal()">Safe</p><script>alert(1)</script><img src="javascript:alert(2)" onerror="steal()"><a href="javascript:alert(3)">bad</a>'
		);

		expect(sanitized).toContain('<p>Safe</p>');
		expect(sanitized).not.toMatch(/script|onclick|onerror|javascript:/i);
	});

	it('preserves legitimate Tiptap structure and safe link and image attributes', () => {
		const input =
			'<h2><strong>Heading</strong></h2><ol start="3"><li>One</li></ol>' +
			'<a href="https://example.com/docs?q=1" target="_blank" rel="ugc">Docs</a>' +
			'<img src="/uploads/image.png" alt="A &amp; B" width="640">';

		expect(sanitizeRichTextHtml(input)).toBe(
			'<h2><strong>Heading</strong></h2><ol start="3"><li>One</li></ol>' +
				'<a href="https://example.com/docs?q=1" target="_blank" rel="noopener noreferrer ugc">Docs</a>' +
				'<img src="/uploads/image.png" alt="A &amp; B" width="640">'
		);
	});

	it('drops active containers while preserving the CMS-v2 presentational SVG subset', () => {
		const sanitized = sanitizeRichTextHtml(
			'<p>before</p><!-- secret --><style>body{display:none}</style>' +
				'<form action="/steal"><input name="secret"><p>form text</p></form>' +
				'<iframe src="https://evil.example"><p>fallback</p></iframe>' +
				'<svg><a href="javascript:alert(1)"><text>svg</text></a></svg>' +
				'<math><mtext><img src=x onerror=bad()></mtext></math><p>after</p>'
		);

		expect(sanitized).toContain('<p>before</p><p>form text</p>');
		expect(sanitized).toContain('<svg><a><text>svg</text></a></svg>');
		expect(sanitized).toContain('<p>after</p>');
		expect(sanitized).not.toMatch(/style|iframe|math|javascript:/i);
	});

	it('rejects obfuscated and protocol-relative URLs and constrains attributes', () => {
		const sanitized = sanitizeRichTextHtml(
			'<a href="java&#x0A;script&#58;alert(1)" ping="https://evil.example">bad</a>' +
				'<a href="//evil.example" target="popup">also bad</a>' +
				'<img src="data:image/svg+xml,&lt;svg onload=alert(1)&gt;" srcset="x 1x" onload="bad()" width="99999">'
		);

		expect(sanitized).toBe('<a>bad</a><a>also bad</a><img>');
		expect(sanitized).not.toMatch(/javascript|data:|evil\.example|onload|ping|srcset/i);
	});

	it('preserves safe embed placeholders while bounding and encoding props', () => {
		const input =
			'<p>before</p><div data-svelte-embed="callout" data-props="{&quot;tone&quot;:&quot;warning&quot;,&quot;count&quot;:2}"></div><p>after</p>';

		expect(sanitizeRichTextHtml(input)).toBe(input);
		expect(
			sanitizeRichTextHtml(
				'<div data-svelte-embed="Callout" data-props="{}" onclick="bad()"></div>'
			)
		).toBe('<div></div>');
	});

	it('balances malformed markup and is idempotent', () => {
		const once = sanitizeRichTextHtml('<p><strong>safe</p><img src="https://example.com/a.png"');

		expect(once).toBe('<p><strong>safe</p>&lt;img src="https://example.com/a.png"');
		expect(sanitizeRichTextHtml(once)).toBe(once);
	});

	it('handles malformed tags, declarations, comments, and duplicate attributes safely', () => {
		expect(sanitizeRichTextHtml('plain text')).toBe('plain text');
		expect(sanitizeRichTextHtml('')).toBe('');
		expect(sanitizeRichTextHtml(null as unknown as string)).toBe('');
		expect(sanitizeRichTextHtml('<3 </p><unknown>text</unknown>')).toBe('&lt;3 </p>text');
		expect(sanitizeRichTextHtml('<p title="unterminated')).toBe('&lt;p title="unterminated');
		expect(sanitizeRichTextHtml('<p =bad foo=one foo="two">text')).toBe('<p>text');
		expect(sanitizeRichTextHtml('<div>wrapped</div><a>link</a><img>')).toBe(
			'<div>wrapped</div><a>link</a><img>'
		);
		expect(sanitizeRichTextHtml('<p>safe<!-- unterminated')).toBe('<p>safe');
		expect(sanitizeRichTextHtml('<!DOCTYPE html><?ignored?><p>safe</p>')).toBe('<p>safe</p>');
		expect(sanitizeRichTextHtml('<!unterminated')).toBe('');
		expect(sanitizeRichTextHtml('<p title=test/>safe')).toBe('<p />safe');
		expect(sanitizeRichTextHtml("<p title='closed'>safe</p>")).toBe('<p>safe</p>');
	});

	it('allows only safe normalized URL schemes and relation tokens', () => {
		expect(
			sanitizeRichTextHtml(
				"<a href='mailto:test@example.com' title='A &quot;quote&quot;'>Mail</a>" +
					'<a href="tel:+15551212" rel="UGC ugc nofollow bad">Phone</a>' +
					'<a href="ftp://example.com">FTP</a>' +
					'<img src="http&#58;//example.com/a.png" title="A&#39;s" height="0" width="40">'
			)
		).toBe(
			'<a href="mailto:test@example.com" title="A &quot;quote&quot;">Mail</a>' +
				'<a href="tel:+15551212" rel="ugc nofollow">Phone</a>' +
				'<a>FTP</a>' +
				'<img src="http://example.com/a.png" title="A\'s" width="40">'
		);
		expect(sanitizeRichTextHtml('<a href="&#0;">bad</a>')).toBe('<a href="�">bad</a>');
		expect(sanitizeRichTextHtml('<a href="&#x110000;">bad</a>')).toBe('<a href="�">bad</a>');
	});

	it('constrains list and table attributes', () => {
		expect(
			sanitizeRichTextHtml(
				'<ol start="0"><li value="2">A</li></ol>' +
					'<table><thead><tr><th colspan="2" rowspan="3" scope="col">H</th></tr></thead>' +
					'<tbody><tr><td colspan="101" rowspan="x">D</td></tr></tbody><tfoot></tfoot></table>'
			)
		).toBe(
			'<ol><li>A</li></ol>' +
				'<table><thead><tr><th>H</th></tr></thead>' +
				'<tbody><tr><td>D</td></tr></tbody></table>'
		);
		expect(sanitizeRichTextHtml('<li value="0">A</li><th scope="invalid">H</th>')).toBe(
			'<li>A</li><th>H</th>'
		);
	});

	it('rejects malformed or excessive embed props without dropping safe placeholders', () => {
		const placeholder = (props: string) =>
			sanitizeRichTextHtml(`<div data-svelte-embed="callout" data-props="${props}"></div>`);
		const withoutProps = '<div data-svelte-embed="callout"></div>';
		const encoded = (value: unknown) =>
			JSON.stringify(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

		expect(placeholder('')).toBe(withoutProps);
		expect(placeholder('{bad json')).toBe(withoutProps);
		expect(placeholder(encoded(null))).toBe(withoutProps);
		expect(placeholder(encoded([1, 2]))).toBe(withoutProps);
		expect(placeholder(encoded({ constructor: 'bad' }))).toBe(withoutProps);
		expect(placeholder(encoded({ 'bad key': true }))).toBe(withoutProps);
		expect(placeholder(encoded({ values: Array(65).fill(true) }))).toBe(withoutProps);
		expect(
			placeholder(encoded(Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`k${i}`, i]))))
		).toBe(withoutProps);
		expect(placeholder(encoded({ text: 'x'.repeat(4097) }))).toBe(withoutProps);
		expect(placeholder(encoded({ a: 'x'.repeat(3000), b: 'y'.repeat(3000) }))).toBe(withoutProps);
		expect(placeholder('x'.repeat(4097))).toBe(withoutProps);

		let nested: Record<string, unknown> = { value: true };
		for (let depth = 0; depth < 8; depth += 1) nested = { nested };
		expect(placeholder(encoded(nested))).toBe(withoutProps);

		const valid = { enabled: true, count: 2, empty: null, labels: ['a', false] };
		expect(placeholder(encoded(valid))).toBe(
			`<div data-svelte-embed="callout" data-props="${encoded(valid)}"></div>`
		);
	});

	it('drops dangerous element contents even with misleading or missing closers', () => {
		expect(sanitizeRichTextHtml('<script>bad</scriptx><p>hidden</p></script><p>safe</p>')).toBe(
			'<p>safe</p>'
		);
		expect(sanitizeRichTextHtml('<iframe><p>never emitted</p>')).not.toContain('<iframe');
		expect(sanitizeRichTextHtml('<style>bad</style')).not.toContain('<style');
	});

	it('sanitizes only fields declared as rich text', () => {
		const fields = sanitizeContentFields(
			{ title: '<b>literal title</b>', body: '<p onmouseover="bad()">Body</p>' },
			[
				{ name: 'title', label: 'Title', type: 'text' },
				{ name: 'body', label: 'Body', type: 'richtext' }
			]
		);

		expect(fields.title).toBe('<b>literal title</b>');
		expect(fields.body).toBe('<p>Body</p>');
	});

	it('leaves missing rich text values unchanged', () => {
		expect(
			sanitizeContentFields({ omitted: undefined, empty: null }, [
				{ name: 'omitted', label: 'Omitted', type: 'richtext' },
				{ name: 'empty', label: 'Empty', type: 'richtext' }
			])
		).toEqual({ omitted: undefined, empty: null });
	});
});
