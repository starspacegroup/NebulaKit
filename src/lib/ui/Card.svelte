<!--
	Card — a surface with an optional header and footer. Give it an `href` and
	the whole card is one link.
-->
<script lang="ts">
	export let title: string | undefined = undefined;
	export let href: string | undefined = undefined;
	/** Heading level for the title, so a card fits the page's outline. */
	export let level: 2 | 3 | 4 = 3;
</script>

<svelte:element this={href ? 'a' : 'article'} {href} class="card" class:card--link={href}>
	{#if title || $$slots.header}
		<header class="card__header">
			{#if title}<svelte:element this={`h${level}`} class="card__title">{title}</svelte:element
				>{/if}
			<slot name="header" />
		</header>
	{/if}
	<div class="card__body"><slot /></div>
	{#if $$slots.footer}
		<footer class="card__footer"><slot name="footer" /></footer>
	{/if}
</svelte:element>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
		padding: var(--spacing-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-text);
		box-shadow: var(--shadow-sm);
	}

	.card--link {
		text-decoration: none;
		transition:
			border-color var(--transition-fast),
			transform var(--transition-fast);
	}

	.card--link:hover,
	.card--link:focus-visible {
		border-color: var(--color-primary);
		transform: translateY(-2px);
	}

	.card--link:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.card__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-sm);
	}

	.card__title {
		margin: 0;
		font-size: 1.125rem;
	}

	.card__body {
		color: var(--color-text-secondary);
	}

	.card__body :global(> :first-child) {
		margin-top: 0;
	}

	.card__body :global(> :last-child) {
		margin-bottom: 0;
	}

	.card__footer {
		display: flex;
		gap: var(--spacing-sm);
		padding-top: var(--spacing-md);
		border-top: 1px solid var(--color-border);
	}

	@media (prefers-reduced-motion: reduce) {
		.card--link:hover,
		.card--link:focus-visible {
			transform: none;
		}
	}
</style>
