import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
// happy-dom reports no form method, which SvelteKit's enhance refuses; the actions are not under test.
vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }) }));

import Product from '../../src/routes/shop/[slug]/+page.svelte';
import Shop from '../../src/routes/shop/+page.svelte';
import Auction from '../../src/routes/auctions/[slug]/+page.svelte';
import Auctions from '../../src/routes/auctions/+page.svelte';
import Built from '../../src/routes/p/[slug]/+page.svelte';
import Content from '../../src/routes/[contentType]/[slug]/+page.svelte';
import Status from '../../src/routes/status/+page.svelte';
import Contact from '../../src/routes/contact/+page.svelte';
import Cart from '../../src/routes/cart/+page.svelte';

const DEFAULT = 'http://localhost/og-image.png';
const meta = (selector: string) =>
	document.head.querySelector(selector)?.getAttribute('content') ?? null;
const shared = () => ({
	og: meta('meta[property="og:image"]'),
	twitter: meta('meta[name="twitter:image"]'),
	alt: meta('meta[property="og:image:alt"]')
});

beforeEach(() => {
	document.head
		.querySelectorAll('meta, title, link[rel="canonical"], script[type="application/ld+json"]')
		.forEach((el) => el.remove());
});

const product = (over: Record<string, unknown> = {}) => ({
	id: 'p1',
	slug: 'mug',
	name: 'Blue mug',
	description: 'Holds coffee.',
	price: '$12.00',
	priceCents: 1200,
	currency: 'usd',
	imageUrl: 'https://cdn.example.com/mug.jpg',
	physical: true,
	...over
});

describe('a product is shared with its own photo', () => {
	it('uses the product image, named for the product', () => {
		render(Product, { data: { product: product() } as never });
		expect(shared()).toEqual({
			og: 'https://cdn.example.com/mug.jpg',
			twitter: 'https://cdn.example.com/mug.jpg',
			alt: 'Blue mug'
		});
	});
	it('falls back to the site image when the product has no photo', () => {
		render(Product, { data: { product: product({ imageUrl: null }) } as never });
		expect(shared().og).toBe(DEFAULT);
		expect(shared().twitter).toBe(DEFAULT);
	});
	it('falls back when the photo is an SVG, which a platform would show as blank', () => {
		render(Product, {
			data: { product: product({ imageUrl: 'https://cdn.example.com/mug.svg' }) } as never
		});
		expect(shared().og).toBe(DEFAULT);
	});
	it('makes a same-site photo absolute', () => {
		render(Product, { data: { product: product({ imageUrl: '/media/mug.jpg' }) } as never });
		expect(shared().og).toBe('http://localhost/media/mug.jpg');
	});
});

describe('the pages that had no share tags now have them', () => {
	it('the shop, with the site image', () => {
		render(Shop, { data: { products: [] } as never });
		expect(shared().og).toBe(DEFAULT);
		expect(meta('meta[property="og:title"]')).toBe('Shop');
		expect(meta('meta[property="og:description"]')).toBe('Everything for sale on this site.');
	});
	it('the auction list', () => {
		render(Auctions, { data: { open: [], sold: [] } as never });
		expect(shared().og).toBe(DEFAULT);
		expect(meta('meta[property="og:title"]')).toBe('Auctions');
	});
	it('the contact page', () => {
		render(Contact, { data: { turnstileSiteKey: '' } as never, form: null });
		expect(shared().og).toBe(DEFAULT);
	});
	it('the cart, which is not indexed but still shares with an image', () => {
		render(Cart);
		expect(shared().og).toBe(DEFAULT);
		expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toMatch(
			/noindex/
		);
	});
	it('the status page', () => {
		render(Status, { data: { snapshot: null } as never });
		expect(shared().og).toBe(DEFAULT);
		expect(document.head.querySelector('link[rel="alternate"][href="/api/status"]')).not.toBeNull();
	});
});

