import { describe, it, expect } from 'vitest';
import { reorder, normalize, type Orderable } from './reorder';

interface Item extends Orderable {
	label?: string;
}

/** Build a layout from a compact `group: ids` spec, ordered 0..n-1. */
function build(spec: Record<string, string[]>): Item[] {
	return Object.entries(spec).flatMap(([group, ids]) =>
		ids.map((id, order) => ({ id, group, order }))
	);
}

/** Ids of one group, in `order` sequence — what the board would render. */
function idsOf(items: Item[], group: string): string[] {
	return items
		.filter((i) => i.group === group)
		.sort((a, b) => a.order - b.order)
		.map((i) => i.id);
}

/** Every group's orders are 0..n-1 exactly once — the invariant P1 broke. */
function expectContiguous(items: Item[]) {
	const groups = new Set(items.map((i) => i.group));
	for (const group of groups) {
		const orders = items
			.filter((i) => i.group === group)
			.map((i) => i.order)
			.sort((a, b) => a - b);
		expect(orders).toEqual(orders.map((_, i) => i));
	}
}

describe('reorder', () => {
	describe('within a single group', () => {
		it('moves an item down to the requested slot', () => {
			// The exact regression from planning/COMPONENT_LIBRARY.md P1: the old
			// per-item +/-1 chain turned [A0,B1,C2,D3] into A=2,B=1,C=1,D=2.
			const items = build({ main: ['A', 'B', 'C', 'D'] });

			const next = reorder(items, 'A', 'main', 2);

			expect(idsOf(next, 'main')).toEqual(['B', 'C', 'A', 'D']);
			expectContiguous(next);
		});

		it('moves an item up to the requested slot', () => {
			const items = build({ main: ['A', 'B', 'C', 'D'] });

			const next = reorder(items, 'D', 'main', 0);

			expect(idsOf(next, 'main')).toEqual(['D', 'A', 'B', 'C']);
			expectContiguous(next);
		});

		it('moves an item to the end', () => {
			const items = build({ main: ['A', 'B', 'C'] });

			expect(idsOf(reorder(items, 'A', 'main', 2), 'main')).toEqual(['B', 'C', 'A']);
		});

		it('keeps orders contiguous and unique for every source/target pair', () => {
			const items = build({ main: ['A', 'B', 'C', 'D', 'E'] });

			for (const id of ['A', 'B', 'C', 'D', 'E']) {
				for (let to = 0; to <= 4; to++) {
					const next = reorder(items, id, 'main', to);
					expectContiguous(next);
					expect(idsOf(next, 'main')).toHaveLength(5);
					expect(idsOf(next, 'main')[to]).toBe(id);
				}
			}
		});

		it('treats a single-item group as a no-op', () => {
			const items = build({ main: ['A'] });

			expect(reorder(items, 'A', 'main', 0)).toBe(items);
		});
	});

	describe('across groups', () => {
		it('inserts into the destination and closes the gap in the source', () => {
			const items = build({ left: ['A', 'B', 'C'], right: ['X', 'Y'] });

			const next = reorder(items, 'B', 'right', 1);

			expect(idsOf(next, 'left')).toEqual(['A', 'C']);
			expect(idsOf(next, 'right')).toEqual(['X', 'B', 'Y']);
			expectContiguous(next);
		});

		it('moves into an empty group', () => {
			const items = build({ left: ['A', 'B'] });

			const next = reorder(items, 'A', 'right', 0);

			expect(idsOf(next, 'left')).toEqual(['B']);
			expect(idsOf(next, 'right')).toEqual(['A']);
			expectContiguous(next);
		});

		it('empties the source group when its last item leaves', () => {
			const items = build({ left: ['A'], right: ['X'] });

			const next = reorder(items, 'A', 'right', 0);

			expect(idsOf(next, 'left')).toEqual([]);
			expect(idsOf(next, 'right')).toEqual(['A', 'X']);
		});

		it('leaves groups that took no part in the move untouched', () => {
			const items = build({ left: ['A'], right: ['X'], other: ['P', 'Q'] });
			const before = items.filter((i) => i.group === 'other');

			const next = reorder(items, 'A', 'right', 0);

			// Same objects, not just equal ones — a diff guard can trust identity.
			for (const item of before) expect(next).toContain(item);
		});
	});

	describe('index handling', () => {
		it('clamps an index past the end of the destination', () => {
			const items = build({ main: ['A', 'B', 'C'] });

			expect(idsOf(reorder(items, 'A', 'main', 99), 'main')).toEqual(['B', 'C', 'A']);
		});

		it('clamps a negative index to the front', () => {
			const items = build({ main: ['A', 'B', 'C'] });

			expect(idsOf(reorder(items, 'C', 'main', -5), 'main')).toEqual(['C', 'A', 'B']);
		});

		it('floors a fractional index', () => {
			const items = build({ main: ['A', 'B', 'C'] });

			expect(idsOf(reorder(items, 'A', 'main', 1.9), 'main')).toEqual(['B', 'A', 'C']);
		});

		it('rejects a non-finite index instead of splicing at 0', () => {
			const items = build({ main: ['A', 'B', 'C'] });

			expect(reorder(items, 'C', 'main', Number.NaN)).toBe(items);
			expect(reorder(items, 'C', 'main', Number.POSITIVE_INFINITY)).toBe(items);
		});

		it('indexes the destination with the moved item already removed', () => {
			// [A,B,C] minus A is [B,C]; index 1 means "between B and C".
			const items = build({ main: ['A', 'B', 'C'] });

			expect(idsOf(reorder(items, 'A', 'main', 1), 'main')).toEqual(['B', 'A', 'C']);
		});
	});

	describe('no-ops', () => {
		it('returns the same array for an unknown id', () => {
			const items = build({ main: ['A', 'B'] });

			expect(reorder(items, 'nope', 'main', 0)).toBe(items);
		});

		it('returns the same array when the item is already at that index', () => {
			const items = build({ main: ['A', 'B', 'C'] });

			expect(reorder(items, 'B', 'main', 1)).toBe(items);
		});

		it('returns the same array for an empty layout', () => {
			const items: Item[] = [];

			expect(reorder(items, 'A', 'main', 0)).toBe(items);
		});
	});

	describe('purity', () => {
		it('does not mutate the input array or its items', () => {
			const items = build({ left: ['A', 'B'], right: ['X'] });
			const snapshot = JSON.parse(JSON.stringify(items));

			reorder(items, 'A', 'right', 0);

			expect(items).toEqual(snapshot);
		});

		it('preserves the input array order and every unrelated field', () => {
			const items: Item[] = [
				{ id: 'A', group: 'main', order: 0, label: 'first' },
				{ id: 'B', group: 'main', order: 1, label: 'second' }
			];

			const next = reorder(items, 'A', 'main', 1);

			expect(next.map((i) => i.id)).toEqual(['A', 'B']);
			expect(next.map((i) => i.label)).toEqual(['first', 'second']);
		});
	});

	describe('repairing malformed input', () => {
		it('normalizes duplicate orders in the groups it touches', () => {
			const items: Item[] = [
				{ id: 'A', group: 'main', order: 2 },
				{ id: 'B', group: 'main', order: 2 },
				{ id: 'C', group: 'main', order: 7 }
			];

			const next = reorder(items, 'C', 'main', 0);

			expect(idsOf(next, 'main')).toEqual(['C', 'A', 'B']);
			expectContiguous(next);
		});

		it('breaks ties on equal orders by input position', () => {
			const items: Item[] = [
				{ id: 'A', group: 'main', order: 0 },
				{ id: 'B', group: 'main', order: 0 },
				{ id: 'C', group: 'main', order: 0 }
			];

			const next = reorder(items, 'C', 'main', 0);

			expect(idsOf(next, 'main')).toEqual(['C', 'A', 'B']);
		});
	});
});

describe('normalize', () => {
	it('reindexes every group to 0..n-1', () => {
		const items: Item[] = [
			{ id: 'A', group: 'left', order: 5 },
			{ id: 'B', group: 'left', order: 5 },
			{ id: 'X', group: 'right', order: 9 }
		];

		const next = normalize(items);

		expect(idsOf(next, 'left')).toEqual(['A', 'B']);
		expect(idsOf(next, 'right')).toEqual(['X']);
		expectContiguous(next);
	});

	it('returns the same array when every group is already contiguous', () => {
		const items = build({ left: ['A', 'B'], right: ['X'] });

		expect(normalize(items)).toBe(items);
	});

	it('does not mutate the input', () => {
		const items: Item[] = [{ id: 'A', group: 'left', order: 4 }];
		const snapshot = JSON.parse(JSON.stringify(items));

		normalize(items);

		expect(items).toEqual(snapshot);
	});

	it('handles an empty layout', () => {
		const items: Item[] = [];

		expect(normalize(items)).toBe(items);
	});
});
