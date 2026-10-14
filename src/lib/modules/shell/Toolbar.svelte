<!--
	Toolbar — a row of buttons in labelled groups, as the ARIA toolbar
	pattern: one tab stop for the whole bar, arrows (and Home and End) move
	between buttons, Tab leaves. An item with `pressed` is a toggle (aria-
	pressed) that flips itself. When the bar is too narrow, the trailing
	items move into a "More" menu that is the last stop in the bar (Enter,
	Space or Down opens it; arrows move; Escape returns to the button).
	Bind `groups`; picks fire `on:action` (`{ id, pressed? }`).
-->
<script lang="ts">
	import { afterUpdate, createEventDispatcher, tick } from 'svelte';
	import { nextIndex, uid } from '$lib/ui';
	import { trackWidth } from './dom';
	import { clampToolbarStop, fitToolbarCount, rovingTabindex, splitToolbarOverflow } from './logic';

	interface ToolbarItem {
		id: string;
		label: string;
		/** An emoji or character shown with the label. */
		icon?: string;
		/** Hide the label on screen (it still names the button). */
		iconOnly?: boolean;
		/** Set for a toggle button. */
		pressed?: boolean;
		disabled?: boolean;
	}
	interface ToolbarGroup {
		id: string;
		label?: string;
		items: ToolbarItem[];
	}

	export let groups: ToolbarGroup[] = [];
	export let label = 'Toolbar';
	export let moreLabel = 'More';
	export let orientation: 'horizontal' | 'vertical' = 'horizontal';

	const dispatch = createEventDispatcher<{ action: { id: string; pressed?: boolean } }>();
	const id = uid('toolbar');
	const GAP = 4;
	const RESERVE = 48;

	let bar: HTMLElement;
	let barWidth = 0;
	let buttons: Record<string, HTMLButtonElement> = {};
	let more: HTMLButtonElement;
	let widths: Record<string, number> = {};
	let measuredFor = '';
	let active = 0;
	let menuOpen = false;
	let menuFocus = 0;
	let menuEntries: HTMLButtonElement[] = [];

	$: flat = groups.flatMap((g) => g.items);
	$: signature = flat.map((i) => i.id).join('|');
	$: horizontal = orientation === 'horizontal';
	$: visible =
		horizontal && measuredFor === signature
			? fitToolbarCount(
					flat.map((i) => widths[i.id] ?? 0),
					barWidth,
					RESERVE,
					GAP
				)
			: flat.length;
	$: split = splitToolbarOverflow(flat, visible);
	$: shownIds = new Set(split.shown.map((i) => i.id));
	$: overflow = split.overflow;
	$: stops = split.shown.length + (overflow.length ? 1 : 0);
	$: active = clampToolbarStop(active, stops);
	$: tabindexes = rovingTabindex(stops, active);
	$: indexOf = new Map(split.shown.map((item, i) => [item.id, i]));
	$: if (menuOpen && !overflow.length) menuOpen = false;

	afterUpdate(() => {
		// Measure every button once while all are on show, so a hidden one's
		// width is known when the bar shrinks and grows again.
		if (
			horizontal &&
			measuredFor !== signature &&
			barWidth > 0 &&
			flat.every((i) => buttons[i.id])
		) {
			widths = Object.fromEntries(flat.map((i) => [i.id, buttons[i.id].offsetWidth]));
			measuredFor = signature;
		}
	});

	function focusStop(i: number) {
		active = i;
		const item = split.shown[i];
		(item ? buttons[item.id] : more)?.focus();
	}

	function onKeydown(event: KeyboardEvent) {
		if (menuOpen) return;
		const target = event.target as HTMLElement;
		const at =
			target === more ? split.shown.length : split.shown.findIndex((i) => buttons[i.id] === target);
		if (at < 0) return;
		const disabled = split.shown.flatMap((item, i) => (item.disabled ? [i] : []));
		if (target === more && (event.key === 'ArrowDown' || event.key === 'ArrowUp') && horizontal) {
			event.preventDefault();
			openMenu();
			return;
		}
		const next = nextIndex(at, stops, event.key, orientation, disabled);
		if (next === null) return;
		event.preventDefault();
		focusStop(next);
	}

	function press(item: ToolbarItem) {
		if (item.disabled) return;
		if (item.pressed !== undefined) {
			item.pressed = !item.pressed;
			groups = groups;
			dispatch('action', { id: item.id, pressed: item.pressed });
		} else {
			dispatch('action', { id: item.id });
		}
	}

	async function openMenu() {
		menuOpen = true;
		menuFocus = 0;
		await tick();
		menuEntries[0]?.focus();
	}

	function closeMenu(returnFocus = true) {
		menuOpen = false;
		if (returnFocus) more?.focus();
	}

	function pickOverflow(item: ToolbarItem) {
		if (item.disabled) return;
		closeMenu();
		press(item);
	}

	function onMenuKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			closeMenu();
			return;
		}
		if (event.key === 'Tab') {
			closeMenu(false);
			return;
		}
		const disabled = overflow.flatMap((item, i) => (item.disabled ? [i] : []));
		const next = nextIndex(menuFocus, overflow.length, event.key, 'vertical', disabled);
		if (next === null) return;
		event.preventDefault();
		menuFocus = next;
		menuEntries[next]?.focus();
	}

	function onWindowPointer(event: PointerEvent) {
		if (menuOpen && !bar.contains(event.target as Node)) closeMenu(false);
	}
