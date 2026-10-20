<!-- Toaster — put one in the root layout. Shows every toast raised with `toast.*()`. -->
<script lang="ts">
	import { fly } from 'svelte/transition';
	import { toast } from './toast';
</script>

<div class="toaster" role="region" aria-label="Notifications">
	<ol aria-live="polite">
		{#each $toast as item (item.id)}
			<li class="toast toast--{item.tone}" transition:fly={{ y: 16, duration: 180 }}>
				<span>{item.message}</span>
				<button type="button" aria-label="Dismiss" on:click={() => toast.dismiss(item.id)}>×</button
				>
			</li>
		{/each}
	</ol>
</div>

<style>
	.toaster ol {
		position: fixed;
		right: var(--spacing-md);
		bottom: var(--spacing-md);
		z-index: 1000;
		display: grid;
		gap: var(--spacing-sm);
		width: min(24rem, calc(100vw - 2 * var(--spacing-md)));
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.toast {
		--tone: var(--color-primary);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-md);
		padding: var(--spacing-sm) var(--spacing-sm) var(--spacing-sm) var(--spacing-md);
		border: 1px solid var(--color-border);
		border-left: 4px solid var(--tone);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		box-shadow: var(--shadow-lg);
	}

	.toast--success {
		--tone: var(--color-success);
	}

	.toast--warning {
		--tone: var(--color-warning);
	}

	.toast--danger {
		--tone: var(--color-danger);
	}

	.toast button {
		padding: 0.25rem 0.5rem;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text-secondary);
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
	}

	.toast button:hover {
		background: var(--color-surface-hover);
		color: var(--color-text);
	}
</style>
