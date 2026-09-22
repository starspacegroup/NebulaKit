<script lang="ts">
	/**
	 * The "Proudly built with NebulaKit" badge.
	 *
	 * Wording, link, geometry and the mark come from the badge module on
	 * nebulakit.starspace.group, which also serves the same badge as an image, a
	 * web component and four framework snippets. This is the Svelte form, checked
	 * into the template so an app generated from it wears the badge without
	 * anyone visiting a page to fetch a snippet.
	 *
	 * Two deliberate departures from the published snippet:
	 *
	 * - Colours use this app's theme tokens instead of the snippet's literal hex.
	 *   Those literals exist so the badge survives on a site that never loaded our
	 *   stylesheet; this one did, and tokens mean the badge follows the theme
	 *   switch in both directions rather than only `prefers-color-scheme`.
	 * - The mark is drawn inline rather than fetched from the badge endpoint. A
	 *   footer should not depend on a third-party request, and the markup is
	 *   smaller than the request would be.
	 *
	 * It is never required. NebulaKit is MIT-licensed; set
	 * `showBuiltWithBadge: false` in `src/lib/site.config.ts` and the footer drops
	 * it. See CUSTOMIZE.md.
	 */

	/** Which wording to show. Matches the variants the badge page offers. */
	export let variant: 'proudly' | 'built' | 'powered' = 'proudly';

	const LABELS = {
		proudly: 'Proudly built with',
		built: 'Built with',
		powered: 'Powered by'
	} as const;

	const HREF = 'https://nebulakit.starspace.group';
</script>

<a class="nebulakit-badge" href={HREF} target="_blank" rel="noopener noreferrer">
	<!-- A simplification of static/favicon.svg: flat fills, thicker strokes and
	     no filter, because the glow and the background stars turn to mud at 16px.
	     No `id` anywhere, so two of these on one page cannot collide. -->
	<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
		<rect width="24" height="24" rx="6" fill="#12142a" />
		<g fill="none" stroke-width="1.4">
			<ellipse cx="12" cy="12" rx="9" ry="3.2" stroke="#7c3aed" transform="rotate(-20 12 12)" />
			<ellipse
				cx="12"
				cy="12"
				rx="7.6"
				ry="2.7"
				stroke="#06b6d4"
				stroke-width="1.1"
				opacity="0.8"
				transform="rotate(22 12 12)"
			/>
		</g>
		<circle cx="12" cy="12" r="3.1" fill="#a855f7" />
		<circle cx="12" cy="12" r="1.7" fill="#e9d5ff" />
	</svg>
	<span>{LABELS[variant]}</span>
	<b>NebulaKit</b>
</a>

<style>
	.nebulakit-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		width: fit-content;
		padding: 0.4rem 0.75rem;
		background-color: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: 999px;
		color: var(--color-text-secondary);
		font-size: 0.75rem;
		font-weight: 500;
		line-height: 1;
		text-decoration: none;
		transition: border-color var(--transition-fast);
	}

	.nebulakit-badge:hover {
		border-color: var(--color-primary);
	}

	.nebulakit-badge svg {
		flex: none;
	}

	.nebulakit-badge span {
		font-size: 0.656rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.nebulakit-badge b {
		font-weight: 600;
		color: var(--color-text);
	}
</style>
