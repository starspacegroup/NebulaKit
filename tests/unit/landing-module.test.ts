/**
 * The landing-pages module itself: every audit rule against a crafted site,
 * routing, redirects, JSON-LD, the scaffold, the param matcher and the route
 * loads. The site's own content is checked in landing-guardrails.test.ts.
 */
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import {
	DEFAULT_FAMILIES,
	LANDING,
	auditLanding,
	defineFamilies,
	definePage,
	findPage,
	formatAudit,
	hubJsonLd,
	isLandingSegment,
	landingPaths,
	landingSitemapRoutes,
	legacyRedirect,
	pageJsonLd,
	pagePath,
	type LandingPage,
	type LandingSiteConfig
} from '../../src/lib/landing';
import { isFamilyKey, pageStub, pagesIndex } from '../../src/lib/landing/scaffold';
import { match } from '../../src/params/landingFamily';
import { load as hubLoad } from '../../src/routes/[family=landingFamily]/+page';
import { load as pageLoad } from '../../src/routes/[family=landingFamily]/[slug]/+page';
import LandingPageView from '../../src/lib/components/landing/LandingPageView.svelte';
import LandingHub from '../../src/lib/components/landing/LandingHub.svelte';

let n = 0;
/** Letters, not digits: the audit flags figures in page text. */
const word = (k: number) =>
	[...k.toString(26)].map((c) => String.fromCharCode(97 + parseInt(c, 26))).join('');
function page(over: Partial<LandingPage> = {}): LandingPage {
	const id = word(++n);
	return definePage({
		family: 'who',
		slug: `page-${id}`,
		name: `Name ${id}`,
		title: `Title ${id}`,
		description: `Description ${id}`,
		h1: `Heading ${id}`,
		lede: `Lede ${id}`,
		blurb: `Blurb ${id}`,
		sectionsHeading: `Sections ${id}`,
		sections: ['a', 'b', 'c'].map((s) => ({ heading: s, body: `Body ${s} ${id}` })),
		faq: ['a', 'b', 'c'].map((s) => ({ question: `Q ${s} ${id}`, answer: `A ${s} ${id}` })),
		...over
	});
}

function site(pages: LandingPage[], over: Partial<LandingSiteConfig> = {}): LandingSiteConfig {
	return {
		example: false,
		origin: 'https://example.test/',
		provider: { name: 'Test', url: 'https://example.test' },
		cta: { primary: { href: '/contact', label: 'Contact' } },
		families: defineFamilies({ who: { legacyPrefixes: ['for'] }, where: {}, what: {} }),
		pages,
		...over
	};
}

const rules = (s: LandingSiteConfig) => auditLanding(s).errors.map((e) => e.rule);

describe('auditLanding', () => {
	it('passes clean, distinct pages', () => {
		expect(auditLanding(site([page(), page()])).errors).toEqual([]);
	});

	it('fails on a duplicate title, h1, lede, section body and FAQ answer', () => {
		const a = page();
		const b = page({
			title: a.title,
			h1: ` ${a.h1.toUpperCase()} `,
			lede: a.lede,
			sections: a.sections,
			faq: a.faq
		});
		const messages = auditLanding(site([a, b])).errors.map((e) => e.message);
		for (const label of ['title', 'h1', 'lede', 'section body', 'FAQ answer'])
			expect(
				messages.some((m) => m.startsWith(`${label} repeats who/`)),
				label
			).toBe(true);
	});

	it('fails on a repeat inside one page and on a duplicate slug', () => {
		const a = page({ faq: [1, 2, 3].map((i) => ({ question: `q${i}`, answer: 'same' })) });
		expect(auditLanding(site([a])).errors[0].message).toBe('FAQ answer repeats within the page');
		const b = page();
		expect(rules(site([b, { ...page(), slug: b.slug }]))).toContain('duplicate');
	});

	it('fails on empty required fields, TODOs in rendered text, length and minimums', () => {
		const errors = auditLanding(
			site([
				page({
					title: 'x'.repeat(71),
					description: 'y'.repeat(171),
					h1: ' ',
					lede: 'TODO(owner): write',
					sections: [],
					faq: []
				})
			])
		).errors;
		expect(errors.map((e) => e.rule).sort()).toEqual(
			['length', 'length', 'minimum', 'minimum', 'required', 'required'].sort()
		);
	});

	it('honours site limits', () => {
		const p = page({ sections: [{ heading: 'h', body: 'only' }], faq: [] });
		expect(rules(site([p], { limits: { minSections: 1, minFaq: 0 } }))).toEqual([]);
	});

	it('requires a tie on region pages', () => {
		const r = page({ family: 'where', slug: 'springfield', name: 'Springfield' });
		expect(rules(site([r]))).toEqual(['region-tie']);
		expect(rules(site([{ ...r, tie: { kind: 'office', note: 'Our office.' } }]))).toEqual([]);
	});

	it('fails a type page that names a region (no cross-product pages)', () => {
		const r = page({
			family: 'where',
			slug: 'springfield',
			name: 'Springfield',
			tie: { kind: 'based-here', note: 'Based here.' }
		});
		const bySlug = page({ slug: 'restaurants-springfield' });
		const byTitle = page({ title: 'Restaurants in springfield' });
		const errors = auditLanding(site([r, bySlug, byTitle])).errors;
		expect(errors.map((e) => e.rule)).toEqual(['cross-product', 'cross-product']);
	});

	it('flags unverified figures and clears verified phrases', () => {
		const p = page({
			lede: 'We cut load time 40% for $1,200, three times faster, 10x, since 2019, in 2 hours.'
		});
		const figures = auditLanding(site([p])).errors.map((e) => e.message.split('"')[1]);
		expect(figures).toEqual(['40%', '$1,200', '10x', '2019']);
		const ok = { ...p, verifiedNumbers: ['40%', '$1,200', '10x'] };
		expect(rules(site([ok], { verifiedNumbers: ['since 2019'] }))).toEqual([]);
	});

	it('fails Example Co. text once the site leaves example mode', () => {
		const p = page({ lede: 'Placeholder from Example Co.' });
		expect(rules(site([p]))).toEqual(['example']);
		expect(rules(site([p], { example: true }))).toEqual([]);
	});

	it('fails an unknown family and a prefix used twice', () => {
		const p = page({ family: 'why' });
		const errors = auditLanding(
			site([p], { families: defineFamilies({ who: { legacyPrefixes: ['who'] } }) })
		).errors;
		expect(errors.map((e) => e.rule)).toEqual(['family', 'family']);
	});

	it('reports TODOs from drafts and notes without failing', () => {
		const draft = page({ draft: true, title: '', lede: 'TODO(owner)' });
		const live = page({ notes: ['TODO(owner): confirm the hours', 'plain note'] });
		const report = auditLanding(site([draft, live]));
		expect(report.errors).toEqual([]);
		expect(report.todos.map((t) => t.text)).toEqual([
			'(owner: owner)',
			'stub not yet published',
			'confirm the hours'
		]);
		expect(formatAudit(report)).toContain('TODO  who/');
		expect(formatAudit(auditLanding(site([page({ h1: '' })])))).toContain('ERROR [required]');
	});
});

