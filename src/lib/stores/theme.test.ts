import {
	resolvedTheme,
	systemTheme,
	themePreference,
	type ThemePreference
} from '$lib/stores/theme';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';

describe('Theme Store', () => {
	beforeEach(() => {
		localStorage.clear();
		// Reset stores to default state
		themePreference.set('system');
		systemTheme.set('light');
	});

	it('should initialize with system theme preference', () => {
		const preference = get(themePreference);
		expect(preference).toBe('system');
	});

	it('should resolve system theme based on system preference', () => {
		themePreference.set('system');
		systemTheme.set('dark');
		expect(get(resolvedTheme)).toBe('dark');

		systemTheme.set('light');
		expect(get(resolvedTheme)).toBe('light');
	});

	it('should resolve to explicit light theme when set', () => {
		themePreference.set('light');
		systemTheme.set('dark'); // System is dark
		expect(get(resolvedTheme)).toBe('light'); // But resolved should be light
	});

	it('should resolve to explicit dark theme when set', () => {
		themePreference.set('dark');
		systemTheme.set('light'); // System is light
		expect(get(resolvedTheme)).toBe('dark'); // But resolved should be dark
	});

	it('should update theme preference value', () => {
		themePreference.set('dark');
		expect(get(themePreference)).toBe('dark');

		themePreference.set('light');
		expect(get(themePreference)).toBe('light');

		themePreference.set('system');
		expect(get(themePreference)).toBe('system');
	});

	it('should handle cycling through all theme preferences', () => {
		const preferences: ThemePreference[] = ['light', 'dark', 'system'];

		preferences.forEach((pref) => {
			themePreference.set(pref);
			expect(get(themePreference)).toBe(pref);
		});
	});

	it('should maintain system theme reactivity', () => {
		themePreference.set('system');

		systemTheme.set('light');
		expect(get(resolvedTheme)).toBe('light');

		systemTheme.set('dark');
		expect(get(resolvedTheme)).toBe('dark');
	});

	it('should not affect resolved theme when changing system theme with explicit preference', () => {
		themePreference.set('light');

		systemTheme.set('dark');
		expect(get(resolvedTheme)).toBe('light'); // Should stay light

		systemTheme.set('light');
		expect(get(resolvedTheme)).toBe('light'); // Should still be light
	});
});
