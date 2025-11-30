/**
 * Theme Contrast Validation Script
 * Validates that all theme colors meet WCAG AA standards
 * Run via: npm run validate:contrast
 */

const { validateThemeContrast } = require('../src/lib/utils/contrast.ts');

// Define themes from app.css
const themes = {
  light: {
    background: '#ffffff',
    text: '#1a1a1a',
    primary: '#0066cc',
    surface: '#f8f9fa',
    textSecondary: '#5a6169',
    border: '#dee2e6',
  },
  dark: {
    background: '#0a0a0a',
    text: '#f8f9fa',
    primary: '#3b82f6',
    surface: '#1a1a1a',
    textSecondary: '#adb5bd',
    border: '#3a3a3a',
  },
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
  console.error(
    '\n❌ Theme contrast validation FAILED. Please fix the issues above.\n'
  );
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
