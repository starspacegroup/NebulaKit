<!--
	GlobalSearch — a command palette on a modal <dialog>, opened with Cmd+K or
	Ctrl+K (or its trigger button). Results are ranked and grouped, with the
	matching text highlighted in <mark>. The ARIA combobox pattern: focus
	stays in the input, Up and Down move the highlighted option (announced
	through aria-activedescendant), Enter picks it, the first Escape clears
	the text and the next closes. With no text it lists recent searches. The
	result count, "searching" and "no results" are announced politely.
	Search is yours to run: listen to `on:search` (`{ query }`), set `loading`
	while you work, pass the answer as `items`, and set `rank={false}` if
	the answer is already filtered. A pick fires `on:select` (`{ item }`) and
	`on:recent` (`{ query }`) for you to store; recents come back in `recent`.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { isCommandShortcut, nextIndex, uid } from '$lib/ui';
	import {
		groupSearchResults,
		searchHighlightSegments,
		rankSearchItems,
		searchStatus,
		type SearchItem
	} from './logic';

	export let items: SearchItem[] = [];
	export let recent: string[] = [];
	export let query = '';
	export let open = false;
	export let loading = false;
	/** Rank and filter `items` here. Turn off when you pass results already filtered. */
	export let rank = true;
	/** Listen for the Cmd+K / Ctrl+K shortcut anywhere on the page. */
	export let hotkey = true;
	/** Show the button that opens the palette. */
	export let showTrigger = true;
	export let label = 'Search';
	export let placeholder = 'Search pages, people and actions…';
	export let triggerLabel = 'Search…';
	export let shortcutHint = 'Ctrl K';
	export let recentLabel = 'Recent searches';
	export let loadingLabel = 'Searching…';
	export let emptyLabel = 'No results found.';
	export let fallbackGroup = 'Results';

	const dispatch = createEventDispatcher<{
		search: { query: string };
		select: { item: SearchItem };
		recent: { query: string };
	}>();
	const id = uid('global-search');
	let dialog: HTMLDialogElement;
	let input: HTMLInputElement;
	let list: HTMLElement | undefined;
	let opener: HTMLElement | null = null;

	interface Row {
		key: string;
		kind: 'recent' | 'result';
		label: string;
		item?: SearchItem;
		disabled: boolean;
	}

	$: typed = query.trim() !== '';
	$: results = rank ? rankSearchItems(items, query) : items;
	$: groups = typed ? groupSearchResults(results, fallbackGroup) : [];
	// prettier-ignore
	$: rows = (typed ? groups.flatMap((g) => g.items) : []).map((item): Row => ({
		key: item.id,
		kind: 'result',
		label: item.label,
		item,
		disabled: !!item.disabled
	}));
	// prettier-ignore
	$: recentRows = typed
		? []
		: recent.map((text): Row => ({
				key: `r-${text}`,
				kind: 'recent',
				label: text,
				disabled: false
			}));
	$: flat = [...rows, ...recentRows];
	$: disabled = flat.flatMap((row, i) => (row.disabled ? [i] : []));
	$: active = nextIndex(-1, flat.length, 'Home', 'vertical', disabled) ?? -1;
	$: activeId = active >= 0 ? `${id}-option-${active}` : undefined;
	$: status = searchStatus(query, results.length, loading, {
		loading: loadingLabel,
		none: emptyLabel
	});
	$: showEmpty = typed && !loading && results.length === 0;
	$: if (dialog) sync(open);

	async function sync(want: boolean) {
		if (want && !dialog.open) {
			opener = document.activeElement as HTMLElement | null;
			if (typeof dialog.showModal === 'function') dialog.showModal();
			else dialog.setAttribute('open', '');
			await tick();
			input?.focus();
		} else if (!want && dialog.open) {
			if (typeof dialog.close === 'function') dialog.close();
			else dialog.removeAttribute('open');
			opener?.focus?.();
		}
	}

	function onWindowKeydown(event: KeyboardEvent) {
		if (hotkey && isCommandShortcut(event)) {
			event.preventDefault();
			open = !open;
		}
	}

	function onInput() {
		dispatch('search', { query });
	}

	function choose(index: number) {
		const row = flat[index];
		if (!row || row.disabled) return;
		if (row.kind === 'recent') {
			query = row.label;
			dispatch('search', { query });
			input?.focus();
			return;
		}
		if (query.trim()) dispatch('recent', { query: query.trim() });
		dispatch('select', { item: row.item as SearchItem });
		open = false;
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
			event.preventDefault();
			event.stopPropagation();
			query = '';
			dispatch('search', { query });
		}
	}

	function modal(node: HTMLElement) {
		const onClick = (event: MouseEvent) => {
			if (event.target === node) open = false;
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

	// Pointer handling, delegated from the listbox: the input keeps focus.
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
</script>

<svelte:window on:keydown={onWindowKeydown} />

{#if showTrigger}
	<button
		type="button"
		class="trigger"
		aria-haspopup="dialog"
		aria-expanded={open}
		on:click={() => (open = true)}
	>
		<span aria-hidden="true">⌕</span>
		<span class="trigger__text">{triggerLabel}</span>
		<kbd class="trigger__kbd" aria-hidden="true">{shortcutHint}</kbd>
	</button>
{/if}

<dialog bind:this={dialog} class="search" aria-label={label} use:modal>
	<div class="search__box">
		<span class="search__icon" aria-hidden="true">⌕</span>
		<input
			bind:this={input}
			bind:value={query}
			class="search__input"
			type="text"
			role="combobox"
			aria-label={label}
			aria-expanded="true"
			aria-controls="{id}-list"
			aria-autocomplete="list"
			aria-activedescendant={activeId}
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
			enterkeyhint="search"
			{placeholder}
			on:input={onInput}
			on:keydown={onKeydown}
		/>
	</div>

	<p class="search__sr" role="status" aria-live="polite">{status}</p>

	<div class="search__results" bind:this={list} use:pointer>
		{#if loading}
			<p class="search__note" aria-hidden="true">
				<span class="search__spinner"></span>{loadingLabel}
			</p>
		{/if}

		{#if showEmpty}
			<p class="search__note">{emptyLabel}</p>
		{/if}

		<div id="{id}-list" role="listbox" aria-label={label}>
			{#if typed}
				{#each groups as group, g (group.label)}
					<div role="group" aria-labelledby="{id}-group-{g}">
						<div class="search__group" id="{id}-group-{g}">{group.label}</div>
						{#each group.items as item (item.id)}
							{@const index = rows.findIndex((r) => r.key === item.id)}
							<div
								id="{id}-option-{index}"
								role="option"
								class="option"
								class:option--active={index === active}
								data-index={index}
								aria-selected={index === active}
								aria-disabled={item.disabled || undefined}
							>
								<span class="option__label">
									{#each searchHighlightSegments(item.label, query) as seg}{#if seg.match}<mark
												>{seg.text}</mark
											>{:else}{seg.text}{/if}{/each}
								</span>
								{#if item.description}
									<span class="option__description">
										{#each searchHighlightSegments(item.description, query) as seg}{#if seg.match}<mark
													>{seg.text}</mark
												>{:else}{seg.text}{/if}{/each}
									</span>
								{/if}
							</div>
						{/each}
					</div>
				{/each}
			{:else if recentRows.length}
				<div role="group" aria-labelledby="{id}-recent">
					<div class="search__group" id="{id}-recent">{recentLabel}</div>
					{#each recentRows as row, i (row.key)}
						<div
							id="{id}-option-{i}"
							role="option"
							class="option"
							class:option--active={i === active}
							data-index={i}
							aria-selected={i === active}
						>
							<span class="option__label"><span aria-hidden="true">↺ </span>{row.label}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</dialog>

<style>
	.trigger {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-sm);
		min-height: 44px;
		padding: 0 var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text-secondary);
		font: inherit;
		cursor: pointer;
	}

	.trigger:hover {
		background: var(--color-surface-hover);
	}

	.trigger:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.trigger__kbd {
		display: none;
		padding: 0 var(--spacing-xs);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}

	@media (min-width: 40rem) {
		.trigger__kbd {
			display: inline;
		}
	}

	.search {
		inline-size: min(36rem, calc(100vw - 1rem));
		max-block-size: min(32rem, calc(100dvh - 2rem));
		margin-block-start: 8dvh;
		padding: 0;
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-background);
		color: var(--color-text);
		box-shadow: var(--shadow-xl);
	}

	.search[open] {
		display: flex;
		flex-direction: column;
	}

	.search::backdrop {
		background: rgb(0 0 0 / 0.5);
	}

	.search__box {
		display: flex;
		flex: none;
		align-items: center;
		gap: var(--spacing-sm);
		padding: 0 var(--spacing-md);
		border-block-end: 1px solid var(--color-border);
	}

	.search__input {
		flex: 1;
		min-width: 0;
		min-height: 52px;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--color-text);
		font: inherit;
		font-size: 1rem;
	}

	.search__input:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.search__results {
		min-height: 0;
		padding: var(--spacing-xs);
		overflow-y: auto;
	}

	.search__group {
		padding: var(--spacing-sm) var(--spacing-sm) var(--spacing-xs);
		color: var(--color-text-secondary);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.option {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 2px;
		min-height: 44px;
		padding: var(--spacing-sm);
		border-radius: var(--radius-md);
		cursor: pointer;
	}

	.option--active {
		background: var(--color-surface-hover);
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.option[aria-disabled='true'] {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.option__label {
		overflow-wrap: anywhere;
	}

	.option__description {
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
		overflow-wrap: anywhere;
	}

	mark {
		border-radius: 2px;
		background: color-mix(in srgb, var(--color-primary) 25%, transparent);
		color: inherit;
		font-weight: 700;
		text-decoration: underline;
	}

	.search__note {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		margin: 0;
		padding: var(--spacing-md);
		color: var(--color-text-secondary);
	}

	.search__spinner {
		width: 1em;
		height: 1em;
		border: 2px solid currentColor;
		border-inline-end-color: transparent;
		border-radius: 50%;
		animation: search-spin 0.8s linear infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		.search__spinner {
			animation-duration: 3s;
		}
	}

	@keyframes search-spin {
		to {
			transform: rotate(360deg);
		}
	}

	.search__sr {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: 0;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
