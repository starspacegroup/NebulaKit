import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * A product page's JSON-LD parses, and its price is the price on the page and
 * in the Google feed (docs/GOOGLE_LISTINGS.md). The product is seeded into the
 * local D1 with wrangler, the same database the dev server reads.
 */
const toml = readFileSync(resolve(process.cwd(), 'wrangler.toml'), 'utf8');
const DB_NAME = toml.match(/^\s*database_name\s*=\s*"([^"]+)"/m)?.[1] ?? '';

function sql(statement: string) {
	execFileSync('bunx', ['wrangler', 'd1', 'execute', DB_NAME, '--local', '--command', statement], {
		stdio: 'pipe'
	});
}

const HOSTILE = `Mug </script><script>window.__pwned=1</script> & "co"`;

test.beforeAll(() => {
	sql(`DELETE FROM commerce_products WHERE id IN ('e2e-g-plain','e2e-g-sale','e2e-g-evil')`);
	const row = (id: string, name: string, extra: { sale?: boolean } = {}) =>
		`INSERT INTO commerce_products (id, slug, name, description, price_cents, currency, image_url, type, active, brand, gtin, sale_price_cents, sale_starts_at, sale_ends_at)
		 VALUES ('${id}', '${id}', '${name.replaceAll("'", "''")}', 'A fine thing.', 2000, 'usd', 'https://cdn.example.com/a.jpg', 'physical', 1, 'Acme', '036000291452',
		 ${extra.sale ? "1500, '2000-01-01T00:00:00Z', '2999-01-01T00:00:00Z'" : 'NULL, NULL, NULL'})`;
	sql(row('e2e-g-plain', 'Plain mug'));
	sql(row('e2e-g-sale', 'Sale mug', { sale: true }));
	sql(row('e2e-g-evil', HOSTILE));
});

test.afterAll(() => {
	sql(`DELETE FROM commerce_products WHERE id IN ('e2e-g-plain','e2e-g-sale','e2e-g-evil')`);
});

async function jsonLd(page: import('@playwright/test').Page) {
	const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
	expect(blocks.length).toBeGreaterThan(0);
	return blocks.map((b) => JSON.parse(b) as { '@graph': Record<string, any>[] });
}

for (const [slug, visible, markup, feed] of [
	['e2e-g-plain', '$20.00', '20.00', '20.00 USD'],
	['e2e-g-sale', '$15.00', '15.00', '20.00 USD']
] as const) {
	test(`${slug}: JSON-LD parses and matches the visible price and the feed`, async ({
		page,
		request
	}) => {
		await page.goto(`/shop/${slug}`);
		const shown = (await page.getByTestId('product-price').textContent())?.trim();
		expect(shown).toBe(visible);

		const [graph] = await jsonLd(page);
		const nodes = graph['@graph'];
		expect(nodes.filter((n) => n['@type'] === 'Organization')).toHaveLength(1);
		expect(nodes.filter((n) => n['@type'] === 'WebSite')).toHaveLength(1);
		const product = nodes.find((n) => n['@type'] === 'Product')!;
		expect(product.offers).toMatchObject({
			price: markup,
			priceCurrency: 'USD',
			availability: 'https://schema.org/InStock'
		});
		expect(product.gtin12).toBe('036000291452');
		// the price a person reads is the number in the markup
		expect(`$${product.offers.price}`).toBe(shown);

		const xml = await (await request.get('/feeds/google-products.xml')).text();
		const item = xml.split('<item>').find((i) => i.includes(`/shop/${slug}<`))!;
		expect(item).toContain(`<g:price>${feed}</g:price>`);
		if (slug === 'e2e-g-sale') expect(item).toContain('<g:sale_price>15.00 USD</g:sale_price>');
	});
}

test('hostile product text cannot break the page, the JSON-LD or the feed', async ({
	page,
	request
}) => {
	await page.goto('/shop/e2e-g-evil');
	expect(
		await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)
	).toBeUndefined();
	const [graph] = await jsonLd(page);
	const product = graph['@graph'].find((n) => n['@type'] === 'Product')!;
	expect(product.name).toBe(HOSTILE);

	const res = await request.get('/feeds/google-products.xml');
	expect(res.headers()['content-type']).toContain('xml');
	expect(res.headers()['x-robots-tag']).toContain('noindex');
	const xml = await res.text();
	// a name that contains markup is refused for the feed rather than escaped into it
	expect(xml).not.toContain('__pwned');
	const parsed = await page.evaluate((text) => {
		const doc = new DOMParser().parseFromString(text, 'application/xml');
		return {
			errors: doc.getElementsByTagName('parsererror').length,
			items: doc.getElementsByTagName('item').length
		};
	}, xml);
	expect(parsed.errors).toBe(0);
	expect(parsed.items).toBeGreaterThanOrEqual(2);

	const tsv = await (await request.get('/feeds/google-products.tsv')).text();
	expect(tsv.split('\n')[0].startsWith('id\ttitle')).toBe(true);
});
