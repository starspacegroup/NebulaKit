<!--
	Checklist — a short to-do list. Ticking an item is local state, like Notes:
	the app decides what, if anything, to persist.
-->
<script lang="ts">
	export let items: { id: string; text: string; done?: boolean }[] = [];

	$: done = items.filter((item) => item.done).length;
</script>

<div class="checklist">
	{#if items.length}
		<p class="checklist__count">{done} of {items.length} done</p>
		<ul>
			{#each items as item (item.id)}
				<li>
					<label class:done={item.done}>
						<input type="checkbox" bind:checked={item.done} />
						<span>{item.text}</span>
					</label>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="checklist__count">Nothing to do.</p>
	{/if}
</div>

<style>
	.checklist__count {
		margin: 0 0 var(--spacing-sm);
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}

	ul {
		display: grid;
		gap: var(--spacing-xs);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	label {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-sm);
		color: var(--color-text);
		cursor: pointer;
	}

	input {
		width: 1rem;
		height: 1rem;
		margin: 0.2rem 0 0;
		padding: 0;
		accent-color: var(--color-primary-solid);
	}

	.done span {
		color: var(--color-text-secondary);
		text-decoration: line-through;
	}
</style>