describe('routing', () => {
	const a = page({ slug: 'alpha' });
	const w = page({ family: 'where', slug: 'town', tie: { kind: 'office', note: 'Office.' } });
	const d = page({ slug: 'draft-one', draft: true });
	const s = site([a, w, d]);

	it('lists hubs with pages, then pages, skipping drafts and empty families', () => {
		expect(landingPaths(s)).toEqual(['/who', '/where', '/who/alpha', '/where/town']);
		expect(findPage(s, 'who', 'draft-one')).toBeUndefined();
		expect(findPage(s, 'nope', 'alpha')).toBeUndefined();
		expect(findPage(s, 'who', 'alpha')?.page).toBe(a);
	});

	it('gives hubs a higher sitemap priority and none in example mode', () => {
		expect(landingSitemapRoutes(s).map((r) => r.priority)).toEqual([0.7, 0.7, 0.6, 0.6]);
		expect(landingSitemapRoutes({ ...s, example: true })).toEqual([]);
	});

	it('uses custom prefixes', () => {
		const custom = site([a], { families: defineFamilies({ who: { prefix: 'for-you' } }) });
		expect(pagePath(custom, a)).toBe('/for-you/alpha');
		expect(() => pagePath(custom, w)).toThrow(/unknown family/);
	});

	it('301s legacy prefixes, keeping the path and query', () => {
		expect(legacyRedirect(s, new URL('https://x.test/for/alpha?ref=1'))).toBe('/who/alpha?ref=1');
		expect(legacyRedirect(s, new URL('https://x.test/for/'))).toBe('/who');
		expect(legacyRedirect(s, new URL('https://x.test/who/alpha'))).toBeNull();
		expect(isLandingSegment(s, 'for')).toBe(true);
		expect(isLandingSegment(s, 'blog')).toBe(false);
	});

	it('keeps defaults for families not overridden', () => {
		expect(defineFamilies({ where: {} })).toEqual([DEFAULT_FAMILIES.where]);
	});
});

describe('JSON-LD', () => {
	const p = page({ serviceType: 'Repair', areaServed: 'Town' });
	const s = site([p]);
	const who = s.families[0];

	it('builds Service, BreadcrumbList and FAQPage with an Organization provider', () => {
		const [service, crumbs, faq] = pageJsonLd(s, who, p) as Record<string, any>[];
		expect(service.provider['@type']).toBe('Organization');
		expect(service.url).toBe(`https://example.test/who/${p.slug}`);
		expect(service.serviceType).toBe('Repair');
		expect(crumbs.itemListElement[1].item).toBe('https://example.test/who');
		expect(faq['@type']).toBe('FAQPage');
	});

	it('omits optional fields and the FAQPage when empty', () => {
		const bare = page({ faq: [] });
		const blocks = pageJsonLd(site([bare]), who, bare);
		expect(blocks).toHaveLength(2);
		expect(blocks[0]).not.toHaveProperty('serviceType');
	});

	it('uses LocalBusiness with an address only when the address is public', () => {
		const address = {
			streetAddress: '1 Example St',
			addressLocality: 'Exampleton',
			addressRegion: 'EX',
			postalCode: '00000',
			addressCountry: 'US'
		};
		const [service] = pageJsonLd(site([p], { publicAddress: address }), who, p) as Record<
			string,
			any
		>[];
		expect(service.provider['@type']).toBe('LocalBusiness');
		expect(service.provider.address['@type']).toBe('PostalAddress');
	});

	it('builds a CollectionPage for a hub', () => {
		expect(hubJsonLd(s, who).hasPart).toEqual([
			{ '@type': 'WebPage', name: p.title, url: `https://example.test/who/${p.slug}` }
		]);
	});
});

