<!--
	Collapsible — one region shown and hidden by a trigger button (the APG
	disclosure pattern). The button carries aria-expanded and aria-controls;
	bind `open`. The height eases open and shut, and simply snaps when the
	reader asks for reduced motion. Closed content is out of the tab order.
	The trigger's text is `label`, or the `trigger` slot.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { uid } from './logic';

	export let open = false;
	export let label = '';
	export let disabled = false;

	const dispatch = createEventDispatcher<{ toggle: { open: boolean } }>();
	const id = uid('collapsible');

	function toggle() {
		open = !open;
		dispatch('toggle', { open });
	}
</script>

<div class="collapsible" class:collapsible--open={open}>
	<button
		type="button"
		class="collapsible__trigger"
		aria-expanded={open}
		aria-controls={id}
		{disabled}
		on:click={toggle}
	>
		<span class="collapsible__label"><slot name="trigger">{label}</slot></span>
		<span class="collapsible__chevron" aria-hidden="true">▾</span>
	</button>
	<div class="collapsible__region" {id}>
		<div class="collapsible__inner">
			<div class="collapsible__content"><slot /></div>
		</div>
	</div>
</div>

<style>
	.collapsible {
		min-width: 0;
	}

	.collapsible__trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-md);
		width: 100%;
		padding: var(--spacing-sm) var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		font-weight: 600;
		text-align: left;
		cursor: pointer;
	}

	.collapsible__trigger:hover:not(:disabled) {
		background: var(--color-surface-hover);
	}

	.collapsible__trigger:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.collapsible__trigger:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.collapsible__chevron {
		color: var(--color-text-secondary);
		transition: transform var(--transition-base);
	}

	.collapsible--open .collapsible__chevron {
		transform: rotate(180deg);
	}

	/* Grid rows ease from 0fr to 1fr, so the height animates to the content's
	   real size with no measuring. Visibility interpolates as visible for the
	   whole transition, so it shows at once on open and hides only when the
	   close has finished — and hidden takes the content out of the tab order
	   and the accessibility tree. */
	.collapsible__region {
		display: grid;
		grid-template-rows: 0fr;
		visibility: hidden;
		transition:
			grid-template-rows var(--transition-base),
			visibility var(--transition-base);
	}

	.collapsible--open .collapsible__region {
		grid-template-rows: 1fr;
		visibility: visible;
	}

	.collapsible__inner {
		min-height: 0;
		overflow: hidden;
	}

	.collapsible__content {
		padding: var(--spacing-sm) var(--spacing-md);
		color: var(--color-text);
	}

	@media (prefers-reduced-motion: reduce) {
		.collapsible__region,
		.collapsible--open .collapsible__region,
		.collapsible__chevron {
			transition: none;
		}
	}
</style>
