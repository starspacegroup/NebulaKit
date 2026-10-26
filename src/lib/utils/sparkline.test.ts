import { describe, it, expect } from 'vitest';
import { sparklinePoints } from './sparkline';

const box = { width: 100, height: 20, padding: 0 };

describe('sparklinePoints', () => {
	it('draws nothing for an empty series', () => {
		expect(sparklinePoints([], box)).toBe('');
	});

	it('draws nothing for a single reading, which has no shape', () => {
		expect(sparklinePoints([5], box)).toBe('');
	});

	it('spreads readings evenly across the width', () => {
		const points = sparklinePoints([0, 1, 2], box).split(' ');

		expect(points.map((p) => p.split(',')[0])).toEqual(['0.00', '50.00', '100.00']);
	});

	it('inverts the y axis, so the highest reading sits at the top', () => {
		const [first, , last] = sparklinePoints([0, 5, 10], box).split(' ');

		expect(first).toBe('0.00,20.00');
		expect(last).toBe('100.00,0.00');
	});

	it('draws a flat series down the middle, not along the floor', () => {
		expect(sparklinePoints([7, 7, 7], box)).toBe('0.00,10.00 50.00,10.00 100.00,10.00');
	});

	it('insets by the padding so the stroke is not clipped', () => {
		const points = sparklinePoints([0, 10], { width: 100, height: 20, padding: 2 });

		expect(points).toBe('0.00,18.00 100.00,2.00');
	});

	it('defaults the padding when none is given', () => {
		expect(sparklinePoints([0, 10], { width: 10, height: 20 })).toBe('0.00,18.00 10.00,2.00');
	});
});
