import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for Theme Store
 * TDD: Tests for theme preference and system theme management
 */

describe('Theme Store', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.unstubAllGlobals();
	});

	describe('resolvedTheme', () => {
		it('should use system theme when preference is system', async () => {
			vi.mock('$app/environment', () => ({
				browser: false
			}));

			const { resolvedTheme, themePreference, systemTheme } = await import(
				'../../src/lib/stores/theme'
			);

			// Set up stores
			themePreference.set('system');
			systemTheme.set('dark');

			expect(get(resolvedTheme)).toBe('dark');
		});

		it('should use explicit preference when set to light', async () => {
			vi.mock('$app/environment', () => ({
				browser: false
			}));

			const { resolvedTheme, themePreference, systemTheme } = await import(
				'../../src/lib/stores/theme'
			);

			systemTheme.set('dark');
			themePreference.set('light');

			expect(get(resolvedTheme)).toBe('light');
		});

		it('should use explicit preference when set to dark', async () => {
			vi.mock('$app/environment', () => ({
				browser: false
			}));

			const { resolvedTheme, themePreference, systemTheme } = await import(
				'../../src/lib/stores/theme'
			);

			systemTheme.set('light');
			themePreference.set('dark');

			expect(get(resolvedTheme)).toBe('dark');
		});

		it('should switch from dark to light when preference changes', async () => {
			vi.mock('$app/environment', () => ({
				browser: false
			}));

			const { resolvedTheme, themePreference } = await import('../../src/lib/stores/theme');

			themePreference.set('dark');
			expect(get(resolvedTheme)).toBe('dark');

			themePreference.set('light');
			expect(get(resolvedTheme)).toBe('light');
		});
	});

	describe('ThemePreference type', () => {
		it('should accept valid theme preferences', async () => {
			vi.mock('$app/environment', () => ({
				browser: false
			}));

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
			vi.mock('$app/environment', () => ({
				browser: false
			}));

			const { systemTheme } = await import('../../src/lib/stores/theme');

			systemTheme.set('dark');
			expect(get(systemTheme)).toBe('dark');

			systemTheme.set('light');
			expect(get(systemTheme)).toBe('light');
		});
	});

	describe('themeStore legacy export', () => {
		it('should be an alias for resolvedTheme', async () => {
			vi.mock('$app/environment', () => ({
				browser: false
			}));

			const { themeStore, resolvedTheme, themePreference } = await import(
				'../../src/lib/stores/theme'
			);

			themePreference.set('dark');

			// Both should return the same value
			expect(get(themeStore)).toBe(get(resolvedTheme));
			expect(get(themeStore)).toBe('dark');
		});
	});
});
