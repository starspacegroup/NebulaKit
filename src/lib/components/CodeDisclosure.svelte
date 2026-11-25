<!--
	A "Code" disclosure for a usage sample: a native <details>, so it opens without script and keeps
	its own keyboard behaviour (Enter or Space on the summary). The summary is a 44px target with a
	chevron that turns when open; the sample inside is a CodeBlock.

	<CodeDisclosure name="Button" code={entry.code} />
-->
<script lang="ts">
	import CodeBlock from '$lib/ui/CodeBlock.svelte';

	/** What the sample shows, for the scrolling region's accessible name ("Button code"). */
	export let name: string;
	export let code: string;
	export let language = 'svelte';
</script>

<details class="disclosure">
	<summary>
		<svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
			<path d="m6 3.5 4.5 4.5L6 12.5" />
		</svg>
		<span>Code</span>
	</summary>
	<div class="disclosure__body">
		<CodeBlock {code} {language} label="{name} code" />
	</div>
</details>

<style>
	.disclosure {
		min-width: 0;
	}

	summary {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-sm);
		min-width: 5.5rem;
		min-height: 2.75rem;
		padding: 0 var(--spacing-md) 0 var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		list-style: none;
		user-select: none;
		transition:
			background var(--transition-fast),
			border-color var(--transition-fast);
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary:hover {
		background: var(--color-surface-hover);
	}

	summary:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	summary svg {
		flex: none;
		stroke: currentColor;
		stroke-width: 1.75;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition: transform var(--transition-fast);
	}

	details[open] > summary svg {
		transform: rotate(90deg);
	}

	.disclosure__body {
		min-width: 0;
		margin-top: var(--spacing-sm);
	}

	@media (prefers-reduced-motion: reduce) {
		summary,
		summary svg {
			transition: none;
		}
	}
</style>
