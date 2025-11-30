import { browser } from '$app/environment';
import { derived, writable } from 'svelte/store';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

// Get system theme preference
function getSystemTheme(): ResolvedTheme {
	if (browser && window.matchMedia('(prefers-color-scheme: dark)').matches) {
		return 'dark';
	}
	return 'light';
}

// Initialize theme preference from localStorage
function getInitialThemePreference(): ThemePreference {
	if (browser) {
		const stored = localStorage.getItem('theme-preference') as ThemePreference;
		if (stored === 'light' || stored === 'dark' || stored === 'system') {
			return stored;
		}
	}
	return 'system'; // Default to system
}

// Store for user's theme preference (light, dark, or system)
export const themePreference = writable<ThemePreference>(getInitialThemePreference());

// Store for system theme (light or dark)
export const systemTheme = writable<ResolvedTheme>(getSystemTheme());

// Derived store for the actual theme to apply
export const resolvedTheme = derived(
	[themePreference, systemTheme],
	([$themePreference, $systemTheme]) => {
		if ($themePreference === 'system') {
			return $systemTheme;
		}
		return $themePreference as ResolvedTheme;
	}
);

// Subscribe to preference changes and update localStorage
if (browser) {
	themePreference.subscribe((value) => {
		localStorage.setItem('theme-preference', value);
	});

	// Listen for system theme changes
	const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
	const handleChange = (e: MediaQueryListEvent) => {
		systemTheme.set(e.matches ? 'dark' : 'light');
	};
	mediaQuery.addEventListener('change', handleChange);
}

// Legacy export for backward compatibility
export const themeStore = resolvedTheme;
