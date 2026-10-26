<!--
	Menubar — a row of menus, as in a desktop app's File / Edit / View: the
	ARIA menubar pattern. The bar is one tab stop; Left and Right (and Home,
	End, typeahead) move between its menus. Down, Enter, Space or a click
	opens a menu on its first item, Up on its last. Inside a menu, Up, Down, Home, End and
	typeahead move, and Left or Right closes it and opens the next one along.
	Escape closes the menu and returns focus to its name in the bar; Tab or a
	click outside closes it. Items take the same shape as ContextMenu's:
	separators, disabled, dangerous, shortcut hints. Picks are reported with
	`on:select` as `{ menu, id }`.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { nextIndex, uid } from './logic';
	import {
		menuModel,
		typeahead,
		typeaheadBuffer,
		typeaheadKey,
		type MenuEntry,
		type MenuItem,
		type TypeaheadState
	} from './overlay-logic';

	export let menus: { id: string; label: string; items: MenuEntry[] }[] = [];
	/** Names the bar for a screen reader. */
	export let label = 'Menu';

	const dispatch = createEventDispatcher<{ select: { menu: string; id: string } }>();
	const id = uid('menubar');
	let root: HTMLDivElement;
	let tops: HTMLButtonElement[] = [];
	let entries: HTMLButtonElement[] = [];
	let current = 0;
	let expanded: number | null = null;
	let focused = 0;
	let typed: TypeaheadState = { text: '', at: 0 };

	$: models = menus.map((menu) => menuModel(menu.items));

	/** The search so far, if this key press is typeahead; null if it is not. */
	function typeaheadSearch(event: KeyboardEvent): string | null {
		const now = Date.now();
		const char = typeaheadKey(event, typed.text !== '' && now - typed.at <= 500);
		if (char === null) return null;
		event.preventDefault();
		typed = typeaheadBuffer(typed, char, now);
		return typed.text;
	}

	function focusTop(i: number) {
		current = i;
		tops[i]?.focus();
	}

	function focusItem(i: number) {
		focused = i;
		entries[i]?.focus();
	}

	async function openMenu(i: number, at: 'first' | 'last' = 'first') {
		current = i;
		expanded = i;
		entries = [];
		typed = { text: '', at: 0 };
		await tick();
		const { items, disabled } = models[i];
		const start = nextIndex(
			at === 'first' ? -1 : items.length,
			items.length,
			at === 'first' ? 'Home' : 'End',
			'vertical',
			disabled
		);
		focusItem(start ?? 0);
	}

	function close(returnFocus = true) {
		expanded = null;
		if (returnFocus) focusTop(current);
	}

	function pick(item: MenuItem) {
		if (item.disabled) return;
		const menu = menus[current].id;
		close();
		dispatch('select', { menu, id: item.id });
	}

	function onTopKeydown(event: KeyboardEvent, i: number) {
		switch (event.key) {
			// Enter and Space click the button, which opens it.
			case 'ArrowDown':
				event.preventDefault();
				openMenu(i, 'first');
				return;
			case 'ArrowUp':
				event.preventDefault();
				openMenu(i, 'last');
				return;
			case 'Escape':
				if (expanded !== null) {
					event.preventDefault();
					close();
				}
				return;
		}
		const search = typeaheadSearch(event);
		if (search !== null) {
			const match = typeahead(
				menus.map((menu) => menu.label),
				i,
				search
			);
			if (match !== null) focusTop(match);
			return;
		}
		const next = nextIndex(i, menus.length, event.key, 'horizontal');
		if (next === null) return;
		event.preventDefault();
		focusTop(next);
	}

	function onMenuKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			close();
			return;
		}
		if (event.key === 'Tab') {
			close(false);
			return;
		}
		if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			event.preventDefault();
			openMenu(nextIndex(current, menus.length, event.key, 'horizontal') ?? current);
			return;
		}
		const { items, disabled } = models[current];
		const search = typeaheadSearch(event);
		if (search !== null) {
			const labels = items.map((item) => item.label);
			const match = typeahead(labels, focused, search, disabled);
			if (match !== null) focusItem(match);
			return;
		}
		const next = nextIndex(focused, items.length, event.key, 'vertical', disabled);
		if (next === null) return;
		event.preventDefault();
		focusItem(next);
	}

	function onWindowPointer(event: PointerEvent) {
		if (expanded !== null && !root.contains(event.target as Node)) close(false);
	}
</script>

<svelte:window on:pointerdown={onWindowPointer} />

<div class="menubar" role="menubar" aria-label={label} bind:this={root}>
	{#each menus as menu, m (menu.id)}
		<div class="menubar__menu">
			<button
				bind:this={tops[m]}
				type="button"
				id="{id}-{m}"
				role="menuitem"
				class="menubar__top"
				aria-haspopup="menu"
				aria-expanded={expanded === m}
				aria-controls="{id}-{m}-menu"
				tabindex={m === current ? 0 : -1}
				on:click={() => (expanded === m ? close() : openMenu(m))}
				on:keydown={(event) => onTopKeydown(event, m)}
				on:mouseenter={() => expanded !== null && expanded !== m && openMenu(m)}
			>
				{menu.label}
			</button>
			{#if expanded === m}
				<div
					id="{id}-{m}-menu"
					class="menubar__list"
					role="menu"
					aria-labelledby="{id}-{m}"
					tabindex="-1"
					on:keydown={onMenuKeydown}
				>
					{#each models[m].rows as row}
						{#if row.kind === 'separator'}
							<div class="menubar__separator" role="separator"></div>
						{:else}
							<button
								bind:this={entries[row.index]}
								type="button"
								role="menuitem"
								class="menubar__item"
								class:menubar__item--danger={row.item.danger}
								tabindex={row.index === focused ? 0 : -1}
								aria-disabled={row.item.disabled || undefined}
								on:click={() => pick(row.item)}
							>
								<span>{row.item.label}</span>
								{#if row.item.shortcut}<span class="menubar__shortcut">{row.item.shortcut}</span
									>{/if}
							</button>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	{/each}
</div>

<style>
	.menubar {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		width: fit-content;
		max-width: 100%;
		padding: var(--spacing-xs);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	.menubar__menu {
		position: relative;
	}

	.menubar__top {
		padding: var(--spacing-xs) var(--spacing-md);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.menubar__top:hover,
	.menubar__top[aria-expanded='true'] {
		background: var(--color-surface-hover);
	}

	.menubar__top:focus-visible,
	.menubar__item:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.menubar__list {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		z-index: 60;
		display: grid;
		min-width: 13rem;
		max-width: calc(100vw - 16px);
		padding: var(--spacing-xs);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		box-shadow: var(--shadow-lg);
	}

	.menubar__item {
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

	.menubar__item:hover,
	.menubar__item:focus {
		background: var(--color-surface-hover);
	}

	.menubar__item--danger {
		color: var(--color-danger);
	}

	.menubar__item[aria-disabled='true'] {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.menubar__shortcut {
		color: var(--color-text-secondary);
		font-family: var(--font-mono);
		font-size: 0.8125rem;
	}

	.menubar__separator {
		height: 1px;
		margin: var(--spacing-xs) 0;
		background: var(--color-border);
	}
</style>
