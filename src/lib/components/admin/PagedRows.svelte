<script lang="ts">
	import { paginate } from '$lib/utils/paginate';

	/**
	 * Paginates a long, already-loaded list widget: shows one `pageSize` page at
	 * a time with Prev/Next controls and an "N–M of T" indicator, so stats
	 * widgets (locations, referrers, pages, …) stay compact. Client-side only.
	 * The default slot receives the current page as `shown` — use
	 * `{#each shown as …}` inside it.
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let items: any[] = [];
	export let pageSize = 10;
	/** Plural noun for the range label, e.g. "pages", "countries". */
	export let noun = 'rows';

	let page = 0;
	$: p = paginate(items, page, pageSize);
</script>

<slot shown={p.shown} />

{#if p.total > pageSize}
	<div class="paged-nav">
		<button
			type="button"
			class="paged-btn"
			disabled={p.page === 0}
			on:click={() => (page = p.page - 1)}>← Prev</button
		>
		<span class="paged-label">{p.start}–{p.end} of {p.total} {noun}</span>
		<button
			type="button"
			class="paged-btn"
			disabled={p.page >= p.pageCount - 1}
			on:click={() => (page = p.page + 1)}>Next →</button
		>
	</div>
{/if}

<style>
	.paged-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-sm);
		margin-top: var(--spacing-sm);
		flex-wrap: wrap;
	}
	.paged-label {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		font-variant-numeric: tabular-nums;
	}
	.paged-btn {
		padding: 0.25rem 0.6rem;
		background: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		color: var(--color-link, var(--color-primary));
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
	}
	.paged-btn:hover:not(:disabled) {
		background: var(--color-surface-hover);
	}
	.paged-btn:disabled {
		opacity: 0.45;
		cursor: default;
		color: var(--color-text-secondary);
	}
</style>
