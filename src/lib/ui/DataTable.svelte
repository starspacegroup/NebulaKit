<!--
	DataTable — a table that searches, sorts, pages and selects. The search box
	filters across the chosen columns (every word has to match), sortable
	headers carry aria-sort, the pager and the rows-per-page select sit
	underneath, and a select-all checkbox in the header goes mixed when only
	some rows on the page are picked. The result count is announced as it
	changes. Bind `selected` (row keys) or listen for `on:selection`.

	<DataTable {rows} {columns} rowKey="id" selectable bind:selected>
		<svelte:fragment slot="toolbar" let:selected>…</svelte:fragment>
	</DataTable>
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { sortRows, toggleSort, uid, type SortDirection } from './logic';
	import {
		cellText,
		filterRows,
		paginate,
		rangeText,
		selectionState,
		toggleAll,
		toggleSelected
	} from './data-logic';
	import Pagination from './Pagination.svelte';

	type Row = Record<string, unknown>;
	type Column = {
		key: string;
		label: string;
		sortable?: boolean;
		align?: 'start' | 'end';
		/** How the cell reads; the search matches this text too. */
		format?: (value: unknown, row: Row) => string;
	};

	export let columns: Column[] = [];
	export let rows: Row[] = [];
	/** The field that identifies a row, for selection. */
	export let rowKey = 'id';
	export let caption = '';
	/** Show the search box. */
	export let searchable = true;
	/** Columns the search looks in. Defaults to every column. */
	export let searchKeys: string[] | undefined = undefined;
	export let query = '';
	export let sort: { key: string; direction: SortDirection } | null = null;
	export let page = 1;
	/** Rows per page; 0 shows them all. */
	export let pageSize = 10;
	export let pageSizes: number[] = [10, 25, 50];
	export let selectable = false;
	export let selected: unknown[] = [];
	/** Shown when there are no rows at all. */
	export let empty = 'Nothing here yet.';
	/** Shown when the search matches nothing. */
	export let noResults = 'No rows match your search.';

	const dispatch = createEventDispatcher<{
		selection: { selected: unknown[] };
		sort: { key: string; direction: SortDirection };
	}>();
	const id = uid('datatable');

	const text = (row: Row, key: string) => {
		const column = columns.find((c) => c.key === key);
		return column?.format ? column.format(row[key], row) : cellText(row[key]);
	};

	$: keys = searchKeys ?? columns.map((c) => c.key);
	$: filtered = filterRows(rows, query, keys, text);
	$: sorted = sort ? sortRows(filtered, sort.key, sort.direction) : filtered;
	$: view = paginate(sorted.length, page, pageSize);
	// A shrinking result set pulls the bound page back into range.
	$: holdPage(view.page);
	$: shown = sorted.slice(view.start, view.end);
	$: visibleKeys = shown.map((row) => row[rowKey]);
	$: allState = selectionState(selected, visibleKeys);
	$: label = caption || 'Table';
	$: frame = { role: 'region', 'aria-label': label, tabindex: 0 };

	function holdPage(to: number) {
		if (to !== page) page = to;
	}

	function setSelected(next: unknown[]) {
		selected = next;
		dispatch('selection', { selected: next });
	}

	function onSort(key: string) {
		sort = toggleSort(sort, key);
		dispatch('sort', sort);
	}

	function onSearch() {
		page = 1;
	}

	function onPageSize(event: Event) {
		pageSize = Number((event.currentTarget as HTMLSelectElement).value);
		page = 1;
	}

	// A label for a row's checkbox: what its first column says.
	function rowName(row: Row): string {
		return columns.length ? text(row, columns[0].key) : String(row[rowKey]);
	}

	// `indeterminate` is a property, not an attribute; an action sets it.
	function mixed(node: HTMLInputElement, on: boolean) {
		node.indeterminate = on;
		return {
			update(next: boolean) {
				node.indeterminate = next;
			}
		};
	}
</script>

