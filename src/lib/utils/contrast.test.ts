import { describe, expect, it } from 'vitest';
import {
	checkContrast,
	getContrastRatio,
	getLuminance,
	hexToRgb,
	validateThemeContrast,
	type ThemeColors
} from './contrast';

describe('Contrast Checker Utility', () => {
	describe('hexToRgb', () => {
		it('should convert 6-digit hex to RGB', () => {
			expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
			expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
			expect(hexToRgb('#0066cc')).toEqual({ r: 0, g: 102, b: 204 });
		});

		it('should handle hex without # prefix', () => {
			expect(hexToRgb('ffffff')).toEqual({ r: 255, g: 255, b: 255 });
			expect(hexToRgb('0066cc')).toEqual({ r: 0, g: 102, b: 204 });
		});

		it('should convert 3-digit hex to RGB', () => {
			expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
			expect(hexToRgb('#000')).toEqual({ r: 0, g: 0, b: 0 });
			expect(hexToRgb('#06c')).toEqual({ r: 0, g: 102, b: 204 });
		});

		it('should throw error for invalid hex', () => {
			expect(() => hexToRgb('invalid')).toThrow();
			expect(() => hexToRgb('#gggggg')).toThrow();
			expect(() => hexToRgb('#12')).toThrow();
		});
	});

	describe('getLuminance', () => {
		it('should calculate luminance for white', () => {
			const luminance = getLuminance({ r: 255, g: 255, b: 255 });
			expect(luminance).toBeCloseTo(1, 2);
		});

		it('should calculate luminance for black', () => {
			const luminance = getLuminance({ r: 0, g: 0, b: 0 });
			expect(luminance).toBe(0);
		});

		it('should calculate luminance for gray', () => {
			const luminance = getLuminance({ r: 128, g: 128, b: 128 });
			expect(luminance).toBeGreaterThan(0);
			expect(luminance).toBeLessThan(1);
		});

		it('should calculate luminance for primary blue (#0066cc)', () => {
			const luminance = getLuminance({ r: 0, g: 102, b: 204 });
			expect(luminance).toBeGreaterThan(0);
			expect(luminance).toBeLessThan(0.5);
		});
	});

	describe('getContrastRatio', () => {
		it('should return 21:1 for black on white', () => {
			const ratio = getContrastRatio('#000000', '#ffffff');
			expect(ratio).toBeCloseTo(21, 1);
		});

		it('should return 21:1 for white on black', () => {
			const ratio = getContrastRatio('#ffffff', '#000000');
			expect(ratio).toBeCloseTo(21, 1);
		});

		it('should return 1:1 for same colors', () => {
			const ratio = getContrastRatio('#ffffff', '#ffffff');
			expect(ratio).toBe(1);
		});

		it('should calculate ratio for common text/background combinations', () => {
			// Dark text on light background
			const ratio1 = getContrastRatio('#1a1a1a', '#ffffff');
			expect(ratio1).toBeGreaterThan(15);

			// Light text on dark background
			const ratio2 = getContrastRatio('#f8f9fa', '#0a0a0a');
			expect(ratio2).toBeGreaterThan(15);
		});
	});

	describe('checkContrast', () => {
		it('should pass AA normal text for high contrast (4.5:1+)', () => {
			const result = checkContrast('#000000', '#ffffff');
			expect(result.ratio).toBeCloseTo(21, 1);
			expect(result.passesAA).toBe(true);
			expect(result.passesAAA).toBe(true);
			expect(result.passesAALarge).toBe(true);
		});

		it('should fail AA normal text for low contrast', () => {
			const result = checkContrast('#888888', '#999999');
			expect(result.ratio).toBeLessThan(4.5);
			expect(result.passesAA).toBe(false);
		});

		it('should pass AA large text but fail AA normal for medium contrast', () => {
			// Use a lighter gray that gives contrast between 3-4.5
			const result = checkContrast('#888888', '#ffffff');
			expect(result.ratio).toBeGreaterThan(3);
			expect(result.ratio).toBeLessThan(4.5);
			expect(result.passesAA).toBe(false);
			expect(result.passesAALarge).toBe(true);
		});

		it('should return proper warning messages', () => {
			const failResult = checkContrast('#aaaaaa', '#bbbbbb');
			expect(failResult.warnings.length).toBeGreaterThan(0);
			expect(failResult.warnings[0]).toContain('contrast ratio');

			const passResult = checkContrast('#000000', '#ffffff');
			expect(passResult.warnings.length).toBe(0);
		});
	});

	describe('validateThemeContrast', () => {
		it('should validate light theme with good contrast', () => {
			const theme: ThemeColors = {
				background: '#ffffff',
				text: '#1a1a1a',
				primary: '#0066cc',
				surface: '#f8f9fa',
				textSecondary: '#5a6169', // Darker gray that passes AA on both white and surface
				border: '#dee2e6'
			};

			const result = validateThemeContrast(theme, 'light');
			expect(result.isValid).toBe(true);
			expect(result.failedChecks.length).toBe(0);
		});

		it('should validate dark theme with good contrast', () => {
			const theme: ThemeColors = {
				background: '#0a0a0a',
				text: '#f8f9fa',
				primary: '#3b82f6',
				surface: '#1a1a1a',
				textSecondary: '#adb5bd',
				border: '#3a3a3a'
			};

			const result = validateThemeContrast(theme, 'dark');
			expect(result.isValid).toBe(true);
			expect(result.failedChecks.length).toBe(0);
		});

		it('should detect contrast failures in theme', () => {
			const badTheme: ThemeColors = {
				background: '#ffffff',
				text: '#cccccc', // Too light on white
				primary: '#ffff00', // Yellow on white - bad contrast
				surface: '#f0f0f0',
				textSecondary: '#e0e0e0', // Very poor contrast
				border: '#fafafa'
			};

			const result = validateThemeContrast(badTheme, 'bad-light');
			expect(result.isValid).toBe(false);
			expect(result.failedChecks.length).toBeGreaterThan(0);
		});

		it('should return detailed failure information', () => {
			const badTheme: ThemeColors = {
				background: '#ffffff',
				text: '#dddddd',
				primary: '#0066cc',
				surface: '#f8f9fa',
				textSecondary: '#cccccc',
				border: '#dee2e6'
			};

			const result = validateThemeContrast(badTheme, 'test');
			const textFailure = result.failedChecks.find((check) => check.pair === 'text/background');

			expect(textFailure).toBeDefined();
			expect(textFailure?.ratio).toBeLessThan(4.5);
			expect(textFailure?.message?.toLowerCase()).toContain('contrast');
		});

		it('should validate all critical color combinations', () => {
			const theme: ThemeColors = {
				background: '#ffffff',
				text: '#1a1a1a',
				primary: '#0066cc',
				surface: '#f8f9fa',
				textSecondary: '#6c757d',
				border: '#dee2e6'
			};

			const result = validateThemeContrast(theme, 'light');

			// Should check at least: text/bg, secondary/bg, primary/bg, text/surface, secondary/surface
			expect(result.checks.length).toBeGreaterThanOrEqual(5);
		});
	});
});
