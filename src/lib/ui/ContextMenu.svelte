<!--
	ContextMenu — a menu of actions for a region, opened by a right-click at
	the pointer, or from the keyboard with Shift+F10 or the ContextMenu key on
	anything focused inside the region (so put something focusable in it). It
	opens down and right of the pointer, mirrored and held inside the viewport
	near an edge. The ARIA menu pattern: focus goes to the first item; arrows,
	Home, End and typeahead move; Enter or a click picks; Escape, Tab or a
	click outside closes, and Escape returns focus where it was. Items can be
	separators, disabled, dangerous, or carry a shortcut hint. Picks are
	reported with `on:select`.

	A context menu is hidden by nature: offer the same actions somewhere
	visible too (a Menu or DropdownMenu on the row, say).
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { nextIndex, uid } from './logic';
	import {
		menuModel,
		placeAtPoint,
		typeahead,
		typeaheadBuffer,
		typeaheadKey,
		type MenuEntry,
		type MenuItem,
		type TypeaheadState
	} from './overlay-logic';

	export let items: MenuEntry[] = [];
	/** Names the menu for a screen reader. */
	export let label = 'Actions';

	const dispatch = createEventDispatcher<{ select: { id: string } }>();
	const id = uid('context-menu');
	let open = false;
	let list: HTMLDivElement;
	let entries: HTMLButtonElement[] = [];
	let focused = 0;
	let top = 0;
	let left = 0;
	let returnTo: HTMLElement | null = null;
	let typed: TypeaheadState = { text: '', at: 0 };

	$: model = menuModel(items);

	async function show(x: number, y: number) {
		if (open) return;
		returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		open = true;
		left = x;
		top = y;
		await tick();
		({ left, top } = placeAtPoint(
			x,
			y,
			{ width: list.offsetWidth, height: list.offsetHeight },
			{ width: window.innerWidth, height: window.innerHeight }
		));
		focus(nextIndex(-1, model.items.length, 'Home', 'vertical', model.disabled) ?? 0);
	}

	function hide(returnFocus = true) {
		open = false;
		if (returnFocus) returnTo?.focus();
	}

	function focus(i: number) {
		focused = i;
		entries[i]?.focus();
	}

	function pick(item: MenuItem) {
		if (item.disabled) return;
		hide();
		dispatch('select', { id: item.id });
	}

	function onMenuKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			hide();
			return;
		}
		if (event.key === 'Tab') {
			event.preventDefault();
			hide();
			return;
		}
		const now = Date.now();
		const char = typeaheadKey(event, typed.text !== '' && now - typed.at <= 500);
		if (char !== null) {
			event.preventDefault();
			typed = typeaheadBuffer(typed, char, now);
			const labels = model.items.map((item) => item.label);
			const match = typeahead(labels, focused, typed.text, model.disabled);
			if (match !== null) focus(match);
			return;
		}
		const next = nextIndex(focused, model.items.length, event.key, 'vertical', model.disabled);
		if (next === null) return;
		event.preventDefault();
		focus(next);
	}

	function onWindowPointer(event: PointerEvent) {
		if (open && !list?.contains(event.target as Node)) hide(false);
	}

	// The region is whatever the page puts in the slot, so its listeners are
	// attached as an action rather than given a role it does not have.
	function region(node: HTMLElement) {
		const onContext = (event: MouseEvent) => {
			event.preventDefault();
			show(event.clientX, event.clientY);
		};
		const onKey = (event: KeyboardEvent) => {
			if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
				event.preventDefault();
				const box = (event.target as HTMLElement).getBoundingClientRect();
				show(box.left, box.top + box.height);
			}
		};
		node.addEventListener('contextmenu', onContext);
		node.addEventListener('keydown', onKey);
		return {
			destroy() {
				node.removeEventListener('contextmenu', onContext);
				node.removeEventListener('keydown', onKey);
			}
		};
	}
</script>

<svelte:window on:pointerdown={onWindowPointer} on:resize={() => open && hide(false)} />

<div class="context-menu" use:region>
	<slot />
</div>
{#if open}
	<div
		bind:this={list}
		{id}
		class="context-menu__list"
		role="menu"
		aria-label={label}
		tabindex="-1"
		style="top: {top}px; left: {left}px"
		on:keydown={onMenuKeydown}
		on:contextmenu|preventDefault
	>
		{#each model.rows as row}
			{#if row.kind === 'separator'}
				<div class="context-menu__separator" role="separator"></div>
			{:else}
				<button
					bind:this={entries[row.index]}
					type="button"
					role="menuitem"
					class="context-menu__item"
					class:context-menu__item--danger={row.item.danger}
					tabindex={row.index === focused ? 0 : -1}
					aria-disabled={row.item.disabled || undefined}
					on:click={() => pick(row.item)}
				>
					<span>{row.item.label}</span>
					{#if row.item.shortcut}<span class="context-menu__shortcut">{row.item.shortcut}</span
						>{/if}
				</button>
			{/if}
		{/each}
	</div>
{/if}

<style>
	.context-menu {
		display: contents;
	}

	.context-menu__list {
		position: fixed;
		z-index: 70;
		display: grid;
		min-width: 12rem;
		max-width: calc(100vw - 16px);
		padding: var(--spacing-xs);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		box-shadow: var(--shadow-lg);
	}

	.context-menu__item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-lg);
		padding: var(--spacing-sm) var(--spacing-md);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.context-menu__item:hover,
	.context-menu__item:focus {
		background: var(--color-surface-hover);
	}

	.context-menu__item:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.context-menu__item--danger {
		color: var(--color-danger);
	}

	.context-menu__item[aria-disabled='true'] {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.context-menu__shortcut {
		color: var(--color-text-secondary);
		font-family: var(--font-mono);
		font-size: 0.8125rem;
	}

	.context-menu__separator {
		height: 1px;
		margin: var(--spacing-xs) 0;
		background: var(--color-border);
	}
</style>
