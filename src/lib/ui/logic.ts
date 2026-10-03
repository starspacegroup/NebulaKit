/**
 * The decisions the UI kit makes, apart from the markup that shows them.
 *
 * Every component in `$lib/ui` that has to work something out — which page
 * numbers a pager shows, which tab an arrow key lands on, what initials an
 * avatar draws — does it here. `*.svelte` is excluded from coverage; this file
 * is not, so the logic is tested and counted.
 */

let counter = 0;

/**
 * A document-unique id for wiring a label to its control, or a trigger to the
 * panel it opens. Deterministic in order, so server and client agree as long
 * as they render the same components in the same order.
 */
export function uid(prefix = 'ui'): string {
	counter += 1;
	return `${prefix}-${counter}`;
}

/** Reset the id counter. For tests, and for a server render per request. */
export function resetUid(): void {
	counter = 0;
}

/** Up to two initials from a name: "Ada Lovelace" → "AL", "plato" → "P". */
export function initials(name: string): string {
	const words = name.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return '?';
	const first = words[0][0];
	const last = words.length > 1 ? words[words.length - 1][0] : '';
	return (first + last).toUpperCase();
}

/** A value as a percentage of `max`, held to [0, 100]. A non-positive max is 0. */
export function percent(value: number, max = 100): number {
	if (!(max > 0) || !Number.isFinite(value)) return 0;
	return Math.min(100, Math.max(0, (value / max) * 100));
}

export type PageItem = number | 'gap';

/**
 * The page numbers a pager shows: always the first and last, the current page
 * and `siblings` either side of it, and a gap wherever pages are skipped. A
 * gap that would hide exactly one page shows that page instead, since the
 * ellipsis would take the same room.
 */
export function pageRange(current: number, total: number, siblings = 1): PageItem[] {
	if (total < 1) return [];
	const page = Math.min(Math.max(1, Math.round(current)), total);
	const start = Math.max(2, page - siblings);
	const end = Math.min(total - 1, page + siblings);
	const items: PageItem[] = [1];
	if (start > 3) items.push('gap');
	else for (let p = 2; p < start; p++) items.push(p);
	for (let p = start; p <= end; p++) items.push(p);
	if (end < total - 2) items.push('gap');
	else for (let p = end + 1; p < total; p++) items.push(p);
	if (total > 1) items.push(total);
	return items;
}

/**
 * Where a roving focus goes on a key press, for tabs, menus and radio groups:
 * arrows step (and wrap), Home and End jump. `orientation` decides which
 * arrows count. Returns null for any other key, so the caller leaves it alone.
 * Disabled indexes are skipped.
 */
export function nextIndex(
	current: number,
	count: number,
	key: string,
	orientation: 'horizontal' | 'vertical' = 'horizontal',
	disabled: readonly number[] = []
): number | null {
	if (count < 1) return null;
	const forward = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
	const back = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
	const usable = (i: number) => !disabled.includes(i);

	const scan = (from: number, step: 1 | -1) => {
		let i = from;
		for (let n = 0; n < count; n++) {
			i = (i + step + count) % count;
			if (usable(i)) return i;
		}
		return null;
	};

	switch (key) {
		case forward:
			return scan(current, 1);
		case back:
			return scan(current, -1);
		case 'Home':
			return scan(-1, 1);
		case 'End':
			return scan(count, -1);
		default:
			return null;
	}
}

export type SortDirection = 'ascending' | 'descending';

/**
 * Rows sorted by one column, without touching the input. Numbers sort as
 * numbers, everything else by locale-aware string compare with numeric
 * collation ("item 2" before "item 10"). Missing values always sort last.
 * Stable, so equal rows keep the order they arrived in.
 */
export function sortRows<T extends Record<string, unknown>>(
	rows: readonly T[],
	key: keyof T,
	direction: SortDirection = 'ascending'
): T[] {
	const sign = direction === 'ascending' ? 1 : -1;
	const missing = (v: unknown) => v === null || v === undefined || v === '';
	return rows
		.map((row, index) => ({ row, index }))
		.sort((a, b) => {
			const x = a.row[key];
			const y = b.row[key];
			if (missing(x) || missing(y)) {
				if (missing(x) && missing(y)) return a.index - b.index;
				return missing(x) ? 1 : -1;
			}
			const order =
				typeof x === 'number' && typeof y === 'number'
					? x - y
					: String(x).localeCompare(String(y), undefined, { numeric: true });
			return order === 0 ? a.index - b.index : order * sign;
		})
		.map(({ row }) => row);
}

/** The next sort state when a column header is pressed: asc → desc → asc. */
export function toggleSort(
	current: { key: string; direction: SortDirection } | null,
	key: string
): { key: string; direction: SortDirection } {
	if (current?.key === key && current.direction === 'ascending') {
		return { key, direction: 'descending' };
	}
	return { key, direction: 'ascending' };
}
