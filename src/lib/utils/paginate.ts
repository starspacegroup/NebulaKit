/** Pure client-side pagination of an already-loaded list. */
export interface Pagination<T> {
	/** The rows for the current (clamped) page. */
	shown: T[];
	/** Total number of pages (at least 1, even when empty). */
	pageCount: number;
	/** The requested page, clamped into [0, pageCount - 1]. */
	page: number;
	/** 1-based index of the first shown row (0 when empty). */
	start: number;
	/** 1-based index of the last shown row (0 when empty). */
	end: number;
	/** Total item count. */
	total: number;
}

/**
 * Slice `items` for a zero-based `page`. `page` is clamped, so out-of-range
 * values (e.g. after the list shrinks) resolve to the nearest valid page
 * instead of showing an empty slice.
 */
export function paginate<T>(items: T[], page: number, pageSize: number): Pagination<T> {
	const size = Math.max(1, Math.floor(pageSize));
	const total = items.length;
	const pageCount = Math.max(1, Math.ceil(total / size));
	const clamped = Math.min(Math.max(0, Math.floor(page) || 0), pageCount - 1);
	const startIdx = clamped * size;
	const shown = items.slice(startIdx, startIdx + size);
	return {
		shown,
		pageCount,
		page: clamped,
		start: total === 0 ? 0 : startIdx + 1,
		end: startIdx + shown.length,
		total
	};
}
