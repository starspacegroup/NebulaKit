/**
 * The decisions the data modules make, apart from the markup that shows them.
 *
 * This file holds what DataGrid, FilterBar and AuditLog share: multi-column
 * sort, column filters, the view pipeline (search → filter → sort → page),
 * selection and CSV. Everything is a pure function over plain data.
 */
import { cellText, filterRows, paginate, type PageSlice } from '$lib/ui/data-logic';
import { sortRows, type SortDirection } from '$lib/ui/logic';

export {
	cellText,
	filterRows,
	paginate,
	rangeText,
	selectionState,
	toggleAll,
	toggleSelected,
	type PageSlice,
	type SelectionState
} from '$lib/ui/data-logic';
export type { SortDirection } from '$lib/ui/logic';

export type GridRow = Record<string, unknown>;

export interface GridSort {
	key: string;
	direction: SortDirection;
}

/** A column filter. `contains` is a case-insensitive substring match, `equals` an exact one. */
export interface ColumnFilter {
	key: string;
	value: string;
	op?: 'contains' | 'equals';
}

/* ------------------------------------------------------------------- sort */

/**
 * The sort list after a header is pressed. A plain press makes that column the
 * only sort (ascending, then descending, then off). With `additive` (Shift) the
 * column joins, flips or leaves the existing list instead.
 */
export function cycleSort(sorts: readonly GridSort[], key: string, additive = false): GridSort[] {
	const at = sorts.findIndex((s) => s.key === key);
	if (additive) {
		if (at === -1) return [...sorts, { key, direction: 'ascending' }];
		if (sorts[at].direction === 'ascending') {
			return sorts.map((s, i) => (i === at ? { key, direction: 'descending' as const } : s));
		}
		return sorts.filter((_, i) => i !== at);
	}
	if (at === -1 || sorts.length > 1) return [{ key, direction: 'ascending' }];
	return sorts[0].direction === 'ascending' ? [{ key, direction: 'descending' }] : [];
}

/** The `aria-sort` value for a column. */
export function ariaSort(
	sorts: readonly GridSort[],
	key: string
): 'ascending' | 'descending' | 'none' {
	return sorts.find((s) => s.key === key)?.direction ?? 'none';
}

/** 1-based place of a column in a multi-column sort, or 0 when it is not sorted. */
export function sortPriority(sorts: readonly GridSort[], key: string): number {
	return sorts.findIndex((s) => s.key === key) + 1;
}

/** Rows sorted by several columns; the first has the most say. Stable. */
export function sortMulti<T extends GridRow>(rows: readonly T[], sorts: readonly GridSort[]): T[] {
	let result = rows.slice();
	for (let i = sorts.length - 1; i >= 0; i--) {
		result = sortRows(result, sorts[i].key, sorts[i].direction);
	}
	return result;
}

/** A spoken description of the current sort, for a live region. */
export function sortAnnouncement(
	sorts: readonly GridSort[],
	labelOf: (key: string) => string = (k) => k
): string {
	if (sorts.length === 0) return 'Sorting cleared.';
	return `Sorted by ${sorts.map((s) => `${labelOf(s.key)} ${s.direction}`).join(', then ')}.`;
}

/* ---------------------------------------------------------------- filters */

/** Rows that satisfy every column filter. Empty filter values are ignored. */
export function applyColumnFilters<T extends GridRow>(
	rows: readonly T[],
	filters: readonly ColumnFilter[],
	text: (row: T, key: string) => string = (row, key) => cellText(row[key])
): T[] {
	const active = filters.filter((f) => f.value.trim() !== '');
	if (active.length === 0) return rows.slice();
	return rows.filter((row) =>
		active.every((f) => {
			const cell = text(row, f.key).toLocaleLowerCase();
			const want = f.value.trim().toLocaleLowerCase();
			return f.op === 'equals' ? cell === want : cell.includes(want);
		})
	);
}

/** Set one column filter, replacing any earlier one on that column; an empty value removes it. */
export function setColumnFilter(
	filters: readonly ColumnFilter[],
	next: ColumnFilter
): ColumnFilter[] {
	const rest = filters.filter((f) => f.key !== next.key);
	return next.value.trim() === '' ? rest : [...rest, next];
}

/** The value of a column's filter, or an empty string. */
export function filterValue(filters: readonly ColumnFilter[], key: string): string {
	return filters.find((f) => f.key === key)?.value ?? '';
}

/* ------------------------------------------------------------------- view */

export interface GridQuery {
	query?: string;
	searchKeys?: readonly string[];
	filters?: readonly ColumnFilter[];
	sorts?: readonly GridSort[];
	page?: number;
	pageSize?: number;
	text?: (row: GridRow, key: string) => string;
}

