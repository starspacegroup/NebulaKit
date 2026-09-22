import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import BuiltWithNebulaKit from './BuiltWithNebulaKit.svelte';

/**
 * The badge ships switched on, so it lands in every app generated from this
 * template. That makes two things worth pinning: that it says and links what
 * the badge page promises, and that it costs the host app nothing — no request,
 * no asset, no id that could collide with the app's own artwork.
 */
describe('BuiltWithNebulaKit', () => {
	it('reads "Proudly built with NebulaKit" by default', () => {
		render(BuiltWithNebulaKit);
		const badge = screen.getByRole('link', { name: /proudly built with nebulakit/i });
		expect(badge).toBeInTheDocument();
	});

	it('links to the badge home in a new tab', () => {
		render(BuiltWithNebulaKit);
		const badge = screen.getByRole('link', { name: /nebulakit/i });
		expect(badge).toHaveAttribute('href', 'https://nebulakit.starspace.group');
		expect(badge).toHaveAttribute('target', '_blank');
		expect(badge).toHaveAttribute('rel', 'noopener noreferrer');
	});

	it('offers the other two wordings', () => {
		render(BuiltWithNebulaKit, { props: { variant: 'built' } });
		expect(screen.getByRole('link', { name: /^built with nebulakit$/i })).toBeInTheDocument();
	});

	it('renders the "powered by" wording', () => {
		render(BuiltWithNebulaKit, { props: { variant: 'powered' } });
		expect(screen.getByRole('link', { name: /^powered by nebulakit$/i })).toBeInTheDocument();
	});

	it('spells the brand the way the brand notes require', () => {
		render(BuiltWithNebulaKit);
		const brand = document.querySelector('.nebulakit-badge b');
		expect(brand).toHaveTextContent('NebulaKit');
	});

	it('draws the mark inline rather than fetching one', () => {
		// A footer should not depend on a third-party request, and an <img> here
		// would break the moment the badge endpoint moved.
		render(BuiltWithNebulaKit);
		expect(document.querySelector('.nebulakit-badge svg')).toBeInTheDocument();
		expect(document.querySelector('.nebulakit-badge img')).toBeNull();
	});

	it('hides the mark from screen readers, since the words are beside it', () => {
		render(BuiltWithNebulaKit);
		expect(document.querySelector('.nebulakit-badge svg')).toHaveAttribute('aria-hidden', 'true');
	});

	it('uses no id, so two badges on a page cannot collide', () => {
		// This is why the mark is a flat simplification of favicon.svg rather than
		// the favicon itself: its gradient and glow filter both need ids.
		render(BuiltWithNebulaKit);
		const svg = document.querySelector('.nebulakit-badge svg');
		expect(svg?.querySelector('[id]')).toBeNull();
		expect(svg?.getAttribute('id')).toBeNull();
	});
});
