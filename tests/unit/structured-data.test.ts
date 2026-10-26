import { writable } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
vi.mock('$app/stores', () => ({
	page: writable({ url: new URL('https://nebulakit.pages.dev/blog/x') })
}));

import { site } from '../../src/lib/site.config';
import {
	LOGO_ID,
	ORGANIZATION_ID,
	WEBSITE_ID,
	absoluteUrl,
	breadcrumbNode,
	buildPageGraph,
	escapeJsonLd,
	itemListNode,
	jsonLdScript,
	organizationNode,
	productNode,
	sharingGraph,
	websiteNode
} from '../../src/lib/seo/structured-data';

const byType = (graph: ReturnType<typeof buildPageGraph>, type: string) =>
	graph['@graph'].filter((node) => node['@type'] === type);

describe('absoluteUrl', () => {
	it('resolves against site.url, never the request origin', () => {
		expect(absoluteUrl('/blog/x')).toBe(`${site.url}/blog/x`);
		expect(absoluteUrl('blog/x')).toBe(`${site.url}/blog/x`);
		expect(absoluteUrl('/')).toBe(`${site.url}/`);
	});
	it('keeps absolute http(s) URLs and drops other schemes', () => {
		expect(absoluteUrl('https://cdn.example/a.png')).toBe('https://cdn.example/a.png');
		expect(absoluteUrl('javascript:alert(1)')).toBe('');
		expect(absoluteUrl('data:text/html,x')).toBe('');
		expect(absoluteUrl('//evil.example/x')).toBe('');
		expect(absoluteUrl('')).toBe('');
	});
});

describe('site-level nodes', () => {
	it('has stable ids built from site.url', () => {
		expect(ORGANIZATION_ID).toBe(`${site.url}/#organization`);
		expect(WEBSITE_ID).toBe(`${site.url}/#website`);
		expect(organizationNode()['@id']).toBe(ORGANIZATION_ID);
		expect((organizationNode().logo as Record<string, unknown>)['@id']).toBe(LOGO_ID);
		expect(websiteNode().publisher).toEqual({ '@id': ORGANIZATION_ID });
	});
	it('does not advertise a SearchAction the site cannot serve', () => {
		expect(JSON.stringify(websiteNode())).not.toContain('SearchAction');
		expect(websiteNode()).not.toHaveProperty('potentialAction');
	});
});

