import { expect, test } from '@playwright/test';

/**
 * Code samples on /modules and /components: opening one must never widen the page or its card,
 * and a long line scrolls inside the block, which a keyboard can reach.
 */

for (const route of ['/modules', '/components']) {
	test.describe(`${route} code blocks`, () => {
		for (const width of [360, 1280]) {
			test(`do not cause sideways page scroll at ${width}px`, async ({ page }) => {
				await page.setViewportSize({ width, height: 800 });
				let res = await page.goto(route);
				for (let i = 0; i < 3 && res && res.status() >= 400; i++) {
					await page.waitForTimeout(1500);
					res = await page.goto(route);
				}
				expect(res?.status()).toBeLessThan(400);
				await page.waitForLoadState('networkidle');

				const first = page.locator('details.disclosure').first();
				await first.locator('summary').click();
				await expect(first).toHaveAttribute('open', '');

				// Open every sample that is on the page.
				await page.evaluate(() => {
					document
						.querySelectorAll('details.disclosure')
						.forEach((d) => d.setAttribute('open', ''));
				});

				const metrics = await page.evaluate(() => {
					const vw = document.documentElement.clientWidth;
					const wide = [...document.querySelectorAll('.code')].filter(
						(el) => el.getBoundingClientRect().right > vw + 1
					).length;
					const card = document.querySelector('details.disclosure')!.closest('article')!;
					return {
						pageOverflow: document.documentElement.scrollWidth - vw,
						blocksPastViewport: wide,
						blockInsideCard:
							document.querySelector('.code')!.getBoundingClientRect().right <=
							card.getBoundingClientRect().right + 1
					};
				});
				expect(metrics.pageOverflow).toBeLessThanOrEqual(1);
				expect(metrics.blocksPastViewport).toBe(0);
				expect(metrics.blockInsideCard).toBe(true);
			});
		}

		test('a long line scrolls inside a focusable region', async ({ page }) => {
			await page.setViewportSize({ width: 360, height: 800 });
			await page.goto(route);
			await page.waitForLoadState('networkidle');
			await page.locator('details.disclosure').first().locator('summary').click();
			await page.evaluate(() => {
				document.querySelectorAll('details.disclosure').forEach((d) => d.setAttribute('open', ''));
			});
			const regions = page.locator('details.disclosure pre[role="region"]');
			const count = await regions.count();
			let scrolling = 0;
			for (let i = 0; i < count; i++) {
				const el = regions.nth(i);
				await expect(el).toHaveAttribute('tabindex', '0');
				if (await el.evaluate((node) => node.scrollWidth > node.clientWidth)) scrolling++;
			}
			// At phone width at least one sample has a line wider than the block.
			expect(scrolling).toBeGreaterThan(0);
		});
	});
}
