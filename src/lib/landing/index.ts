/**
 * Landing pages — public surface. See docs/SEO_LANDING_PAGES.md.
 *
 * `LANDING` is the active site config from `content/site.ts`; routes,
 * components, the sitemap and the guardrail test all read it.
 */
export * from './types';
export { DEFAULT_FAMILIES, defineFamilies } from './families';
export {
	canonicalUrl,
	familyByKey,
	familyPages,
	findFamily,
	findPage,
	hubPath,
	isLandingSegment,
	landingPaths,
	landingSitemapRoutes,
	legacyRedirect,
	pagePath,
	publishedPages
} from './routing';
export { hubJsonLd, pageJsonLd } from './jsonld';
export { auditLanding, formatAudit, DEFAULT_LIMITS } from './audit';
export type { AuditIssue, AuditReport, AuditTodo } from './audit';

export { definePage } from './define';

export { LANDING } from './content/site';