export interface GridView<T> {
	/** Every row that passed search and filters, sorted. */
	rows: T[];
	/** The rows on the current page. */
	pageRows: T[];
	slice: PageSlice;
	count: number;
}

/** The whole pipeline: search, column filters, sort, then the page. */
export function gridView<T extends GridRow>(rows: readonly T[], q: GridQuery): GridView<T> {
	const keys = q.searchKeys ?? (rows[0] ? Object.keys(rows[0]) : []);
	const searched = filterRows(rows, q.query ?? '', keys, q.text);
	const filtered = applyColumnFilters(searched, q.filters ?? [], q.text);
	const sorted = sortMulti(filtered, q.sorts ?? []);
	const slice = paginate(sorted.length, q.page ?? 1, q.pageSize ?? 0);
	return {
		rows: sorted,
		pageRows: sorted.slice(slice.start, slice.end),
		slice,
		count: sorted.length
	};
}

/** "1 result", "12 results", "No results" — also the text a live region announces. */
export function resultCount(count: number, one = 'result', many = 'results'): string {
	if (count === 0) return `No ${many}`;
	return `${count} ${count === 1 ? one : many}`;
}

/** "3 selected", or an empty string when nothing is. */
export function selectedText(count: number, suffix = 'selected'): string {
	return count > 0 ? `${count} ${suffix}` : '';
}

export type GridDensity = 'compact' | 'comfortable' | 'spacious';
export const GRID_DENSITIES: readonly GridDensity[] = ['compact', 'comfortable', 'spacious'];

/** Keep a selection to keys that still exist (after a filter or data change they may not). */
export function pruneSelection<K>(selected: readonly K[], existing: readonly K[]): K[] {
	return selected.filter((k) => existing.includes(k));
}

/* -------------------------------------------------------------------- csv */

/**
 * One CSV field. Quotes when needed, and defuses spreadsheet formulas: a cell
 * that starts with `=`, `+`, `@`, tab, CR, or a `-` that is not a number is
 * prefixed with an apostrophe so Excel does not run it.
 */
export function csvField(value: unknown): string {
	let text = cellText(value);
	if (/^[=+@\t\r]/.test(text) || (text.startsWith('-') && !/^-\d+(\.\d+)?$/.test(text))) {
		text = `'${text}`;
	}
	return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV text (CRLF line ends) for rows and the columns to export. */
export function toCsv<T extends GridRow>(
	rows: readonly T[],
	columns: readonly { key: string; label: string }[],
	text: (row: T, key: string) => unknown = (row, key) => row[key]
): string {
	const head = columns.map((c) => csvField(c.label)).join(',');
	const body = rows.map((row) => columns.map((c) => csvField(text(row, c.key))).join(','));
	return [head, ...body].join('\r\n');
}

/* ------------------------------------------------------------- filter bar */

export interface FilterDef {
	key: string;
	label: string;
	/** Fixed choices. Without them the filter takes free text. */
	options?: { value: string; label: string }[];
}

export interface ActiveFilter {
	key: string;
	value: string;
}

/** Add or replace the filter on a key. A blank value is refused (returns the list unchanged). */
export function addActiveFilter(
	active: readonly ActiveFilter[],
	next: ActiveFilter
): ActiveFilter[] {
	const value = next.value.trim();
	if (value === '') return active.slice();
	return [...active.filter((f) => f.key !== next.key), { key: next.key, value }];
}

export function removeActiveFilter(active: readonly ActiveFilter[], key: string): ActiveFilter[] {
	return active.filter((f) => f.key !== key);
}

/** The definitions not yet in use — what the add-filter menu offers. */
export function unusedDefs(
	defs: readonly FilterDef[],
	active: readonly ActiveFilter[]
): FilterDef[] {
	return defs.filter((d) => !active.some((f) => f.key === d.key));
}

/** The chip text: "Status: Active". Option values show their label. */
export function chipLabel(defs: readonly FilterDef[], filter: ActiveFilter): string {
	const def = defs.find((d) => d.key === filter.key);
	const option = def?.options?.find((o) => o.value === filter.value);
	return `${def?.label ?? filter.key}: ${option?.label ?? filter.value}`;
}

/** Active filters as grid column filters (options match exactly, free text by substring). */
export function toColumnFilters(
	defs: readonly FilterDef[],
	active: readonly ActiveFilter[]
): ColumnFilter[] {
	return active.map((f) => ({
		key: f.key,
		value: f.value,
		op: defs.find((d) => d.key === f.key)?.options ? 'equals' : 'contains'
	}));
}