describe('scaffold', () => {
	it('writes an empty draft with TODO markers and no prose', () => {
		const stub = pageStub('who', 'bakeries');
		expect(stub).toContain("family: 'who'");
		expect(stub).toContain('draft: true');
		expect(stub).toContain("title: ''");
		expect(stub).toContain('TODO(owner)');
		expect(stub).not.toContain('tie:');
		expect(pageStub('where', 'town')).toContain("tie: { kind: 'other', note: '' }");
	});

	it('rejects a bad slug and checks family keys', () => {
		expect(() => pageStub('who', 'Bad Slug')).toThrow(/slug/);
		expect(isFamilyKey('why')).toBe(true);
		expect(isFamilyKey('how')).toBe(false);
	});

	it('builds a sorted index', () => {
		const index = pagesIndex(['who/b-two', 'where/a']);
		expect(index.indexOf('where_a')).toBeLessThan(index.indexOf('who_b_two'));
		expect(index).toContain("import who_b_two from './who/b-two';");
	});
});

describe('routes', () => {
	const shipped = LANDING.pages[0];
	const prefix = LANDING.families.find((f) => f.key === shipped.family)!.prefix;
	const url = (path: string) => new URL(`https://example.test${path}`);
	const call = (fn: unknown, event: object) =>
		(fn as (e: object) => unknown)(event) as Record<string, any>;

	it('matches configured and legacy prefixes only', () => {
		expect(match(prefix)).toBe(true);
		expect(match('for')).toBe(true);
		expect(match('admin')).toBe(false);
	});

	it('loads a hub and a page', () => {
		expect(
			call(hubLoad, { params: { family: prefix }, url: url(`/${prefix}`) }).family.prefix
		).toBe(prefix);
		const found = call(pageLoad, {
			params: { family: prefix, slug: shipped.slug },
			url: url(`/${prefix}/${shipped.slug}`)
		});
		expect(found.page).toBe(shipped);
	});

	it('404s an unknown page and 301s a legacy path', () => {
		expect(() =>
			call(pageLoad, { params: { family: prefix, slug: 'nope' }, url: url(`/${prefix}/nope`) })
		).toThrow();
		try {
			call(hubLoad, { params: { family: 'for' }, url: url('/for') });
			expect.unreachable();
		} catch (e) {
			expect(e).toMatchObject({ status: 301, location: '/who' });
		}
		try {
			call(pageLoad, { params: { family: 'for', slug: 'x' }, url: url('/for/x') });
			expect.unreachable();
		} catch (e) {
			expect(e).toMatchObject({ status: 301, location: '/who/x' });
		}
	});

	it('404s a family with no published pages', () => {
		const empty = LANDING.families.find(
			(f) => !LANDING.pages.some((p) => p.family === f.key && !p.draft)
		);
		if (empty)
			expect(() =>
				call(hubLoad, { params: { family: empty.prefix }, url: url(`/${empty.prefix}`) })
			).toThrow();
	});
});

describe('components', () => {
	const p = page({
		extra: { heading: 'Local facts', sections: [{ heading: 'Fact', body: 'Fact body' }] },
		checks: { heading: 'Check these', items: ['One check'] },
		related: [{ href: '/contact', label: 'Ask us' }]
	});
	const sibling = page();
	const where = page({ family: 'where', slug: 'town', tie: { kind: 'office', note: 'Office.' } });
	const s = site([p, sibling, where], {
		example: true,
		cta: {
			primary: { href: '/contact', label: 'Contact' },
			secondary: { href: '/pricing', label: 'Pricing' }
		}
	});

	it('renders a page with its sections, FAQ, links and example notice', () => {
		render(LandingPageView, { site: s, family: s.families[0], page: p });
		expect(screen.getByRole('heading', { level: 1, name: p.h1 })).toBeInTheDocument();
		expect(screen.getByText('Fact body')).toBeInTheDocument();
		expect(screen.getByText('One check')).toBeInTheDocument();
		expect(screen.getByText(p.faq[0].question)).toBeInTheDocument();
		expect(screen.getByRole('link', { name: sibling.name })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Ask us' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Pricing' })).toBeInTheDocument();
		expect(screen.getByRole('note')).toHaveTextContent(/Example content/);
	});

	it('renders a hub with one card per page', () => {
		render(LandingHub, { site: s, family: s.families[0] });
		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Who we work with');
		expect(screen.getByRole('link', { name: p.name })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Where we work' })).toBeInTheDocument();
	});
});
