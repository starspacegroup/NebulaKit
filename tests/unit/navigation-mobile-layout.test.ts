import { describe, expect, it } from 'vitest';
import NavigationSource from '../../src/lib/components/Navigation.svelte?raw';

describe('Navigation mobile layout styles', () => {
	it('keeps the mobile menu button aligned to the right edge of the navbar', () => {
		expect(NavigationSource).toMatch(/\.mobile-menu-btn\s*\{[\s\S]*?margin-left:\s*auto;/);
	});

	it('renders the mobile menu as a full-screen fixed overlay with centered scrollable content', () => {
		expect(NavigationSource).toMatch(
			/\.nav-links\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?inset:\s*0;[\s\S]*?width:\s*100vw;[\s\S]*?min-height:\s*100dvh;[\s\S]*?overflow-y:\s*auto;[\s\S]*?justify-content:\s*center;/
		);
	});

	it('keeps a dedicated mobile menu header so the logo remains visible at the top', () => {
		expect(NavigationSource).toContain('class="mobile-menu-header"');
		expect(NavigationSource).toMatch(
			/\.mobile-menu-header\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?top:\s*0;/
		);
	});

	it('locks body scroll while the mobile menu is open and restores the prior overflow state', () => {
		expect(NavigationSource).toContain("document.body.style.overflow = 'hidden'");
		expect(NavigationSource).toContain('document.body.style.overflow = previousBodyOverflow');
	});

	it('raises the navbar stacking order while the mobile menu is open', () => {
		expect(NavigationSource).toContain('class:menu-open={mobileMenuOpen}');
		expect(NavigationSource).toMatch(/\.nav\.menu-open\s*\{[\s\S]*?z-index:\s*200;/);
	});

	it('keeps a dedicated desktop brand slot so the site title does not collapse', () => {
		expect(NavigationSource).toMatch(/\.logo\s*\{[\s\S]*?white-space:\s*nowrap;/);
		expect(NavigationSource).toMatch(
			/\.nav-content\s*\{[\s\S]*?display:\s*flex;[\s\S]*?justify-content:\s*space-between;/
		);
		expect(NavigationSource).toMatch(
			/@media \(min-width:\s*768px\)\s*\{[\s\S]*?\.logo\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?left:\s*0;[\s\S]*?top:\s*50%;/
		);
	});

	it('anchors desktop header controls inside the nav bar', () => {
		expect(NavigationSource).toMatch(/\.nav-content\s*\{[\s\S]*?position:\s*relative;/);
		expect(NavigationSource).toMatch(
			/@media \(min-width:\s*768px\)\s*\{[\s\S]*?\.nav-actions\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?left:\s*50%;[\s\S]*?top:\s*50%;[\s\S]*?transform:\s*translate\(-50%,\s*-50%\);/
		);
		expect(NavigationSource).toMatch(
			/@media \(min-width:\s*768px\)\s*\{[\s\S]*?\.nav-links\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?right:\s*0;[\s\S]*?top:\s*50%;[\s\S]*?transform:\s*translateY\(-50%\);/
		);
	});

	it('resets the mobile menu wrapper sizing on desktop so controls stay inside the navbar', () => {
		expect(NavigationSource).toMatch(
			/@media \(min-width:\s*768px\)\s*\{[\s\S]*?\.mobile-menu-content\s*\{[\s\S]*?display:\s*block;[\s\S]*?flex:\s*none;[\s\S]*?min-height:\s*auto;/
		);
	});
});
