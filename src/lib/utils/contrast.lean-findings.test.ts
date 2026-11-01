/**
 * Regression tests for contrast violations proved in ../../../../proofs (Lean,
 * `Proofs/Themes.lean`). Each pair below is PROVED to miss 3:1 under the exact
 * WCAG formula. They are `it.fails` so the suite stays green until a colour is
 * chosen; when someone fixes a token, its test flips and must become `it`.
 * Not fixed here: every one is a visual/design decision, not an obvious fix.
 */
import { describe, it, expect } from 'vitest';
import { getContrastRatio } from './contrast';

describe('Lean-proved contrast violations (non-text, WCAG 1.4.11, 3:1)', () => {
	// Light --color-border #dee2e6 on --color-background #ffffff: 1.30:1.
	it.fails('light border vs background meets 3:1', () => {
		expect(getContrastRatio('#dee2e6', '#ffffff')).toBeGreaterThanOrEqual(3);
	});
	// Dark --color-border #3a3a3a on --color-background #0a0a0a: 1.74:1.
	it.fails('dark border vs background meets 3:1', () => {
		expect(getContrastRatio('#3a3a3a', '#0a0a0a')).toBeGreaterThanOrEqual(3);
	});
	// Dark --chart-content #b01e5c on --color-surface #1a1a1a: 2.64:1, although
	// app.css says the chart series were validated for contrast.
	it.fails('dark chart-content vs surface meets 3:1', () => {
		expect(getContrastRatio('#b01e5c', '#1a1a1a')).toBeGreaterThanOrEqual(3);
	});
});
