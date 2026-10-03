<!-- Kbd — a key, or a chord of keys: <Kbd keys={['Ctrl', 'K']} />. -->
<script lang="ts">
	export let keys: string[] = [];
</script>

<span class="kbd-group">
	{#each keys as key, i (i)}
		{#if i > 0}<span class="kbd-plus" aria-hidden="true">+</span>{/if}
		<kbd>{key}</kbd>
	{/each}
	{#if keys.length === 0}<kbd><slot /></kbd>{/if}
</span>

<style>
	.kbd-group {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	kbd {
		padding: 0.125rem 0.4rem;
		border: 1px solid var(--color-border);
		border-bottom-width: 2px;
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: var(--color-text);
		font-family: var(--font-mono);
		font-size: 0.8125rem;
	}

	.kbd-plus {
		color: var(--color-text-secondary);
		font-size: 0.75rem;
	}
</style>
