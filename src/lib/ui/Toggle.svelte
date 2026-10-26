<!--
	Toggle — a button that stays pressed or not (aria-pressed), like Bold in
	a toolbar. Bind `pressed`. For an icon-only toggle, pass `label` so it has
	a name; the slot is the visible content.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let pressed = false;
	export let size: 'sm' | 'md' = 'md';
	export let variant: 'default' | 'outline' = 'default';
	export let disabled = false;
	/** The accessible name, for a toggle whose content is only an icon. */
	export let label: string | undefined = undefined;

	const dispatch = createEventDispatcher<{ change: { pressed: boolean } }>();

	function toggle() {
		pressed = !pressed;
		dispatch('change', { pressed });
	}
</script>

<button
	type="button"
	class="toggle toggle--{size} toggle--{variant}"
	aria-pressed={pressed}
	aria-label={label}
	{disabled}
	on:click={toggle}
	{...$$restProps}
>
	<slot />
</button>

<style>
	.toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-xs);
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-text-secondary);
		font: inherit;
		font-weight: 600;
		line-height: 1;
		cursor: pointer;
		transition:
			background-color var(--transition-fast),
			color var(--transition-fast);
	}

	.toggle--md {
		min-width: 2.5rem;
		height: 2.5rem;
		padding: 0 var(--spacing-md);
	}

	.toggle--sm {
		min-width: 2rem;
		height: 2rem;
		padding: 0 var(--spacing-sm);
		font-size: 0.875rem;
	}

	.toggle--outline {
		border-color: var(--color-border);
	}

	.toggle:hover:not(:disabled) {
		background: var(--color-surface-hover);
		color: var(--color-text);
	}

	/* Pressed shows in the fill; the label keeps the text colour for contrast in both themes. */
	.toggle[aria-pressed='true'] {
		background: color-mix(in srgb, var(--color-primary) 18%, var(--color-surface));
		color: var(--color-text);
	}

	.toggle--outline[aria-pressed='true'] {
		border-color: var(--color-primary);
	}

	.toggle:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.toggle:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@media (prefers-reduced-motion: reduce) {
		.toggle {
			transition: none;
		}
	}
</style>
