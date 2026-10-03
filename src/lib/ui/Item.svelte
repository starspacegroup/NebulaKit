<!--
	Item — one row of a list: something to look at (an avatar or icon), a
	title and description, a bit of meta on the side, and actions. With an
	href the title is the link and its hit area stretches over the whole row,
	while the actions stay their own buttons — a link never wraps a button.

	<Item title="Ada Lovelace" description="Analyst" href="/people/ada">
		<Avatar slot="media" name="Ada Lovelace" size="sm" />
		<Button slot="actions" size="sm" variant="ghost">Message</Button>
	</Item>
-->
<script lang="ts">
	export let title = '';
	export let description = '';
	/** Short text on the trailing side: a time, a count, a status. */
	export let meta = '';
	export let href: string | undefined = undefined;
	export let variant: 'default' | 'outline' | 'muted' = 'default';
	export let size: 'sm' | 'md' | 'lg' = 'md';
</script>

<div class="item item--{variant} item--{size}" class:item--link={!!href}>
	{#if $$slots.media}
		<div class="item__media"><slot name="media" /></div>
	{/if}
	<div class="item__body">
		{#if title || $$slots.title}
			<p class="item__title">
				{#if href}
					<a {href} class="item__link"><slot name="title">{title}</slot></a>
				{:else}
					<slot name="title">{title}</slot>
				{/if}
			</p>
		{/if}
		{#if description || $$slots.description}
			<p class="item__description"><slot name="description">{description}</slot></p>
		{/if}
		<slot />
	</div>
	{#if meta || $$slots.meta}
		<div class="item__meta"><slot name="meta">{meta}</slot></div>
	{/if}
	{#if $$slots.actions}
		<div class="item__actions"><slot name="actions" /></div>
	{/if}
</div>

<style>
	.item {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		min-width: 0;
		padding: var(--spacing-sm) var(--spacing-md);
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		color: var(--color-text);
		transition: background var(--transition-fast);
	}

	.item--outline {
		border-color: var(--color-border);
	}

	.item--muted {
		background: var(--color-surface);
	}

	.item--sm {
		gap: var(--spacing-sm);
		padding: var(--spacing-xs) var(--spacing-sm);
		font-size: 0.875rem;
	}

	.item--lg {
		padding: var(--spacing-md) var(--spacing-lg);
	}

	.item--link:hover {
		background: var(--color-surface-hover);
	}

	.item--link:focus-within {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.item__media {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		color: var(--color-text-secondary);
	}

	.item__body {
		display: grid;
		flex: 1;
		gap: 2px;
		min-width: 0;
	}

	.item__title,
	.item__description {
		margin: 0;
		overflow-wrap: anywhere;
	}

	.item__title {
		font-weight: 600;
		line-height: 1.35;
	}

	.item--lg .item__title {
		font-size: 1.0625rem;
	}

	.item__description {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		line-height: 1.45;
	}

	.item--sm .item__description {
		font-size: 0.8125rem;
	}

	.item__link {
		color: inherit;
		text-decoration: none;
	}

	/* The link's hit area covers the row; the actions sit above it. */
	.item__link::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
	}

	.item__link:focus-visible {
		outline: none;
	}

	.item__meta {
		flex-shrink: 0;
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.item__actions {
		position: relative;
		z-index: 1;
		display: flex;
		flex-shrink: 0;
		gap: var(--spacing-xs);
	}

	@media (max-width: 30rem) {
		.item {
			flex-wrap: wrap;
		}

		.item__body {
			flex-basis: 10rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.item {
			transition: none;
		}
	}
</style>
