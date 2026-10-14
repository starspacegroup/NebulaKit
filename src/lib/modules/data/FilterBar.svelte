<!--
	FilterBar — the active filters as removable chips, an "Add filter" menu for
	the ones not yet used, and "Clear all". Choosing a filter opens a small
	form (a choice list, or a text box) so the value is always labelled. Pass
	`count` and the number of results is announced each time the filters change.
	Bind `active`; the output is plain `{ key, value }` pairs that
	`toColumnFilters()` turns into DataGrid filters.

	<FilterBar {defs} bind:active count={rows.length} />
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import Menu from '$lib/ui/Menu.svelte';
	import Select from '$lib/ui/Select.svelte';
	import TextInput from '$lib/ui/TextInput.svelte';
	import {
		addActiveFilter,
		chipLabel,
		removeActiveFilter,
		resultCount,
		unusedDefs,
		type ActiveFilter,
		type FilterDef
	} from './logic';

	export let label = 'Filters';
	export let defs: FilterDef[] = [];
	export let active: ActiveFilter[] = [];
	/** The number of results with the filters applied. Omit to skip the announcement. */
	export let count: number | undefined = undefined;
	export let copy = {
		add: 'Add filter',
		clearAll: 'Clear all',
		apply: 'Apply',
		cancel: 'Cancel',
		remove: 'Remove filter',
		empty: 'Enter a value.',
		none: 'No filters applied.',
		value: 'Value',
		active: 'Active filters'
	};

	const dispatch = createEventDispatcher<{
		change: { active: ActiveFilter[] };
		clear: void;
	}>();

	let root: HTMLElement;
	let pending: FilterDef | null = null;
	let draft = '';
	let error = '';
	let announcement = '';

	$: available = unusedDefs(defs, active);
	$: menuItems = available.map((d) => ({ id: d.key, label: d.label }));
	$: summary = count === undefined ? '' : resultCount(count);

	async function begin(event: CustomEvent<{ id: string }>) {
		pending = defs.find((d) => d.key === event.detail.id) ?? null;
		draft = pending?.options?.[0]?.value ?? '';
		error = '';
		await tick();
		root.querySelector<HTMLElement>('.filterbar__editor input, .filterbar__editor select')?.focus();
	}

	async function apply() {
		if (!pending) return;
		if (draft.trim() === '') {
			error = copy.empty;
			return;
		}
		const def = pending;
		active = addActiveFilter(active, { key: def.key, value: draft });
		announcement = `Filter added: ${chipLabel(defs, { key: def.key, value: draft.trim() })}.`;
		pending = null;
		dispatch('change', { active });
		await focusAdd();
	}

	async function cancel() {
		pending = null;
		await focusAdd();
	}

	// Back to the menu button, or to the first chip once every filter is in use.
	async function focusAdd() {
		await tick();
		const target =
			root.querySelector<HTMLElement>('.filterbar__add button') ??
			root.querySelector<HTMLElement>('.filterbar__remove');
		target?.focus();
	}

	function onPick(event: Event) {
		draft = (event.currentTarget as HTMLSelectElement).value;
	}

	function remove(filter: ActiveFilter) {
		active = removeActiveFilter(active, filter.key);
		announcement = `Filter removed: ${chipLabel(defs, filter)}.`;
		dispatch('change', { active });
	}

	function clearAll() {
		active = [];
		announcement = 'All filters cleared.';
		dispatch('change', { active });
		dispatch('clear');
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && pending) {
			event.stopPropagation();
			cancel();
		}
	}
</script>

<div class="filterbar" role="group" aria-label={label} bind:this={root}>
	<div class="filterbar__row">
		<ul class="filterbar__chips" aria-label={copy.active}>
			{#each active as filter (filter.key)}
				<li class="filterbar__chip">
					<span>{chipLabel(defs, filter)}</span>
					<button
						type="button"
						class="filterbar__remove"
						aria-label="{copy.remove}: {chipLabel(defs, filter)}"
						on:click={() => remove(filter)}><span aria-hidden="true">×</span></button
					>
				</li>
			{:else}
				<li class="filterbar__none">{copy.none}</li>
			{/each}
		</ul>
		<div class="filterbar__actions">
			{#if available.length > 0}
				<div class="filterbar__add">
					<Menu label={copy.add} items={menuItems} on:select={begin} />
				</div>
			{/if}
			{#if active.length > 0}
				<button type="button" class="filterbar__clear" on:click={clearAll}>{copy.clearAll}</button>
			{/if}
		</div>
	</div>

	{#if pending}
		<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
		<form
			class="filterbar__editor"
			aria-label="{copy.add}: {pending.label}"
			on:submit|preventDefault={apply}
			on:keydown={onKeydown}
		>
			{#if pending.options}
				<Select label={pending.label} value={draft} options={pending.options} on:change={onPick} />
			{:else}
				<TextInput
					label={pending.label}
					bind:value={draft}
					{error}
					autocomplete="off"
					on:input={() => (error = '')}
				/>
			{/if}
			<div class="filterbar__buttons">
				<button type="submit" class="filterbar__apply">{copy.apply}</button>
				<button type="button" class="filterbar__clear" on:click={cancel}>{copy.cancel}</button>
			</div>
		</form>
	{/if}

	<p class="filterbar__count" role="status">{announcement} {summary}</p>
</div>

<style>
	.filterbar {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		min-width: 0;
	}

	.filterbar__row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-sm);
	}

	.filterbar__chips {
		display: flex;
		flex: 1 1 14rem;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
		min-width: 0;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.filterbar__chip {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
		padding-inline: var(--spacing-md) var(--spacing-xs);
		border: 1px solid var(--color-primary);
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-primary) 12%, var(--color-background));
		font-size: 0.9rem;
		overflow-wrap: anywhere;
	}

	.filterbar__none {
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.filterbar__remove {
		display: inline-grid;
		place-items: center;
		min-width: 2.75rem;
		min-height: 2.75rem;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 1.25rem;
		cursor: pointer;
	}

	.filterbar__remove:hover {
		background: var(--color-surface-hover);
	}

	.filterbar__actions,
	.filterbar__buttons {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.filterbar__clear,
	.filterbar__apply {
		min-height: 2.75rem;
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.filterbar__apply {
		border-color: var(--color-primary-solid);
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
	}

	.filterbar__clear:hover {
		background: var(--color-surface-hover);
	}

	.filterbar__remove:focus-visible,
	.filterbar__clear:focus-visible,
	.filterbar__apply:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.filterbar__editor {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		max-width: 22rem;
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	.filterbar__count {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}
</style>
