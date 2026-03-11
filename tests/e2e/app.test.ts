import { expect, test } from '@playwright/test';

test.describe('Homepage', () => {
	test('should load homepage successfully', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveTitle(/NebulaKit/);
	});

	test('should navigate to documentation page via command palette', async ({ page }) => {
		await page.goto('/');

		// Open command palette
		const commandPaletteBtn = page.locator('button[aria-label="Open command palette"]');
		await commandPaletteBtn.click();

		// Wait for command palette dialog to appear
		const palette = page.locator('[role="dialog"]');
		await expect(palette).toBeVisible();

		// Search for documentation
		const searchInput = palette.locator('input[placeholder*="Search"]');
		await searchInput.fill('documentation');

		// Click on the documentation command (scoped to palette)
		const docCommand = palette.locator('button:has-text("Documentation")').first();
		await expect(docCommand).toBeVisible();
		await docCommand.click();

		await expect(page).toHaveURL('/documentation');
	});

	test('should open command palette with keyboard shortcut', async ({ page }) => {
		await page.goto('/');

		// Use Ctrl+K keyboard shortcut to open command palette
		await page.keyboard.press('Control+k');

		// Command palette should be visible
		const palette = page.locator('[role="dialog"]');
		await expect(palette).toBeVisible();
	});
});

test.describe('Theme System', () => {
	test('should toggle theme', async ({ page }) => {
		await page.goto('/');

		// Wait for hydration to set initial data-theme
		await page.waitForFunction(() => document.documentElement.hasAttribute('data-theme'));

		// Find theme switcher button
		const themeSwitcher = page.locator('button[aria-label*="theme" i]').first();
		await expect(themeSwitcher).toBeVisible();

		const initialTheme = await page.locator('html').getAttribute('data-theme');
		await themeSwitcher.click();

		// Wait for theme to change
		await page.waitForFunction(
			(initial) => document.documentElement.getAttribute('data-theme') !== initial,
			initialTheme
		);

		const newTheme = await page.locator('html').getAttribute('data-theme');
		expect(['light', 'dark']).toContain(newTheme);
	});

	test('should persist theme preference', async ({ page }) => {
		await page.goto('/');

		// Wait for hydration to set initial data-theme
		await page.waitForFunction(() => document.documentElement.hasAttribute('data-theme'));

		const themeSwitcher = page.locator('button[aria-label*="theme" i]').first();
		await expect(themeSwitcher).toBeVisible();

		const initialTheme = await page.locator('html').getAttribute('data-theme');
		await themeSwitcher.click();

		// Wait for theme to actually change
		await page.waitForFunction(
			(initial) => document.documentElement.getAttribute('data-theme') !== initial,
			initialTheme
		);
		const newTheme = await page.locator('html').getAttribute('data-theme');

		// Reload page
		await page.reload();

		// Wait for hydration to re-apply the persisted theme
		await page.waitForFunction(() => document.documentElement.hasAttribute('data-theme'));

		const persistedTheme = await page.locator('html').getAttribute('data-theme');
		expect(persistedTheme).toBe(newTheme);
	});
});

test.describe('Authentication', () => {
	test('should show login page', async ({ page }) => {
		await page.goto('/auth/login');
		await expect(page.locator('h1')).toContainText(/welcome back/i);
	});

	test('should navigate to signup from login', async ({ page }) => {
		await page.goto('/auth/login');
		await page.click('a[href="/auth/signup"]');
		await expect(page).toHaveURL('/auth/signup');
	});

	test('should validate email format', async ({ page }) => {
		await page.goto('/auth/login');

		const emailInput = page.locator('input[type="email"]');
		const submitButton = page.locator('button[type="submit"]');

		await emailInput.fill('invalid-email');
		await submitButton.click();

		// Check for HTML5 validation state
		const validationMessage = await emailInput.evaluate(
			(el: HTMLInputElement) => el.validationMessage
		);
		expect(validationMessage).toBeTruthy();
	});
});
