<!--
	DropdownMenu — Menu with more to say: items in labelled groups between
	separators, checkbox items (menuitemcheckbox) and radio groups
	(menuitemradio), each with aria-checked, and shortcut hints. The ARIA menu
	button pattern: Enter, Space or ArrowDown on the button opens it on the
	first item, ArrowUp on the last; arrows, Home, End and typeahead move;
	Escape or a click outside closes and returns focus to the button.

	A plain item fires `on:select` and closes. A checkbox or radio item
	changes `state` (bind it: checkbox id → boolean, radio group key → chosen
	id), fires `on:change` with `{ id, value }`, and leaves the menu open so
	several can be set in one visit.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { nextIndex, uid } from './logic';
	import {
		applyChoice,
		flattenGroups,
		isChecked,
		typeahead,
		typeaheadBuffer,
		typeaheadKey,
		type DropdownEntry,
		type DropdownGroup,
		type MenuState,
		type TypeaheadState
	} from './overlay-logic';

	export let label: string;
	export let groups: DropdownGroup[] = [];
	export let state: MenuState = {};
	export let align: 'start' | 'end' = 'start';

	const dispatch = createEventDispatcher<{
		select: { id: string };
		change: { id: string; value: boolean | string };
	}>();
	const id = uid('dropdown-menu');
	const ROLES = { item: 'menuitem', checkbox: 'menuitemcheckbox', radio: 'menuitemradio' };
	let open = false;
	let root: HTMLDivElement;
	let trigger: HTMLButtonElement;
	let entries: HTMLButtonElement[] = [];
	let focused = 0;
	let typed: TypeaheadState = { text: '', at: 0 };

	$: flat = flattenGroups(groups);
	$: disabled = flat.flatMap((entry, i) => (entry.item.disabled ? [i] : []));
	$: checkable = flat.some((entry) => entry.kind !== 'item');
	$: offsets = groups.map((_, g) => flat.findIndex((entry) => entry.group === g));

	async function show(at: 'first' | 'last' = 'first') {
		open = true;
		await tick();
		const start = nextIndex(
			at === 'first' ? -1 : flat.length,
			flat.length,
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

	function activate(entry: DropdownEntry, index: number) {
		if (entry.item.disabled) return;
		focused = index;
		if (entry.kind === 'item') {
			hide();
			dispatch('select', { id: entry.item.id });
			return;
		}
		const result = applyChoice(state, entry);
		if (!result) return;
		state = result.state;
		dispatch('change', result.change);
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
			event.stopPropagation();
			hide();
			return;
		}
		if (event.key === 'Tab') {
			hide(false);
			return;
		}
		const now = Date.now();
		const char = typeaheadKey(event, typed.text !== '' && now - typed.at <= 500);
		if (char !== null) {
			event.preventDefault();
			typed = typeaheadBuffer(typed, char, now);
			const labels = flat.map((entry) => entry.item.label);
			const match = typeahead(labels, focused, typed.text, disabled);
			if (match !== null) focus(match);
			return;
		}
		const next = nextIndex(focused, flat.length, event.key, 'vertical', disabled);
		if (next === null) return;
		event.preventDefault();
		focus(next);
	}

	function onWindowPointer(event: PointerEvent) {
		if (open && !root.contains(event.target as Node)) hide(false);
	}
</script>

<svelte:window on:pointerdown={onWindowPointer} />

<div class="dropdown-menu" bind:this={root}>
	<button
		bind:this={trigger}
		type="button"
		class="dropdown-menu__trigger"
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
			class="dropdown-menu__list dropdown-menu__list--{align}"
			role="menu"
			{id}
			aria-label={label}
			tabindex="-1"
			on:keydown={onMenuKeydown}
		>
			{#each groups as group, g}
				{#if g > 0}<div class="dropdown-menu__separator" role="separator"></div>{/if}
				<div class="dropdown-menu__group" role="group" aria-label={group.label}>
					{#if group.label}
						<div class="dropdown-menu__label" aria-hidden="true">{group.label}</div>
					{/if}
					{#each group.items as item, i (item.id)}
						{@const index = offsets[g] + i}
						{@const entry = flat[index]}
						{@const checked = isChecked(state, entry)}
						<button
							bind:this={entries[index]}
							type="button"
							role={ROLES[entry.kind]}
							class="dropdown-menu__item"
							class:dropdown-menu__item--danger={item.danger}
							tabindex={index === focused ? 0 : -1}
							aria-checked={checked}
							aria-disabled={item.disabled || undefined}
							on:click={() => activate(entry, index)}
						>
							{#if checkable}
								<span class="dropdown-menu__check" aria-hidden="true"
									>{checked ? (entry.kind === 'radio' ? '●' : '✓') : ''}</span
								>
							{/if}
							<span class="dropdown-menu__text">{item.label}</span>
							{#if item.shortcut}<span class="dropdown-menu__shortcut">{item.shortcut}</span>{/if}
						</button>
					{/each}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.dropdown-menu {
		position: relative;
		display: inline-block;
	}

	.dropdown-menu__trigger {
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

	.dropdown-menu__trigger:hover {
		background: var(--color-surface-hover);
	}

	.dropdown-menu__trigger:focus-visible,
	.dropdown-menu__item:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.dropdown-menu__list {
		position: absolute;
		top: calc(100% + 4px);
		z-index: 60;
		display: grid;
		min-width: 14rem;
		max-width: calc(100vw - 16px);
		padding: var(--spacing-xs);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		box-shadow: var(--shadow-lg);
	}

	.dropdown-menu__list--start {
		left: 0;
	}

	.dropdown-menu__list--end {
		right: 0;
	}

	.dropdown-menu__group {
		display: grid;
	}

	.dropdown-menu__label {
		padding: var(--spacing-xs) var(--spacing-md);
		color: var(--color-text-secondary);
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.dropdown-menu__separator {
		height: 1px;
		margin: var(--spacing-xs) 0;
		background: var(--color-border);
	}

	.dropdown-menu__item {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm) var(--spacing-md);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.dropdown-menu__item:hover,
	.dropdown-menu__item:focus {
		background: var(--color-surface-hover);
	}

	.dropdown-menu__item--danger {
		color: var(--color-danger);
	}

	.dropdown-menu__item[aria-disabled='true'] {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.dropdown-menu__check {
		flex: none;
		width: 1rem;
		color: var(--color-primary);
		text-align: center;
	}

	.dropdown-menu__text {
		flex: 1;
	}

	.dropdown-menu__shortcut {
		margin-left: var(--spacing-lg);
		color: var(--color-text-secondary);
		font-family: var(--font-mono);
		font-size: 0.8125rem;
	}
</style>
