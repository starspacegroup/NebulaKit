import type { SitemapRoute } from '$lib/agent-discovery';
import type { FamilyKey, LandingFamily, LandingPage, LandingSiteConfig } from './types';

/** Pages that are routed and listed: everything not marked `draft`. */
export const publishedPages = (site: LandingSiteConfig): LandingPage[] =>
	site.pages.filter((p) => !p.draft);

export const findFamily = (site: LandingSiteConfig, prefix: string): LandingFamily | undefined =>
	site.families.find((f) => f.prefix === prefix);

export const familyByKey = (site: LandingSiteConfig, key: FamilyKey): LandingFamily | undefined =>
	site.families.find((f) => f.key === key);

export const familyPages = (site: LandingSiteConfig, key: FamilyKey): LandingPage[] =>
	publishedPages(site).filter((p) => p.family === key);

export function findPage(
	site: LandingSiteConfig,
	prefix: string,
	slug: string
): { family: LandingFamily; page: LandingPage } | undefined {
	const family = findFamily(site, prefix);
	const page = family && familyPages(site, family.key).find((p) => p.slug === slug);
	return family && page ? { family, page } : undefined;
}

export const hubPath = (family: LandingFamily) => `/${family.prefix}`;

export function pagePath(site: LandingSiteConfig, page: LandingPage): string {
	const family = familyByKey(site, page.family);
	if (!family) throw new Error(`landing page "${page.slug}" names unknown family "${page.family}"`);
	return `${hubPath(family)}/${page.slug}`;
}

/** Absolute canonical URL on the production origin. */
export const canonicalUrl = (site: LandingSiteConfig, path: string) =>
	`${site.origin.replace(/\/$/, '')}${path}`;

/** Every routed path, hubs first. Hubs with no published pages are left out. */
export function landingPaths(site: LandingSiteConfig): string[] {
	const live = site.families.filter((f) => familyPages(site, f.key).length);
	return [
		...live.map(hubPath),
		...live.flatMap((f) => familyPages(site, f.key).map((p) => `${hubPath(f)}/${p.slug}`))
	];
}

/**
 * Sitemap entries for the landing pages. Empty while the site still ships the
 * example content, so placeholder pages are never offered to a crawler.
 */
export function landingSitemapRoutes(site: LandingSiteConfig): SitemapRoute[] {
	if (site.example) return [];
	return landingPaths(site).map((path) => ({
		path,
		changefreq: 'monthly',
		priority: path.split('/').length === 2 ? 0.7 : 0.6
	}));
}

/** True when `segment` is a live family prefix or one of its legacy names. */
export const isLandingSegment = (site: LandingSiteConfig, segment: string) =>
	site.families.some((f) => f.prefix === segment || f.legacyPrefixes?.includes(segment));

/**
 * The 301 target for a path under a renamed family prefix, or null.
 * `/for/restaurants?x=1` → `/who/restaurants?x=1` when `who` lists `for`.
 */
export function legacyRedirect(site: LandingSiteConfig, url: URL): string | null {
	const [, first, ...rest] = url.pathname.split('/');
	const family = site.families.find((f) => f.legacyPrefixes?.includes(first));
	if (!family) return null;
	const tail = rest.filter(Boolean).join('/');
	return `/${family.prefix}${tail ? `/${tail}` : ''}${url.search}`;
}
