import { expect, test, type Page, type Request } from '@playwright/test';

/**
 * The cart's on-page card form, end to end in a real browser, with Stripe stubbed:
 * - js.stripe.com is route-intercepted with a fake `Stripe()` that draws one input and records
 *   what the page asks of it (amounts, appearance, confirm);
 * - the checkout API is intercepted too, so the test can read exactly what the browser sends.
 * Needs the dev server to see STRIPE_SECRET_KEY and a pk_test_ STRIPE_PUBLISHABLE_KEY (placeholders
 * are enough: no request reaches Stripe). Skips itself when the cart is not in on-page mode.
 */

const FAKE_STRIPE = `
window.__stripe = { updates: [], elementsOptions: null, confirms: [], submits: 0, decline: false };
window.Stripe = function (key) {
	window.__stripe.key = key;
	return {
		elements(options) {
			window.__stripe.elementsOptions = options;
			return {
				create() {
					const handlers = {};
					return {
						mount(el) {
							el.innerHTML = '<label>Card number <input data-testid="fake-card" autocomplete="cc-number"></label>';
							setTimeout(() => handlers.ready && handlers.ready({}), 0);
						},
						on(event, handler) { handlers[event] = handler; },
						unmount() {},
						destroy() {}
					};
				},
				async submit() { window.__stripe.submits += 1; return {}; },
				update(options) { window.__stripe.updates.push(options); }
			};
		},
		async confirmPayment(options) {
			window.__stripe.confirms.push({ clientSecret: options.clientSecret, returnUrl: options.confirmParams.return_url });
			if (window.__stripe.decline) return { error: { message: 'Your card was declined.' } };
			return { paymentIntent: { id: 'pi_e2e', status: 'succeeded' } };
		}
	};
};
`;

const ORDER_ID = '11111111-2222-4333-8444-555555555555';
const SERVER_TOTAL = 4000;

async function setup(page: Page, opts: { decline?: boolean } = {}) {
	const checkoutBodies: Record<string, unknown>[] = [];
	const stripeRequests: string[] = [];
	await page.route('https://js.stripe.com/**', (route) => {
		stripeRequests.push(route.request().url());
		return route.fulfill({ contentType: 'application/javascript', body: FAKE_STRIPE });
	});
	await page.route('https://api.stripe.com/**', (route) => {
		stripeRequests.push(route.request().url());
		return route.abort();
	});
	await page.route('**/api/v1/checkout/quote', (route) =>
		route.fulfill({
			json: {
				quote: {
					currency: 'usd',
					lines: [{ productId: 'prod-1', lineTotalCents: SERVER_TOTAL }],
					subtotalCents: SERVER_TOTAL,
					baseSubtotalCents: SERVER_TOTAL,
					shippingCents: 0,
					taxCents: 0,
					totalCents: SERVER_TOTAL,
					regional: null
				}
			}
		})
	);
	await page.route('**/api/v1/checkout', (route, request: Request) => {
		checkoutBodies.push(request.postDataJSON());
		return route.fulfill({
			status: 201,
			json: {
				order: { id: ORDER_ID, status: 'pending', currency: 'usd', totalCents: SERVER_TOTAL },
				payment: {
					provider: 'stripe',
					reference: 'pi_e2e',
					redirectUrl: null,
					clientSecret: 'pi_e2e_secret_test'
				}
			}
		});
	});
	await page.route(`**/api/v1/orders/${ORDER_ID}/status`, (route) =>
		route.fulfill({ json: { status: 'paid' } })
	);
	// A cart whose stored price is absurd: the page must never send it, or charge it.
	await page.addInitScript(() => {
		localStorage.setItem(
			'nebulakit-cart',
			JSON.stringify([
				{
					productId: 'prod-1',
					slug: 'ebook',
					name: 'E-book',
					unitPriceCents: 1,
					currency: 'usd',
					physical: false,
					quantity: 2
				}
			])
		);
	});
	await page.goto('/cart');
	// The cart is read from localStorage after hydration, so wait for the form before deciding.
	const field = page.getByTestId('card-field');
	const onPage = await field
		.waitFor({ timeout: 20_000 })
		.then(() => true)
		.catch(() => false);
	test.skip(!onPage, 'cart is not in on-page mode on this server');
	if (opts.decline)
		await page.evaluate(
			() => ((window as never as { __stripe: { decline: boolean } }).__stripe.decline = true)
		);
	return { checkoutBodies, stripeRequests };
}

