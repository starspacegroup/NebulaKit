import { describe, expect, it } from 'vitest';
import {
	buildBarChartGeometry,
	fillDailySeries,
	fillHourlySeries,
	fillMonthlySeries,
	formatHourLabel,
	formatMonthLabel,
	niceMax,
	type MonthlyPoint
} from '../../src/lib/utils/stats-timeseries';

describe('formatMonthLabel', () => {
	it('renders YYYY-MM as "Mon \'YY"', () => {
		expect(formatMonthLabel('2024-11')).toBe("Nov '24");
		expect(formatMonthLabel('2026-01')).toBe("Jan '26");
	});

	it('falls back to "?" for an out-of-range month', () => {
		expect(formatMonthLabel('2024-13')).toBe("? '24");
	});
});

describe('fillMonthlySeries', () => {
	it('gap-fills missing months with zero and runs cumulative totals', () => {
		const series = fillMonthlySeries([
			{ ym: '2024-11', count: 24 },
			{ ym: '2025-01', count: 9 } // 2024-12 is missing -> must be filled with 0
		]);
		expect(series.map((p) => p.ym)).toEqual(['2024-11', '2024-12', '2025-01']);
		expect(series.map((p) => p.count)).toEqual([24, 0, 9]);
		expect(series.map((p) => p.cumulative)).toEqual([24, 24, 33]);
	});

	it('spans a year boundary correctly', () => {
		const series = fillMonthlySeries([
			{ ym: '2025-11', count: 1 },
			{ ym: '2026-02', count: 1 }
		]);
		expect(series.map((p) => p.ym)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
		expect(series).toHaveLength(4);
	});

	it('ignores rows with a null/empty ym', () => {
		const series = fillMonthlySeries([
			{ ym: null, count: 5 },
			{ ym: '', count: 5 },
			{ ym: '2025-03', count: 2 }
		]);
		expect(series).toEqual([{ ym: '2025-03', label: "Mar '25", count: 2, cumulative: 2 }]);
	});

	it('merges duplicate months and tolerates null counts', () => {
		const series = fillMonthlySeries([
			{ ym: '2025-03', count: 2 },
			{ ym: '2025-03', count: null as unknown as number }
		]);
		expect(series).toEqual([{ ym: '2025-03', label: "Mar '25", count: 2, cumulative: 2 }]);
	});

	it('returns an empty array when there is no dated data', () => {
		expect(fillMonthlySeries([])).toEqual([]);
		expect(fillMonthlySeries([{ ym: null, count: 3 }])).toEqual([]);
	});
});

describe('niceMax', () => {
	it('rounds up to a 1/2/5 × 10ⁿ ceiling', () => {
		expect(niceMax(1)).toBe(1);
		expect(niceMax(3)).toBe(5);
		expect(niceMax(7)).toBe(10);
		expect(niceMax(24)).toBe(50);
		expect(niceMax(140)).toBe(200);
	});

	it('never returns zero for non-positive input', () => {
		expect(niceMax(0)).toBe(1);
		expect(niceMax(-4)).toBe(1);
	});
});

describe('buildBarChartGeometry', () => {
	const series: MonthlyPoint[] = [
		{ ym: '2024-11', label: "Nov '24", count: 24, cumulative: 24 },
		{ ym: '2024-12', label: "Dec '24", count: 44, cumulative: 68 },
		{ ym: '2025-01', label: "Jan '25", count: 0, cumulative: 68 }
	];

	it('produces one bar per point, all anchored to the baseline', () => {
		const g = buildBarChartGeometry(series, { width: 300, height: 120 });
		expect(g.bars).toHaveLength(3);
		for (const bar of g.bars) {
			expect(bar.y + bar.height).toBeCloseTo(g.baselineY, 5);
			expect(bar.x).toBeGreaterThanOrEqual(g.plotLeft);
			expect(bar.x + bar.width).toBeLessThanOrEqual(g.plotRight + 0.001);
		}
	});

	it('scales bar height to the nice y-max (tallest bar fills the plot)', () => {
		const g = buildBarChartGeometry(series);
		expect(g.yMax).toBe(niceMax(44)); // 50
		const tallest = g.bars.reduce((a, b) => (b.height > a.height ? b : a));
		expect(tallest.point.count).toBe(44);
		// A zero-count month has no bar height.
		expect(g.bars[2].height).toBe(0);
	});

	it('always labels the first and last month on the x axis', () => {
		const g = buildBarChartGeometry(series, { maxXLabels: 2 });
		const labels = g.xTicks.map((t) => t.label);
		expect(labels[0]).toBe("Nov '24");
		expect(labels[labels.length - 1]).toBe("Jan '25");
	});

	it('does not place a strided x label adjacent to the always-shown last one', () => {
		// 20 months, ~8 labels -> stride 3. The strided index 18 sits one slot from
		// the last (19); it must be dropped so the final two labels never collide.
		const dense = fillMonthlySeries([
			{ ym: '2024-11', count: 1 },
			{ ym: '2026-06', count: 1 }
		]);
		expect(dense).toHaveLength(20);
		const labels = buildBarChartGeometry(dense, { maxXLabels: 8 }).xTicks.map((t) => t.label);
		expect(labels).toContain("Jun '26"); // last, always shown
		expect(labels).toContain("Feb '26"); // strided index 15, safely spaced
		expect(labels).not.toContain("May '26"); // strided index 18 — too close to last, dropped
	});

	it('includes 0 and the max as y ticks', () => {
		const g = buildBarChartGeometry(series);
		const values = g.yTicks.map((t) => t.value);
		expect(values).toContain(0);
		expect(values).toContain(g.yMax);
	});

	it('flags an empty series without throwing', () => {
		const g = buildBarChartGeometry([]);
		expect(g.empty).toBe(true);
		expect(g.bars).toEqual([]);
		expect(g.xTicks).toEqual([]);
	});
});

describe('fillDailySeries', () => {
	it('gap-fills days across the window with cumulative totals', () => {
		const series = fillDailySeries(
			[
				{ day: '2026-07-14', count: 3 },
				{ day: '2026-07-16', count: 2 }
			],
			'2026-07-13',
			'2026-07-16'
		);

		expect(series.map((p) => p.ym)).toEqual([
			'2026-07-13',
			'2026-07-14',
			'2026-07-15',
			'2026-07-16'
		]);
		expect(series.map((p) => p.count)).toEqual([0, 3, 0, 2]);
		expect(series.map((p) => p.cumulative)).toEqual([0, 3, 3, 5]);
		expect(series[3].label).toBe('Jul 16');
	});

	it('sums duplicate day rows and ignores empty days', () => {
		const series = fillDailySeries(
			[
				{ day: '2026-07-16', count: 1 },
				{ day: '2026-07-16', count: 4 },
				{ day: '', count: 9 }
			],
			'2026-07-16',
			'2026-07-16'
		);
		expect(series).toHaveLength(1);
		expect(series[0].count).toBe(5);
	});

	it('returns [] for unparseable bounds', () => {
		expect(fillDailySeries([], 'nope', '2026-07-16')).toEqual([]);
	});
});

describe('formatHourLabel', () => {
	it('renders the hour, and the day label at midnight', () => {
		expect(formatHourLabel('2026-07-23T14')).toBe('14:00');
		expect(formatHourLabel('2026-07-23T09')).toBe('09:00');
		expect(formatHourLabel('2026-07-23T00')).toBe('Jul 23');
	});

	it('falls back to "?" for an unparseable hour', () => {
		expect(formatHourLabel('2026-07-23')).toBe('?');
	});
});

describe('fillHourlySeries', () => {
	it('gap-fills the trailing hours across a day boundary', () => {
		const series = fillHourlySeries(
			[
				{ hourKey: '2026-07-22T23', count: 4 },
				{ hourKey: '2026-07-23T01', count: 6 }
			],
			'2026-07-23T02',
			4
		);

		expect(series.map((p) => p.ym)).toEqual([
			'2026-07-22T23',
			'2026-07-23T00',
			'2026-07-23T01',
			'2026-07-23T02'
		]);
		expect(series.map((p) => p.count)).toEqual([4, 0, 6, 0]);
		expect(series.map((p) => p.cumulative)).toEqual([4, 4, 10, 10]);
		expect(series.map((p) => p.label)).toEqual(['23:00', 'Jul 23', '01:00', '02:00']);
	});

	it('sums duplicate hour rows and ignores empty keys', () => {
		const series = fillHourlySeries(
			[
				{ hourKey: '2026-07-23T05', count: 2 },
				{ hourKey: '2026-07-23T05', count: 3 },
				{ hourKey: '', count: 99 }
			],
			'2026-07-23T05',
			1
		);
		expect(series).toHaveLength(1);
		expect(series[0].count).toBe(5);
	});

	it('spans a full 24-hour window', () => {
		expect(fillHourlySeries([], '2026-07-23T10', 24)).toHaveLength(24);
	});

	it('returns [] for an unparseable anchor or a non-positive span', () => {
		expect(fillHourlySeries([], 'nope', 24)).toEqual([]);
		expect(fillHourlySeries([], '2026-07-23T10', 0)).toEqual([]);
	});
});
