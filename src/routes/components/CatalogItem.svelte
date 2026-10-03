<!-- One catalog entry: its name, what it is for, the live demo, and the code. -->
<script lang="ts">
	import { catalogEntry } from '$lib/ui/catalog';

	export let id: string;

	$: entry = catalogEntry(id);
</script>

<article class="item" id={entry.id} aria-labelledby="{entry.id}-name">
	<header>
		<h3 id="{entry.id}-name"><a href="#{entry.id}">{entry.name}</a></h3>
		<p>{entry.summary}</p>
	</header>
	<div class="demo"><slot /></div>
	<details>
		<summary>Code</summary>
		<pre><code>{entry.code}</code></pre>
	</details>
</article>

<style>
	/* Cards in one row share a height; the demo takes the slack, not the code toggle. */
	.item {
		display: grid;
		grid-template-rows: auto 1fr auto;
		gap: var(--spacing-md);
		min-width: 0;
		padding: var(--spacing-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-background);
		scroll-margin-top: 5rem;
	}

	h3 {
		margin: 0 0 var(--spacing-xs);
		font-size: 1.125rem;
	}

	h3 a {
		color: var(--color-text);
		text-decoration: none;
	}

	h3 a:hover {
		text-decoration: underline;
	}

	header p {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.9375rem;
	}

	.demo {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-md);
		min-width: 0;
		padding: var(--spacing-lg);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	.demo > :global(*) {
		max-width: 100%;
	}

	details {
		margin: 0;
		padding: 0;
		border: 0;
		background: none;
	}

	summary {
		width: max-content;
		padding: 0;
		background: none;
		color: var(--color-primary);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
	}

	pre {
		max-width: 100%;
		margin: var(--spacing-sm) 0 0;
		padding: var(--spacing-md);
		overflow-x: auto;
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 0.8125rem;
		line-height: 1.55;
	}
</style>
