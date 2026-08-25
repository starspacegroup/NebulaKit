/**
 * GET /sitemap.xml — canonical index of every crawlable URL on this site.
 *
 * Two sources, merged:
 *   1. Static public pages declared in `SITEMAP_ROUTES` (src/lib/agent-discovery.ts).
 *   2. Published CMS content — content-type list pages plus every published
 *      item — read from D1 at request time, so publishing a post updates the
 *      sitemap with no build step and no cron job.
 *
 * URLs are built from the request origin because the sitemap protocol requires
 * every entry to share the sitemap's own host. That also means this file is
 * correct on a preview deploy and on a custom domain without per-domain edits.
 *
 * Degrades cleanly: if D1 is unreachable (fresh clone with placeholder binding
 * IDs, or a transient error) the static routes are still served. A partial
 * sitemap is useful; a 500 tells the crawler the site has no sitemap at all.
 */
import { SITEMAP_ROUTES, absoluteUrl, escapeXml } from '$lib/agent-discovery';
import { listPublishedContentForSitemap } from '$lib/services/cms';
import type { RequestHandler } from './$types';

/** A single `<url>` entry before serialization. */
interface SitemapEntry {
	loc: string;
	lastmod?: string;
	changefreq?: string;
	priority?: number;
}

/**
 * Normalize a D1 timestamp to the W3C date format sitemaps.org requires.
 *
 * D1 writes `CURRENT_TIMESTAMP` as `YYYY-MM-DD HH:MM:SS` (no `T`, no zone),
 * which is not valid W3C datetime. Rather than guess a timezone, emit the date
 * part only — a valid, honest `lastmod` at day granularity. Anything
 * unparseable is dropped, since `lastmod` is optional and a wrong date is worse
 * than none.
 */
function toW3CDate(value: string | null): string | undefined {
	if (!value) return undefined;
	const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
	return match ? match[1] : undefined;
}

/** Serialize entries into a urlset document. */
function renderSitemap(entries: SitemapEntry[]): string {
	const urls = entries
		.map((entry) => {
			const parts = [`\t\t<loc>${escapeXml(entry.loc)}</loc>`];
			if (entry.lastmod) parts.push(`\t\t<lastmod>${entry.lastmod}</lastmod>`);
			if (entry.changefreq) parts.push(`\t\t<changefreq>${entry.changefreq}</changefreq>`);
			if (entry.priority !== undefined) {
				parts.push(`\t\t<priority>${entry.priority.toFixed(1)}</priority>`);
			}
			return `\t<url>\n${parts.join('\n')}\n\t</url>`;
		})
		.join('\n');

	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export const GET: RequestHandler = async ({ url, platform }) => {
	const origin = url.origin;

	const entries: SitemapEntry[] = SITEMAP_ROUTES.map((route) => ({
		loc: absoluteUrl(origin, route.path),
		changefreq: route.changefreq,
		priority: route.priority
	}));

	const db = platform?.env?.DB;
	if (db) {
		try {
			const rows = await listPublishedContentForSitemap(db);

			// Content-type list pages (/blog, /faq, …) — one entry per type that
			// actually has published content, so the sitemap never advertises an
			// empty listing page.
			const typeSlugs = new Set(rows.map((row) => row.typeSlug));
			for (const typeSlug of typeSlugs) {
				entries.push({
					loc: absoluteUrl(origin, `/${typeSlug}`),
					changefreq: 'daily',
					priority: 0.7
				});
			}

			// Individual items (/blog/hello-world).
			for (const row of rows) {
				entries.push({
					loc: absoluteUrl(origin, `/${row.typeSlug}/${row.itemSlug}`),
					lastmod: toW3CDate(row.lastmod),
					changefreq: 'monthly',
					priority: 0.6
				});
			}
		} catch (error) {
			// Static routes are already queued; log and ship what we have.
			console.error('sitemap: failed to read CMS content', error);
		}
	}

	return new Response(renderSitemap(entries), {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			// Short TTL: publishing a post should show up quickly, but a burst of
			// crawlers shouldn't each trigger a fresh D1 scan.
			'Cache-Control': 'public, max-age=600'
		}
	});
};
