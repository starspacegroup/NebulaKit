/**
 * GET /robots.txt — crawl rules, AI crawler policy, and Content Signals.
 *
 * Served as a route rather than a file in `static/` for two reasons:
 *
 *  1. The `Sitemap:` line and the host it points at are derived from the live
 *     request origin, so this file is correct on localhost, on preview deploys,
 *     and on a custom domain without anyone editing it.
 *  2. Keeping policy in the route avoids duplicating deploy-specific URLs in a
 *     static file that can drift from the live origin.
 *
 * Policy lives in src/lib/agent-discovery.ts; this module only formats it.
 * Format follows RFC 9309; Content-Signal follows contentsignals.org.
 */
import { AI_CRAWLERS, CONTENT_SIGNAL, CRAWLER_ALLOW, CRAWLER_DISALLOW } from '$lib/agent-discovery';
import { site } from '$lib/site.config';
import type { RequestHandler } from './$types';

/**
 * Render one RFC 9309 group: one or more `User-agent` lines followed by the
 * rules that apply to all of them.
 *
 * `Allow` precedes `Disallow` for readability only — conformant parsers resolve
 * conflicts by longest-match, not by line order (RFC 9309 §2.2.2).
 */
function group(userAgents: readonly string[]): string {
	return [
		...userAgents.map((ua) => `User-agent: ${ua}`),
		`Content-Signal: ${CONTENT_SIGNAL}`,
		'Allow: /',
		...CRAWLER_ALLOW.map((path) => `Allow: ${path}`),
		...CRAWLER_DISALLOW.map((path) => `Disallow: ${path}`)
	].join('\n');
}

export const GET: RequestHandler = ({ url }) => {
	const body = [
		`# robots.txt for ${site.name}`,
		'#',
		'# Content Signals (https://contentsignals.org) declare how this content may',
		'# be used after it is fetched. This deployment allows all three:',
		'#',
		'#   search   = yes  — index it and link to it from search results',
		'#   ai-input = yes  — retrieve it to ground a live AI answer, with citation',
		'#   ai-train = yes  — use it as AI training data',
		'#',
		'# Private surfaces (admin console, JSON APIs, auth flows, the reset and',
		'# setup routes) stay Disallowed for every crawler, AI or otherwise.',
		'',
		group(['*']),
		'',
		'# Named AI crawlers. The policy matches the wildcard group above, but',
		'# several operators only honour rules written against their own token.',
		'',
		group(AI_CRAWLERS),
		'',
		`Sitemap: ${url.origin}/sitemap.xml`,
		''
	].join('\n');

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			// Long-lived but revalidatable: crawlers re-read robots.txt often, and a
			// stale copy silently governs crawl behaviour until it expires.
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
