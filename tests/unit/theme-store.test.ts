import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const environment = vi.hoisted(() => ({ browser: false }));
vi.mock('$app/environment', () => environment);

/**
 * Tests for Theme Store
 * TDD: Tests for theme preference and system theme management
 */

describe('Theme Store', () => {
	beforeEach(() => {
		vi.resetModules();
		environment.browser = false;
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.unstubAllGlobals();
	});

	describe('resolvedTheme', () => {
		it('should use system theme when preference is system', async () => {
			const { resolvedTheme, themePreference, systemTheme } =
				await import('../../src/lib/stores/theme');

			// Set up stores
			themePreference.set('system');
			systemTheme.set('dark');

			expect(get(resolvedTheme)).toBe('dark');
		});

		it('should use explicit preference when set to light', async () => {
			const { resolvedTheme, themePreference, systemTheme } =
				await import('../../src/lib/stores/theme');

			systemTheme.set('dark');
			themePreference.set('light');

			expect(get(resolvedTheme)).toBe('light');
		});

		it('should use explicit preference when set to dark', async () => {
			const { resolvedTheme, themePreference, systemTheme } =
				await import('../../src/lib/stores/theme');

			systemTheme.set('light');
			themePreference.set('dark');

			expect(get(resolvedTheme)).toBe('dark');
		});

		it('should switch from dark to light when preference changes', async () => {
			const { resolvedTheme, themePreference } = await import('../../src/lib/stores/theme');

			themePreference.set('dark');
			expect(get(resolvedTheme)).toBe('dark');

			themePreference.set('light');
			expect(get(resolvedTheme)).toBe('light');
		});
	});

	describe('ThemePreference type', () => {
		it('should accept valid theme preferences', async () => {
			const { themePreference } = await import('../../src/lib/stores/theme');

			// These should all be valid
			themePreference.set('light');
			expect(get(themePreference)).toBe('light');

			themePreference.set('dark');
			expect(get(themePreference)).toBe('dark');

			themePreference.set('system');
			expect(get(themePreference)).toBe('system');
		});
	});

	describe('systemTheme', () => {
		it('should be a writable store', async () => {
			const { systemTheme } = await import('../../src/lib/stores/theme');

			systemTheme.set('dark');
			expect(get(systemTheme)).toBe('dark');

			systemTheme.set('light');
			expect(get(systemTheme)).toBe('light');
		});
	});

	describe('themeStore legacy export', () => {
		it('should be an alias for resolvedTheme', async () => {
			const { themeStore, resolvedTheme, themePreference } =
				await import('../../src/lib/stores/theme');

			themePreference.set('dark');

			// Both should return the same value
			expect(get(themeStore)).toBe(get(resolvedTheme));
			expect(get(themeStore)).toBe('dark');
		});
	});

	describe('browser environment', () => {
		it('should read theme preference from localStorage when available', async () => {
			const mockLocalStorage = {
				getItem: vi.fn().mockReturnValue('dark'),
				setItem: vi.fn()
			};
			const mockMatchMedia = vi.fn().mockReturnValue({
				matches: false,
				addEventListener: vi.fn()
			});

			vi.stubGlobal('localStorage', mockLocalStorage);
			vi.stubGlobal('matchMedia', mockMatchMedia);

			environment.browser = true;

			const { themePreference } = await import('../../src/lib/stores/theme');

			// The store should have been initialized with 'dark' from localStorage
			expect(mockLocalStorage.getItem).toHaveBeenCalledWith('theme-preference');
			expect(get(themePreference)).toBe('dark');
		});

		it('should detect dark system theme preference', async () => {
			const mockLocalStorage = {
				getItem: vi.fn().mockReturnValue(null),
				setItem: vi.fn()
			};
			const mockMatchMedia = vi.fn().mockReturnValue({
				matches: true, // Dark mode
				addEventListener: vi.fn()
			});

			vi.stubGlobal('localStorage', mockLocalStorage);
			vi.stubGlobal('matchMedia', mockMatchMedia);

			environment.browser = true;

			const { systemTheme } = await import('../../src/lib/stores/theme');

			// System theme should be 'dark' when prefers-color-scheme matches
			expect(get(systemTheme)).toBe('dark');
		});

		it('should detect light system theme preference', async () => {
			const mockLocalStorage = {
				getItem: vi.fn().mockReturnValue(null),
				setItem: vi.fn()
			};
			const mockMatchMedia = vi.fn().mockReturnValue({
				matches: false, // Light mode
				addEventListener: vi.fn()
			});

			vi.stubGlobal('localStorage', mockLocalStorage);
			vi.stubGlobal('matchMedia', mockMatchMedia);

			environment.browser = true;

			const { systemTheme } = await import('../../src/lib/stores/theme');

			expect(get(systemTheme)).toBe('light');
		});

		it('should read light theme from localStorage', async () => {
			const mockLocalStorage = {
				getItem: vi.fn().mockReturnValue('light'),
				setItem: vi.fn()
			};
			const mockMatchMedia = vi.fn().mockReturnValue({
				matches: true,
				addEventListener: vi.fn()
			});

			vi.stubGlobal('localStorage', mockLocalStorage);
			vi.stubGlobal('matchMedia', mockMatchMedia);

			environment.browser = true;

			const { themePreference } = await import('../../src/lib/stores/theme');

			expect(get(themePreference)).toBe('light');
		});

		it('should read system theme from localStorage', async () => {
			const mockLocalStorage = {
				getItem: vi.fn().mockReturnValue('system'),
				setItem: vi.fn()
			};
			const mockMatchMedia = vi.fn().mockReturnValue({
				matches: false,
				addEventListener: vi.fn()
			});

			vi.stubGlobal('localStorage', mockLocalStorage);
			vi.stubGlobal('matchMedia', mockMatchMedia);

			environment.browser = true;

			const { themePreference } = await import('../../src/lib/stores/theme');

			expect(get(themePreference)).toBe('system');
		});

		it('should default to system when localStorage has invalid value', async () => {
			const mockLocalStorage = {
				getItem: vi.fn().mockReturnValue('invalid-theme'),
				setItem: vi.fn()
			};
			const mockMatchMedia = vi.fn().mockReturnValue({
				matches: false,
				addEventListener: vi.fn()
			});

			vi.stubGlobal('localStorage', mockLocalStorage);
			vi.stubGlobal('matchMedia', mockMatchMedia);

			environment.browser = true;

			const { themePreference } = await import('../../src/lib/stores/theme');

			// Should fall back to 'system' for invalid stored value
			expect(get(themePreference)).toBe('system');
		});

		it('should persist theme preference changes to localStorage', async () => {
			const mockLocalStorage = {
				getItem: vi.fn().mockReturnValue(null),
				setItem: vi.fn()
			};
			const mockMatchMedia = vi.fn().mockReturnValue({
				matches: false,
				addEventListener: vi.fn()
			});

			vi.stubGlobal('localStorage', mockLocalStorage);
			vi.stubGlobal('matchMedia', mockMatchMedia);

			environment.browser = true;

			const { themePreference } = await import('../../src/lib/stores/theme');

			themePreference.set('dark');

			expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme-preference', 'dark');
		});

		it('should set up media query listener for system theme changes', async () => {
			const mockAddEventListener = vi.fn();
			const mockLocalStorage = {
				getItem: vi.fn().mockReturnValue(null),
				setItem: vi.fn()
			};
			const mockMatchMedia = vi.fn().mockReturnValue({
				matches: false,
				addEventListener: mockAddEventListener
			});

			vi.stubGlobal('localStorage', mockLocalStorage);
			vi.stubGlobal('matchMedia', mockMatchMedia);

			environment.browser = true;

			await import('../../src/lib/stores/theme');

			// Should have called matchMedia to get the query
			expect(mockMatchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
			// Should have added an event listener for changes
			expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));
		});

		it('should update systemTheme when media query changes', async () => {
			let changeHandler: ((e: MediaQueryListEvent) => void) | undefined;
			const mockAddEventListener = vi.fn((event: string, handler: any) => {
				if (event === 'change') {
					changeHandler = handler;
				}
			});
			const mockLocalStorage = {
				getItem: vi.fn().mockReturnValue(null),
				setItem: vi.fn()
			};
			const mockMatchMedia = vi.fn().mockReturnValue({
				matches: false,
				addEventListener: mockAddEventListener
			});

			vi.stubGlobal('localStorage', mockLocalStorage);
			vi.stubGlobal('matchMedia', mockMatchMedia);

			environment.browser = true;

			const { systemTheme } = await import('../../src/lib/stores/theme');

			// Initially light
			expect(get(systemTheme)).toBe('light');

			// Simulate media query change to dark
			if (changeHandler) {
				changeHandler({ matches: true } as MediaQueryListEvent);
				expect(get(systemTheme)).toBe('dark');

				// Change back to light
				changeHandler({ matches: false } as MediaQueryListEvent);
				expect(get(systemTheme)).toBe('light');
			}
		});
	});
});
