import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import ThemeToggle from '../../src/lib/components/ThemeToggle.svelte';
import { themePreference } from '../../src/lib/stores/theme';

describe('ThemeToggle', () => {
	beforeEach(() => {
		// Reset theme preference before each test
		themePreference.set('system');
	});

	it('should render all three theme options', () => {
		render(ThemeToggle);

		// Should show light, dark, and system options
		expect(screen.getByLabelText('Light theme')).toBeTruthy();
		expect(screen.getByLabelText('Dark theme')).toBeTruthy();
		expect(screen.getByLabelText('System theme')).toBeTruthy();
	});

	it('should highlight the active theme option', () => {
		themePreference.set('light');
		render(ThemeToggle);

		const lightButton = screen.getByLabelText('Light theme');
		expect(lightButton.classList.contains('active')).toBe(true);
	});

	it('should switch to light theme when light button is clicked', async () => {
		themePreference.set('dark');
		render(ThemeToggle);

		const lightButton = screen.getByLabelText('Light theme');
		await fireEvent.click(lightButton);

		expect(get(themePreference)).toBe('light');
	});

	it('should switch to dark theme when dark button is clicked', async () => {
		themePreference.set('light');
		render(ThemeToggle);

		const darkButton = screen.getByLabelText('Dark theme');
		await fireEvent.click(darkButton);

		expect(get(themePreference)).toBe('dark');
	});

	it('should switch to system theme when system button is clicked', async () => {
		themePreference.set('light');
		render(ThemeToggle);

		const systemButton = screen.getByLabelText('System theme');
		await fireEvent.click(systemButton);

		expect(get(themePreference)).toBe('system');
	});

	it('should display all three options in a horizontal layout', () => {
		const { container } = render(ThemeToggle);

		const toggle = container.querySelector('.theme-toggle');
		expect(toggle).toBeTruthy();

		const buttons = container.querySelectorAll('.theme-option');
		expect(buttons.length).toBe(3);
	});

	it('should show light theme icon in the first position', () => {
		render(ThemeToggle);

		const buttons = screen.getAllByRole('button');
		expect(buttons[0]).toHaveAttribute('aria-label', 'Light theme');
	});

	it('should show dark theme icon in the second position', () => {
		render(ThemeToggle);

		const buttons = screen.getAllByRole('button');
		expect(buttons[1]).toHaveAttribute('aria-label', 'Dark theme');
	});

	it('should show system theme icon in the third position', () => {
		render(ThemeToggle);

		const buttons = screen.getAllByRole('button');
		expect(buttons[2]).toHaveAttribute('aria-label', 'System theme');
	});

	it('should update active state when theme changes externally', async () => {
		const { container } = render(ThemeToggle);

		// Initially system
		themePreference.set('system');
		await new Promise((resolve) => setTimeout(resolve, 0));

		let systemButton = container.querySelector('[aria-label="System theme"]');
		expect(systemButton?.classList.contains('active')).toBe(true);

		// Change to dark
		themePreference.set('dark');
		await new Promise((resolve) => setTimeout(resolve, 0));

		let darkButton = container.querySelector('[aria-label="Dark theme"]');
		expect(darkButton?.classList.contains('active')).toBe(true);
	});
});
