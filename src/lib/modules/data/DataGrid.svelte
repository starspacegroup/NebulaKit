<!--
	DataGrid — a data table that works the way a product needs: search, multi-
	column sort (Shift adds a column), per-column filters, paging with a page
	size, row selection with a bulk-action bar, a menu of actions per row, a
	density toggle, and loading, empty and error states. Below ~40rem of its own
	width it becomes a list of labelled cards. "Export CSV" hands the current
	view (everything that matches, in the current order) to your callback.

	The grid does not own your data: sorting, filtering and paging are computed
	from `rows` with the pure functions in `./logic`, and every change is also an
	event, so a server-driven grid can ignore the built-in pipeline by passing
	pre-shaped rows and `pageSize={0}`.

	<DataGrid label="People" {rows} {columns} selectable bind:selected
		bulkActions={[{ id: 'delete', label: 'Delete', danger: true }]}
		on:bulkaction={…} on:export={…} />
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Alert from '$lib/ui/Alert.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import Pagination from '$lib/ui/Pagination.svelte';
	import Select from '$lib/ui/Select.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import TextInput from '$lib/ui/TextInput.svelte';
	import ActionMenu from './parts/ActionMenu.svelte';
	import {
		ariaSort,
		cellText,
		cycleSort,
		filterValue,
		gridView,
		GRID_DENSITIES,
		rangeText,
		resultCount,
		selectedText,
		selectionState,
		setColumnFilter,
		sortAnnouncement,
		sortPriority,
		toCsv,
		toggleAll,
		toggleSelected,
		type ColumnFilter,
		type GridDensity,
		type GridSort
	} from './logic';

	type Row = Record<string, unknown>;
	type Column = {
		key: string;
		label: string;
		sortable?: boolean;
		/** Adds a filter field for this column: free text, or a choice from `options`. */
		filter?: 'text' | 'select';
		options?: { value: string; label: string }[];
		align?: 'start' | 'end';
		/** How the cell reads. Search, filters, sort-announcements and CSV use this text. */
		format?: (value: unknown, row: Row) => string;
	};
	type Action = { id: string; label: string; danger?: boolean; disabled?: boolean };

	/** Names the grid (its region and its table caption). */
	export let label: string;
	export let columns: Column[] = [];
	export let rows: Row[] = [];
	export let rowKey = 'id';
	/** Show the caption on screen. It is always there for assistive technology. */
	export let showLabel = false;
	export let searchable = true;
	export let searchKeys: string[] | undefined = undefined;
	export let query = '';
	export let sorts: GridSort[] = [];
	export let filters: ColumnFilter[] = [];
	export let page = 1;
	/** Rows per page; 0 shows them all. */
	export let pageSize = 10;
	export let pageSizes: number[] = [10, 25, 50];
	export let selectable = false;
	export let selected: unknown[] = [];
	export let density: GridDensity = 'comfortable';
	export let densityToggle = true;
	export let loading = false;
	/** A message replaces the rows and offers "Try again". */
	export let error = '';
	export let rowActions: Action[] | ((row: Row) => Action[]) = [];
	export let bulkActions: Action[] = [];
	/** What names a row to assistive technology. Defaults to the first column's text. */
	export let rowLabel: ((row: Row) => string) | undefined = undefined;
	export let exportable = true;
	export let exportName = 'export.csv';
	/** Called with the CSV of the current view, as well as the `export` event. */
	export let onExport: ((csv: string, name: string) => void) | undefined = undefined;
	export let empty = 'Nothing here yet.';
	export let noResults = 'No rows match.';
	export let copy = {
		search: 'Search',
		filters: 'Filters',
		clearFilters: 'Clear filters',
		sortBy: 'Sort by',
		density: 'Density',
		exportCsv: 'Export CSV',
		retry: 'Try again',
		rowsPerPage: 'Rows per page',
		selectAll: 'Select all rows on this page',
		selectAllCards: 'Select all',
		selectRow: 'Select',
		clearSelection: 'Clear selection',
		actions: 'Actions',
		loading: 'Loading rows',
		any: 'Any',
		densities: { compact: 'Compact', comfortable: 'Comfortable', spacious: 'Spacious' }
	};

	const dispatch = createEventDispatcher<{
		sort: { sorts: GridSort[] };
		filter: { filters: ColumnFilter[]; query: string };
		pagechange: { page: number; pageSize: number };
		selection: { selected: unknown[] };
		rowaction: { action: string; row: Row };
		bulkaction: { action: string; rows: Row[] };
		export: { csv: string; name: string; count: number };
		retry: void;
	}>();

	let announcement = '';

	$: texts = Object.fromEntries(
		columns.map((c) => [c.key, c.format ? (r: Row) => c.format?.(r[c.key], r) ?? '' : null])
	) as Record<string, ((row: Row) => string) | null>;
	function textOf(row: Row, key: string): string {
		const format = texts[key];
		return format ? format(row) : cellText(row[key]);
	}

	$: view = gridView(rows, {
		query,
		searchKeys: searchKeys ?? columns.map((c) => c.key),
		filters,
		sorts,
		page,
		pageSize,
		text: textOf
	});
	$: current = view.slice.page;
	$: keys = view.pageRows.map((r) => r[rowKey]);
	$: allState = selectionState(selected, keys);
	$: chosen = rows.filter((r) => selected.includes(r[rowKey]));
	$: filtering = query.trim() !== '' || filters.some((f) => f.value.trim() !== '');
	$: activeFilters = filters.filter((f) => f.value.trim() !== '').length;
	$: filterColumns = columns.filter((c) => c.filter);
	$: sortOptions = columns
		.filter((c) => c.sortable)
		.flatMap((c) => [
			{ value: `${c.key}:ascending`, label: `${c.label}, ascending` },
			{ value: `${c.key}:descending`, label: `${c.label}, descending` }
		]);
	$: cardSort = sorts[0] ? `${sorts[0].key}:${sorts[0].direction}` : '';
	$: span = columns.length + (selectable ? 1 : 0) + (hasRowActions ? 1 : 0);
	$: hasRowActions = typeof rowActions === 'function' || rowActions.length > 0;
	$: labelOf = (key: string) => columns.find((c) => c.key === key)?.label ?? key;

	function nameOf(row: Row): string {
		if (rowLabel) return rowLabel(row);
		return columns[0] ? textOf(row, columns[0].key) : String(row[rowKey]);
	}

	function actionsFor(row: Row): Action[] {
		return typeof rowActions === 'function' ? rowActions(row) : rowActions;
	}

	function setSorts(next: GridSort[]) {
		sorts = next;
		page = 1;
		announcement = sortAnnouncement(next, labelOf);
		dispatch('sort', { sorts: next });
	}

	function onHeader(event: MouseEvent, key: string) {
		setSorts(cycleSort(sorts, key, event.shiftKey));
	}

	function onCardSort(event: Event) {
		const value = (event.currentTarget as HTMLSelectElement).value;
		if (!value) return setSorts([]);
		const [key, direction] = value.split(':');
		setSorts([{ key, direction: direction as GridSort['direction'] }]);
	}

	function changed() {
		page = 1;
		announcement = '';
		dispatch('filter', { filters, query });
	}

	function setFilter(key: string, value: string, op: 'contains' | 'equals') {
		filters = setColumnFilter(filters, { key, value, op });
		changed();
	}

	function onFilter(event: Event, key: string, op: 'contains' | 'equals') {
		setFilter(key, (event.currentTarget as HTMLInputElement).value, op);
	}

	function arrow(list: GridSort[], key: string): string {
		const mark = { ascending: '▲', descending: '▼', none: '↕' }[ariaSort(list, key)];
		const place = list.length > 1 ? sortPriority(list, key) : 0;
		return place > 0 ? `${mark}${place}` : mark;
	}

	function clearFilters() {
		query = '';
		filters = [];
		changed();
	}

	function goto(to: number) {
		page = to;
		dispatch('pagechange', { page: to, pageSize });
	}

	function setPageSize(event: Event) {
		pageSize = Number((event.currentTarget as HTMLSelectElement).value);
		goto(1);
	}

	function select(next: unknown[]) {
		selected = next;
		dispatch('selection', { selected });
	}

	function exportCsv() {
		const csv = toCsv(view.rows, columns, textOf);
		dispatch('export', { csv, name: exportName, count: view.rows.length });
		onExport?.(csv, exportName);
	}

	function bulk(action: string) {
		dispatch('bulkaction', { action, rows: chosen });
	}
