<!--
	Pagination — page numbers with gaps, previous and next. Bind `page`, or
	pass `href` to make real links (`href={(p) => `?page=${p}`}`) so it works
	without script and can be crawled.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { pageRange } from './logic';

	export let page = 1;
	export let total = 1;
	export let siblings = 1;
	export let href: ((page: number) => string) | undefined = undefined;
	export let label = 'Pagination';

	const dispatch = createEventDispatcher<{ change: { page: number } }>();

	$: items = pageRange(page, total, siblings);

	function go(event: Event, to: number) {
		if (to < 1 || to > total || to === page) return;
		if (!href) event.preventDefault();
		page = to;
		dispatch('change', { page: to });
	}

	// Without an href these are role="button", so Enter has to work as a click does.
	function key(event: KeyboardEvent, to: number) {
		if (event.key === 'Enter' && !href) go(event, to);
	}
</script>

{#if total > 1}
	<nav aria-label={label} class="pager">
		<ul>
			<li>
				<a
					href={href && page > 1 ? href(page - 1) : undefined}
					role={href ? undefined : 'button'}
					tabindex={page > 1 ? 0 : -1}
					aria-disabled={page <= 1 || undefined}
					on:click={(e) => go(e, page - 1)}
					on:keydown={(e) => key(e, page - 1)}
				>
					<span aria-hidden="true">‹</span> Previous
				</a>
			</li>
			{#each items as item, i (i)}
				<li>
					{#if item === 'gap'}
						<span class="pager__gap" aria-hidden="true">…</span>
					{:else}
						<a
							href={href ? href(item) : undefined}
							role={href ? undefined : 'button'}
							tabindex="0"
							aria-label="Page {item}"
							aria-current={item === page ? 'page' : undefined}
							on:click={(e) => go(e, item)}
							on:keydown={(e) => key(e, item)}
						>
							{item}
						</a>
					{/if}
				</li>
			{/each}
			<li>
				<a
					href={href && page < total ? href(page + 1) : undefined}
					role={href ? undefined : 'button'}
					tabindex={page < total ? 0 : -1}
					aria-disabled={page >= total || undefined}
					on:click={(e) => go(e, page + 1)}
					on:keydown={(e) => key(e, page + 1)}
				>
					Next <span aria-hidden="true">›</span>
				</a>
			</li>
		</ul>
	</nav>
{/if}

<style>
	ul {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-xs);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	a {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		min-width: 2.5rem;
		height: 2.5rem;
		padding: 0 0.625rem;
		box-sizing: border-box;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font-variant-numeric: tabular-nums;
		text-decoration: none;
		cursor: pointer;
	}

	a:hover:not([aria-disabled='true']):not([aria-current='page']) {
		background: var(--color-surface-hover);
	}

	a:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	a[aria-current='page'] {
		border-color: var(--color-primary-solid);
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
		font-weight: 700;
	}

	a[aria-disabled='true'] {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.pager__gap {
		padding: 0 0.25rem;
		color: var(--color-text-secondary);
	}
</style>
