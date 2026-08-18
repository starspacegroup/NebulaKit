import { describe, it, expect } from 'vitest';
import { contains, insertionIndex, pickZone, type Rect } from './drop-position';

/** A rect from top/left plus size — closer to how a layout actually reads. */
function rect(top: number, left: number, height = 40, width = 100): Rect {
	return { top, left, bottom: top + height, right: left + width };
}

/** A vertical stack of `count` 40px rows starting at y=0. */
function stack(count: number, left = 0): Rect[] {
	return Array.from({ length: count }, (_, i) => rect(i * 40, left));
}

describe('contains', () => {
	it('accepts a point inside', () => {
		expect(contains(rect(0, 0), { x: 50, y: 20 })).toBe(true);
	});

	it('accepts a point exactly on an edge', () => {
		expect(contains(rect(0, 0), { x: 0, y: 0 })).toBe(true);
		expect(contains(rect(0, 0), { x: 100, y: 40 })).toBe(true);
	});

	it('rejects points outside on each axis', () => {
		expect(contains(rect(0, 0), { x: -1, y: 20 })).toBe(false);
		expect(contains(rect(0, 0), { x: 101, y: 20 })).toBe(false);
		expect(contains(rect(0, 0), { x: 50, y: -1 })).toBe(false);
		expect(contains(rect(0, 0), { x: 50, y: 41 })).toBe(false);
	});
});

describe('insertionIndex', () => {
	it('returns 0 for an empty zone', () => {
		expect(insertionIndex([], { x: 0, y: 0 })).toBe(0);
	});

	it('lands before an item once the pointer is above its midpoint', () => {
		const rects = stack(3);

		expect(insertionIndex(rects, { x: 50, y: 5 })).toBe(0);
		expect(insertionIndex(rects, { x: 50, y: 19 })).toBe(0);
	});

	it('lands after an item once the pointer passes its midpoint', () => {
		const rects = stack(3);

		expect(insertionIndex(rects, { x: 50, y: 21 })).toBe(1);
		expect(insertionIndex(rects, { x: 50, y: 61 })).toBe(2);
	});

	it('lands at the end below the last midpoint', () => {
		expect(insertionIndex(stack(3), { x: 50, y: 500 })).toBe(3);
	});

	it('switches to the x axis when the zone is horizontal', () => {
		const rects = [rect(0, 0), rect(0, 100), rect(0, 200)];

		expect(insertionIndex(rects, { x: 40, y: 20 }, 'horizontal')).toBe(0);
		expect(insertionIndex(rects, { x: 60, y: 20 }, 'horizontal')).toBe(1);
		expect(insertionIndex(rects, { x: 999, y: 20 }, 'horizontal')).toBe(3);
	});

	it('reads the gap left by the dragged item, because it was excluded', () => {
		// Three rows, the middle one is the item being dragged and so absent.
		// A pointer over that gap resolves to index 1 — where the item already
		// is — which is exactly the drop-onto-yourself no-op.
		const rects = [rect(0, 0), rect(80, 0)];

		expect(insertionIndex(rects, { x: 50, y: 60 })).toBe(1);
	});
});

describe('pickZone', () => {
	const left = { name: 'left', rect: rect(0, 0, 400, 100) };
	const right = { name: 'right', rect: rect(0, 100, 400, 100) };
	const zones = [left, right];

	it('returns the zone under the pointer', () => {
		expect(pickZone(zones, { x: 50, y: 50 })).toBe(left);
		expect(pickZone(zones, { x: 150, y: 50 })).toBe(right);
	});

	it('prefers the last containing zone, so an inner zone wins', () => {
		const outer = { name: 'outer', rect: rect(0, 0, 400, 400) };
		const inner = { name: 'inner', rect: rect(10, 10, 50, 50) };

		expect(pickZone([outer, inner], { x: 20, y: 20 })).toBe(inner);
	});

	it('claims a pointer below a short column for that column', () => {
		expect(pickZone(zones, { x: 50, y: 900 })).toBe(left);
	});

	it('claims a pointer above a column for that column', () => {
		const low = { name: 'low', rect: rect(200, 0, 100, 100) };

		expect(pickZone([low], { x: 50, y: 10 })).toBe(low);
	});

	it('picks the vertically nearest column when bands overlap', () => {
		const top = { name: 'top', rect: rect(0, 0, 100, 100) };
		const bottom = { name: 'bottom', rect: rect(300, 0, 100, 100) };

		expect(pickZone([top, bottom], { x: 50, y: 150 })).toBe(top);
		expect(pickZone([top, bottom], { x: 50, y: 280 })).toBe(bottom);
	});

	it('returns null when the pointer is outside every band', () => {
		expect(pickZone(zones, { x: 900, y: 50 })).toBeNull();
	});

	it('returns null when there are no zones', () => {
		expect(pickZone([], { x: 0, y: 0 })).toBeNull();
	});
});