</script>

<section
	class="grid"
	class:grid--busy={loading}
	aria-label={label}
	aria-busy={loading || undefined}
>
	<div class="grid__toolbar">
		{#if searchable}
			<div class="grid__search">
				<TextInput
					type="search"
					label={copy.search}
					hideLabel
					placeholder="{copy.search} {label.toLocaleLowerCase()}"
					autocomplete="off"
					bind:value={query}
					on:input={changed}
				/>
			</div>
		{/if}
		{#if sortOptions.length > 0}
			<div class="grid__cardsort">
				<Select
					label={copy.sortBy}
					value={cardSort}
					options={[{ value: '', label: '—' }, ...sortOptions]}
					on:change={onCardSort}
				/>
			</div>
		{/if}
		{#if selectable}
			<label class="grid__cardall">
				<input
					type="checkbox"
					checked={allState === 'all'}
					indeterminate={allState === 'some'}
					on:change={() => select(toggleAll(selected, keys))}
				/>
				{copy.selectAllCards}
			</label>
		{/if}
		{#if densityToggle}
			<div class="grid__density" role="group" aria-label={copy.density}>
				{#each GRID_DENSITIES as option (option)}
					<button
						type="button"
						class="grid__chip"
						aria-pressed={density === option}
						on:click={() => (density = option)}>{copy.densities[option]}</button
					>
				{/each}
			</div>
		{/if}
		{#if exportable}
			<button
				type="button"
				class="grid__button"
				disabled={view.count === 0 || loading}
				on:click={exportCsv}>{copy.exportCsv}</button
			>
		{/if}
	</div>

	{#if filterColumns.length > 0}
		<details class="grid__filters">
			<summary>{copy.filters}{activeFilters ? ` (${activeFilters})` : ''}</summary>
			<div class="grid__filterfields">
				{#each filterColumns as column (column.key)}
					{#if column.filter === 'select'}
						<Select
							label={column.label}
							value={filterValue(filters, column.key)}
							options={[{ value: '', label: copy.any }, ...(column.options ?? [])]}
							on:change={(e) => onFilter(e, column.key, 'equals')}
						/>
					{:else}
						<TextInput
							type="search"
							label={column.label}
							value={filterValue(filters, column.key)}
							autocomplete="off"
							on:input={(e) => onFilter(e, column.key, 'contains')}
						/>
					{/if}
				{/each}
				{#if activeFilters > 0}
					<button type="button" class="grid__button" on:click={clearFilters}
						>{copy.clearFilters}</button
					>
				{/if}
			</div>
		</details>
	{/if}

	{#if selectable && selected.length > 0}
		<div class="grid__bulk" role="region" aria-label="Bulk actions">
			<strong>{selectedText(chosen.length)}</strong>
			{#each bulkActions as action (action.id)}
				<button
					type="button"
					class="grid__button"
					class:grid__button--danger={action.danger}
					disabled={action.disabled}
					on:click={() => bulk(action.id)}>{action.label}</button
				>
			{/each}
			<button type="button" class="grid__button" on:click={() => select([])}
				>{copy.clearSelection}</button
			>
		</div>
	{/if}

	<p class="grid__count" role="status">
		{#if loading}{copy.loading}{:else if !error}{resultCount(view.count)}{/if}
	</p>
	<p class="sr-only" role="status">{announcement}</p>

	{#if error}
		<Alert tone="danger" title={error}>
			<button type="button" class="grid__button" on:click={() => dispatch('retry')}
				>{copy.retry}</button
			>
		</Alert>
	{:else}
		<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
		<div class="grid__scroll" role="region" aria-label="{label} table" tabindex="0">
			<!-- svelte-ignore a11y-no-redundant-roles -->
			<table class="grid__table grid__table--{density}" role="table">
				<caption class:sr-only={!showLabel}>{label}</caption>
				<!-- svelte-ignore a11y-no-redundant-roles -->
				<thead role="rowgroup">
					<!-- svelte-ignore a11y-no-redundant-roles -->
					<tr role="row">
						{#if selectable}
							<th scope="col" role="columnheader" class="grid__narrow">
								<label class="grid__check">
									<input
										type="checkbox"
										aria-label={copy.selectAll}
										checked={allState === 'all'}
										indeterminate={allState === 'some'}
										disabled={keys.length === 0}
										on:change={() => select(toggleAll(selected, keys))}
									/>
								</label>
							</th>
						{/if}
						{#each columns as column (column.key)}
							<th
								scope="col"
								role="columnheader"
								class:grid__end={column.align === 'end'}
								aria-sort={column.sortable ? ariaSort(sorts, column.key) : undefined}
							>
								{#if column.sortable}
									<button
										type="button"
										class="grid__sort"
										on:click={(e) => onHeader(e, column.key)}
									>
										{column.label}
										<span aria-hidden="true" class="grid__arrow">
											{arrow(sorts, column.key)}
										</span>
									</button>
								{:else}
									{column.label}
								{/if}
							</th>
						{/each}
						{#if hasRowActions}
							<th scope="col" role="columnheader" class="grid__narrow"
								><span class="sr-only">{copy.actions}</span></th
							>
						{/if}
					</tr>
				</thead>
				<!-- svelte-ignore a11y-no-redundant-roles -->
				<tbody role="rowgroup">
					{#if loading}
						{#each [0, 1, 2] as n (n)}
							<!-- svelte-ignore a11y-no-redundant-roles -->
							<tr role="row" class="grid__skeleton">
								<td role="cell" colspan={span}><Skeleton height="1.5rem" /></td>
							</tr>
						{/each}
					{:else if view.count === 0}
						<!-- svelte-ignore a11y-no-redundant-roles -->
						<tr role="row">
							<td role="cell" colspan={span} class="grid__empty">
								<EmptyState title={filtering ? noResults : empty}>
									{#if filtering}
										<button type="button" class="grid__button" on:click={clearFilters}
											>{copy.clearFilters}</button
										>
									{/if}
								</EmptyState>
							</td>
						</tr>
					{:else}
						{#each view.pageRows as row (row[rowKey])}
							<!-- svelte-ignore a11y-no-redundant-roles -->
							<tr
								role="row"
								aria-selected={selectable ? selected.includes(row[rowKey]) : undefined}
								class:grid__row--selected={selected.includes(row[rowKey])}
							>
								{#if selectable}
									<td role="cell" class="grid__narrow grid__pick">
										<label class="grid__check">
											<input
												type="checkbox"
												aria-label="{copy.selectRow} {nameOf(row)}"
												checked={selected.includes(row[rowKey])}
												on:change={() => select(toggleSelected(selected, row[rowKey]))}
											/>
										</label>
									</td>
								{/if}
								{#each columns as column (column.key)}
									<td
										role="cell"
										data-label={column.label}
										class:grid__end={column.align === 'end'}
									>
										<slot
											name="cell"
											{row}
											{column}
											value={row[column.key]}
											text={textOf(row, column.key)}>{textOf(row, column.key)}</slot
										>
									</td>
								{/each}
								{#if hasRowActions}
									<td role="cell" class="grid__narrow grid__acts">
										<ActionMenu
											label="{copy.actions}: {nameOf(row)}"
											items={actionsFor(row)}
											on:select={(e) => dispatch('rowaction', { action: e.detail.id, row })}
										/>
									</td>
								{/if}
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>

		{#if !loading && view.count > 0}
			<div class="grid__foot">
				<p class="grid__range">
					{rangeText(view.slice.start, view.slice.end, view.count)}
				</p>
				{#if pageSize > 0 && pageSizes.length > 0}
					<div class="grid__size">
						<Select
							label={copy.rowsPerPage}
							value={String(pageSize)}
							options={pageSizes.map((n) => ({ value: String(n), label: String(n) }))}
							on:change={setPageSize}
						/>
					</div>
				{/if}
				{#if view.slice.pageCount > 1}
					<Pagination
						page={current}
						total={view.slice.pageCount}
						label="{label} pages"
						on:change={(e) => goto(e.detail.page)}
					/>
				{/if}
			</div>
		{/if}
	{/if}
</section>

<style>
	.grid {
		container-type: inline-size;
		container-name: grid;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
		color: var(--color-text);
	}

	.grid__toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: var(--spacing-sm);
	}

	.grid__search {
		flex: 1 1 14rem;
		min-width: 0;
	}

	.grid__cardsort {
		flex: 1 1 12rem;
		min-width: 0;
	}

	.grid__cardall {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-sm);
		min-height: 2.75rem;
		cursor: pointer;
	}

	.grid__density {
		display: inline-flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
	}

	.grid__chip,
	.grid__button {
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

	.grid__chip[aria-pressed='true'] {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 16%, var(--color-surface));
		box-shadow: inset 0 -3px 0 var(--color-primary);
	}

	.grid__button--danger {
		color: var(--color-danger);
	}

	.grid__chip:hover,
	.grid__button:hover:not(:disabled) {
		background: var(--color-surface-hover);
	}

	.grid__button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.grid__chip:focus-visible,
	.grid__button:focus-visible,
	.grid__sort:focus-visible,
	.grid__scroll:focus-visible,
	summary:focus-visible,
	.grid__check input:focus-visible,
	.grid__cardall input:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.grid__filters {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: 0 var(--spacing-md);
	}

	summary {
		display: flex;
		align-items: center;
		min-height: 2.75rem;
		font-weight: 600;
		cursor: pointer;
	}

	.grid__filterfields {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
		align-items: end;
		gap: var(--spacing-md);
		padding-block: var(--spacing-sm) var(--spacing-md);
	}

	.grid__bulk {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm) var(--spacing-md);
		border: 1px solid var(--color-primary);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-primary) 10%, var(--color-background));
	}

	.grid__count,
	.grid__range {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.grid__scroll {
		position: relative;
		min-width: 0;
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
	}

	.grid--busy .grid__scroll {
		opacity: 0.85;
	}

	/* Cards first: every part of a table becomes a block. */
	.grid__table,
	.grid__table thead,
	.grid__table tbody,
	.grid__table tr,
	.grid__table td {
		display: block;
	}

	.grid__table {
		border-collapse: collapse;
		width: 100%;
	}

	.grid__table thead {
		display: none;
	}

	.grid__table tr {
		padding: var(--spacing-sm) var(--spacing-md);
		border-bottom: 1px solid var(--color-border);
	}

	.grid__table tr:last-child {
		border-bottom: 0;
	}

	.grid__table td {
		display: grid;
		grid-template-columns: minmax(3.5rem, 6rem) minmax(0, 1fr);
		gap: var(--spacing-sm);
		padding: var(--spacing-xs) 0;
		overflow-wrap: anywhere;
		text-align: start;
	}

	.grid__table td[data-label]::before {
		content: attr(data-label);
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.grid__table td.grid__narrow {
		display: flex;
		justify-content: flex-end;
		padding: 0;
	}

	.grid__table td.grid__pick {
		justify-content: flex-start;
	}

	.grid__table td.grid__empty {
		display: block;
		padding: var(--spacing-md) 0;
	}

	.grid__row--selected {
		background: color-mix(in srgb, var(--color-primary) 10%, var(--color-background));
	}

	.grid__check {
		display: inline-grid;
		place-items: center;
		min-width: 2.75rem;
		min-height: 2.75rem;
		cursor: pointer;
	}

	.grid__check input,
	.grid__cardall input {
		width: 1.125rem;
		height: 1.125rem;
		accent-color: var(--color-primary-solid);
	}

	.grid__sort {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
		min-height: 2.75rem;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.grid__arrow {
		color: var(--color-text-secondary);
		font-size: 0.75rem;
	}

	.grid__foot {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		justify-content: space-between;
		gap: var(--spacing-md);
	}

	.grid__size {
		min-width: 8rem;
	}

	@container grid (min-width: 40rem) {
		.grid__cardsort,
		.grid__cardall {
			display: none;
		}

		.grid__table {
			display: table;
		}

		.grid__table thead {
			display: table-header-group;
		}

		.grid__table tbody {
			display: table-row-group;
		}

		.grid__table tr {
			display: table-row;
			padding: 0;
		}

		.grid__table th,
		.grid__table td,
		.grid__table td.grid__narrow,
		.grid__table td.grid__empty {
			display: table-cell;
			padding: var(--cell, 0.75rem) var(--spacing-md);
			vertical-align: middle;
			border-bottom: 1px solid var(--color-border);
		}

		.grid__table td[data-label]::before {
			content: none;
		}

		.grid__table th {
			background: var(--color-surface);
			font-size: 0.875rem;
			text-align: start;
			white-space: nowrap;
		}

		.grid__table tr:last-child td {
			border-bottom: 0;
		}

		.grid__table .grid__end {
			text-align: end;
		}

		.grid__narrow {
			width: 1%;
			white-space: nowrap;
		}

		.grid__table--compact {
			--cell: 0.25rem;
		}

		.grid__table--comfortable {
			--cell: 0.625rem;
		}

		.grid__table--spacious {
			--cell: 1.125rem;
		}
	}

	caption {
		text-align: start;
		font-weight: 700;
		padding: var(--spacing-sm) var(--spacing-md);
	}
</style>
