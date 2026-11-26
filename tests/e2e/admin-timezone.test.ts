import { expect, test } from '@playwright/test';

/**
 * The admin clock (docs/ADMIN_TIMEZONE.md): follows the browser's zone without
 * asking, until the owner pins a zone in Settings. Headless; signs in through the
 * localhost-only dev simulator as a superadmin (who is the owner tier).
 */
test.describe('Admin time zone', () => {
	test.use({ timezoneId: 'Asia/Kolkata' });

	test('follows the browser zone, then an explicit setting wins', async ({ page, request }) => {
		await page.goto('/api/auth/dev-simulate?provider=github&role=superadmin');

		// A failed earlier run may have left a site zone behind; start from auto.
		await page.request.put('/api/admin/settings/timezone', { data: { timeZone: 'auto' } });

		// First visit: no cookie yet, so the server renders UTC; the client reads
		// the browser zone, sets the cookie and re-renders without a manual reload.
		await page.goto('/admin');
		const clock = page.getByTestId('admin-clock');
		await expect(clock).toContainText('UTC+05:30', { timeout: 15000 });
		await expect(page.getByTestId('stats-zone')).toContainText('UTC+05:30');
		await expect(page.getByTestId('stats-zone')).toContainText(/Kolkata|Calcutta/);

		const cookies = await page.context().cookies();
		const tz = cookies.find((c) => c.name === 'tz');
		expect(tz?.value).toMatch(/Kolkata|Calcutta/);
		expect(tz?.httpOnly).toBe(false);
		expect(tz?.sameSite).toBe('Lax');
		// Never in a URL.
		expect(page.url()).not.toMatch(/Kolkata|Calcutta|tz=/);

		// A reload now renders in that zone on the server.
		await page.reload();
		await expect(page.getByTestId('stats-zone')).toContainText('UTC+05:30');

		// Pin a zone in Settings; it beats the browser.
		await page.goto('/admin/settings');
		await expect(page.getByTestId('timezone-current')).toContainText('UTC+05:30');
		await page.waitForLoadState('networkidle');
		// `networkidle` does not imply hydration, and a radio ticked before Svelte
		// attaches its handler is silently ignored. Retry until the input appears.
		const input = page.getByTestId('timezone-input');
		await expect(async () => {
			await page.getByLabel(/A fixed zone for everyone/).check();
			await expect(input).toBeVisible({ timeout: 1000 });
		}).toPass({ timeout: 20000 });
		await input.fill('America/New_York');
		await page.getByRole('button', { name: 'Save time zone' }).click();
		await expect(page.getByText('Saved.')).toBeVisible({ timeout: 15000 });

		await page.goto('/admin');
		await expect(page.getByTestId('stats-zone')).toContainText('America/New_York');
		await expect(page.getByTestId('stats-zone')).toContainText(/UTC-0[45]:00/);
		await expect(page.getByTestId('admin-clock')).toContainText('site setting');

		// A personal zone beats the site's. The sidebar links to the control.
		await page.getByRole('link', { name: 'Change my time zone' }).click();
		await expect(page).toHaveURL(/\/profile#time-zone$/);
		const personal = page.getByTestId('personal-timezone-setting');
		await expect(personal.getByTestId('timezone-source')).toContainText('site setting');
		await page.waitForLoadState('networkidle');
		const personalInput = personal.getByTestId('timezone-input');
		await expect(async () => {
			await personal.getByLabel(/A zone of my own/).check();
			await expect(personalInput).toBeVisible({ timeout: 1000 });
		}).toPass({ timeout: 20000 });
		await personalInput.fill('Asia/Tokyo');
		await personal.getByRole('button', { name: 'Save time zone' }).click();
		await expect(personal.getByText('Saved.')).toBeVisible({ timeout: 15000 });

		await page.goto('/admin');
		await expect(page.getByTestId('stats-zone')).toContainText('Asia/Tokyo');
		await expect(page.getByTestId('stats-zone')).toContainText('UTC+09:00');
		await expect(page.getByTestId('admin-clock')).toContainText('your preference');

		// Clearing it hands the clock back to the site setting.
		const clear = await page.request.put('/api/profile/timezone', { data: { timeZone: 'auto' } });
		expect(clear.ok()).toBe(true);
		await page.reload();
		await expect(page.getByTestId('stats-zone')).toContainText('America/New_York');
		const hostile = await page.request.put('/api/profile/timezone', {
			data: { timeZone: 'Mars/Olympus' }
		});
		expect(hostile.status()).toBe(400);

		// An unknown zone is refused by the server, not just the form.
		const bad = await page.request.put('/api/admin/settings/timezone', {
			data: { timeZone: 'Mars/Olympus' }
		});
		expect(bad.status()).toBe(400);

		// Put it back so the dev database is left as it was found.
		const reset = await page.request.put('/api/admin/settings/timezone', {
			data: { timeZone: 'auto' }
		});
		expect(reset.ok()).toBe(true);
		void request;
	});
});
