/**
 * This site's landing pages. Downstream sites edit this file and the page
 * files under `pages/`; the module code beside it stays generic.
 *
 * Shipped with Example Co., an invented bike shop, so every family has a page
 * to look at. While `example` is true the pages render an "example content"
 * notice, carry noindex, and stay out of the sitemap. To go live: delete the
 * example page files, run `bun run landing index`, write real pages, then set
 * `example: false` (the audit fails if Example Co. text is still there).
 */
import { site } from '../../site.config';
import { defineFamilies } from '../families';
import type { LandingSiteConfig } from '../types';
import { PAGES } from './pages';

export const LANDING: LandingSiteConfig = {
	example: true,
	origin: site.url,
	provider: { name: site.name, url: site.url },
	cta: {
		primary: { href: '/contact', label: 'Get in touch' }
	},
	families: defineFamilies({
		who: { legacyPrefixes: ['for'] },
		where: {},
		what: {},
		when: {},
		why: {}
	}),
	pages: PAGES
};
