import { describe, expect, it } from 'vitest';
import {
	FALLBACK_SHARE_IMAGE,
	firstDocumentImage,
	firstShareImage,
	resolveShareImage,
	usableImageUrl
} from '../../src/lib/seo/share-image';

const origin = 'https://shop.example';
const defaults = { src: '/card.png', alt: 'The shop', width: 1200, height: 630 };
const resolve = (over: Record<string, unknown> = {}) =>
	resolveShareImage({ title: 'A page', origin, ...over }, defaults);

describe('usableImageUrl', () => {
	it('accepts http(s) URLs and root-relative paths, absolute in the result', () => {
		expect(usableImageUrl('https://cdn.example.com/a.jpg', origin)).toBe(
			'https://cdn.example.com/a.jpg'
		);
		expect(usableImageUrl('http://cdn.example.com/a.jpg', origin)).toBe(
			'http://cdn.example.com/a.jpg'
		);
		expect(usableImageUrl('/media/a.webp', origin)).toBe('https://shop.example/media/a.webp');
		expect(usableImageUrl('  /a.png ', origin)).toBe('https://shop.example/a.png');
	});
	it.each([
		['an SVG', 'https://x.test/a.svg'],
		['a compressed SVG', 'https://x.test/a.svgz'],
		['an SVG with a query', '/a.svg?v=3'],
		['an upper-case SVG', '/A.SVG'],
		['javascript:', 'javascript:alert(1)'],
		['data:', 'data:image/png;base64,AAAA'],
		['file:', 'file:///etc/passwd'],
		['protocol-relative', '//cdn.test/a.png'],
		['empty', ''],
		['spaces', '   ']
	])('does not accept %s', (_n, value) => {
		expect(usableImageUrl(value, origin)).toBeNull();
	});
	it('refuses things that are not strings, and absurdly long URLs', () => {
		for (const bad of [null, undefined, 5, {}, [], true])
			expect(usableImageUrl(bad, origin)).toBeNull();
		expect(usableImageUrl(`https://x.test/${'a'.repeat(2100)}.png`, origin)).toBeNull();
	});
});

describe('resolveShareImage', () => {
	it('uses the page image, with its own alt and size', () => {
		expect(
			resolve({ image: '/m.jpg', imageAlt: 'A mug', imageWidth: 800, imageHeight: 600 })
		).toEqual({
			src: 'https://shop.example/m.jpg',
			alt: 'A mug',
			width: 800,
			height: 600,
			isDefault: false
		});
	});
	it('names the page when the image has no alt', () => {
		expect(resolve({ image: '/m.jpg', title: 'Blue mug' }).alt).toBe('Blue mug');
	});
	it('leaves the size at 0 when it is unknown or nonsense', () => {
		for (const size of [undefined, 0, -5, NaN, Infinity, '800' as never]) {
			expect(resolve({ image: '/m.jpg', imageWidth: size, imageHeight: size })).toMatchObject({
				width: 0,
				height: 0
			});
		}
	});
	it('rounds a fractional size', () => {
		expect(resolve({ image: '/m.jpg', imageWidth: 799.6 }).width).toBe(800);
	});
	it('falls back to the site default, with the default alt and size, when there is no image', () => {
		for (const image of [undefined, null, '', '   ']) {
			expect(resolve({ image })).toEqual({
				src: 'https://shop.example/card.png',
				alt: 'The shop',
				width: 1200,
				height: 630,
				isDefault: true
			});
		}
	});
	it('falls back rather than share something a platform will not show', () => {
		for (const image of [
			'https://x.test/a.svg',
			'javascript:alert(1)',
			'data:image/png;base64,A'
		]) {
			expect(resolve({ image, imageAlt: 'Page alt' })).toMatchObject({
				src: 'https://shop.example/card.png',
				alt: 'The shop',
				isDefault: true
			});
		}
	});
	it('never returns an empty image, even if the site default is missing or broken', () => {
		for (const broken of [
			{ src: '', alt: '', width: 0, height: 0 },
			{ src: 'javascript:x', alt: '', width: 0, height: 0 },
			{ src: '/logo.svg', alt: '', width: 0, height: 0 }
		]) {
			const r = resolveShareImage({ title: 'Page', origin }, broken);
			expect(r.src).toBe('https://shop.example/og-image.png');
			expect(r.isDefault).toBe(true);
			expect(r.alt).toBe('Page');
		}
		expect(FALLBACK_SHARE_IMAGE.src).toBe('/og-image.png');
	});
	it('always answers with an absolute http(s) URL, over many odd inputs', () => {
		const inputs = [
			'',
			' ',
			'a',
			'/',
			'/x',
			'//x',
			'x:y',
			'https://',
			'https://a b',
			'\u0000',
			'/a.svg',
			'../x.png'
		];
		for (const image of inputs) {
			const r = resolve({ image });
			expect(r.src).toMatch(/^https?:\/\/[^\s]+$/);
			expect(r.src.endsWith('.svg')).toBe(false);
		}
	});
});

describe('firstShareImage', () => {
	it('takes the first usable candidate, skipping unusable ones, as given', () => {
		expect(firstShareImage(null, '', 'https://x.test/a.svg', '/featured.jpg', '/other.jpg')).toBe(
			'/featured.jpg'
		);
		expect(firstShareImage('https://cdn.test/seo.png', '/featured.jpg')).toBe(
			'https://cdn.test/seo.png'
		);
	});
	it('is empty when none is usable, which sends the page to the site default', () => {
		expect(firstShareImage()).toBe('');
		expect(firstShareImage(undefined, 7, 'https://x.test/a.svg')).toBe('');
	});
});

describe('firstDocumentImage', () => {
	const image = (src: string, alt = '') => ({ type: 'image', props: { src, alt } });
	it('finds the first picture in reading order, nested or not', () => {
		const doc = {
			blocks: [
				{ type: 'heading', props: { text: 'Hi' } },
				{
					type: 'section',
					props: {},
					children: [{ type: 'text', props: {} }, image('/hero.jpg', 'The hero')]
				},
				image('/later.jpg')
			]
		};
		expect(firstDocumentImage(doc)).toEqual({ src: '/hero.jpg', alt: 'The hero' });
	});
	it('goes down through columns', () => {
		const doc = {
			blocks: [
				{
					type: 'columns',
					props: {},
					children: [
						{ type: 'column', props: {}, children: [] },
						{ type: 'column', props: {}, children: [image('/in-column.png')] }
					]
				}
			]
		};
		expect(firstDocumentImage(doc)?.src).toBe('/in-column.png');
	});
	it('skips an image block with nothing chosen, or an SVG, and returns null if that is all there is', () => {
		expect(
			firstDocumentImage({ blocks: [image(''), image('/logo.svg'), image('/real.jpg')] })?.src
		).toBe('/real.jpg');
		expect(firstDocumentImage({ blocks: [image(''), { type: 'text', props: {} }] })).toBeNull();
		expect(firstDocumentImage({ blocks: [] })).toBeNull();
	});
	it('tolerates a block with no props', () => {
		expect(firstDocumentImage({ blocks: [{ type: 'image' }] })).toBeNull();
	});
});
