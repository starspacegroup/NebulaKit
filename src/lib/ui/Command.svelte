<!--
	Command — a command palette: a search box over a grouped list of actions,
	filtered and ranked as you type (label and keywords, case-insensitive;
	prefix matches first, then word starts, then anywhere). The ARIA combobox
	pattern: focus stays in the input, Up and Down move the highlighted option
	(announced through aria-activedescendant), Enter picks it, Escape clears
	the search. The number of results is announced politely. Picks are
	reported with `on:select`.

	Inline by default. With `dialog` it renders in a modal opened by binding
	`open`, and closes on a pick, on Escape or on the backdrop. Wire the
	shortcut on the page: `isCommandShortcut` from './overlay-logic' knows ⌘K
	and Ctrl+K, and `shortcut` shows the hint.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { nextIndex, uid } from './logic';
	import { groupCommands, rankCommands, type CommandItem } from './overlay-logic';

	export let items: CommandItem[] = [];
	export let query = '';
	export let placeholder = 'Type a command or search…';
	/** Names the search box and the list for a screen reader. */
	export let label = 'Search commands';
	export let empty = 'No results found.';
	/** Render in a modal dialog, shown while `open`. */
	export let dialog = false;
	export let open = false;
	/** A hint for the shortcut that opens it, such as "⌘K" or "Ctrl K". */
	export let shortcut = '';

	const dispatch = createEventDispatcher<{ select: { id: string } }>();
	const id = uid('command');
	let host: HTMLElement;
	let input: HTMLInputElement;
	let list: HTMLDivElement;

	$: grouped = groupCommands(rankCommands(items, query));
	$: flat = grouped.flatMap((group) => group.items);
	$: sections = grouped.map((group, g) => ({
		...group,
		start: grouped.slice(0, g).reduce((n, prev) => n + prev.items.length, 0)
	}));
	$: disabled = flat.flatMap((item, i) => (item.disabled ? [i] : []));
	$: active = nextIndex(-1, flat.length, 'Home', 'vertical', disabled) ?? -1;
	$: activeId = active >= 0 ? `${id}-option-${active}` : undefined;
	$: status = query.trim()
		? flat.length
			? `${flat.length} result${flat.length === 1 ? '' : 's'}`
			: empty
		: '';

	$: if (dialog && host) sync(open);

	async function sync(want: boolean) {
		const modal = host as HTMLDialogElement;
		if (want && !modal.open) {
			query = '';
			if (typeof modal.showModal === 'function') modal.showModal();
			else modal.setAttribute('open', '');
			await tick();
			input?.focus();
		} else if (!want && modal.open) {
			if (typeof modal.close === 'function') modal.close();
			else modal.removeAttribute('open');
		}
	}

	function choose(index: number) {
		const item = flat[index];
		if (!item || item.disabled) return;
		dispatch('select', { id: item.id });
		if (dialog) open = false;
	}

	function move(index: number) {
		active = index;
		list?.querySelector(`#${id}-option-${index}`)?.scrollIntoView?.({ block: 'nearest' });
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const next = nextIndex(active, flat.length, event.key, 'vertical', disabled);
			if (next !== null) move(next);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			choose(active);
		} else if (event.key === 'Escape' && query) {
			// The first Escape clears the search; the next one closes the dialog.
			event.preventDefault();
			event.stopPropagation();
			query = '';
		}
	}

	// Pointer handling on the options, delegated from the listbox: the input
	// keeps focus, and the options stay plain role="option" elements.
	function pointer(node: HTMLElement) {
		const indexOf = (event: Event) => {
			const option = (event.target as Element).closest('[role="option"]');
			return option ? Number(option.getAttribute('data-index')) : -1;
		};
		const onClick = (event: MouseEvent) => {
			const index = indexOf(event);
			if (index >= 0) choose(index);
		};
		const onMove = (event: MouseEvent) => {
			const index = indexOf(event);
			if (index >= 0 && index !== active && !flat[index].disabled) active = index;
		};
		const onDown = (event: MouseEvent) => event.preventDefault();
		node.addEventListener('click', onClick);
		node.addEventListener('mousemove', onMove);
		node.addEventListener('mousedown', onDown);
		return {
			destroy() {
				node.removeEventListener('click', onClick);
				node.removeEventListener('mousemove', onMove);
				node.removeEventListener('mousedown', onDown);
			}
		};
	}

	// In dialog mode: a click on the dialog element itself is the backdrop, and
	// the native close (Escape included) is mirrored into `open`.
	function modal(node: HTMLElement) {
		const onClick = (event: MouseEvent) => {
			if (dialog && event.target === node) open = false;
		};
		const onClose = () => (open = false);
		node.addEventListener('click', onClick);
		node.addEventListener('close', onClose);
		return {
			destroy() {
				node.removeEventListener('click', onClick);
				node.removeEventListener('close', onClose);
			}
		};
	}
</script>

