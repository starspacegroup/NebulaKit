<!--
	Table — rows and columns, with optional sorting. Sortable headers are
	buttons and carry aria-sort, so the order is announced. Wide tables scroll
	inside their own frame instead of widening the page.
-->
<script lang="ts">
	import { sortRows, toggleSort, type SortDirection } from './logic';

	type Row = Record<string, unknown>;

	export let columns: {
		key: string;
		label: string;
		sortable?: boolean;
		align?: 'start' | 'end';
	}[] = [];
	export let rows: Row[] = [];
	export let caption = '';
	export let sort: { key: string; direction: SortDirection } | null = null;
	/** Shown in place of the body when there are no rows. */
	export let empty = 'Nothing here yet.';

	// Focusable so a keyboard can scroll a wide table (axe: scrollable-region-focusable).
	$: frame = { role: 'region', 'aria-label': caption || 'Table', tabindex: 0 };

	$: shown = sort ? sortRows(rows, sort.key, sort.direction) : rows;
</script>

<div class="table-frame" {...frame}>
	<table>
		{#if caption}<caption>{caption}</caption>{/if}
		<thead>
			<tr>
				{#each columns as column (column.key)}
					<th
						scope="col"
						class:end={column.align === 'end'}
						aria-sort={sort?.key === column.key ? sort.direction : undefined}
					>
						{#if column.sortable}
							<button type="button" on:click={() => (sort = toggleSort(sort, column.key))}>
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
			{#each shown as row, r (r)}
				<tr>
					{#each columns as column (column.key)}
						<td class:end={column.align === 'end'}>
							<slot name="cell" {row} {column}>{row[column.key] ?? ''}</slot>
						</td>
					{/each}
				</tr>
			{:else}
				<tr><td colspan={columns.length} class="empty">{empty}</td></tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.table-frame {
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
	}

	.table-frame:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
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

	th button:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.arrow {
		font-size: 0.6875rem;
		color: var(--color-text-secondary);
	}

	.empty {
		padding: var(--spacing-lg);
		color: var(--color-text-secondary);
		text-align: center;
	}
</style>
