/**
 * Ordered-list surgery for drag-and-drop layouts.
 *
 * This module is the whole reason widget reordering can be trusted: it has no
 * DOM, no Svelte and no widget concept, so every ordering rule is testable in
 * isolation. Anything that drags — a widget board, a sortable list, a nav
 * reorder — reduces its drop to one `reorder()` call.
 *
 * ## The rule this file exists to enforce
 *
 * **Order is derived, never patched.** The predecessor implementation adjusted
 * each item's `order` with a chain of `if / else-if` +/-1 conditionals. For a
 * move *within* one group, an item sitting between the source and the
 * destination needs both the source-side decrement and the dest-side increment
 * — but `else-if` lets it match only the first. Moving A in `[A0,B1,C2,D3]` to
 * index 2 produced `A=2, B=1, C=1, D=2`: two collisions, after which the render
 * order depended on sort stability. Widgets appeared to jump back, swap with a
 * neighbour, or not move at all.
 *
 * Modelling the move as remove -> clamp -> splice -> reindex makes contiguous,
 * unique orders true by construction, and the conditionals disappear.
 *
 * ## The index contract
 *
 * `toIndex` indexes the destination group **with the moved item already
 * removed**. That is the same space a drag indicator is computed in, so
 * "the item lands where the indicator was" holds without an off-by-one
 * correction anywhere. See `$lib/actions/draggable`.
 */

export interface Orderable {
	/** Stable identity. Never a DOM index — those diverge the moment anything moves. */
	id: string;
	/** Which column/section/list the item currently lives in. */
	group: string;
	/** Position within `group`. Contiguous from 0 after any call here. */
	order: number;
}

function byOrder(a: Orderable, b: Orderable): number {
	return a.order - b.order;
}

/**
 * Move `itemId` to `toIndex` of `toGroup`, returning a new layout whose touched
 * groups are numbered 0..n-1.
 *
 * Returns the **same array reference** when nothing changes (unknown id, an
 * unusable index, or a drop onto the position the item already holds), so a
 * caller can skip a persist with `if (next === prev) return`. Items whose
 * `group` and `order` are unaffected keep their object identity for the same
 * reason.
 */
export function reorder<T extends Orderable>(
	items: T[],
	itemId: string,
	toGroup: string,
	toIndex: number
): T[] {
	const moved = items.find((item) => item.id === itemId);
	if (!moved) return items;
	// A non-finite index means the caller's hit-testing failed. Splicing at NaN
	// silently lands the item at the front; refusing is the honest answer.
	if (!Number.isFinite(toIndex)) return items;

	const fromGroup = moved.group;

	// Destination in "moved item removed" space — exactly what toIndex indexes.
	const dest = items.filter((item) => item.group === toGroup && item !== moved).sort(byOrder);
	const insertAt = Math.max(0, Math.min(Math.floor(toIndex), dest.length));
	dest.splice(insertAt, 0, moved);

	// Keyed by object, not id: a duplicated id in stored layout data would
	// otherwise silently reindex the wrong item.
	const targets = new Map<T, { group: string; order: number }>();
	dest.forEach((item, order) => targets.set(item, { group: toGroup, order }));

	if (fromGroup !== toGroup) {
		items
			.filter((item) => item.group === fromGroup && item !== moved)
			.sort(byOrder)
			.forEach((item, order) => targets.set(item, { group: fromGroup, order }));
	}

	return apply(items, targets);
}

/**
 * Renumber every group 0..n-1, preserving current relative order.
 *
 * `reorder()` keeps the groups it touches contiguous; use this after an add or
 * a remove, or once when loading a layout of unknown provenance. Same
 * same-reference and same-identity guarantees as `reorder()`.
 */
export function normalize<T extends Orderable>(items: T[]): T[] {
	const groups = new Map<string, T[]>();
	for (const item of items) {
		const list = groups.get(item.group);
		if (list) list.push(item);
		else groups.set(item.group, [item]);
	}

	const targets = new Map<T, { group: string; order: number }>();
	for (const [group, list] of groups) {
		list.sort(byOrder).forEach((item, order) => targets.set(item, { group, order }));
	}

	return apply(items, targets);
}

/**
 * Rebuild the layout from computed targets, keeping the input's array order and
 * every untouched object reference.
 *
 * Array position is deliberately preserved: it makes persisted JSON diffs small
 * and stops a keyed `{#each}` from seeing spurious moves. Rendering sorts by
 * `order` regardless, so the array's own sequence carries no meaning.
 */
function apply<T extends Orderable>(
	items: T[],
	targets: Map<T, { group: string; order: number }>
): T[] {
	let changed = false;

	const next = items.map((item) => {
		const target = targets.get(item);
		if (!target || (item.group === target.group && item.order === target.order)) return item;
		changed = true;
		return { ...item, group: target.group, order: target.order };
	});

	return changed ? next : items;
}
