/**
 * Tests for the CMS embed placeholder codec and segment parser ($lib/cms/embed)
 */
import { describe, expect, it } from 'vitest';

import {
	decodeAttrEntities,
	embedPlaceholderHtml,
	encodeAttrEntities,
	parseContentSegments,
	parseEmbedProps
} from '../../src/lib/cms/embed';

describe('attr entity codec', () => {
	it('round-trips special characters', () => {
		const raw = `{"a":"<b> & 'c' \\"d\\""}`;
		expect(decodeAttrEntities(encodeAttrEntities(raw))).toBe(raw);
	});
});

describe('embedPlaceholderHtml', () => {
	it('builds a placeholder without props', () => {
		expect(embedPlaceholderHtml('callout')).toBe('<div data-svelte-embed="callout"></div>');
	});

	it('builds a placeholder with encoded props', () => {
		const html = embedPlaceholderHtml('callout', { level: 300 });
		expect(html).toBe(
			'<div data-svelte-embed="callout" data-props="{&quot;level&quot;:300}"></div>'
		);
	});

	it('rejects invalid names', () => {
		expect(() => embedPlaceholderHtml('Bad Name')).toThrow('Invalid embed name');
	});
});

describe('parseEmbedProps', () => {
	it('parses entity-escaped JSON', () => {
		expect(parseEmbedProps('{&quot;level&quot;:300}')).toEqual({ level: 300 });
	});

	it('degrades malformed values to empty props', () => {
		expect(parseEmbedProps('{broken')).toEqual({});
		expect(parseEmbedProps('[1,2]')).toEqual({});
		expect(parseEmbedProps('"str"')).toEqual({});
		expect(parseEmbedProps(undefined)).toEqual({});
		expect(parseEmbedProps('')).toEqual({});
	});
});

describe('parseContentSegments', () => {
	it('returns a single html segment for plain content', () => {
		expect(parseContentSegments('<p>hello</p>')).toEqual([{ type: 'html', html: '<p>hello</p>' }]);
	});

	it('returns empty for empty/non-string input', () => {
		expect(parseContentSegments('')).toEqual([]);
		expect(parseContentSegments(undefined as unknown as string)).toEqual([]);
	});

	it('splits html around a single embed', () => {
		const html = '<p>before</p>' + embedPlaceholderHtml('callout', { level: 1 }) + '<p>after</p>';
		expect(parseContentSegments(html)).toEqual([
			{ type: 'html', html: '<p>before</p>' },
			{ type: 'embed', name: 'callout', props: { level: 1 } },
			{ type: 'html', html: '<p>after</p>' }
		]);
	});

	it('handles multiple embeds back to back', () => {
		const html =
			embedPlaceholderHtml('one') + embedPlaceholderHtml('two', { x: 'y' }) + '<p>tail</p>';
		const segments = parseContentSegments(html);
		expect(segments).toEqual([
			{ type: 'embed', name: 'one', props: {} },
			{ type: 'embed', name: 'two', props: { x: 'y' } },
			{ type: 'html', html: '<p>tail</p>' }
		]);
	});

	it('round-trips the sanitizer output shape (attrs in any order)', () => {
		const html = '<div data-props="{&quot;a&quot;:1}" data-svelte-embed="thing"></div>';
		expect(parseContentSegments(html)).toEqual([{ type: 'embed', name: 'thing', props: { a: 1 } }]);
	});

	it('treats embeds with malformed props as prop-less', () => {
		const html = '<div data-svelte-embed="thing" data-props="{oops"></div>';
		expect(parseContentSegments(html)).toEqual([{ type: 'embed', name: 'thing', props: {} }]);
	});

	it('ignores plain divs and skips whitespace-only chunks', () => {
		const html = '<div class="x">not an embed</div> ' + embedPlaceholderHtml('real') + '  ';
		const segments = parseContentSegments(html);
		expect(segments[0]).toEqual({ type: 'html', html: '<div class="x">not an embed</div> ' });
		expect(segments[1]).toEqual({ type: 'embed', name: 'real', props: {} });
		expect(segments).toHaveLength(2);
	});
});