<svelte:element
	this={dialog ? 'dialog' : 'div'}
	bind:this={host}
	class="command"
	class:command--dialog={dialog}
	aria-label={dialog ? label : undefined}
	use:modal
>
	<div class="command__search">
		<span class="command__icon" aria-hidden="true">⌕</span>
		<input
			bind:this={input}
			bind:value={query}
			class="command__input"
			type="text"
			role="combobox"
			aria-label={label}
			aria-expanded="true"
			aria-controls="{id}-list"
			aria-autocomplete="list"
			aria-activedescendant={activeId}
			autocomplete="off"
			spellcheck="false"
			{placeholder}
			on:keydown={onKeydown}
		/>
		{#if shortcut}<kbd class="command__kbd">{shortcut}</kbd>{/if}
	</div>
	<div
		bind:this={list}
		id="{id}-list"
		class="command__list"
		role="listbox"
		aria-label={label}
		use:pointer
	>
		{#each sections as section, s}
			<div
				class="command__group"
				role={section.group ? 'group' : 'presentation'}
				aria-labelledby={section.group ? `${id}-group-${s}` : undefined}
			>
				{#if section.group}
					<div id="{id}-group-{s}" class="command__heading" role="presentation">
						{section.group}
					</div>
				{/if}
				{#each section.items as item, i (item.id)}
					{@const index = section.start + i}
					<div
						id="{id}-option-{index}"
						class="command__option"
						class:command__option--active={index === active}
						role="option"
						aria-selected={index === active}
						aria-disabled={item.disabled || undefined}
						data-index={index}
					>
						<span>{item.label}</span>
						{#if item.shortcut}<span class="command__shortcut">{item.shortcut}</span>{/if}
					</div>
				{/each}
			</div>
		{/each}
	</div>
	<p
		class="command__status"
		class:command__status--empty={query.trim() && !flat.length}
		role="status"
	>
		{status}
	</p>
	{#if dialog}
		<p class="command__hints" aria-hidden="true">
			<span><kbd>↑</kbd><kbd>↓</kbd> move</span>
			<span><kbd>↵</kbd> pick</span>
			<span><kbd>Esc</kbd> close</span>
		</p>
	{/if}
</svelte:element>

<style>
	.command {
		display: grid;
		width: 100%;
		max-width: 36rem;
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-background);
		color: var(--color-text);
	}

	.command--dialog {
		width: min(36rem, calc(100vw - 2rem));
		max-height: min(32rem, calc(100dvh - 4rem));
		margin: 12vh auto auto;
		padding: 0;
		box-shadow: var(--shadow-xl);
	}

	.command--dialog:not([open]) {
		display: none;
	}

	.command--dialog::backdrop {
		background: rgb(0 0 0 / 0.5);
	}

	.command__search {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: 0 var(--spacing-md);
		border-bottom: 1px solid var(--color-border);
	}

	.command__search:focus-within {
		box-shadow: inset 0 -2px 0 var(--color-primary);
	}

	.command__icon {
		color: var(--color-text-secondary);
		font-size: 1.25rem;
	}

	.command__input {
		flex: 1;
		min-width: 0;
		padding: var(--spacing-md) 0;
		border: 0;
		background: transparent;
		color: var(--color-text);
		font: inherit;
		outline: none;
	}

	.command__input::placeholder {
		color: var(--color-text-secondary);
	}

	kbd {
		padding: 0.0625rem 0.375rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: var(--color-text-secondary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}

	.command__list {
		max-height: 20rem;
		overflow-y: auto;
		padding: var(--spacing-xs);
	}

	.command--dialog .command__list {
		max-height: none;
	}

	.command__list:empty {
		display: none;
	}

	.command__group + .command__group {
		margin-top: var(--spacing-xs);
		padding-top: var(--spacing-xs);
		border-top: 1px solid var(--color-border);
	}

	.command__heading {
		padding: var(--spacing-xs) var(--spacing-sm);
		color: var(--color-text-secondary);
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.command__option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-md);
		padding: var(--spacing-sm);
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.command__option--active {
		background: var(--color-surface-hover);
		box-shadow: inset 2px 0 0 var(--color-primary);
	}

	.command__option[aria-disabled='true'] {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.command__shortcut {
		color: var(--color-text-secondary);
		font-family: var(--font-mono);
		font-size: 0.8125rem;
	}

	/* Read to a screen reader always; shown only when it says nothing matched. */
	.command__status {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.command__status--empty {
		position: static;
		width: auto;
		height: auto;
		margin: 0;
		padding: var(--spacing-lg);
		clip: auto;
		color: var(--color-text-secondary);
		text-align: center;
		white-space: normal;
	}

	.command__hints {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-md);
		margin: 0;
		padding: var(--spacing-sm) var(--spacing-md);
		border-top: 1px solid var(--color-border);
		color: var(--color-text-secondary);
		font-size: 0.75rem;
	}

	.command__hints kbd + kbd {
		margin-left: 2px;
	}
</style>
