/**
 * `Accept: text/markdown` content negotiation.
 *
 * Agents that ask for Markdown get Markdown; browsers, which never send that
 * Accept value, keep getting HTML byte-for-byte. Lives here rather than in
 * hooks.server.ts so it can be unit-tested directly — hooks are excluded from
 * coverage (see vite.config.ts).
 */
import { estimateTokens, htmlToMarkdown } from './html-to-markdown';

/**
 * Does this `Accept` header ask for Markdown?
 *
 * Honours q-values, so `text/markdown;q=0` is an explicit refusal rather than a
 * request. Anything else mentioning `text/markdown` counts — no browser sends
 * it, so presence is a reliable signal of an agent on the other end.
 */
export function prefersMarkdown(accept: string | null | undefined): boolean {
	if (!accept) return false;

	for (const part of accept.split(',')) {
		const [rawType, ...parameters] = part.split(';');
		const type = rawType.trim().toLowerCase();
		if (type !== 'text/markdown') continue;

		const q = parameters
			.map((parameter) => /^\s*q\s*=\s*([0-9.]+)\s*$/i.exec(parameter))
			.find(Boolean);
		return q ? Number(q[1]) > 0 : true;
	}

	return false;
}

/** Is this a response we can meaningfully convert? */
export function isConvertibleHtml(response: Response): boolean {
	return (
		response.status === 200 && (response.headers.get('content-type') ?? '').includes('text/html')
	);
}

/**
 * Rebuild an HTML response as Markdown.
 *
 * Original headers are preserved except the ones the new body invalidates:
 * `content-length` and `content-encoding` would describe the HTML bytes, and
 * carrying them over produces a truncated or undecodable response.
 *
 * `Vary: Accept` is mandatory here — without it a shared cache can serve this
 * Markdown to the next browser that asks for the same URL.
 */
export async function toMarkdownResponse(response: Response): Promise<Response> {
	const markdown = htmlToMarkdown(await response.text());

	const headers = new Headers(response.headers);
	headers.delete('content-length');
	headers.delete('content-encoding');
	headers.set('Content-Type', 'text/markdown; charset=utf-8');
	headers.set('x-markdown-tokens', String(estimateTokens(markdown)));
	headers.set('Vary', 'Accept');

	return new Response(markdown, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}
