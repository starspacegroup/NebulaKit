/**
 * The anti-doorway guardrails, run against THIS site's landing content
 * (src/lib/landing/content). A downstream site keeps this file as is: it
 * fails when its own pages repeat each other, cross a type with a region,
 * claim a place with no tie, or state a figure nobody verified. Open
 * TODO(owner) markers are printed, not failed. See docs/SEO_LANDING_PAGES.md.
 */
import { describe, expect, it } from 'vitest';
import {
	LANDING,
	auditLanding,
	canonicalUrl,
	familyByKey,
	formatAudit,
	landingPaths,
	landingSitemapRoutes,
	pageJsonLd,
	pagePath,
	publishedPages
} from '../../src/lib/landing';
import { SITEMAP_ROUTES } from '../../src/lib/agent-discovery';

const report = auditLanding(LANDING);

describe('landing content guardrails', () => {
	it('passes the audit', () => {
		if (report.todos.length) console.info(formatAudit({ errors: [], todos: report.todos }));
		expect(report.errors, formatAudit(report)).toEqual([]);
	});

	it('builds each FAQPage from the visible FAQ, word for word', () => {
		for (const page of publishedPages(LANDING)) {
			const family = familyByKey(LANDING, page.family)!;
			const faq = pageJsonLd(LANDING, family, page).find((b) => b['@type'] === 'FAQPage') as {
				mainEntity: { name: string; acceptedAnswer: { text: string } }[];
			};
			expect(faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(
				page.faq.map((f) => [f.question, f.answer])
			);
		}
	});

	it('publishes no postal address unless one is public on the site', () => {
		const ld = JSON.stringify(
			publishedPages(LANDING).map((p) => pageJsonLd(LANDING, familyByKey(LANDING, p.family)!, p))
		);
		if (!LANDING.publicAddress) expect(ld).not.toMatch(/PostalAddress|LocalBusiness/);
	});

	it('lists every page in the sitemap once real content is in place', () => {
		const sitemap = SITEMAP_ROUTES.map((r) => r.path);
		if (LANDING.example) {
			expect(landingSitemapRoutes(LANDING)).toEqual([]);
		} else {
			for (const path of landingPaths(LANDING)) expect(sitemap).toContain(path);
		}
	});

	it('keeps canonical URLs on the production origin', () => {
		for (const page of publishedPages(LANDING)) {
			expect(canonicalUrl(LANDING, pagePath(LANDING, page))).toMatch(/^https:\/\//);
		}
	});
});
