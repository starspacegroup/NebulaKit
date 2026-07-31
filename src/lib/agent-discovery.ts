/**
 * Agent discovery surface — the single source of truth for the machine-readable
 * contract this site publishes to AI agents, LLM crawlers, and search engines.
 *
 * Consumed by:
 *   - src/routes/robots.txt/+server.ts          (crawl rules + content signals)
 *   - src/routes/sitemap.xml/+server.ts         (canonical URL index)
 *   - src/routes/.well-known/api-catalog/+server.ts
 *   - src/routes/.well-known/agent-skills/...   (skills discovery index)
 *   - src/hooks.server.ts                       (RFC 8288 Link headers)
 *   - tests/unit/agent-readiness.test.ts        (regression guard)
 *
 * WHY THIS IS ONE MODULE: the guard test asserts that every public page route
 * is either listed for the sitemap or explicitly excluded *with a stated
 * reason*. Adding a page without deciding its crawl policy fails the test suite
 * rather than silently shipping an incomplete sitemap. See AGENTS.md §8.
 *
 * WHY REQUEST-ORIGIN URLS, NOT `site.config.url`: the sitemap protocol requires
 * every listed URL to share the sitemap's own host, and robots.txt is per-host
 * by definition. Deriving from the live request keeps preview deploys, custom
 * domains, and *.pages.dev all correct without anyone re-running
 * `bun run customize` — which is exactly why these files never go stale.
 *
 * This module must stay dependency-free (no `$app`, no Node APIs) so routes,
 * hooks, and tests can all import it.
 */

/** A page that should appear in sitemap.xml. */
export interface SitemapRoute {
	/** Root-relative path, no trailing slash (except the root itself). */
	path: string;
	/** How often the page is expected to change (sitemaps.org `changefreq`). */
	changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
	/** Relative importance within this site, 0.0–1.0 (sitemaps.org `priority`). */
	priority: number;
}

/**
 * Public pages listed in sitemap.xml.
 *
 * Add every new publicly-crawlable page here. If a page should NOT be listed,
 * add it to {@link SITEMAP_EXCLUDED_ROUTES} with a reason instead — the guard
 * test accepts either, but never silence.
 */
export const SITEMAP_ROUTES: readonly SitemapRoute[] = [
	{ path: '/', changefreq: 'weekly', priority: 1.0 },
	{ path: '/documentation', changefreq: 'weekly', priority: 0.8 },
	{ path: '/chat', changefreq: 'monthly', priority: 0.6 },
	{ path: '/contact', changefreq: 'monthly', priority: 0.5 },
	{ path: '/privacy', changefreq: 'yearly', priority: 0.3 },
	{ path: '/terms', changefreq: 'yearly', priority: 0.3 }
];

/**
 * Top-level route directories deliberately kept out of sitemap.xml, and why.
 *
 * The guard test reads these reasons — a bare exclusion with no justification
 * is treated as an oversight. Keys are top-level route segments as they appear
 * in `src/routes/`.
 */
export const SITEMAP_EXCLUDED_ROUTES: Readonly<Record<string, string>> = {
	admin: 'Owner/admin console — private, and Disallowed for every crawler.',
	api: 'JSON endpoints, not pages. Described by /.well-known/api-catalog instead.',
	auth: 'Sign-in and sign-up forms — no standalone content worth indexing.',
	profile: 'Requires an authenticated session; renders per-user data.',
	reset: 'Destructive maintenance route — must never be crawled or surfaced.',
	setup: 'One-time install wizard; meaningless (and risky) once the site is live.',
	media: 'R2 binary passthrough, not an HTML page.',
	'[contentType]': 'Enumerated dynamically from the CMS at request time.'
};

/**
 * Paths no crawler should walk, for any user-agent group.
 *
 * Applies to the wildcard group AND every named AI crawler group: "open to
 * everything" is a policy about *published content*, not an invitation into the
 * admin console. Order matters in RFC 9309 only for specificity, not sequence.
 */
export const CRAWLER_DISALLOW: readonly string[] = [
	'/admin/',
	'/api/',
	'/auth/',
	'/profile',
	'/reset',
	'/setup',
	'/media/'
];

/**
 * Paths re-allowed after the broader Disallow rules above.
 *
 * RFC 9309 §2.2.2 resolves conflicts by longest match, so `/api/health` wins
 * over `/api/`. The health endpoint is the `status` link in the API catalog, so
 * it has to stay reachable for the catalog to be honest.
 */
export const CRAWLER_ALLOW: readonly string[] = ['/api/health'];

