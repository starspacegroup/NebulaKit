import { describe, expect, it } from 'vitest';
import NavigationSource from '../../src/lib/components/Navigation.svelte?raw';

describe('Navigation mobile layout styles', () => {
	it('keeps the mobile menu button aligned to the right edge of the navbar', () => {
		expect(NavigationSource).toMatch(/\.mobile-menu-btn\s*\{[\s\S]*?justify-self:\s*end;/);
	});
});