<div class="datatable">
	{#if searchable || $$slots.toolbar}
		<div class="datatable__toolbar">
			{#if searchable}
				<input
					class="datatable__search"
					type="search"
					placeholder="Search…"
					aria-label="Search {label}"
					aria-controls="{id}-table"
					bind:value={query}
					on:input={onSearch}
				/>
			{/if}
			<div class="datatable__actions"><slot name="toolbar" {selected} /></div>
		</div>
	{/if}

	<div class="datatable__frame" {...frame}>
		<table id="{id}-table">
			{#if caption}<caption>{caption}</caption>{/if}
			<thead>
				<tr>
					{#if selectable}
						<th scope="col" class="datatable__check">
							<input
								type="checkbox"
								aria-label="Select all rows on this page"
								checked={allState === 'all'}
								disabled={shown.length === 0}
								use:mixed={allState === 'some'}
								on:change={() => setSelected(toggleAll(selected, visibleKeys))}
							/>
						</th>
					{/if}
					{#each columns as column (column.key)}
						<th
							scope="col"
							class:end={column.align === 'end'}
							aria-sort={sort?.key === column.key ? sort.direction : undefined}
						>
							{#if column.sortable}
								<button type="button" on:click={() => onSort(column.key)}>
									{column.label}
									<span aria-hidden="true" class="arrow">
										{sort?.key === column.key ? (sort.direction === 'ascending' ? '▲' : '▼') : '↕'}
									</span>
								</button>
							{:else}
								{column.label}
							{/if}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each shown as row, r (row[rowKey] ?? r)}
					{@const picked = selected.includes(row[rowKey])}
					<tr class:selected={picked}>
						{#if selectable}
							<td class="datatable__check">
								<input
									type="checkbox"
									aria-label="Select {rowName(row)}"
									checked={picked}
									on:change={() => setSelected(toggleSelected(selected, row[rowKey]))}
								/>
							</td>
						{/if}
						{#each columns as column (column.key)}
							<td class:end={column.align === 'end'}>
								<slot name="cell" {row} {column} value={text(row, column.key)}
									>{text(row, column.key)}</slot
								>
							</td>
						{/each}
					</tr>
				{:else}
					<tr>
						<td colspan={columns.length + (selectable ? 1 : 0)} class="empty">
							<slot name="empty" {query}>{rows.length ? noResults : empty}</slot>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="datatable__footer">
		<p class="datatable__count" aria-live="polite">
			{rangeText(view.start, view.end, sorted.length)}{#if selectable && selected.length}<span>
					· {selected.length} selected</span
				>{/if}
		</p>
		{#if pageSizes.length}
			<label class="datatable__size">
				Rows per page
				<select value={pageSize} on:change={onPageSize}>
					{#each pageSizes as size (size)}
						<option value={size}>{size > 0 ? size : 'All'}</option>
					{/each}
				</select>
			</label>
		{/if}
		<Pagination bind:page total={view.pageCount} label="{label} pages" />
	</div>
</div>

<style>
	.datatable {
		display: grid;
		gap: var(--spacing-sm);
		min-width: 0;
	}

	.datatable__toolbar,
	.datatable__footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-sm) var(--spacing-md);
	}

	.datatable__actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
		margin-left: auto;
	}

	.datatable__search {
		flex: 1 1 14rem;
		max-width: 22rem;
		min-width: 0;
		height: 2.5rem;
		padding: 0 var(--spacing-sm);
		box-sizing: border-box;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
	}

	.datatable__search:focus-visible,
	.datatable__size select:focus-visible,
	.datatable__frame:focus-visible,
	input[type='checkbox']:focus-visible,
	th button:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.datatable__frame {
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
	}

	table {
		width: 100%;
		margin: 0;
		border: 0;
		border-collapse: collapse;
		font-size: 0.9375rem;
	}

	caption {
		padding: var(--spacing-sm) var(--spacing-md);
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		text-align: left;
	}

	th,
	td {
		padding: var(--spacing-sm) var(--spacing-md);
		border: 0;
		border-bottom: 1px solid var(--color-border);
		text-align: left;
		color: var(--color-text);
	}

	th {
		background: var(--color-surface);
		font-weight: 700;
		white-space: nowrap;
	}

	tbody tr:last-child td {
		border-bottom: 0;
	}

	tbody tr:hover td {
		background: var(--color-surface);
	}

	tbody tr.selected td {
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
	}

	.datatable__check {
		width: 1%;
		padding-right: 0;
	}

	input[type='checkbox'] {
		width: 1.125rem;
		height: 1.125rem;
		margin: 0;
		accent-color: var(--color-primary-solid);
		cursor: pointer;
	}

	.end {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	th button {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.arrow {
		font-size: 0.6875rem;
		color: var(--color-text-secondary);
	}

	.empty {
		padding: var(--spacing-xl) var(--spacing-lg);
		color: var(--color-text-secondary);
		text-align: center;
	}

	.datatable__count {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		font-variant-numeric: tabular-nums;
	}

	.datatable__size {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.datatable__size select {
		height: 2.25rem;
		padding: 0 var(--spacing-xs);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
	}

	.datatable__footer :global(nav) {
		margin-left: auto;
	}
</style>