describe('buildPageGraph', () => {
	it('home page: org, website, page about the org, no breadcrumb', () => {
		const graph = buildPageGraph({ path: '/', title: 'Home' });
		expect(graph['@context']).toBe('https://schema.org');
		expect(graph['@graph'].map((n) => n['@type'])).toEqual(['Organization', 'WebSite', 'WebPage']);
		const page = byType(graph, 'WebPage')[0];
		expect(page.about).toEqual({ '@id': ORGANIZATION_ID });
		expect(page).not.toHaveProperty('breadcrumb');
	});
	it('sub-page gets a breadcrumb starting at Home, and no about', () => {
		const graph = buildPageGraph({ path: '/privacy', title: 'Privacy' });
		const crumbs = byType(graph, 'BreadcrumbList')[0].itemListElement as Array<
			Record<string, unknown>
		>;
		expect(crumbs[0]).toMatchObject({ position: 1, name: 'Home', item: `${site.url}/` });
		expect(byType(graph, 'WebPage')[0]).not.toHaveProperty('about');
		expect(byType(graph, 'WebPage')[0].breadcrumb).toEqual({
			'@id': `${site.url}/privacy#breadcrumb`
		});
	});
	it('every @id reference resolves to a node in the graph', () => {
		const graph = buildPageGraph({
			path: '/blog/post',
			title: 'Post',
			image: '/og.png',
			breadcrumb: [{ name: 'Blog', path: '/blog' }],
			article: { type: 'BlogPosting', datePublished: '2026-01-01', keywords: ['a', 'b'] }
		});
		const ids = new Set<unknown>();
		const refs: string[] = [];
		const walk = (value: unknown, root: boolean) => {
			if (Array.isArray(value)) value.forEach((v) => walk(v, false));
			else if (value && typeof value === 'object') {
				const keys = Object.keys(value);
				if ('@id' in value && keys.length > 1) ids.add((value as { '@id': string })['@id']);
				if (!root && keys.length === 1 && keys[0] === '@id')
					refs.push((value as { '@id': string })['@id']);
				else Object.values(value).forEach((v) => walk(v, false));
			}
		};
		graph['@graph'].forEach((n) => walk(n, true));
		expect(refs.length).toBeGreaterThan(3);
		for (const ref of refs) expect(ids.has(ref)).toBe(true);
	});
	it('article: BlogPosting with dates, keywords, section, falls back to org author', () => {
		const graph = buildPageGraph({
			path: '/blog/post',
			title: 'Post',
			article: {
				type: 'BlogPosting',
				datePublished: '2026-01-01T00:00:00Z',
				keywords: ['svelte', 'd1'],
				section: 'Blog'
			}
		});
		const post = byType(graph, 'BlogPosting')[0];
		expect(post).toMatchObject({
			headline: 'Post',
			datePublished: '2026-01-01T00:00:00Z',
			dateModified: '2026-01-01T00:00:00Z',
			keywords: 'svelte, d1',
			articleSection: 'Blog',
			author: { '@id': ORGANIZATION_ID }
		});
		const named = buildPageGraph({ path: '/x', title: 'X', article: { author: 'Ada' } });
		expect(byType(named, 'Article')[0].author).toEqual({ '@type': 'Person', name: 'Ada' });
	});
	it('listing: ItemList in order, page is mainEntity', () => {
		const graph = buildPageGraph({
			path: '/blog',
			title: 'Blog',
			pageType: 'CollectionPage',
			items: [
				{ name: 'One', url: '/blog/one' },
				{ name: 'Two', url: '/blog/two', description: 'second' }
			]
		});
		const list = byType(graph, 'ItemList')[0];
		expect(list.numberOfItems).toBe(2);
		expect((list.itemListElement as Array<Record<string, unknown>>)[1]).toMatchObject({
			position: 2,
			url: `${site.url}/blog/two`,
			description: 'second'
		});
		expect(byType(graph, 'CollectionPage')[0].mainEntity).toEqual({
			'@id': `${site.url}/blog#itemlist`
		});
	});
	it('product: ItemPage + Product + Offer with decimal price and no availability claim', () => {
		const graph = buildPageGraph({
			path: '/shop/mug',
			title: 'Mug',
			image: '/mug.png',
			product: { name: 'Mug', sku: 'mug', priceCents: 1999, currency: 'usd' }
		});
		expect(byType(graph, 'ItemPage')).toHaveLength(1);
		const product = byType(graph, 'Product')[0];
		expect(product.image).toEqual({ '@id': `${site.url}/shop/mug#primaryimage` });
		expect(product.offers).toMatchObject({
			'@type': 'Offer',
			price: '19.99',
			priceCurrency: 'USD',
			url: `${site.url}/shop/mug`
		});
		expect(JSON.stringify(graph)).not.toContain('availability');
		expect(byType(graph, 'ItemPage')[0].mainEntity).toEqual({
			'@id': `${site.url}/shop/mug#product`
		});
	});
	it('omits empty fields rather than emitting empty strings', () => {
		const graph = buildPageGraph({ path: '/x', title: 'X', description: '' });
		expect(byType(graph, 'WebPage')[0]).not.toHaveProperty('description');
		expect(buildPageGraph({ path: '', title: 'Root' })['@graph'][2].url).toBe(`${site.url}/`);
	});
	it('exposes node builders directly', () => {
		expect(breadcrumbNode([], `${site.url}/`).itemListElement).toHaveLength(1);
		expect(itemListNode([], `${site.url}/`).numberOfItems).toBe(0);
		expect(productNode({ name: 'n', priceCents: 5, currency: 'eur' }, 'u').offers).toMatchObject({
			price: '0.05'
		});
	});
});

