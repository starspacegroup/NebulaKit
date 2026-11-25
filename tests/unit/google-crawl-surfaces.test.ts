import { describe, expect, it } from 'vitest';
import { GET as robotsGet } from '../../src/routes/robots.txt/+server';
import { GET as sitemapGet } from '../../src/routes/sitemap.xml/+server';
import {
	CRAWLER_DISALLOW,
	MERCHANT_BOTS,
	SITEMAP_EXCLUDED_ROUTES
} from '../../src/lib/agent-discovery';

const groupFor = (body: string, agent: string) => {
	const block = body.split(/\n\n+/).find((b) => b.split('\n').includes(`User-agent: ${agent}`));
	return block ? block.split('\n') : [];
};

describe('crawl surfaces for Google listings', () => {
	it("lets Google's image and shopping fetchers read product images in /media/, and nothing private", async () => {
		const body = await (
			await robotsGet({ url: new URL('https://x.test/robots.txt') } as never)
		).text();
		for (const bot of MERCHANT_BOTS) {
			const rules = groupFor(body, bot);
			expect(rules.length, bot).toBeGreaterThan(0);
			expect(rules, bot).not.toContain('Disallow: /media/');
			for (const path of CRAWLER_DISALLOW.filter((p) => p !== '/media/'))
				expect(rules, `${bot} ${path}`).toContain(`Disallow: ${path}`);
		}
		// ordinary crawlers still cannot read /media/, and the feeds are not blocked for anyone
		expect(groupFor(body, '*')).toContain('Disallow: /media/');
		expect(body).not.toContain('Disallow: /feeds');
	});

	it('keeps the feeds out of the sitemap, with a stated reason', async () => {
		expect(SITEMAP_EXCLUDED_ROUTES.feeds).toMatch(/not pages/);
		const xml = await (
			await sitemapGet({ url: new URL('https://x.test/sitemap.xml'), platform: undefined } as never)
		).text();
		expect(xml).not.toContain('/feeds/');
	});
});
