/**
 * Agent-readiness contract tests (AGENTS.md §8).
 *
 * These are regression guards, not coverage filler. Every assertion here maps to
 * a published contract that an external crawler or agent relies on, and each one
 * has a specific failure it exists to catch:
 *
 *  - robots.txt losing its `User-agent` line (the whole file becomes invalid)
 *  - the sitemap silently dropping a new public page
 *  - the API catalog advertising an endpoint that no longer exists
 *  - a skills digest drifting from the document it describes
 *
 * The route-coverage test at the bottom is the one that keeps this true over
 * time: adding a page route without deciding its crawl policy fails the suite.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
	AGENT_LINKS,
	AI_CRAWLERS,
	CONTENT_SIGNAL,
	CRAWLER_ALLOW,
	CRAWLER_DISALLOW,
	SITEMAP_EXCLUDED_ROUTES,
	SITEMAP_ROUTES,
	absoluteUrl,
	buildLinkHeader,
	escapeXml
} from '../../src/lib/agent-discovery';
import { AGENT_SKILLS, findAgentSkill, skillDigest } from '../../src/lib/server/agent-skills';

import { GET as robotsGet } from '../../src/routes/robots.txt/+server';
import { GET as sitemapGet } from '../../src/routes/sitemap.xml/+server';
import { GET as authMdGet } from '../../src/routes/auth.md/+server';
import { GET as healthGet } from '../../src/routes/api/health/+server';
import { GET as catalogGet } from '../../src/routes/[x+2e]well-known/api-catalog/+server';
import { GET as skillsIndexGet } from '../../src/routes/[x+2e]well-known/agent-skills/index.json/+server';
import { GET as skillDocGet } from '../../src/routes/[x+2e]well-known/agent-skills/[skill]/SKILL.md/+server';

const ORIGIN = 'https://example.test';

/** Minimal event stub — these handlers only read `url` and `platform`. */
function event(path: string, extras: Record<string, unknown> = {}) {
	return { url: new URL(`${ORIGIN}${path}`), ...extras } as never;
}

/** D1 stub returning fixed rows from `.prepare().bind().all()`. */
function createDb(rows: unknown[] = [], options: { failing?: boolean } = {}) {
	return {
		prepare: () => ({
			bind: () => ({
				all: async () => {
					if (options.failing) throw new Error('D1 unavailable');
					return { results: rows };
				}
			}),
			first: async () => {
				if (options.failing) throw new Error('D1 unavailable');
				return { 1: 1 };
			},
			all: async () => {
				if (options.failing) throw new Error('D1 unavailable');
				return { results: rows };
			}
		})
	};
}

describe('robots.txt', () => {
	it('serves plain text with 200', async () => {
		const response = await robotsGet(event('/robots.txt'));
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('text/plain');
	});

	it('declares at least one User-agent group', async () => {
		// The original defect: a robots.txt with no User-agent line is invalid and
		// is ignored wholesale by conforming crawlers (RFC 9309 §2.2.1).
		const body = await (await robotsGet(event('/robots.txt'))).text();
		expect(body).toMatch(/^User-agent: \*$/m);
	});

	it('names every AI crawler explicitly', async () => {
		const body = await (await robotsGet(event('/robots.txt'))).text();
		for (const crawler of AI_CRAWLERS) {
			expect(body).toContain(`User-agent: ${crawler}`);
		}
	});

	it('declares Content Signals', async () => {
		const body = await (await robotsGet(event('/robots.txt'))).text();
		expect(body).toContain(`Content-Signal: ${CONTENT_SIGNAL}`);
	});

	it('keeps private surfaces disallowed for every group', async () => {
		const text = await (await robotsGet(event('/robots.txt'))).text();
		// One Disallow per path per group (wildcard + the AI group).
		for (const path of CRAWLER_DISALLOW) {
			const occurrences = text.split(`Disallow: ${path}\n`).length - 1;
			expect(occurrences).toBe(2);
		}
	});

	it('re-allows the health endpoint above the /api/ disallow', async () => {
		const body = await (await robotsGet(event('/robots.txt'))).text();
		for (const path of CRAWLER_ALLOW) {
			expect(body).toContain(`Allow: ${path}`);
		}
	});

	it('points at the sitemap on the requesting host', async () => {
		const body = await (await robotsGet(event('/robots.txt'))).text();
		expect(body).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
	});
});

