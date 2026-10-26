<!-- Breadcrumbs — where this page sits. The last item is the current page and is not a link. -->
<script lang="ts">
	export let items: { label: string; href?: string }[] = [];
</script>

<nav aria-label="Breadcrumb" class="crumbs">
	<ol>
		{#each items as item, i (i)}
			<li>
				{#if i === items.length - 1 || !item.href}
					<span aria-current={i === items.length - 1 ? 'page' : undefined}>{item.label}</span>
				{:else}
					<a href={item.href}>{item.label}</a>
				{/if}
			</li>
		{/each}
	</ol>
</nav>

<style>
	ol {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-xs);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.875rem;
	}

	li {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
		color: var(--color-text-secondary);
	}

	li + li::before {
		content: '/';
		color: var(--color-border);
	}

	a {
		color: var(--color-primary);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	[aria-current='page'] {
		color: var(--color-text);
		font-weight: 600;
	}
</style>