test.describe('on-page checkout', () => {
	test('mounts the card form, pays through the server, and never sends or charges a client price', async ({
		page
	}) => {
		const { checkoutBodies, stripeRequests } = await setup(page);
		await expect(page.getByTestId('fake-card')).toBeVisible();
		await expect(page.getByTestId('card-field')).toHaveAttribute('data-phase', 'ready');
		expect(stripeRequests.every((url) => url.startsWith('https://js.stripe.com/'))).toBe(true);

		// The form shows the server's quote, not the cart's stored price.
		const pay = page.getByRole('button', { name: /^Pay \$40\.00$/ });
		await expect(pay).toBeEnabled();

		// Keyboard only: type the email and submit with Enter.
		await page.getByLabel('Email').fill('ada@example.com');
		await page.getByLabel('Email').press('Enter');
		await page.waitForURL(`**/cart?order=${ORDER_ID}`);
		await expect(page.getByText(/payment is confirmed/i)).toBeVisible();

		expect(checkoutBodies).toHaveLength(1);
		const body = checkoutBodies[0];
		expect(body).toMatchObject({
			email: 'ada@example.com',
			lines: [{ productId: 'prod-1', quantity: 2 }],
			onSite: true
		});
		expect(typeof body.checkoutKey).toBe('string');
		const sent = JSON.stringify(body);
		for (const field of ['Cents', 'price', 'amount', 'total', 'currency']) {
			expect(sent, `checkout body must not carry ${field}`).not.toContain(field);
		}
	});

	test('confirms the server’s amount and client secret with Stripe.js', async ({ page }) => {
		await setup(page);
		await page.getByLabel('Email').fill('ada@example.com');
		const recorded = page.evaluate(
			() =>
				new Promise((resolve) => {
					const s = (window as never as { __stripe: { confirms: unknown[]; updates: unknown[] } })
						.__stripe;
					const started = Date.now();
					const tick = () =>
						s.confirms.length || Date.now() - started > 5000
							? resolve({ confirms: s.confirms, updates: s.updates })
							: setTimeout(tick, 20);
					tick();
				})
		);
		await page.getByRole('button', { name: /^Pay/ }).click();
		const { confirms, updates } = (await recorded) as {
			confirms: Array<{ clientSecret: string; returnUrl: string }>;
			updates: Array<{ amount?: number }>;
		};
		expect(confirms).toEqual([
			{
				clientSecret: 'pi_e2e_secret_test',
				returnUrl: expect.stringContaining(`/cart?order=${ORDER_ID}`)
			}
		]);
		const amounts = updates.map((u) => u.amount).filter((a) => a !== undefined);
		expect(amounts.at(-1)).toBe(SERVER_TOTAL);
		expect(amounts).not.toContain(2);
	});

	test('announces a declined card and moves focus to it', async ({ page }) => {
		const { checkoutBodies } = await setup(page, { decline: true });
		await page.getByLabel('Email').fill('ada@example.com');
		await page.getByRole('button', { name: /^Pay/ }).click();
		const alert = page.getByRole('alert').filter({ hasText: 'Your card was declined.' });
		await expect(alert).toBeVisible();
		await expect(page.getByTestId('checkout-problems')).toBeFocused();
		await expect(page.getByTestId('checkout-problems')).toHaveAttribute('aria-live', 'assertive');
		expect(page.url()).not.toContain('order=');
		// The order stays open for another card, and can be backed out of.
		await expect(page.getByRole('button', { name: 'Cancel order' })).toBeVisible();
		expect(checkoutBodies).toHaveLength(1);
	});

	test('dresses the card form in the current theme and follows a theme switch', async ({
		page
	}) => {
		await setup(page);
		await expect(page.getByTestId('card-field')).toHaveAttribute('data-phase', 'ready');
		const read = () =>
			page.evaluate(() => {
				const s = (
					window as never as {
						__stripe: {
							elementsOptions: { appearance: { variables: Record<string, string> } };
							updates: Array<{ appearance?: { variables: Record<string, string> } }>;
						};
					}
				).__stripe;
				const looks = [s.elementsOptions.appearance, ...s.updates.map((u) => u.appearance)].filter(
					Boolean
				);
				return looks.at(-1)!.variables;
			});
		const bodyColour = () =>
			page.evaluate(() => getComputedStyle(document.querySelector('.cart')!).color);

		await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
		await expect.poll(async () => (await read()).colorText).toBe(await bodyColour());
		const light = await read();

		await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
		await expect.poll(async () => (await read()).colorBackground).not.toBe(light.colorBackground);
		const dark = await read();
		expect(dark.colorText).toBe(await bodyColour());
		expect(dark.colorText).not.toBe(light.colorText);
	});
});
