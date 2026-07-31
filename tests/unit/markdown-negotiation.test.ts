/**
 * Tests for `Accept: text/markdown` negotiation (AGENTS.md §8).
 *
 * The behaviour that matters: browsers must keep getting HTML byte-for-byte,
 * agents must get Markdown, and the response must carry `Vary: Accept` so a
 * shared cache never serves one to the other.
 */
import { describe, expect, it } from 'vitest';
import {
	isConvertibleHtml,
	prefersMarkdown,
	toMarkdownResponse
} from '../../src/lib/server/markdown-negotiation';

/** Build a response resembling what SvelteKit renders. */
function htmlResponse(body: string, init: ResponseInit = {}) {
	return new Response(body, {
		status: 200,
		headers: { 'Content-Type': 'text/html' },
		...init
	});
}

describe('prefersMarkdown', () => {
	it('detects an explicit markdown request', () => {
		expect(prefersMarkdown('text/markdown')).toBe(true);
		expect(prefersMarkdown('text/markdown, text/html;q=0.9')).toBe(true);
	});

	it('ignores the Accept header browsers actually send', () => {
		// If this ever returns true, every browser visitor gets Markdown.
		expect(
			prefersMarkdown(
				'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
			)
		).toBe(false);
	});

	it('treats q=0 as a refusal', () => {
		expect(prefersMarkdown('text/markdown;q=0')).toBe(false);
		expect(prefersMarkdown('text/markdown;q=0.0')).toBe(false);
	});

	it('accepts a positive q-value', () => {
		expect(prefersMarkdown('text/markdown;q=0.5')).toBe(true);
	});

	it('is case- and whitespace-insensitive', () => {
		expect(prefersMarkdown('  TEXT/MARKDOWN ')).toBe(true);
	});

	it('handles a missing header', () => {
		expect(prefersMarkdown(null)).toBe(false);
		expect(prefersMarkdown(undefined)).toBe(false);
		expect(prefersMarkdown('')).toBe(false);
	});

	it('does not match a media type that merely contains the word', () => {
		expect(prefersMarkdown('text/markdownish')).toBe(false);
	});
});

describe('isConvertibleHtml', () => {
	it('accepts a 200 HTML response', () => {
		expect(isConvertibleHtml(htmlResponse('<p>x</p>'))).toBe(true);
	});

	it('rejects non-HTML responses', () => {
		expect(
			isConvertibleHtml(new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
		).toBe(false);
	});

	it('rejects redirects and errors', () => {
		expect(isConvertibleHtml(htmlResponse('<p>x</p>', { status: 404 }))).toBe(false);
	});
});

describe('toMarkdownResponse', () => {
	const html =
		'<html><head><title>T</title></head><body><main><h1>Hi</h1><p>Body.</p></main></body></html>';

	it('converts the body to markdown', async () => {
		const response = await toMarkdownResponse(htmlResponse(html));
		expect(await response.text()).toBe('# Hi\n\nBody.');
	});

	it('sets the markdown content type', async () => {
		const response = await toMarkdownResponse(htmlResponse(html));
		expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
	});

	it('reports an approximate token count', async () => {
		const response = await toMarkdownResponse(htmlResponse(html));
		expect(Number(response.headers.get('x-markdown-tokens'))).toBeGreaterThan(0);
	});

	it('sets Vary: Accept so caches keep the representations apart', async () => {
		const response = await toMarkdownResponse(htmlResponse(html));
		expect(response.headers.get('vary')).toBe('Accept');
	});

	it('drops headers that described the HTML bytes', async () => {
		// Carrying these over yields a truncated or undecodable response.
		const original = htmlResponse(html, {
			headers: {
				'Content-Type': 'text/html',
				'Content-Length': '9999',
				'Content-Encoding': 'gzip'
			}
		});
		const response = await toMarkdownResponse(original);
		expect(response.headers.get('content-length')).toBeNull();
		expect(response.headers.get('content-encoding')).toBeNull();
	});

	it('preserves unrelated headers', async () => {
		const original = htmlResponse(html, {
			headers: { 'Content-Type': 'text/html', Link: '</x>; rel="self"' }
		});
		const response = await toMarkdownResponse(original);
		expect(response.headers.get('link')).toBe('</x>; rel="self"');
	});

	it('keeps the original status', async () => {
		const response = await toMarkdownResponse(htmlResponse(html));
		expect(response.status).toBe(200);
	});
});
