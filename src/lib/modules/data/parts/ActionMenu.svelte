<!--
	ActionMenu — an icon button that opens a menu of actions (the ARIA menu
	button pattern), for rows and cards where a visible "Actions" label would
	repeat. `label` is the button's accessible name ("Actions for Ada"), so
	every row's button is told apart. Arrows, Home and End move; Enter picks;
	Escape closes and returns focus. The list is fixed-positioned so a
	scrolling table cannot clip it, and closes if the page scrolls.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { nextIndex, uid } from '$lib/ui/logic';

	export let label: string;
	export let items: { id: string; label: string; danger?: boolean; disabled?: boolean }[] = [];
	export let glyph = '⋯';
	export let disabled = false;

	const dispatch = createEventDispatcher<{ select: { id: string } }>();
	const id = uid('action-menu');
	let open = false;
	let root: HTMLSpanElement;
	let trigger: HTMLButtonElement;
	let entries: HTMLButtonElement[] = [];
	let focused = 0;
	let place = '';

	$: blocked = items.flatMap((item, i) => (item.disabled ? [i] : []));

	function position() {
		const rect = trigger.getBoundingClientRect();
		const rtl = getComputedStyle(trigger).direction === 'rtl';
		const edge = rtl
			? `inset-inline-end: ${Math.max(0, rect.left)}px;`
			: `inset-inline-end: ${Math.max(0, document.documentElement.clientWidth - rect.right)}px;`;
		const below = window.innerHeight - rect.bottom;
		const vertical =
			below < 240 && rect.top > below
				? `bottom: ${window.innerHeight - rect.top + 4}px;`
				: `top: ${rect.bottom + 4}px;`;
		place = `${vertical} ${edge}`;
	}

	async function show(at: 'first' | 'last' = 'first') {
		if (disabled || items.length === 0) return;
		position();
		open = true;
		await tick();
		const start = nextIndex(
			at === 'first' ? -1 : items.length,
			items.length,
			at === 'first' ? 'Home' : 'End',
			'vertical',
			blocked
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
		hide();
		dispatch('select', { id: item.id });
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
		const next = nextIndex(focused, items.length, event.key, 'vertical', blocked);
		if (next === null) return;
		event.preventDefault();
		focus(next);
	}

	function onWindowPointer(event: PointerEvent) {
		if (open && !root.contains(event.target as Node)) hide(false);
	}

	function onWindowScroll() {
		if (open) hide(false);
	}
</script>

<svelte:window
	on:pointerdown={onWindowPointer}
	on:scroll|capture={onWindowScroll}
	on:resize={onWindowScroll}
/>

<span class="action-menu" bind:this={root}>
	<button
		bind:this={trigger}
		type="button"
		class="action-menu__trigger"
		aria-label={label}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-controls={open ? id : undefined}
		{disabled}
		on:click={() => (open ? hide() : show())}
		on:keydown={onTriggerKeydown}
	>
		<span aria-hidden="true">{glyph}</span>
	</button>
	{#if open}
		<div
			class="action-menu__list"
			style={place}
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
					class="action-menu__item"
					class:action-menu__item--danger={item.danger}
					tabindex={i === focused ? 0 : -1}
					aria-disabled={item.disabled || undefined}
					on:click={() => pick(item)}
				>
					{item.label}
				</button>
			{/each}
		</div>
	{/if}
</span>

<style>
	.action-menu {
		display: inline-block;
	}

	.action-menu__trigger {
		display: inline-grid;
		place-items: center;
		min-width: 2.75rem;
		min-height: 2.75rem;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-text);
		font: inherit;
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
	}

	.action-menu__trigger:hover:not(:disabled) {
		background: var(--color-surface-hover);
		border-color: var(--color-border);
	}

	.action-menu__trigger:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.action-menu__trigger:focus-visible,
	.action-menu__item:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.action-menu__list {
		position: fixed;
		z-index: 60;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		min-width: 12rem;
		max-width: calc(100vw - 1rem);
		padding: var(--spacing-xs);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		box-shadow: var(--shadow-lg);
	}

	.action-menu__item {
		min-height: 2.75rem;
		padding: var(--spacing-sm) var(--spacing-md);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text);
		font: inherit;
		text-align: start;
		cursor: pointer;
	}

	.action-menu__item:hover,
	.action-menu__item:focus {
		background: var(--color-surface-hover);
	}

	.action-menu__item--danger {
		color: var(--color-danger);
	}

	.action-menu__item[aria-disabled='true'] {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
