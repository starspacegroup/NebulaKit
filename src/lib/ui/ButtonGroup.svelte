<!--
	ButtonGroup — joins buttons into one control: shared borders, rounded only
	at the ends. A role="group" with a label, so a screen reader announces
	what the buttons are for. Works with the kit's Button and plain buttons.
-->
<script lang="ts">
	export let label: string;
	export let orientation: 'horizontal' | 'vertical' = 'horizontal';
</script>

<div class="button-group button-group--{orientation}" role="group" aria-label={label}>
	<slot />
</div>

<style>
	.button-group {
		display: inline-flex;
		max-width: 100%;
	}

	.button-group--vertical {
		flex-direction: column;
	}

	/* The focused button is lifted so its whole ring shows over its neighbours. */
	.button-group > :global(*) {
		position: relative;
	}

	.button-group > :global(*:hover),
	.button-group > :global(*:focus-visible) {
		z-index: 1;
	}

	.button-group > :global(button:not(.btn)) {
		padding: 0.5rem 0.875rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		cursor: pointer;
	}

	.button-group > :global(button:not(.btn):hover:not(:disabled)) {
		background: var(--color-surface-hover);
	}

	.button-group > :global(button:not(.btn):focus-visible) {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.button-group--horizontal > :global(*:not(:first-child)) {
		margin-left: -1px;
		border-top-left-radius: 0;
		border-bottom-left-radius: 0;
	}

	.button-group--horizontal > :global(*:not(:last-child)) {
		border-top-right-radius: 0;
		border-bottom-right-radius: 0;
	}

	.button-group--vertical > :global(*:not(:first-child)) {
		margin-top: -1px;
		border-top-left-radius: 0;
		border-top-right-radius: 0;
	}

	.button-group--vertical > :global(*:not(:last-child)) {
		border-bottom-left-radius: 0;
		border-bottom-right-radius: 0;
	}
</style>
