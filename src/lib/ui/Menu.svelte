<!--
	Menu — a button that opens a list of actions (the ARIA menu button
	pattern). Opening focuses the first item; arrows, Home and End move; Enter
	or a click picks; Escape or a click outside closes and returns focus to the
	button. Picks are reported with `on:select`.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { nextIndex, uid } from './logic';

	export let label: string;
	export let items: { id: string; label: string; danger?: boolean; disabled?: boolean }[] = [];
	export let align: 'start' | 'end' = 'start';

	const dispatch = createEventDispatcher<{ select: { id: string } }>();
	const id = uid('menu');
	let open = false;
	let root: HTMLDivElement;
	let trigger: HTMLButtonElement;
	let entries: HTMLButtonElement[] = [];
	let focused = 0;

	$: disabled = items.flatMap((item, i) => (item.disabled ? [i] : []));

	async function show(at: 'first' | 'last' = 'first') {
		open = true;
		await tick();
		const start = nextIndex(
			at === 'first' ? -1 : items.length,
			items.length,
			at === 'first' ? 'Home' : 'End',
			'vertical',
			disabled
		);
		focus(start ?? 0);
	}

	function hide(returnFocus = true) {
		open = false;
		if (returnFocus) trigger?.focus();
	}

	function focus(i: number) {
		focused = i;
		entries[i]?.focus();
	}

	function pick(item: (typeof items)[number]) {
		if (item.disabled) return;
		dispatch('select', { id: item.id });
		hide();
	}

	function onTriggerKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			show(event.key === 'ArrowDown' ? 'first' : 'last');
		}
	}

	function onMenuKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			hide();
			return;
		}
		if (event.key === 'Tab') {
			hide(false);
			return;
		}
		const next = nextIndex(focused, items.length, event.key, 'vertical', disabled);
		if (next === null) return;
		event.preventDefault();
		focus(next);
	}

	function onWindowPointer(event: PointerEvent) {
		if (open && !root.contains(event.target as Node)) hide(false);
	}
</script>

<svelte:window on:pointerdown={onWindowPointer} />

<div class="menu" bind:this={root}>
	<button
		bind:this={trigger}
		type="button"
		class="menu__trigger"
		aria-haspopup="menu"
		aria-expanded={open}
		aria-controls={id}
		on:click={() => (open ? hide() : show())}
		on:keydown={onTriggerKeydown}
	>
		{label}
		<span aria-hidden="true">▾</span>
	</button>
	{#if open}
		<div
			class="menu__list menu__list--{align}"
			role="menu"
			{id}
			aria-label={label}
			tabindex="-1"
			on:keydown={onMenuKeydown}
		>
			{#each items as item, i (item.id)}
				<button
					bind:this={entries[i]}
					type="button"
					role="menuitem"
					class="menu__item"
					class:menu__item--danger={item.danger}
					tabindex={i === focused ? 0 : -1}
					aria-disabled={item.disabled || undefined}
					on:click={() => pick(item)}
				>
					{item.label}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.menu {
		position: relative;
		display: inline-block;
	}

	.menu__trigger {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: 0.625rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.menu__trigger:hover {
		background: var(--color-surface-hover);
	}

	.menu__trigger:focus-visible,
	.menu__item:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.menu__list {
		position: absolute;
		top: calc(100% + 4px);
		z-index: 60;
		display: grid;
		min-width: 12rem;
		padding: var(--spacing-xs);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		box-shadow: var(--shadow-lg);
	}

	.menu__list--start {
		left: 0;
	}

	.menu__list--end {
		right: 0;
	}

	.menu__item {
		padding: var(--spacing-sm) var(--spacing-md);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.menu__item:hover,
	.menu__item:focus {
		background: var(--color-surface-hover);
	}

	.menu__item--danger {
		color: var(--color-danger);
	}

	.menu__item[aria-disabled='true'] {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
