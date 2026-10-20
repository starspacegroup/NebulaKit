<!--
	Alert — a message that belongs in the page. `danger` and `warning` are
	announced as alerts; `info` and `success` as status, so a screen reader is
	not interrupted for good news.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let tone: 'info' | 'success' | 'warning' | 'danger' = 'info';
	export let title = '';
	export let dismissible = false;

	const dispatch = createEventDispatcher<{ dismiss: void }>();
	let open = true;

	const icons = { info: 'i', success: '✓', warning: '!', danger: '×' };

	function dismiss() {
		open = false;
		dispatch('dismiss');
	}
</script>

{#if open}
	<div
		class="alert alert--{tone}"
		role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
	>
		<span class="alert__icon" aria-hidden="true">{icons[tone]}</span>
		<div class="alert__body">
			{#if title}<p class="alert__title">{title}</p>{/if}
			<div class="alert__text"><slot /></div>
		</div>
		{#if dismissible}
			<button type="button" class="alert__close" aria-label="Dismiss" on:click={dismiss}>×</button>
		{/if}
	</div>
{/if}

<style>
	.alert {
		--tone: var(--color-primary);
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-md);
		padding: var(--spacing-md);
		border: 1px solid color-mix(in srgb, var(--tone) 40%, transparent);
		border-left: 4px solid var(--tone);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--tone) 8%, var(--color-background));
		color: var(--color-text);
	}

	.alert--success {
		--tone: var(--color-success);
	}

	.alert--warning {
		--tone: var(--color-warning);
	}

	.alert--danger {
		--tone: var(--color-danger);
	}

	.alert__icon {
		display: grid;
		flex-shrink: 0;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		background: var(--tone);
		color: var(--color-background);
		font-size: 0.875rem;
		font-weight: 800;
	}

	.alert__body {
		flex: 1;
		min-width: 0;
	}

	.alert__title {
		margin: 0 0 var(--spacing-xs);
		font-weight: 700;
	}

	.alert__text :global(p) {
		margin: 0;
	}

	.alert__close {
		padding: 0 0.375rem;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text-secondary);
		font-size: 1.25rem;
		line-height: 1.2;
		cursor: pointer;
	}

	.alert__close:hover {
		background: var(--color-surface-hover);
		color: var(--color-text);
	}
</style>
