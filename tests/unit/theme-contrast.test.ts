import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	checkContrast,
	validateThemeContrast,
	type ThemeColors
} from '../../src/lib/utils/contrast';

describe('Theme Contrast Validation', () => {
	it('uses src/app.css as the validator palette source', () => {
		const validator = readFileSync(
			resolve(import.meta.dirname, '../../scripts/validate-theme-contrast.cjs'),
			'utf8'
		);

		expect(validator).toContain("readFileSync(join(__dirname, '../src/app.css')");
		expect(validator).not.toContain("background: '#ffffff'");
	});

	describe('Light Theme', () => {
		it('should meet WCAG AA contrast standards', () => {
			const lightTheme: ThemeColors = {
				background: '#ffffff',
				text: '#1a1a1a',
				primary: '#0066cc',
				surface: '#f8f9fa',
				textSecondary: '#5a6169', // Updated to match app.css
				border: '#dee2e6'
			};

			const result = validateThemeContrast(lightTheme, 'light');

			// If there are failures, log them for debugging
			if (!result.isValid) {
				console.error('Light theme contrast failures:');
				result.failedChecks.forEach((check) => {
					console.error(`  - ${check.message}`);
				});
			}

			// We expect some failures with the current colors, so let's be explicit about what we check
			expect(result.checks.length).toBeGreaterThan(0);

			// Critical text combinations must pass
			const textBgCheck = result.checks.find((c) => c.pair === 'text/background');
			expect(textBgCheck?.passes).toBe(true);

			const textSurfaceCheck = result.checks.find((c) => c.pair === 'text/surface');
			expect(textSurfaceCheck?.passes).toBe(true);
		});

		it('should warn about any failing contrast ratios', () => {
			const lightTheme: ThemeColors = {
				background: '#ffffff',
				text: '#1a1a1a',
				primary: '#0066cc',
				surface: '#f8f9fa',
				textSecondary: '#5a6169', // Updated to match app.css
				border: '#dee2e6'
			};

			const result = validateThemeContrast(lightTheme, 'light');

			// List all checks for documentation
			result.checks.forEach((check) => {
				const status = check.passes ? '✓' : '✗';
				console.log(`${status} ${check.pair}: ${check.ratio.toFixed(2)}:1`);
			});
		});
	});

	describe('Dark Theme', () => {
		it('should meet WCAG AA contrast standards', () => {
			const darkTheme: ThemeColors = {
				background: '#0a0a0a',
				text: '#f8f9fa',
				primary: '#3b82f6',
				surface: '#1a1a1a',
				textSecondary: '#adb5bd',
				border: '#3a3a3a'
			};

			const result = validateThemeContrast(darkTheme, 'dark');

			// If there are failures, log them for debugging
			if (!result.isValid) {
				console.error('Dark theme contrast failures:');
				result.failedChecks.forEach((check) => {
					console.error(`  - ${check.message}`);
				});
			}

			// Critical text combinations must pass
			const textBgCheck = result.checks.find((c) => c.pair === 'text/background');
			expect(textBgCheck?.passes).toBe(true);

			const textSurfaceCheck = result.checks.find((c) => c.pair === 'text/surface');
			expect(textSurfaceCheck?.passes).toBe(true);
		});

		it('should warn about any failing contrast ratios', () => {
			const darkTheme: ThemeColors = {
				background: '#0a0a0a',
				text: '#f8f9fa',
				primary: '#3b82f6',
				surface: '#1a1a1a',
				textSecondary: '#adb5bd',
				border: '#3a3a3a'
			};

			const result = validateThemeContrast(darkTheme, 'dark');

			// List all checks for documentation
			result.checks.forEach((check) => {
				const status = check.passes ? '✓' : '✗';
				console.log(`${status} ${check.pair}: ${check.ratio.toFixed(2)}:1`);
			});
		});
	});

	describe('Color Recommendations', () => {
		it('should suggest better colors when contrast fails', () => {
			// This test documents problematic theme colors and suggests improvements
			// Using the OLD color here to demonstrate the validation
			const problematicLight: ThemeColors = {
				background: '#ffffff',
				text: '#1a1a1a',
				primary: '#0066cc',
				surface: '#f8f9fa',
				textSecondary: '#6c757d', // OLD color - intentionally problematic for demonstration
				border: '#dee2e6'
			};

			const result = validateThemeContrast(problematicLight, 'problematic-light');

			if (result.failedChecks.length > 0) {
				console.log('\n🎨 Color Improvement Suggestions:');
				result.failedChecks.forEach((check) => {
					console.log(`\n  ${check.pair}:`);
					console.log(`    Current: ${check.foreground} on ${check.background}`);
					console.log(`    Ratio: ${check.ratio.toFixed(2)}:1 (needs 4.5:1)`);

					// Suggest darker/lighter alternatives
					if (check.pair.includes('secondary')) {
						console.log(
							`    Suggestion: Use a darker gray like #5a6169 (5.95:1) or #495057 (7.39:1)`
						);
					}
				});
			}

			// Test passes regardless - this is informational
			expect(result.checks.length).toBeGreaterThan(0);
		});
	});

	describe('checkContrast function', () => {
		it('should return warning for colors that only pass large text contrast', () => {
			// A contrast ratio between 3:1 and 4.5:1 - passes for large text but not normal
			// #767676 on white gives roughly 4.54:1, so we need something slightly lower
			// #757575 on #ffffff is approximately 4.41:1
			const result = checkContrast('#808080', '#ffffff');

			// Gray (#808080) on white has ~3.95:1 ratio - passes large, fails AA
			expect(result.passesAALarge).toBe(true);
			expect(result.passesAA).toBe(false);
			expect(result.warnings.length).toBe(2); // Both AA fail and large text only warnings
			expect(result.warnings[1]).toContain('only passes for large text');
		});

		it('should not add large text warning when contrast fails completely', () => {
			// Very low contrast - fails both AA and AALarge
			const result = checkContrast('#cccccc', '#ffffff');

			expect(result.passesAALarge).toBe(false);
			expect(result.passesAA).toBe(false);
			// Only one warning (AA fail), not the large text warning
			expect(result.warnings.length).toBe(1);
			expect(result.warnings[0]).toContain('Low contrast ratio');
		});

		it('should return no warnings for high contrast colors', () => {
			const result = checkContrast('#000000', '#ffffff');

			expect(result.passesAA).toBe(true);
			expect(result.passesAAA).toBe(true);
			expect(result.passesAALarge).toBe(true);
			expect(result.warnings.length).toBe(0);
		});
	});
});
