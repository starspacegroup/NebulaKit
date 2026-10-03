<!--
	Accordion — built on <details>, so it opens with no script, works with
	find-in-page, and is announced correctly. `exclusive` lets only one item
	be open at a time (the native `name` attribute).
-->
<script lang="ts">
	import { uid } from './logic';

	export let items: { title: string; content?: string; open?: boolean }[] = [];
	export let exclusive = false;

	const group = uid('accordion');
</script>

<div class="accordion">
	{#each items as item, i (i)}
		<details name={exclusive ? group : undefined} open={item.open}>
			<summary>{item.title}</summary>
			<div class="accordion__content">
				<slot {item} index={i}>{item.content ?? ''}</slot>
			</div>
		</details>
	{/each}
</div>

<style>
	.accordion {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}

	details + details {
		border-top: 1px solid var(--color-border);
	}

	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-md);
		padding: var(--spacing-md);
		background: var(--color-surface);
		color: var(--color-text);
		font-weight: 600;
		list-style: none;
		cursor: pointer;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary::after {
		content: '+';
		font-size: 1.25rem;
		line-height: 1;
		color: var(--color-text-secondary);
	}

	details[open] summary::after {
		content: '−';
	}

	summary:hover {
		background: var(--color-surface-hover);
	}

	summary:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.accordion__content {
		padding: var(--spacing-md);
		color: var(--color-text-secondary);
	}
</style>
