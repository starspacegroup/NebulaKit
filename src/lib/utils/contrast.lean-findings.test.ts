/**
 * Regression tests for contrast violations proved in ../../../../proofs (Lean,
 * `Proofs/Themes.lean`). The border pairs below are PROVED to miss 3:1 under the exact
 * WCAG formula. The borders are `it.fails` so the suite stays green until a colour
 * is chosen; when someone fixes a token, its test flips and must become `it`.
 * The chart colour is fixed and its test is a plain `it`.
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
	// Dark --chart-content was #b01e5c (2.64:1). Now #d6336c, 3.77:1 on --color-surface #1a1a1a.
	it('dark chart-content vs surface meets 3:1', () => {
		expect(getContrastRatio('#d6336c', '#1a1a1a')).toBeGreaterThanOrEqual(3);
	});
});