describe('an auction is shared with its product photo', () => {
	const view = {
		id: 'a1',
		slug: 'mug-auction',
		title: 'Blue mug',
		phase: 'live',
		startsAt: '2030-01-01T00:00:00.000Z',
		endsAt: '2030-01-02T00:00:00.000Z',
		price: '$10.00',
		priceCents: 1000,
		bidCount: 0,
		reserve: 'none',
		buyNow: null,
		minimumBid: '$10.00',
		minimumBidInput: '10.00',
		leader: null,
		extendSeconds: 0,
		youLead: false,
		youWon: false,
		finalPrice: null,
		orderId: null,
		payDueAt: null
	};
	const data = (imageUrl: string | null) =>
		({
			auction: view,
			description: 'Holds coffee.',
			imageUrl,
			physical: false,
			bids: [],
			signedIn: true,
			order: null
		}) as never;

	it('uses the product image', () => {
		render(Auction, { data: data('https://cdn.example.com/mug.jpg'), form: null });
		expect(shared()).toEqual({
			og: 'https://cdn.example.com/mug.jpg',
			twitter: 'https://cdn.example.com/mug.jpg',
			alt: 'Blue mug'
		});
	});
	it('falls back to the site image without one', () => {
		render(Auction, { data: data(null), form: null });
		expect(shared().og).toBe(DEFAULT);
	});
});

describe('a built page is shared with its first picture', () => {
	const page = (blocks: unknown[], title = 'About us') =>
		({
			page: { slug: 'about', title, published: true, document: { version: 2, blocks } },
			products: []
		}) as never;
	const image = (src: string, alt: string) => ({
		id: `i-${src}`,
		type: 'image',
		props: { src, alt }
	});

	it('uses the first image, even nested, with its alt text', () => {
		render(Built, {
			data: page([
				{ id: 'h', type: 'heading', props: { text: 'Hello', level: 1, align: 'start' } },
				{
					id: 's',
					type: 'section',
					props: { gap: 'md', padding: 'md', tone: 'plain' },
					children: [image('/media/team.jpg', 'The team')]
				}
			])
		});
		expect(shared()).toEqual({
			og: 'http://localhost/media/team.jpg',
			twitter: 'http://localhost/media/team.jpg',
			alt: 'The team'
		});
	});
	it('falls back to the site image for a page with no picture', () => {
		render(Built, {
			data: page([{ id: 'h', type: 'heading', props: { text: 'Hello', level: 1, align: 'start' } }])
		});
		expect(shared().og).toBe(DEFAULT);
	});
	it('names the page when the picture has no alt text', () => {
		render(Built, { data: page([image('/media/team.jpg', '')]) });
		expect(shared().alt).toBe('About us');
	});
});

describe('a content item is shared with its SEO image, then its featured image', () => {
	const content = (item: Record<string, unknown>) =>
		({
			contentType: { slug: 'blog', name: 'Blog', settings: { itemTemplate: 'blog-item' } },
			item: {
				id: 'c1',
				slug: 'hello',
				title: 'Hello world',
				seoTitle: null,
				seoDescription: null,
				seoImage: null,
				publishedAt: null,
				updatedAt: null,
				fields: {},
				...item
			},
			tags: [],
			related: []
		}) as never;

	it('prefers the SEO image', () => {
		render(Content, {
			data: content({
				seoImage: 'https://cdn.example.com/seo.jpg',
				fields: { featured_image: '/feat.jpg' }
			})
		});
		expect(shared().og).toBe('https://cdn.example.com/seo.jpg');
	});
	it('uses the featured image when there is no SEO image', () => {
		render(Content, {
			data: content({ fields: { featured_image: 'https://cdn.example.com/feat.jpg' } })
		});
		expect(shared().og).toBe('https://cdn.example.com/feat.jpg');
	});
	it('moves on to the featured image when the SEO image is unusable', () => {
		render(Content, {
			data: content({
				seoImage: 'https://cdn.example.com/seo.svg',
				fields: { featured_image: '/feat.jpg' }
			})
		});
		expect(shared().og).toBe('http://localhost/feat.jpg');
	});
	it('falls back to the site image when it has neither', () => {
		render(Content, { data: content({}) });
		expect(shared().og).toBe(DEFAULT);
	});
});