</script>

<svelte:window on:pointerdown={onWindowPointer} />

<!-- svelte-ignore a11y-no-noninteractive-element-interactions a11y-interactive-supports-focus -->
<div
	bind:this={bar}
	use:trackWidth={(w) => (barWidth = w)}
	class="toolbar toolbar--{orientation}"
	role="toolbar"
	aria-label={label}
	aria-orientation={orientation}
	on:keydown={onKeydown}
>
	{#each groups as group, g (group.id)}
		{#if group.items.some((i) => shownIds.has(i.id) || !horizontal || measuredFor !== signature)}
			{#if g > 0}<span
					class="toolbar__separator"
					role="separator"
					aria-orientation={horizontal ? 'vertical' : 'horizontal'}
				></span>{/if}
			<div class="toolbar__group" role="group" aria-label={group.label}>
				{#each group.items as item (item.id)}
					{#if shownIds.has(item.id)}
						<button
							bind:this={buttons[item.id]}
							type="button"
							class="toolbar__button"
							class:toolbar__button--pressed={item.pressed}
							tabindex={tabindexes[indexOf.get(item.id) ?? 0]}
							aria-pressed={item.pressed === undefined ? undefined : item.pressed}
							aria-label={item.iconOnly ? item.label : undefined}
							aria-disabled={item.disabled || undefined}
							on:focus={() => (active = indexOf.get(item.id) ?? 0)}
							on:click={() => press(item)}
						>
							{#if item.icon}<span aria-hidden="true">{item.icon}</span>{/if}
							{#if !item.iconOnly}<span>{item.label}</span>{/if}
						</button>
					{/if}
				{/each}
			</div>
		{/if}
	{/each}

	{#if overflow.length}
		<div class="toolbar__more">
			<button
				bind:this={more}
				type="button"
				class="toolbar__button"
				tabindex={tabindexes[split.shown.length]}
				aria-haspopup="menu"
				aria-expanded={menuOpen}
				aria-controls="{id}-menu"
				on:focus={() => (active = split.shown.length)}
				on:click={() => (menuOpen ? closeMenu() : openMenu())}
			>
				<span aria-hidden="true">⋯</span>
				<span>{moreLabel}</span>
			</button>
			{#if menuOpen}
				<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
				<div
					class="toolbar__menu"
					id="{id}-menu"
					role="menu"
					aria-label={moreLabel}
					tabindex="-1"
					on:keydown={onMenuKeydown}
				>
					{#each overflow as item, i (item.id)}
						<button
							bind:this={menuEntries[i]}
							type="button"
							role={item.pressed === undefined ? 'menuitem' : 'menuitemcheckbox'}
							class="toolbar__menu-item"
							tabindex={i === menuFocus ? 0 : -1}
							aria-checked={item.pressed === undefined ? undefined : item.pressed}
							aria-disabled={item.disabled || undefined}
							on:click={() => pickOverflow(item)}
						>
							{#if item.icon}<span aria-hidden="true">{item.icon}</span>{/if}
							{item.label}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		min-width: 0;
		padding: var(--spacing-xs);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	.toolbar--vertical {
		flex-direction: column;
		align-items: stretch;
		width: max-content;
		max-width: 100%;
	}

	.toolbar__group {
		display: flex;
		gap: var(--spacing-xs);
	}

	.toolbar--vertical .toolbar__group {
		flex-direction: column;
	}

	.toolbar__separator {
		align-self: stretch;
		width: 1px;
		background: var(--color-border);
	}

	.toolbar--vertical .toolbar__separator {
		width: auto;
		height: 1px;
	}

	.toolbar__button,
	.toolbar__menu-item {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
		min-width: 44px;
		min-height: 44px;
		padding: 0 var(--spacing-sm);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text);
		font: inherit;
		white-space: nowrap;
		cursor: pointer;
	}

	.toolbar__button {
		justify-content: center;
	}

	.toolbar__button:hover,
	.toolbar__menu-item:hover {
		background: var(--color-surface-hover);
	}

	.toolbar__button:focus-visible,
	.toolbar__menu-item:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 1px;
	}

	.toolbar__button--pressed {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 14%, var(--color-background));
		font-weight: 700;
	}

	.toolbar__button[aria-disabled='true'],
	.toolbar__menu-item[aria-disabled='true'] {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.toolbar__more {
		position: relative;
		margin-inline-start: auto;
	}

	.toolbar__menu {
		position: absolute;
		inset-block-start: calc(100% + 4px);
		inset-inline-end: 0;
		z-index: 60;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		min-width: 12rem;
		padding: var(--spacing-xs);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		box-shadow: var(--shadow-lg);
	}

	.toolbar__menu-item {
		justify-content: flex-start;
		text-align: start;
	}
</style>
