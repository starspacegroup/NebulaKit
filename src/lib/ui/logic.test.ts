import { beforeEach, describe, expect, it } from 'vitest';
import {
	initials,
	nextIndex,
	pageRange,
	percent,
	resetUid,
	sortRows,
	toggleSort,
	uid
} from './logic';

describe('uid', () => {
	beforeEach(() => resetUid());

	it('counts up per call, with a prefix', () => {
		expect(uid()).toBe('ui-1');
		expect(uid('field')).toBe('field-2');
	});

	it('starts again after a reset', () => {
		uid();
		resetUid();
		expect(uid()).toBe('ui-1');
	});
});

describe('initials', () => {
	it('takes the first and last word', () => {
		expect(initials('Ada Lovelace')).toBe('AL');
		expect(initials('  grace  brewster murray hopper ')).toBe('GH');
	});

	it('takes one letter from one word, and a ? from nothing', () => {
		expect(initials('plato')).toBe('P');
		expect(initials('   ')).toBe('?');
	});
});

describe('percent', () => {
	it('scales and clamps', () => {
		expect(percent(25)).toBe(25);
		expect(percent(3, 4)).toBe(75);
		expect(percent(150)).toBe(100);
		expect(percent(-5)).toBe(0);
	});

	it('is 0 for a bad max or value', () => {
		expect(percent(5, 0)).toBe(0);
		expect(percent(5, -1)).toBe(0);
		expect(percent(Number.NaN)).toBe(0);
	});
});

describe('pageRange', () => {
	it('shows every page when there are few', () => {
		expect(pageRange(1, 1)).toEqual([1]);
		expect(pageRange(2, 5)).toEqual([1, 2, 3, 4, 5]);
	});

	it('puts gaps where pages are skipped', () => {
		expect(pageRange(10, 20)).toEqual([1, 'gap', 9, 10, 11, 'gap', 20]);
		expect(pageRange(1, 20)).toEqual([1, 2, 'gap', 20]);
		expect(pageRange(20, 20)).toEqual([1, 'gap', 19, 20]);
	});

	it('shows a single skipped page rather than a gap', () => {
		expect(pageRange(4, 20)).toEqual([1, 2, 3, 4, 5, 'gap', 20]);
		expect(pageRange(17, 20)).toEqual([1, 'gap', 16, 17, 18, 19, 20]);
	});

	it('clamps the current page and handles no pages', () => {
		expect(pageRange(99, 3)).toEqual([1, 2, 3]);
		expect(pageRange(-4, 3)).toEqual([1, 2, 3]);
		expect(pageRange(1, 0)).toEqual([]);
	});

	it('widens with more siblings', () => {
		expect(pageRange(10, 20, 2)).toEqual([1, 'gap', 8, 9, 10, 11, 12, 'gap', 20]);
	});
});

describe('nextIndex', () => {
	it('steps and wraps with the arrows for its orientation', () => {
		expect(nextIndex(0, 3, 'ArrowRight')).toBe(1);
		expect(nextIndex(2, 3, 'ArrowRight')).toBe(0);
		expect(nextIndex(0, 3, 'ArrowLeft')).toBe(2);
		expect(nextIndex(0, 3, 'ArrowDown', 'vertical')).toBe(1);
		expect(nextIndex(0, 3, 'ArrowUp', 'vertical')).toBe(2);
		expect(nextIndex(0, 3, 'ArrowDown')).toBeNull();
	});

	it('jumps with Home and End', () => {
		expect(nextIndex(1, 4, 'Home')).toBe(0);
		expect(nextIndex(1, 4, 'End')).toBe(3);
	});

	it('skips disabled items', () => {
		expect(nextIndex(0, 4, 'ArrowRight', 'horizontal', [1, 2])).toBe(3);
		expect(nextIndex(0, 3, 'Home', 'horizontal', [0])).toBe(1);
		expect(nextIndex(0, 3, 'End', 'horizontal', [2])).toBe(1);
	});

	it('returns null for other keys, no items, or nothing usable', () => {
		expect(nextIndex(0, 3, 'Enter')).toBeNull();
		expect(nextIndex(0, 0, 'ArrowRight')).toBeNull();
		expect(nextIndex(0, 2, 'ArrowRight', 'horizontal', [0, 1])).toBeNull();
		// An out-of-range index in the list must not hide a usable item.
		expect(nextIndex(0, 2, 'ArrowRight', 'horizontal', [0, 5])).toBe(1);
	});
});

describe('sortRows', () => {
	const rows = [
		{ name: 'item 10', size: 3, note: 'b' },
		{ name: 'item 2', size: 1, note: '' },
		{ name: 'item 1', size: 3, note: 'a' }
	];

	it('sorts strings with numeric collation, both ways', () => {
		expect(sortRows(rows, 'name').map((r) => r.name)).toEqual(['item 1', 'item 2', 'item 10']);
		expect(sortRows(rows, 'name', 'descending').map((r) => r.name)).toEqual([
			'item 10',
			'item 2',
			'item 1'
		]);
	});

	it('sorts numbers as numbers and keeps ties stable', () => {
		expect(sortRows(rows, 'size').map((r) => r.name)).toEqual(['item 2', 'item 10', 'item 1']);
		expect(sortRows(rows, 'size', 'descending').map((r) => r.name)).toEqual([
			'item 10',
			'item 1',
			'item 2'
		]);
	});

	it('puts missing values last in either direction', () => {
		expect(sortRows(rows, 'note').map((r) => r.note)).toEqual(['a', 'b', '']);
		expect(sortRows(rows, 'note', 'descending').map((r) => r.note)).toEqual(['b', 'a', '']);
		const blanks = [{ v: null }, { v: undefined }];
		expect(sortRows(blanks, 'v')).toEqual(blanks);
	});

	it('does not touch the input', () => {
		const copy = [...rows];
		sortRows(rows, 'name', 'descending');
		expect(rows).toEqual(copy);
	});
});

describe('toggleSort', () => {
	it('starts ascending, flips to descending, then back', () => {
		expect(toggleSort(null, 'a')).toEqual({ key: 'a', direction: 'ascending' });
		expect(toggleSort({ key: 'a', direction: 'ascending' }, 'a')).toEqual({
			key: 'a',
			direction: 'descending'
		});
		expect(toggleSort({ key: 'a', direction: 'descending' }, 'a')).toEqual({
			key: 'a',
			direction: 'ascending'
		});
		expect(toggleSort({ key: 'a', direction: 'descending' }, 'b')).toEqual({
			key: 'b',
			direction: 'ascending'
		});
	});
});
