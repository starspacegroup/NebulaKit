import { describe, expect, it } from 'vitest';
import {
	decodeAttrEntities,
	embedPlaceholderHtml,
	encodeAttrEntities,
	parseContentSegments,
	parseEmbedProps
} from '../../src/lib/cms/embed';

describe('attribute entity codec', () => {
	it('encodes the five characters that would break a quoted attribute', () => {
		expect(encodeAttrEntities(`&"'<>`)).toBe('&amp;&quot;&#39;&lt;&gt;');
	});

	it('encodes ampersands first, so nothing is double-encoded', () => {
		// If & were escaped last, &quot; would come back as &amp;quot;
		expect(encodeAttrEntities('"')).toBe('&quot;');
		expect(decodeAttrEntities(encodeAttrEntities('"'))).toBe('"');
	});

	it('round-trips a string containing every escaped character', () => {
		const raw = `a & b "c" 'd' <e> </f>`;
		expect(decodeAttrEntities(encodeAttrEntities(raw))).toBe(raw);
	});

	it('leaves an unescaped string untouched', () => {
		expect(encodeAttrEntities('plain text 123')).toBe('plain text 123');
		expect(decodeAttrEntities('plain text 123')).toBe('plain text 123');
	});
});

describe('embedPlaceholderHtml', () => {
	it('builds a bare placeholder when there are no props', () => {
		expect(embedPlaceholderHtml('callout')).toBe('<div data-svelte-embed="callout"></div>');
	});

	it('omits the props attribute for an empty object rather than emitting {}', () => {
		expect(embedPlaceholderHtml('callout', {})).toBe('<div data-svelte-embed="callout"></div>');
	});

	it('serializes props as an entity-escaped JSON attribute', () => {
		expect(embedPlaceholderHtml('callout', { tone: 'warning', count: 2 })).toBe(
			'<div data-svelte-embed="callout" data-props="{&quot;tone&quot;:&quot;warning&quot;,&quot;count&quot;:2}"></div>'
		);
	});

	it('escapes props that would otherwise close the attribute or the tag', () => {
		const html = embedPlaceholderHtml('callout', { text: '"><script>alert(1)</script>' });
		expect(html).not.toContain('<script>');
		expect(html).toMatch(/^<div data-svelte-embed="callout" data-props="[^"]*"><\/div>$/);
	});

	it.each(['Callout', 'call out', 'call_out', 'call.out', '', 'callout/'])(
		'rejects the invalid embed name %o',
		(name) => {
			expect(() => embedPlaceholderHtml(name)).toThrow(/Invalid embed name/);
		}
	);

	it('accepts lowercase names with digits and hyphens', () => {
		expect(() => embedPlaceholderHtml('gallery-2')).not.toThrow();
	});
});

describe('parseEmbedProps', () => {
	it.each([undefined, null, ''])('returns an empty object for %o', (raw) => {
		expect(parseEmbedProps(raw)).toEqual({});
	});

	it('parses plain JSON', () => {
		expect(parseEmbedProps('{"a":1}')).toEqual({ a: 1 });
	});

	it('parses entity-escaped JSON as stored in the attribute', () => {
		expect(parseEmbedProps('{&quot;tone&quot;:&quot;warning&quot;}')).toEqual({ tone: 'warning' });
	});

	it('degrades malformed JSON to no props instead of throwing', () => {
		expect(parseEmbedProps('{not json')).toEqual({});
	});

	it.each([
		['an array', '[1,2]'],
		['a bare string', '"nope"'],
		['a number', '42'],
		['null', 'null']
	])('rejects %s, which is valid JSON but not a props object', (_label, raw) => {
		expect(parseEmbedProps(raw)).toEqual({});
	});

	it('round-trips props through the placeholder it builds', () => {
		const props = { title: 'A & B', nested: { ok: true } };
		const html = embedPlaceholderHtml('callout', props);
		const raw = /data-props="([^"]*)"/.exec(html)?.[1];
		expect(parseEmbedProps(raw)).toEqual(props);
	});
});

describe('parseContentSegments', () => {
	it.each([
		['an empty string', ''],
		['a non-string', 123 as unknown as string],
		['null', null as unknown as string]
	])('returns no segments for %s', (_label, input) => {
		expect(parseContentSegments(input)).toEqual([]);
	});

	it('returns a single html segment when there are no embeds', () => {
		expect(parseContentSegments('<p>hello</p>')).toEqual([{ type: 'html', html: '<p>hello</p>' }]);
	});

	it('returns a single embed segment when there is no surrounding html', () => {
		expect(parseContentSegments('<div data-svelte-embed="callout"></div>')).toEqual([
			{ type: 'embed', name: 'callout', props: {} }
		]);
	});

	it('splits html around an embed, preserving order', () => {
		const segments = parseContentSegments(
			'<p>before</p><div data-svelte-embed="callout"></div><p>after</p>'
		);
		expect(segments).toEqual([
			{ type: 'html', html: '<p>before</p>' },
			{ type: 'embed', name: 'callout', props: {} },
			{ type: 'html', html: '<p>after</p>' }
		]);
	});

	it('carries props through to the embed segment', () => {
		const segments = parseContentSegments(
			'<div data-svelte-embed="callout" data-props="{&quot;tone&quot;:&quot;info&quot;}"></div>'
		);
		expect(segments).toEqual([{ type: 'embed', name: 'callout', props: { tone: 'info' } }]);
	});

	it('handles several embeds in one document', () => {
		const segments = parseContentSegments(
			'<div data-svelte-embed="a"></div>mid<div data-svelte-embed="b"></div>'
		);
		expect(segments.map((s) => (s.type === 'embed' ? s.name : s.html))).toEqual(['a', 'mid', 'b']);
	});

	it('drops whitespace-only html between embeds', () => {
		const segments = parseContentSegments(
			'<div data-svelte-embed="a"></div>\n\n  \t<div data-svelte-embed="b"></div>'
		);
		expect(segments).toHaveLength(2);
		expect(segments.every((s) => s.type === 'embed')).toBe(true);
	});

	it('tolerates whitespace inside the placeholder element', () => {
		expect(parseContentSegments('<div data-svelte-embed="callout">\n</div>')).toEqual([
			{ type: 'embed', name: 'callout', props: {} }
		]);
	});

	it('leaves a div that is not an embed as plain html', () => {
		const html = '<div class="note">text</div>';
		expect(parseContentSegments(html)).toEqual([{ type: 'html', html }]);
	});

	it('returns the same result when called twice', () => {
		// The block pattern is a module-level /g regex, so a stale lastIndex
		// would make every second call skip the first embed.
		const html = '<p>a</p><div data-svelte-embed="callout"></div>';
		expect(parseContentSegments(html)).toEqual(parseContentSegments(html));
		expect(parseContentSegments(html)).toHaveLength(2);
	});
});