describe('sitemap.xml', () => {
	it('serves XML with 200', async () => {
		const response = await sitemapGet(event('/sitemap.xml', { platform: undefined }));
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('application/xml');
	});

	it('lists every declared static route as an absolute URL on this host', async () => {
		const body = await (await sitemapGet(event('/sitemap.xml', { platform: undefined }))).text();
		for (const route of SITEMAP_ROUTES) {
			expect(body).toContain(`<loc>${absoluteUrl(ORIGIN, route.path)}</loc>`);
		}
	});

	it('includes published CMS items and their type list pages', async () => {
		const db = createDb([
			{ type_slug: 'blog', item_slug: 'hello-world', lastmod: '2026-07-28 11:00:00' },
			{ type_slug: 'blog', item_slug: 'second-post', lastmod: null }
		]);
		const body = await (
			await sitemapGet(event('/sitemap.xml', { platform: { env: { DB: db } } }))
		).text();

		expect(body).toContain(`<loc>${ORIGIN}/blog</loc>`);
		expect(body).toContain(`<loc>${ORIGIN}/blog/hello-world</loc>`);
		expect(body).toContain(`<loc>${ORIGIN}/blog/second-post</loc>`);
	});

	it('converts D1 timestamps to W3C dates and omits unusable ones', async () => {
		const db = createDb([
			{ type_slug: 'blog', item_slug: 'dated', lastmod: '2026-07-28 11:00:00' },
			{ type_slug: 'blog', item_slug: 'undated', lastmod: null }
		]);
		const body = await (
			await sitemapGet(event('/sitemap.xml', { platform: { env: { DB: db } } }))
		).text();

		// `2026-07-28 11:00:00` is not valid W3C datetime; the date alone is.
		expect(body).toContain('<lastmod>2026-07-28</lastmod>');
		expect(body).not.toContain('11:00:00');
		// Two items, one lastmod.
		expect(body.split('<lastmod>').length - 1).toBe(1);
	});

	it('still serves static routes when the database fails', async () => {
		// A partial sitemap beats a 500, which tells the crawler there is none.
		const response = await sitemapGet(
			event('/sitemap.xml', { platform: { env: { DB: createDb([], { failing: true }) } } })
		);
		expect(response.status).toBe(200);
		expect(await response.text()).toContain(`<loc>${ORIGIN}/</loc>`);
	});

	it('escapes XML metacharacters in slugs', () => {
		expect(escapeXml(`a&b<c>"d'`)).toBe('a&amp;b&lt;c&gt;&quot;d&apos;');
	});
});

describe('/.well-known/api-catalog', () => {
	it('serves the RFC 9727 media type', async () => {
		const response = await catalogGet(event('/.well-known/api-catalog'));
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('application/linkset+json');
	});

	it('anchors every entry on this host with a service-doc link', async () => {
		const body = await (await catalogGet(event('/.well-known/api-catalog'))).json();
		expect(Array.isArray(body.linkset)).toBe(true);
		expect(body.linkset.length).toBeGreaterThan(0);

		for (const member of body.linkset) {
			expect(member.anchor.startsWith(ORIGIN)).toBe(true);
			expect(member['service-doc']?.[0]?.href).toBe(`${ORIGIN}/documentation`);
		}
	});

	it('only advertises endpoints that exist in the codebase', () => {
		// Guards the honesty rule: a catalogued path an agent cannot reach is worse
		// than an absent catalog. Anchors map to src/routes/api/<segments>.
		const routes = resolve(__dirname, '../../src/routes');
		const anchors = ['/api/contact-form-submissions', '/api/health', '/api/cms', '/api/chat'];
		for (const anchor of anchors) {
			expect(existsSync(join(routes, anchor))).toBe(true);
		}
	});
});