describe('sharingGraph', () => {
	it('returns null for noindex pages and explicit opt-outs', () => {
		expect(sharingGraph({ path: '/a', title: 'A', noindex: true })).toBeNull();
		expect(sharingGraph({ path: '/a', title: 'A', extra: null })).toBeNull();
	});
	it('derives an Article from type=article props', () => {
		const graph = sharingGraph({
			path: '/blog/x',
			title: 'X',
			type: 'article',
			publishedTime: '2026-02-02',
			modifiedTime: '2026-03-03',
			author: 'Ada'
		})!;
		expect(byType(graph, 'Article')[0]).toMatchObject({
			datePublished: '2026-02-02',
			dateModified: '2026-03-03',
			author: { name: 'Ada' }
		});
	});
	it('lets page extras win over derived article data', () => {
		const graph = sharingGraph({
			path: '/blog/x',
			title: 'X',
			type: 'article',
			extra: { article: { type: 'BlogPosting' } }
		})!;
		expect(byType(graph, 'BlogPosting')).toHaveLength(1);
		expect(byType(graph, 'Article')).toHaveLength(0);
	});
	it('a plain website page has no article and carries its description and image', () => {
		const graph = sharingGraph({
			path: '/about',
			title: 'About',
			description: 'd',
			image: '/i.png',
			imageAlt: 'alt',
			imageWidth: 10,
			imageHeight: 20
		})!;
		expect(byType(graph, 'Article')).toHaveLength(0);
		expect(byType(graph, 'ImageObject').find((n) => n.caption === 'alt')).toMatchObject({
			width: 10,
			height: 20
		});
	});
});

describe('escaping', () => {
	it('neutralises script breakout, ampersands and line separators', () => {
		const escaped = escapeJsonLd('{"a":"</script><script>alert(1)</script> & \u2028\u2029"}');
		expect(escaped).not.toContain('<');
		expect(escaped).not.toContain('>');
		expect(escaped).not.toContain('&');
		expect(escaped).not.toMatch(/[\u2028\u2029]/);
	});
	it('round-trips: the escaped payload parses to the same value', () => {
		const title = '</script><img src=x onerror=alert(1)> & "quotes"';
		const graph = buildPageGraph({ path: '/x', title });
		const script = jsonLdScript(graph);
		const inner = script.slice('<script type="application/ld+json">'.length, -'</script>'.length);
		expect(JSON.parse(inner)).toEqual(JSON.parse(JSON.stringify(graph)));
		// Exactly one closing tag: the one jsonLdScript wrote itself.
		expect(script.match(/<\/script>/g)).toHaveLength(1);
		expect(script.match(/<script/g)).toHaveLength(1);
	});
	it('emits nothing for a null graph', () => {
		expect(jsonLdScript(null)).toBe('');
	});
});

describe('SharingMeta rendering', () => {
	it('renders one parseable JSON-LD block into the head', async () => {
		const SharingMeta = (await import('../../src/lib/components/SharingMeta.svelte')).default;
		render(SharingMeta, {
			props: { title: '</script><b>x', structured: { breadcrumb: [{ name: 'A', path: '/a' }] } }
		});
		const blocks = document.head.querySelectorAll('script[type="application/ld+json"]');
		expect(blocks).toHaveLength(1);
		const parsed = JSON.parse(blocks[0].textContent ?? '');
		expect(parsed['@graph'].some((n: { name?: string }) => n.name === '</script><b>x')).toBe(true);
		expect(document.head.querySelector('b')).toBeNull();
	});

	it('renders none for a noindex page', async () => {
		document.head.innerHTML = '';
		const SharingMeta = (await import('../../src/lib/components/SharingMeta.svelte')).default;
		render(SharingMeta, { props: { title: 'Draft', noindex: true } });
		expect(document.head.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(0);
	});
});
