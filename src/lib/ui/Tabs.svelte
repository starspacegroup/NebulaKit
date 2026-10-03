<!--
	Tabs — the ARIA tabs pattern. One tab stop for the whole list; arrow keys,
	Home and End move between tabs and select as they go. The panel content is
	the slot, given the active tab's id.

	<Tabs tabs={[{ id: 'a', label: 'One' }]} bind:active let:active>…</Tabs>
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { nextIndex, uid } from './logic';

	export let tabs: { id: string; label: string; disabled?: boolean }[] = [];
	export let active: string = tabs[0]?.id ?? '';
	export let label = 'Tabs';

	const base = uid('tabs');
	let buttons: HTMLButtonElement[] = [];

	$: disabled = tabs.flatMap((t, i) => (t.disabled ? [i] : []));
	$: index = Math.max(
		0,
		tabs.findIndex((t) => t.id === active)
	);

	async function onKeydown(event: KeyboardEvent) {
		const next = nextIndex(index, tabs.length, event.key, 'horizontal', disabled);
		if (next === null) return;
		event.preventDefault();
		active = tabs[next].id;
		await tick();
		buttons[next]?.focus();
	}
</script>

<div class="tabs">
	<div class="tabs__list" role="tablist" aria-label={label} tabindex="-1" on:keydown={onKeydown}>
		{#each tabs as tab, i (tab.id)}
			<button
				bind:this={buttons[i]}
				type="button"
				role="tab"
				id="{base}-tab-{tab.id}"
				aria-controls="{base}-panel"
				aria-selected={tab.id === active}
				tabindex={tab.id === active ? 0 : -1}
				disabled={tab.disabled}
				class="tabs__tab"
				on:click={() => (active = tab.id)}
			>
				{tab.label}
			</button>
		{/each}
	</div>
	<div
		class="tabs__panel"
		role="tabpanel"
		id="{base}-panel"
		aria-labelledby="{base}-tab-{active}"
		tabindex="0"
	>
		<slot {active} />
	</div>
</div>

<style>
	/* Shrinks to its container; a long tab list scrolls inside its own row. */
	.tabs {
		min-width: 0;
		max-width: 100%;
	}

	.tabs__list {
		display: flex;
		gap: var(--spacing-xs);
		overflow-x: auto;
		border-bottom: 1px solid var(--color-border);
	}

	.tabs__list:focus {
		outline: none;
	}

	.tabs__tab {
		margin-bottom: -1px;
		padding: var(--spacing-sm) var(--spacing-md);
		border: 0;
		border-bottom: 2px solid transparent;
		background: transparent;
		color: var(--color-text-secondary);
		font: inherit;
		font-weight: 600;
		white-space: nowrap;
		cursor: pointer;
	}

	.tabs__tab:hover:not(:disabled) {
		color: var(--color-text);
	}

	.tabs__tab[aria-selected='true'] {
		border-bottom-color: var(--color-primary);
		color: var(--color-text);
	}

	.tabs__tab:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.tabs__tab:focus-visible,
	.tabs__panel:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.tabs__panel {
		padding: var(--spacing-md) 0;
		color: var(--color-text);
	}
</style>
