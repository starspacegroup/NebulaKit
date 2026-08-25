/**
 * Theme Contrast Validation Script
 * Validates that all theme colors meet WCAG AA standards
 * Run via: bun run validate:contrast
 */

const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { validateThemeContrast } = require('../src/lib/utils/contrast.ts');

const css = readFileSync(join(__dirname, '../src/app.css'), 'utf8');

function readTheme(selector, blockPattern) {
	const block = css.match(blockPattern)?.[1];
	if (!block) throw new Error(`Could not find ${selector} theme variables in src/app.css`);

	const variables = Object.fromEntries(
		[...block.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;/g)].map((match) => [
			match[1],
			match[2]
		])
	);
	const names = {
		background: 'color-background',
		text: 'color-text',
		primary: 'color-primary',
		surface: 'color-surface',
		textSecondary: 'color-text-secondary',
		border: 'color-border'
	};

	return Object.fromEntries(
		Object.entries(names).map(([name, variable]) => {
			const value = variables[variable];
			if (!value) throw new Error(`Missing --${variable} in the ${selector} theme`);
			return [name, value];
		})
	);
}

const themes = {
	light: readTheme(':root', /:root\s*\{([\s\S]*?)\n\}/),
	dark: readTheme("[data-theme='dark']", /\[data-theme=['"]dark['"]\]\s*\{([\s\S]*?)\n\}/)
};

let hasErrors = false;

console.log('🎨 Validating theme contrast ratios...\n');

for (const [themeName, themeColors] of Object.entries(themes)) {
	console.log(`\n📋 ${themeName.toUpperCase()} THEME:`);
	console.log('─'.repeat(50));

	const result = validateThemeContrast(themeColors, themeName);

	result.checks.forEach((check) => {
		const icon = check.passes ? '✓' : '✗';
		const status = check.passes ? 'PASS' : 'FAIL';
		const color = check.passes ? '\x1b[32m' : '\x1b[31m';
		const reset = '\x1b[0m';

		console.log(
			`  ${color}${icon} ${status}${reset} ${check.pair.padEnd(25)} ${check.ratio.toFixed(2)}:1`
		);

		if (!check.passes) {
			console.log(`         ${check.message}`);
		}
	});

	if (result.isValid) {
		console.log(`\n  ✅ ${themeName} theme passes WCAG AA standards`);
	} else {
		console.log(`\n  ❌ ${themeName} theme has ${result.failedChecks.length} contrast issue(s)`);
		hasErrors = true;
	}
}

console.log('\n' + '─'.repeat(50));

if (hasErrors) {
	console.error('\n❌ Theme contrast validation FAILED. Please fix the issues above.\n');
	console.error('💡 Tips:');
	console.error('  - Text colors need 4.5:1 contrast ratio (WCAG AA)');
	console.error('  - Large text (18pt+) needs 3:1 contrast ratio');
	console.error('  - Use darker colors for better accessibility');
	console.error('  - Test your colors at https://contrast-ratio.com\n');
	process.exit(1);
} else {
	console.log('\n✅ All themes meet WCAG AA contrast standards!\n');
	process.exit(0);
}
