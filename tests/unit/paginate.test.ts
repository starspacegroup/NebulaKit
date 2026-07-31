import { describe, expect, it } from 'vitest';
import { paginate } from '../../src/lib/utils/paginate';

const nums = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe('paginate', () => {
	it('returns the first page and correct 1-based range', () => {
		const p = paginate(nums(25), 0, 10);
		expect(p.shown).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
		expect(p).toMatchObject({ pageCount: 3, page: 0, start: 1, end: 10, total: 25 });
	});

	it('returns a middle page', () => {
		const p = paginate(nums(25), 1, 10);
		expect(p.shown).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
		expect(p).toMatchObject({ start: 11, end: 20 });
	});

	it('returns a short final page', () => {
		const p = paginate(nums(25), 2, 10);
		expect(p.shown).toEqual([21, 22, 23, 24, 25]);
		expect(p).toMatchObject({ page: 2, start: 21, end: 25, pageCount: 3 });
	});

	it('clamps a page beyond the end to the last page', () => {
		const p = paginate(nums(25), 99, 10);
		expect(p.page).toBe(2);
		expect(p.shown).toEqual([21, 22, 23, 24, 25]);
	});

	it('clamps a negative page to 0', () => {
		expect(paginate(nums(25), -5, 10).page).toBe(0);
	});

	it('handles an empty list (one page, zeroed range)', () => {
		expect(paginate([], 0, 10)).toMatchObject({
			shown: [],
			pageCount: 1,
			page: 0,
			start: 0,
			end: 0,
			total: 0
		});
	});

	it('handles a list shorter than a page (no clamping needed)', () => {
		const p = paginate(nums(6), 0, 10);
		expect(p.shown).toHaveLength(6);
		expect(p).toMatchObject({ pageCount: 1, start: 1, end: 6 });
	});

	it('guards against a non-positive pageSize', () => {
		const p = paginate(nums(3), 0, 0);
		expect(p.shown).toEqual([1]);
		expect(p.pageCount).toBe(3);
	});
});