describe('agent skills discovery', () => {
	it('serves an index with a schema and one entry per skill', async () => {
		const response = await skillsIndexGet(event('/.well-known/agent-skills/index.json'));
		expect(response.status).toBe(200);

		const body = await response.json();
		expect(body.$schema).toMatch(/^https:\/\/schemas\.agentskills\.io\//);
		expect(body.skills).toHaveLength(AGENT_SKILLS.length);
	});

	it('publishes a digest matching the bytes the skill route serves', async () => {
		// The failure this catches: editing a skill body without the index noticing,
		// so an agent verifying the digest rejects a legitimate document.
		const index = await (
			await skillsIndexGet(event('/.well-known/agent-skills/index.json'))
		).json();

		for (const entry of index.skills) {
			const served = await skillDocGet(
				event(`/.well-known/agent-skills/${entry.name}/SKILL.md`, {
					params: { skill: entry.name }
				})
			);
			expect(served.status).toBe(200);
			expect(served.headers.get('content-type')).toContain('text/markdown');
			expect(await skillDigest(await served.text())).toBe(entry.digest);
		}
	});

	it('uses the RFC field names', async () => {
		const index = await (
			await skillsIndexGet(event('/.well-known/agent-skills/index.json'))
		).json();
		for (const entry of index.skills) {
			expect(Object.keys(entry).sort()).toEqual(['description', 'digest', 'name', 'type', 'url']);
			expect(entry.type).toBe('skill-md');
			expect(entry.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
		}
	});

	it('404s an unknown skill rather than serving an empty document', async () => {
		// The handler is synchronous, so it throws while the argument is evaluated —
		// wrap it so the throw becomes a rejection `expect` can inspect.
		await expect(async () =>
			skillDocGet(event('/.well-known/agent-skills/nope/SKILL.md', { params: { skill: 'nope' } }))
		).rejects.toHaveProperty('status', 404);
	});

	it('finds skills by name', () => {
		expect(findAgentSkill('read-pages-as-markdown')?.name).toBe('read-pages-as-markdown');
		expect(findAgentSkill('missing')).toBeUndefined();
	});
});

describe('/auth.md', () => {
	it('serves markdown with 200', async () => {
		const response = await authMdGet(event('/auth.md'));
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('text/markdown');
	});

	it('states plainly that there is no agent registration or OAuth server', async () => {
		// This template deliberately does NOT publish oauth-authorization-server or
		// oauth-protected-resource, because it is an OAuth client. If someone later
		// adds a real authorization server, this expectation should be updated
		// alongside the new metadata — not deleted to make the test pass.
		const body = await (await authMdGet(event('/auth.md'))).text();
		expect(body).toContain('Not offered');
		expect(body).toContain('oauth-authorization-server');
	});
});

describe('/api/health', () => {
	it('reports ok when the database answers', async () => {
		const response = await healthGet(
			event('/api/health', { platform: { env: { DB: createDb() } } })
		);
		expect(response.status).toBe(200);
		expect((await response.json()).status).toBe('ok');
	});

	it('reports degraded with 503 when the database is missing', async () => {
		const response = await healthGet(event('/api/health', { platform: undefined }));
		expect(response.status).toBe(503);
		const body = await response.json();
		expect(body.status).toBe('degraded');
		expect(body.services.database).toBe('unavailable');
	});

	it('reports degraded when the database throws', async () => {
		const response = await healthGet(
			event('/api/health', { platform: { env: { DB: createDb([], { failing: true }) } } })
		);
		expect(response.status).toBe(503);
	});
});

describe('Link headers', () => {
	it('serializes registered relation types', () => {
		const header = buildLinkHeader();
		expect(header).toContain('</.well-known/api-catalog>; rel="api-catalog"');
		expect(header).toContain('rel="service-doc"');
	});

	it('emits one comma-separated value covering every declared link', () => {
		expect(buildLinkHeader().split(', ')).toHaveLength(AGENT_LINKS.length);
	});

	it('omits the type parameter when a link has none', () => {
		expect(buildLinkHeader([{ href: '/x', rel: 'self', note: 'test' }])).toBe('</x>; rel="self"');
	});
});

describe('absoluteUrl', () => {
	it('never doubles the slash', () => {
		expect(absoluteUrl('https://a.dev/', '/terms')).toBe('https://a.dev/terms');
		expect(absoluteUrl('https://a.dev', '/terms')).toBe('https://a.dev/terms');
	});

	it('keeps the bare root addressable', () => {
		expect(absoluteUrl('https://a.dev', '/')).toBe('https://a.dev/');
	});
});

describe('sitemap route coverage (the guard)', () => {
	/**
	 * Top-level route directories that render a page.
	 *
	 * Only the first segment matters: policy is set per top-level area, and
	 * nested pages inherit it (an excluded `/admin` covers `/admin/users`).
	 */
	const routesDir = resolve(__dirname, '../../src/routes');
	const pageDirectories = readdirSync(routesDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.filter((name) => existsSync(join(routesDir, name, '+page.svelte')));

	it('finds the app’s route directories', () => {
		// Sanity check: if this ever reads zero directories the tests below would
		// pass vacuously and the guard would be silently dead.
		expect(pageDirectories.length).toBeGreaterThan(3);
	});

	it.each(pageDirectories)(
		'/%s is either in the sitemap or excluded with a reason',
		(directory) => {
			const listed = SITEMAP_ROUTES.some((route) => route.path === `/${directory}`);
			const excluded = Object.prototype.hasOwnProperty.call(SITEMAP_EXCLUDED_ROUTES, directory);

			expect(
				listed || excluded,
				`Route "/${directory}" is neither listed in SITEMAP_ROUTES nor excluded in ` +
					`SITEMAP_EXCLUDED_ROUTES (src/lib/agent-discovery.ts). Add it to one or the ` +
					`other — see AGENTS.md §8.`
			).toBe(true);
		}
	);

	it('lists the site root', () => {
		expect(existsSync(join(routesDir, '+page.svelte'))).toBe(true);
		expect(SITEMAP_ROUTES.some((route) => route.path === '/')).toBe(true);
	});

	it('gives every exclusion a non-trivial reason', () => {
		for (const [route, reason] of Object.entries(SITEMAP_EXCLUDED_ROUTES)) {
			expect(reason.length, `"${route}" needs a real reason`).toBeGreaterThan(20);
		}
	});

	it('has no stale exclusions for routes that no longer exist', () => {
		for (const route of Object.keys(SITEMAP_EXCLUDED_ROUTES)) {
			expect(existsSync(join(routesDir, route)), `"${route}" no longer exists`).toBe(true);
		}
	});

	it('keeps sitemap priorities and changefreq within spec', () => {
		for (const route of SITEMAP_ROUTES) {
			expect(route.priority).toBeGreaterThanOrEqual(0);
			expect(route.priority).toBeLessThanOrEqual(1);
			expect(route.path.startsWith('/')).toBe(true);
		}
	});
});
