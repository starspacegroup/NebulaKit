<!-- One module entry: its name, what it is for, the live demo, its accessibility promise and the code. -->
<script lang="ts">
	import { moduleEntry } from '$lib/modules/catalog';

	export let id: string;

	$: entry = moduleEntry(id);
</script>

<article class="item" id={entry.id} aria-labelledby="{entry.id}-name">
	<header>
		<h3 id="{entry.id}-name"><a href="#{entry.id}">{entry.name}</a></h3>
		<p>{entry.summary}</p>
	</header>
	<div class="demo"><slot /></div>
	<p class="a11y"><strong>Accessibility.</strong> {entry.a11y}</p>
	<details>
		<summary>Code</summary>
		<pre><code>{entry.code}</code></pre>
	</details>
</article>

<style>
	.item {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
		padding: var(--spacing-md);
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

	header p,
	.a11y {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.demo {
		min-width: 0;
		padding: var(--spacing-sm);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	@media (min-width: 40rem) {
		.item {
			padding: var(--spacing-lg);
		}

		.demo {
			padding: var(--spacing-md);
		}
	}

	summary {
		cursor: pointer;
		font-size: 0.9rem;
	}

	pre {
		overflow-x: auto;
		margin: var(--spacing-sm) 0 0;
		padding: var(--spacing-md);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 0.8rem;
	}
</style>