/**
 * Content Signals (contentsignals.org) — how this site's content may be used
 * once it has been fetched, expressed alongside the crawl rules.
 *
 * NebulaKit's shipped default is fully permissive: the template is open source
 * and its demo content is meant to be found, quoted, and learned from.
 *
 *   search    — may be indexed and linked in search results
 *   ai-input  — may be retrieved to ground a live AI answer (RAG) and cited
 *   ai-train  — may be used as AI training data
 *
 * DOWNSTREAM SITES: this is a policy choice, not a technical one. If your
 * content is proprietary, flip `ai-train` (and possibly `ai-input`) to `no`
 * here — every robots.txt group picks the change up automatically.
 */
export const CONTENT_SIGNAL = 'search=yes, ai-input=yes, ai-train=yes';

/**
 * AI crawlers named explicitly in robots.txt.
 *
 * Naming them matters even when the policy matches the wildcard group: several
 * operators only honour rules written against their own token, and auditors
 * flag a robots.txt with no AI-specific entries as "undeclared". They share one
 * RFC 9309 group (multiple `User-agent` lines, one rule block) — valid, and far
 * easier to keep consistent than 20 near-identical stanzas.
 */
export const AI_CRAWLERS: readonly string[] = [
	// OpenAI
	'GPTBot',
	'OAI-SearchBot',
	'ChatGPT-User',
	// Anthropic
	'ClaudeBot',
	'Claude-Web',
	'Claude-User',
	'Claude-SearchBot',
	'anthropic-ai',
	// Google (Gemini / Vertex training opt-in token)
	'Google-Extended',
	// Perplexity
	'PerplexityBot',
	'Perplexity-User',
	// Apple
	'Applebot-Extended',
	// Meta
	'Meta-ExternalAgent',
	'FacebookBot',
	// Common Crawl — the corpus behind many open models
	'CCBot',
	// Others in common rotation
	'Bytespider',
	'Amazonbot',
	'cohere-ai',
	'MistralAI-User',
	'DuckAssistBot',
	'YouBot',
	'Diffbot',
	'TimpiBot'
];

/** An RFC 8288 Link header entry advertised on HTML responses. */
export interface AgentLink {
	/** Root-relative target of the link. */
	href: string;
	/** IANA-registered relation type where one exists. */
	rel: string;
	/** Media type hint for the target. */
	type?: string;
	/** Why this link is advertised — documentation only, never serialized. */
	note: string;
}

/**
 * Link headers advertised on HTML responses (RFC 8288).
 *
 * Registered relation types only, so a conforming agent can act on them without
 * out-of-band knowledge: `api-catalog` is RFC 9727, `service-doc` and
 * `describedby` are in the IANA Link Relations registry, `sitemap` is
 * registered via the sitemaps.org protocol.
 */
export const AGENT_LINKS: readonly AgentLink[] = [
	{
		href: '/.well-known/api-catalog',
		rel: 'api-catalog',
		type: 'application/linkset+json',
		note: 'RFC 9727 catalog of this deployment’s APIs.'
	},
	{
		href: '/documentation',
		rel: 'service-doc',
		type: 'text/html',
		note: 'Human-readable documentation for the app and its API surface.'
	},
	{
		href: '/sitemap.xml',
		rel: 'sitemap',
		type: 'application/xml',
		note: 'Canonical index of crawlable pages.'
	},
	{
		href: '/auth.md',
		rel: 'describedby',
		type: 'text/markdown',
		note: 'How agents authenticate against this deployment.'
	}
];

/**
 * Serialize {@link AGENT_LINKS} into a single RFC 8288 `Link` header value.
 *
 * Multiple links are comma-separated in one header rather than repeated across
 * several headers — both are legal, but one value survives proxies and CDN
 * header-merging more predictably.
 */
export function buildLinkHeader(links: readonly AgentLink[] = AGENT_LINKS): string {
	return links
		.map((link) => {
			const params = [`rel="${link.rel}"`];
			if (link.type) params.push(`type="${link.type}"`);
			return `<${link.href}>; ${params.join('; ')}`;
		})
		.join(', ');
}

/**
 * Join an origin and a root-relative path into an absolute URL.
 *
 * Trailing slashes are trimmed from the origin so `https://x.dev/` + `/terms`
 * never yields a double slash, and the bare root stays `https://x.dev/`.
 */
export function absoluteUrl(origin: string, path: string): string {
	const base = origin.replace(/\/+$/, '');
	return path === '/' ? `${base}/` : `${base}${path}`;
}

/** Escape the five XML entities so CMS slugs can't break the sitemap document. */
export function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}
