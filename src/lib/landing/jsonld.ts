import { faqJsonLd } from '$lib/seo/faq';
import { canonicalUrl, familyPages, hubPath, pagePath } from './routing';
import type { LandingFamily, LandingPage, LandingSiteConfig } from './types';

/**
 * The provider. A postal address goes in only when `publicAddress` is set,
 * meaning the address is already published on the site; a LocalBusiness with
 * an address nobody can see on the page is misleading markup.
 */
function provider(site: LandingSiteConfig) {
	const base = { name: site.provider.name, url: site.provider.url };
	return site.publicAddress
		? {
				'@type': 'LocalBusiness',
				...base,
				address: { '@type': 'PostalAddress', ...site.publicAddress }
			}
		: { '@type': 'Organization', ...base };
}

/**
 * Service + FAQPage + BreadcrumbList for one page. The FAQPage comes from the
 * same array the page renders, so markup and visible text match word for word.
 */
export function pageJsonLd(site: LandingSiteConfig, family: LandingFamily, page: LandingPage) {
	const url = canonicalUrl(site, pagePath(site, page));
	const blocks: Record<string, unknown>[] = [
		{
			'@context': 'https://schema.org',
			'@type': 'Service',
			name: page.title,
			description: page.description,
			url,
			provider: provider(site),
			...(page.serviceType ? { serviceType: page.serviceType } : {}),
			...(page.areaServed ? { areaServed: page.areaServed } : {})
		},
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Home', item: canonicalUrl(site, '/') },
				{
					'@type': 'ListItem',
					position: 2,
					name: family.label,
					item: canonicalUrl(site, hubPath(family))
				},
				{ '@type': 'ListItem', position: 3, name: page.name, item: url }
			]
		}
	];
	if (page.faq.length) blocks.push(faqJsonLd(page.faq) as unknown as Record<string, unknown>);
	return blocks;
}

/** CollectionPage for a hub, one part per published page. */
export function hubJsonLd(site: LandingSiteConfig, family: LandingFamily) {
	return {
		'@context': 'https://schema.org',
		'@type': 'CollectionPage',
		name: family.hubTitle,
		url: canonicalUrl(site, hubPath(family)),
		hasPart: familyPages(site, family.key).map((p) => ({
			'@type': 'WebPage',
			name: p.title,
			url: canonicalUrl(site, pagePath(site, p))
		}))
	};
}
