/**
 * Contrast Checker Utility
 * Validates WCAG AA/AAA contrast ratios for theme colors
 */

export interface RGB {
	r: number;
	g: number;
	b: number;
}

export interface ContrastResult {
	ratio: number;
	passesAA: boolean;
	passesAAA: boolean;
	passesAALarge: boolean;
	warnings: string[];
}

export interface ThemeColors {
	background: string;
	text: string;
	primary: string;
	surface: string;
	textSecondary: string;
	border: string;
}

export interface ThemeContrastCheck {
	pair: string;
	foreground: string;
	background: string;
	ratio: number;
	passes: boolean;
	message?: string;
}

export interface ThemeContrastResult {
	themeName: string;
	isValid: boolean;
	checks: ThemeContrastCheck[];
	failedChecks: ThemeContrastCheck[];
}

/**
 * Convert hex color to RGB object
 */
export function hexToRgb(hex: string): RGB {
	// Remove # if present
	hex = hex.replace(/^#/, '');

	// Validate hex format
	if (!/^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(hex)) {
		throw new Error(`Invalid hex color: #${hex}`);
	}

	// Expand 3-digit hex to 6-digit
	if (hex.length === 3) {
		hex = hex
			.split('')
			.map((char) => char + char)
			.join('');
	}

	const r = parseInt(hex.substring(0, 2), 16);
	const g = parseInt(hex.substring(2, 4), 16);
	const b = parseInt(hex.substring(4, 6), 16);

	return { r, g, b };
}

/**
 * Calculate relative luminance according to WCAG formula
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
export function getLuminance(rgb: RGB): number {
	// Convert RGB to sRGB
	const rsRGB = rgb.r / 255;
	const gsRGB = rgb.g / 255;
	const bsRGB = rgb.b / 255;

	// Apply gamma correction
	const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
	const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
	const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

	// Calculate luminance
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 * https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
 */
export function getContrastRatio(color1: string, color2: string): number {
	const rgb1 = hexToRgb(color1);
	const rgb2 = hexToRgb(color2);

	const lum1 = getLuminance(rgb1);
	const lum2 = getLuminance(rgb2);

	const lighter = Math.max(lum1, lum2);
	const darker = Math.min(lum1, lum2);

	return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG standards
 * - AA: 4.5:1 for normal text, 3:1 for large text
 * - AAA: 7:1 for normal text, 4.5:1 for large text
 */
export function checkContrast(foreground: string, background: string): ContrastResult {
	const ratio = getContrastRatio(foreground, background);
	const warnings: string[] = [];

	const passesAA = ratio >= 4.5;
	const passesAAA = ratio >= 7;
	const passesAALarge = ratio >= 3;

	if (!passesAA) {
		warnings.push(
			`Low contrast ratio: ${ratio.toFixed(2)}:1. WCAG AA requires 4.5:1 for normal text.`
		);
	}

	if (!passesAALarge && passesAALarge) {
		warnings.push(`Contrast ratio ${ratio.toFixed(2)}:1 only passes for large text (18pt+).`);
	}

	return {
		ratio,
		passesAA,
		passesAAA,
		passesAALarge,
		warnings
	};
}

/**
 * Validate all critical color combinations in a theme
 */
export function validateThemeContrast(theme: ThemeColors, themeName: string): ThemeContrastResult {
	const checks: ThemeContrastCheck[] = [];

	// Define critical color combinations to check
	// Note: Borders don't need text-level contrast (4.5:1), only 3:1 for UI components
	const combinations: Array<{
		pair: string;
		foreground: keyof ThemeColors;
		background: keyof ThemeColors;
	}> = [
		{ pair: 'text/background', foreground: 'text', background: 'background' },
		{
			pair: 'text-secondary/background',
			foreground: 'textSecondary',
			background: 'background'
		},
		{ pair: 'primary/background', foreground: 'primary', background: 'background' },
		{ pair: 'text/surface', foreground: 'text', background: 'surface' },
		{
			pair: 'text-secondary/surface',
			foreground: 'textSecondary',
			background: 'surface'
		}
	];

	for (const combo of combinations) {
		const foregroundColor = theme[combo.foreground];
		const backgroundColor = theme[combo.background];

		const result = checkContrast(foregroundColor, backgroundColor);

		const check: ThemeContrastCheck = {
			pair: combo.pair,
			foreground: foregroundColor,
			background: backgroundColor,
			ratio: result.ratio,
			passes: result.passesAA
		};

		if (!result.passesAA) {
			check.message = `${combo.pair}: Contrast ratio ${result.ratio.toFixed(2)}:1 is below WCAG AA minimum (4.5:1)`;
		}

		checks.push(check);
	}

	const failedChecks = checks.filter((check) => !check.passes);

	return {
		themeName,
		isValid: failedChecks.length === 0,
		checks,
		failedChecks
	};
}
