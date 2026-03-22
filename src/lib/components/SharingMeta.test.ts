import { render } from '@testing-library/svelte';
import { describe, expect, it, beforeEach } from 'vitest';
import SharingMeta from './SharingMeta.svelte';

describe('SharingMeta', () => {
	beforeEach(() => {
		// Clear any existing meta tags from previous tests
		document.head.querySelectorAll('meta, title, link[rel="canonical"]').forEach((el) => el.remove());
	});

	it('should render title with site name suffix', () => {
		render(SharingMeta, {
			props: { title: 'Test Page' }
		});
		const title = document.querySelector('title');
		expect(title?.textContent).toBe('Test Page - NebulaKit');
	});

	it('should render title without suffix when siteName is empty', () => {
		render(SharingMeta, {
			props: { title: 'Test Page', siteName: '' }
		});
		const title = document.querySelector('title');
		expect(title?.textContent).toBe('Test Page');
	});

	it('should render custom siteName in title suffix', () => {
		render(SharingMeta, {
			props: { title: 'Test Page', siteName: 'MySite' }
		});
		const title = document.querySelector('title');
		expect(title?.textContent).toBe('Test Page - MySite');
	});

	it('should render meta description', () => {
		render(SharingMeta, {
			props: { title: 'Test', description: 'A test description' }
		});
		const desc = document.querySelector('meta[name="description"]');
		expect(desc).toBeInTheDocument();
		expect(desc?.getAttribute('content')).toBe('A test description');
	});

	it('should not render meta description when not provided', () => {
		render(SharingMeta, {
			props: { title: 'Test' }
		});
		const desc = document.querySelector('meta[name="description"]');
		expect(desc).not.toBeInTheDocument();
	});

	// Open Graph tags
	it('should render og:title', () => {
		render(SharingMeta, {
			props: { title: 'OG Test' }
		});
		const ogTitle = document.querySelector('meta[property="og:title"]');
		expect(ogTitle?.getAttribute('content')).toBe('OG Test');
	});

	it('should render og:description when description is provided', () => {
		render(SharingMeta, {
			props: { title: 'Test', description: 'OG description' }
		});
		const ogDesc = document.querySelector('meta[property="og:description"]');
		expect(ogDesc?.getAttribute('content')).toBe('OG description');
	});

	it('should render og:type with default value "website"', () => {
		render(SharingMeta, {
			props: { title: 'Test' }
		});
		const ogType = document.querySelector('meta[property="og:type"]');
		expect(ogType?.getAttribute('content')).toBe('website');
	});

	it('should render og:type with custom value', () => {
		render(SharingMeta, {
			props: { title: 'Test', type: 'article' }
		});
		const ogType = document.querySelector('meta[property="og:type"]');
		expect(ogType?.getAttribute('content')).toBe('article');
	});

	it('should render og:image when image is provided', () => {
		render(SharingMeta, {
			props: { title: 'Test', image: 'https://example.com/image.png' }
		});
		const ogImage = document.querySelector('meta[property="og:image"]');
		expect(ogImage?.getAttribute('content')).toBe('https://example.com/image.png');
	});

	it('should not render og:image when image is not provided', () => {
		render(SharingMeta, {
			props: { title: 'Test' }
		});
		const ogImage = document.querySelector('meta[property="og:image"]');
		expect(ogImage).not.toBeInTheDocument();
	});

	it('should render og:image:alt when image and imageAlt are provided', () => {
		render(SharingMeta, {
			props: { title: 'Test', image: 'https://example.com/image.png', imageAlt: 'Test image' }
		});
		const ogImageAlt = document.querySelector('meta[property="og:image:alt"]');
		expect(ogImageAlt?.getAttribute('content')).toBe('Test image');
	});

	it('should fall back to title for og:image:alt when imageAlt is not provided', () => {
		render(SharingMeta, {
			props: { title: 'My Title', image: 'https://example.com/image.png' }
		});
		const ogImageAlt = document.querySelector('meta[property="og:image:alt"]');
		expect(ogImageAlt?.getAttribute('content')).toBe('My Title');
	});

	it('should render og:url when url is provided', () => {
		render(SharingMeta, {
			props: { title: 'Test', url: 'https://example.com/page' }
		});
		const ogUrl = document.querySelector('meta[property="og:url"]');
		expect(ogUrl?.getAttribute('content')).toBe('https://example.com/page');
	});

	it('should render og:site_name', () => {
		render(SharingMeta, {
			props: { title: 'Test' }
		});
		const ogSiteName = document.querySelector('meta[property="og:site_name"]');
		expect(ogSiteName?.getAttribute('content')).toBe('NebulaKit');
	});

	it('should render og:locale', () => {
		render(SharingMeta, {
			props: { title: 'Test' }
		});
		const ogLocale = document.querySelector('meta[property="og:locale"]');
		expect(ogLocale?.getAttribute('content')).toBe('en_US');
	});

	it('should render custom og:locale', () => {
		render(SharingMeta, {
			props: { title: 'Test', locale: 'fr_FR' }
		});
		const ogLocale = document.querySelector('meta[property="og:locale"]');
		expect(ogLocale?.getAttribute('content')).toBe('fr_FR');
	});

	// Twitter Card tags
	it('should render twitter:card with default summary_large_image', () => {
		render(SharingMeta, {
			props: { title: 'Test' }
		});
		const twitterCard = document.querySelector('meta[name="twitter:card"]');
		expect(twitterCard?.getAttribute('content')).toBe('summary_large_image');
	});

	it('should render twitter:card with custom value', () => {
		render(SharingMeta, {
			props: { title: 'Test', twitterCard: 'summary' }
		});
		const twitterCard = document.querySelector('meta[name="twitter:card"]');
		expect(twitterCard?.getAttribute('content')).toBe('summary');
	});

	it('should render twitter:title', () => {
		render(SharingMeta, {
			props: { title: 'Twitter Test' }
		});
		const twitterTitle = document.querySelector('meta[name="twitter:title"]');
		expect(twitterTitle?.getAttribute('content')).toBe('Twitter Test');
	});

	it('should render twitter:description when description is provided', () => {
		render(SharingMeta, {
			props: { title: 'Test', description: 'Twitter desc' }
		});
		const twitterDesc = document.querySelector('meta[name="twitter:description"]');
		expect(twitterDesc?.getAttribute('content')).toBe('Twitter desc');
	});

	it('should render twitter:image when image is provided', () => {
		render(SharingMeta, {
			props: { title: 'Test', image: 'https://example.com/tw.png' }
		});
		const twitterImage = document.querySelector('meta[name="twitter:image"]');
		expect(twitterImage?.getAttribute('content')).toBe('https://example.com/tw.png');
	});

	it('should render twitter:image:alt when image and imageAlt are provided', () => {
		render(SharingMeta, {
			props: { title: 'Test', image: 'https://example.com/tw.png', imageAlt: 'Alt text' }
		});
		const twitterImageAlt = document.querySelector('meta[name="twitter:image:alt"]');
		expect(twitterImageAlt?.getAttribute('content')).toBe('Alt text');
	});

	it('should render twitter:site when twitterSite is provided', () => {
		render(SharingMeta, {
			props: { title: 'Test', twitterSite: '@nebulakit' }
		});
		const twitterSite = document.querySelector('meta[name="twitter:site"]');
		expect(twitterSite?.getAttribute('content')).toBe('@nebulakit');
	});

	it('should render twitter:creator when twitterCreator is provided', () => {
		render(SharingMeta, {
			props: { title: 'Test', twitterCreator: '@author' }
		});
		const twitterCreator = document.querySelector('meta[name="twitter:creator"]');
		expect(twitterCreator?.getAttribute('content')).toBe('@author');
	});

	// Canonical URL
	it('should render canonical link when url is provided', () => {
		render(SharingMeta, {
			props: { title: 'Test', url: 'https://example.com/canonical' }
		});
		const canonical = document.querySelector('link[rel="canonical"]');
		expect(canonical?.getAttribute('href')).toBe('https://example.com/canonical');
	});

	it('should not render canonical link when url is not provided', () => {
		render(SharingMeta, {
			props: { title: 'Test' }
		});
		const canonical = document.querySelector('link[rel="canonical"]');
		expect(canonical).not.toBeInTheDocument();
	});

	// Article-specific meta tags
	it('should render article:published_time when publishedTime is provided', () => {
		render(SharingMeta, {
			props: { title: 'Test', type: 'article', publishedTime: '2026-01-15T00:00:00Z' }
		});
		const published = document.querySelector('meta[property="article:published_time"]');
		expect(published?.getAttribute('content')).toBe('2026-01-15T00:00:00Z');
	});

	it('should render article:modified_time when modifiedTime is provided', () => {
		render(SharingMeta, {
			props: { title: 'Test', type: 'article', modifiedTime: '2026-02-20T00:00:00Z' }
		});
		const modified = document.querySelector('meta[property="article:modified_time"]');
		expect(modified?.getAttribute('content')).toBe('2026-02-20T00:00:00Z');
	});

	it('should render article:author when author is provided', () => {
		render(SharingMeta, {
			props: { title: 'Test', type: 'article', author: 'Jane Doe' }
		});
		const authorMeta = document.querySelector('meta[property="article:author"]');
		expect(authorMeta?.getAttribute('content')).toBe('Jane Doe');
	});

	it('should not render article tags when type is not article', () => {
		render(SharingMeta, {
			props: { title: 'Test', publishedTime: '2026-01-15T00:00:00Z', author: 'Jane' }
		});
		expect(document.querySelector('meta[property="article:published_time"]')).not.toBeInTheDocument();
		expect(document.querySelector('meta[property="article:author"]')).not.toBeInTheDocument();
	});

	// Robots meta
	it('should render robots meta when noindex is true', () => {
		render(SharingMeta, {
			props: { title: 'Test', noindex: true }
		});
		const robots = document.querySelector('meta[name="robots"]');
		expect(robots?.getAttribute('content')).toBe('noindex, nofollow');
	});

	it('should not render robots meta when noindex is false', () => {
		render(SharingMeta, {
			props: { title: 'Test' }
		});
		const robots = document.querySelector('meta[name="robots"]');
		expect(robots).not.toBeInTheDocument();
	});

	// Full integration: all props combined
	it('should render all meta tags when all props are provided', () => {
		render(SharingMeta, {
			props: {
				title: 'Full Test',
				description: 'Full description',
				image: 'https://example.com/full.png',
				imageAlt: 'Full image alt',
				url: 'https://example.com/full',
				type: 'article',
				siteName: 'TestSite',
				locale: 'de_DE',
				twitterCard: 'summary',
				twitterSite: '@testsite',
				twitterCreator: '@creator',
				publishedTime: '2026-01-01T00:00:00Z',
				modifiedTime: '2026-03-01T00:00:00Z',
				author: 'Test Author',
				noindex: false
			}
		});

		expect(document.querySelector('title')?.textContent).toBe('Full Test - TestSite');
		expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Full description');
		expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('Full Test');
		expect(document.querySelector('meta[property="og:description"]')?.getAttribute('content')).toBe('Full description');
		expect(document.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('article');
		expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe('https://example.com/full.png');
		expect(document.querySelector('meta[property="og:image:alt"]')?.getAttribute('content')).toBe('Full image alt');
		expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe('https://example.com/full');
		expect(document.querySelector('meta[property="og:site_name"]')?.getAttribute('content')).toBe('TestSite');
		expect(document.querySelector('meta[property="og:locale"]')?.getAttribute('content')).toBe('de_DE');
		expect(document.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toBe('summary');
		expect(document.querySelector('meta[name="twitter:title"]')?.getAttribute('content')).toBe('Full Test');
		expect(document.querySelector('meta[name="twitter:description"]')?.getAttribute('content')).toBe('Full description');
		expect(document.querySelector('meta[name="twitter:image"]')?.getAttribute('content')).toBe('https://example.com/full.png');
		expect(document.querySelector('meta[name="twitter:image:alt"]')?.getAttribute('content')).toBe('Full image alt');
		expect(document.querySelector('meta[name="twitter:site"]')?.getAttribute('content')).toBe('@testsite');
		expect(document.querySelector('meta[name="twitter:creator"]')?.getAttribute('content')).toBe('@creator');
		expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://example.com/full');
		expect(document.querySelector('meta[property="article:published_time"]')?.getAttribute('content')).toBe('2026-01-01T00:00:00Z');
		expect(document.querySelector('meta[property="article:modified_time"]')?.getAttribute('content')).toBe('2026-03-01T00:00:00Z');
		expect(document.querySelector('meta[property="article:author"]')?.getAttribute('content')).toBe('Test Author');
		expect(document.querySelector('meta[name="robots"]')).not.toBeInTheDocument();
	});
});
