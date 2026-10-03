<!--
	Button — or a link that looks like one, when given an `href`.

	`loading` keeps the button's width, shows a spinner, sets aria-busy and
	blocks clicks; it does not disable the button, so focus is not lost while
	the work runs.
-->
<script lang="ts">
	export let variant: 'primary' | 'secondary' | 'ghost' | 'danger' = 'primary';
	export let size: 'sm' | 'md' | 'lg' = 'md';
	export let type: 'button' | 'submit' | 'reset' = 'button';
	export let href: string | undefined = undefined;
	export let disabled = false;
	export let loading = false;
	/** Stretch to the width of the container. */
	export let block = false;

	function guard(event: MouseEvent) {
		if (loading) {
			event.preventDefault();
			event.stopImmediatePropagation();
		}
	}
</script>

{#if href && !disabled}
	<a
		{href}
		class="btn btn--{variant} btn--{size}"
		class:btn--block={block}
		aria-busy={loading || undefined}
		on:click={guard}
		on:click
		{...$$restProps}
	>
		{#if loading}<span class="btn__spinner" aria-hidden="true"></span>{/if}
		<slot />
	</a>
{:else}
	<button
		{type}
		{disabled}
		class="btn btn--{variant} btn--{size}"
		class:btn--block={block}
		aria-busy={loading || undefined}
		on:click={guard}
		on:click
		{...$$restProps}
	>
		{#if loading}<span class="btn__spinner" aria-hidden="true"></span>{/if}
		<slot />
	</button>
{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-sm);
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		font: inherit;
		font-weight: 600;
		line-height: 1.2;
		text-decoration: none;
		cursor: pointer;
		transition:
			background-color var(--transition-fast),
			border-color var(--transition-fast),
			color var(--transition-fast);
	}

	.btn:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.btn[aria-busy='true'] {
		cursor: progress;
	}

	.btn--sm {
		padding: 0.375rem 0.75rem;
		font-size: 0.875rem;
	}

	.btn--md {
		padding: 0.625rem 1.125rem;
		font-size: 1rem;
	}

	.btn--lg {
		padding: 0.875rem 1.5rem;
		font-size: 1.125rem;
	}

	.btn--block {
		display: flex;
		width: 100%;
	}

	.btn--primary {
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
	}

	.btn--primary:hover:not(:disabled) {
		background: var(--color-primary-solid-hover);
	}

	.btn--secondary {
		background: var(--color-surface);
		border-color: var(--color-border);
		color: var(--color-text);
	}

	.btn--secondary:hover:not(:disabled) {
		background: var(--color-surface-hover);
	}

	.btn--ghost {
		background: transparent;
		color: var(--color-primary);
	}

	.btn--ghost:hover:not(:disabled) {
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
	}

	.btn--danger {
		background: var(--color-danger-solid);
		color: var(--color-on-solid);
	}

	.btn--danger:hover:not(:disabled) {
		background: var(--color-danger-solid-hover);
	}

	.btn__spinner {
		width: 1em;
		height: 1em;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: btn-spin 0.7s linear infinite;
	}

	@keyframes btn-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.btn__spinner {
			animation-duration: 2s;
		}
	}
</style>
