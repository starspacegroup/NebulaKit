import { describe, expect, it, vi } from 'vitest';
import {
	SERIES_COLORS,
	arcCentroid,
	arcPath,
	areaPath,
	avatarOverflow,
	axisWidth,
	bands,
	cellText,
	chartSummary,
	clean,
	codeLines,
	copyText,
	donutArcs,
	donutSummary,
	explore,
	filterRows,
	formatDelta,
	formatNumber,
	indexFromScroll,
	labelStep,
	linePath,
	nearestIndex,
	niceNumber,
	niceTicks,
	paginate,
	percentText,
	pointerRatio,
	polar,
	rangeText,
	scaleLinear,
	selectionState,
	seriesColor,
	seriesExtent,
	shouldRotate,
	slideIndex,
	sparklinePath,
	toggleAll,
	toggleSelected,
	tooltipShift,
	valueText
} from './data-logic';

describe('table logic', () => {
	const rows = [
		{ id: 1, name: 'Ada Lovelace', city: 'London', score: 90 },
		{ id: 2, name: 'Alan Turing', city: 'Manchester', score: null },
		{ id: 3, name: 'Grace Hopper', city: 'New York', score: 75 }
	];

	it('cellText turns missing values into nothing', () => {
		expect(cellText(null)).toBe('');
		expect(cellText(undefined)).toBe('');
		expect(cellText(0)).toBe('0');
	});

	it('filterRows matches every word across the chosen columns, ignoring case', () => {
		expect(filterRows(rows, '  ', ['name'])).toEqual(rows);
		expect(filterRows(rows, '', ['name'])).not.toBe(rows);
		expect(filterRows(rows, 'ada london', ['name', 'city']).map((r) => r.id)).toEqual([1]);
		expect(filterRows(rows, 'ada london', ['name'])).toEqual([]);
		expect(filterRows(rows, 'NEW', ['city']).map((r) => r.id)).toEqual([3]);
		expect(filterRows(rows, 'top', ['name'], (r) => `${r.name} top`)).toHaveLength(3);
	});

	it('paginate slices and clamps', () => {
		expect(paginate(42, 2, 10)).toEqual({ page: 2, pageCount: 5, start: 10, end: 20 });
		expect(paginate(42, 9, 10)).toEqual({ page: 5, pageCount: 5, start: 40, end: 42 });
		expect(paginate(42, -3, 10).page).toBe(1);
		expect(paginate(42, NaN, 10).page).toBe(1);
		expect(paginate(0, 1, 10)).toEqual({ page: 1, pageCount: 1, start: 0, end: 0 });
		expect(paginate(7, 3, 0)).toEqual({ page: 1, pageCount: 1, start: 0, end: 7 });
		expect(paginate(-2, 1, NaN)).toEqual({ page: 1, pageCount: 1, start: 0, end: 0 });
	});

	it('rangeText says which rows are showing', () => {
		expect(rangeText(10, 20, 42)).toBe('11–20 of 42');
		expect(rangeText(0, 0, 0)).toBe('No results');
		expect(rangeText(5, 5, 3)).toBe('No results');
	});

	it('selectionState is none, some or all of the rows in view', () => {
		expect(selectionState([1], [])).toBe('none');
		expect(selectionState([], [1, 2])).toBe('none');
		expect(selectionState([1, 9], [1, 2])).toBe('some');
		expect(selectionState([2, 1], [1, 2])).toBe('all');
	});

	it('toggleAll adds the missing rows, or clears the view when all are on', () => {
		expect(toggleAll([9, 1], [1, 2])).toEqual([9, 1, 2]);
		expect(toggleAll([9, 1, 2], [1, 2])).toEqual([9]);
	});

	it('toggleSelected flips one key', () => {
		expect(toggleSelected([1], 2)).toEqual([1, 2]);
		expect(toggleSelected([1, 2], 1)).toEqual([2]);
	});
});

describe('scales and ticks', () => {
	it('cycles the series palette, including negative indexes', () => {
		expect(seriesColor(0)).toBe('var(--color-primary)');
		expect(seriesColor(SERIES_COLORS.length + 1)).toBe(SERIES_COLORS[1]);
		expect(seriesColor(-1)).toBe(SERIES_COLORS[SERIES_COLORS.length - 1]);
	});

	it('clean drops float noise', () => {
		expect(clean(0.1 + 0.2)).toBe(0.3);
	});

	it('niceNumber rounds to 1, 2, 5 or 10 times a power of ten', () => {
		expect([1.2, 2.5, 6, 8].map((x) => niceNumber(x, true))).toEqual([1, 2, 5, 10]);
		expect([1, 1.5, 4, 6].map((x) => niceNumber(x, false))).toEqual([1, 2, 5, 10]);
		expect(niceNumber(340, false)).toBe(500);
	});

	it('niceTicks covers the range on round numbers', () => {
		expect(niceTicks(0, 84)).toEqual({
			min: 0,
			max: 100,
			step: 20,
			ticks: [0, 20, 40, 60, 80, 100]
		});
		expect(niceTicks(84, 0).max).toBe(100);
		expect(niceTicks(-0.3, 0.7).ticks).toEqual([-0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8]);
		expect(niceTicks(5, 5).ticks[0]).toBeLessThan(5);
		expect(niceTicks(0, 0)).toMatchObject({ min: 0, max: 1 });
		expect(niceTicks(NaN, Infinity)).toMatchObject({ min: 0, max: 1 });
		expect(niceTicks(0, 10, 1).ticks).toEqual([0, 10]);
	});

	it('scaleLinear maps, and a flat domain maps to the middle', () => {
		expect(scaleLinear([0, 10], [100, 0])(5)).toBe(50);
		expect(scaleLinear([3, 3], [0, 10])(99)).toBe(5);
	});

	it('bands divide a span with padding', () => {
		expect(bands(0, 0, 100)).toEqual([]);
		const [a, b] = bands(2, 0, 100, 0.2);
		expect(a).toEqual({ x: 5, width: 40, center: 25 });
		expect(b.center).toBe(75);
		expect(bands(1, 0, 10)[0].width).toBe(8);
	});

	it('nearestIndex picks the closest position', () => {
		expect(nearestIndex(5, [])).toBeNull();
		expect(nearestIndex(64, [10, 50, 90])).toBe(1);
		expect(nearestIndex(71, [10, 50, 90])).toBe(2);
	});

	it('pointerRatio is held to [0, 1]', () => {
		expect(pointerRatio(150, 100, 200)).toBe(0.25);
		expect(pointerRatio(0, 100, 200)).toBe(0);
		expect(pointerRatio(999, 100, 200)).toBe(1);
		expect(pointerRatio(5, 0, 0)).toBe(0);
	});

	it('labelStep thins labels that would collide', () => {
		expect(labelStep(0, 500)).toBe(1);
		expect(labelStep(5, 0)).toBe(1);
		expect(labelStep(5, 500)).toBe(1);
		expect(labelStep(30, 300)).toBe(6);
	});

	it('axisWidth fits the longest label', () => {
		expect(axisWidth([])).toBe(17);
		expect(axisWidth(['1,000', '0'])).toBe(45);
	});

	it('tooltipShift keeps a tooltip on the chart near its edges', () => {
		expect(tooltipShift(0.05)).toBe(0);
		expect(tooltipShift(0.5)).toBe(-50);
		expect(tooltipShift(0.95)).toBe(-100);
	});
});

describe('paths', () => {
	it('linePath breaks at missing points', () => {
		expect(linePath([])).toBe('');
		expect(
			linePath([{ x: 0, y: 1 }, { x: 1.006, y: 2 }, null, { x: 3, y: NaN }, { x: 4, y: 5 }])
		).toBe('M0,1L1.01,2M4,5');
	});

	it('areaPath closes each run down to the baseline', () => {
		expect(areaPath([{ x: 0, y: 1 }, { x: 2, y: 3 }, null], 10)).toBe('M0,10L0,1L2,3L2,10Z');
	});

	it('sparklinePath fits values to a box', () => {
		expect(sparklinePath([], 100, 20)).toBe('');
		expect(sparklinePath([NaN], 100, 20)).toBe('');
		expect(sparklinePath([4], 100, 20, 0)).toBe('M0,10L100,10');
		expect(sparklinePath([0, 10], 100, 20, 0)).toBe('M0,20L100,0');
		expect(sparklinePath([0, NaN, 10], 100, 20, 0)).toBe('M0,20M100,0');
	});

	it('donutArcs share the turn, ignoring nothing and negatives', () => {
		const arcs = donutArcs([1, -5, 3], 0);
		expect(arcs.map((a) => a.fraction)).toEqual([0.25, 0, 0.75]);
		expect(arcs[2].end).toBeCloseTo(Math.PI * 2);
		expect(donutArcs([0, NaN]).every((a) => a.fraction === 0)).toBe(true);
		expect(donutArcs([1])[0].start).toBeCloseTo(-Math.PI / 2);
	});

	it('polar and arcCentroid place points on the circle', () => {
		expect(polar(0, 0, 10, 0)).toEqual({ x: 10, y: 0 });
		const c = arcCentroid(0, 0, 10, 6, { start: 0, end: Math.PI, fraction: 0.5 });
		expect(c.x).toBeCloseTo(0);
		expect(c.y).toBeCloseTo(8);
	});

	it('arcPath draws slices, pies, full rings and nothing', () => {
		expect(arcPath(50, 50, 40, 20, 1, 1)).toBe('');
		const ring = arcPath(50, 50, 40, 20, 0, Math.PI * 2);
		expect(ring.match(/M/g)).toHaveLength(2);
		expect(arcPath(50, 50, 40, 0, 0, Math.PI * 2).match(/M/g)).toHaveLength(1);
		const small = arcPath(50, 50, 40, 20, 0, Math.PI / 2);
		expect(small).toContain('A40,40 0 0 1');
		expect(small).toContain('A20,20 0 0 0');
		expect(arcPath(50, 50, 40, 20, 0, Math.PI * 1.5)).toContain('0 1 1');
		expect(arcPath(50, 50, 40, 0, 0, 1)).toMatch(/L50,50Z$/);
	});
});

describe('formatting and summaries', () => {
	it('formats numbers and percentages', () => {
		expect(formatNumber(1234.5678)).toBe('1,234.57');
		expect(percentText(0.4567)).toBe('46%');
		expect(percentText(NaN)).toBe('0%');
		expect(valueText(3)).toBe('3');
		expect(valueText(null)).toBe('—');
		expect(valueText(undefined)).toBe('—');
		expect(valueText(NaN)).toBe('—');
		expect(valueText(2, (n) => `$${n}`)).toBe('$2');
	});

	it('seriesExtent spans every finite value', () => {
		expect(seriesExtent([])).toBeNull();
		expect(seriesExtent([{ name: 'a', values: [null] }])).toBeNull();
		expect(
			seriesExtent([
				{ name: 'a', values: [3, null, 9] },
				{ name: 'b', values: [-2] }
			])
		).toEqual([-2, 9]);
	});

	it('chartSummary names the chart, its data and its range', () => {
		expect(chartSummary('Visits', 'line chart', ['Mon'], [{ name: 'Web', values: [4] }])).toBe(
			'Visits: line chart of Web across 1 point, ranging from 4 to 4.'
		);
		expect(
			chartSummary(
				'Visits',
				'bar chart',
				['Mon', 'Tue'],
				[
					{ name: 'Web', values: [4, 1000] },
					{ name: 'App', values: [2, 3] }
				],
				(n) => `${n}!`
			)
		).toBe('Visits: bar chart of 2 series across 2 points, ranging from 2! to 1000!.');
		expect(chartSummary('Empty', 'bar chart', [], [])).toBe(
			'Empty: bar chart of 0 series across 0 points, no data.'
		);
	});

	it('donutSummary lists shares, largest first', () => {
		expect(
			donutSummary('Traffic', [
				{ label: 'Direct', value: 1 },
				{ label: 'Search', value: 3 },
				{ label: 'None', value: 0 }
			])
		).toBe('Traffic: donut chart. Search 75%, Direct 25%.');
		expect(donutSummary('Traffic', [])).toBe('Traffic: donut chart, no data.');
	});

	it('formatDelta signs, colours and words a change', () => {
		expect(formatDelta(4.25)).toEqual({
			text: '+4.3%',
			direction: 'up',
			tone: 'success',
			label: 'Up 4.3%'
		});
		expect(formatDelta(-3, { suffix: ' pts' })).toEqual({
			text: '−3 pts',
			direction: 'down',
			tone: 'danger',
			label: 'Down 3 pts'
		});
		expect(formatDelta(-1200, { invert: true, digits: 0 }).tone).toBe('success');
		expect(formatDelta(-1200, { invert: true, digits: 0 }).text).toBe('−1,200%');
		expect(formatDelta(2, { invert: true }).tone).toBe('danger');
		expect(formatDelta(0.01)).toMatchObject({ text: '0%', direction: 'flat', tone: 'neutral' });
		expect(formatDelta(NaN).label).toBe('No change');
	});
});

describe('carousel logic', () => {
	it('slideIndex wraps when looping and clamps when not', () => {
		expect(slideIndex(5, 0, true)).toBe(0);
		expect(slideIndex(-1, 4, true)).toBe(3);
		expect(slideIndex(4, 4, true)).toBe(0);
		expect(slideIndex(-1, 4, false)).toBe(0);
		expect(slideIndex(9, 4, false)).toBe(3);
		expect(slideIndex(NaN, 4, false)).toBe(0);
	});

	it('indexFromScroll reads the slide the track rests on', () => {
		expect(indexFromScroll(610, 300, 4)).toBe(2);
		expect(indexFromScroll(9999, 300, 4)).toBe(3);
		expect(indexFromScroll(100, 0, 4)).toBe(0);
	});

	it('shouldRotate only when nothing holds it', () => {
		const base = {
			interval: 3000,
			paused: false,
			hovered: false,
			focused: false,
			reducedMotion: false,
			count: 3
		};
		expect(shouldRotate(base)).toBe(true);
		expect(shouldRotate({ ...base, interval: 0 })).toBe(false);
		expect(shouldRotate({ ...base, count: 1 })).toBe(false);
		expect(shouldRotate({ ...base, paused: true })).toBe(false);
		expect(shouldRotate({ ...base, hovered: true })).toBe(false);
		expect(shouldRotate({ ...base, focused: true })).toBe(false);
		expect(shouldRotate({ ...base, reducedMotion: true })).toBe(false);
	});
});

describe('avatars and code', () => {
	it('avatarOverflow folds the rest into +N', () => {
		expect(avatarOverflow(6, 4)).toEqual({ shown: 4, rest: 2 });
		expect(avatarOverflow(3, 4)).toEqual({ shown: 3, rest: 0 });
		expect(avatarOverflow(6, 0)).toEqual({ shown: 6, rest: 0 });
		expect(avatarOverflow(-1, 2)).toEqual({ shown: 0, rest: 0 });
	});

	it('codeLines splits on any newline and drops one trailing', () => {
		expect(codeLines('a\r\nb\rc\n')).toEqual(['a', 'b', 'c']);
		expect(codeLines('')).toEqual(['']);
	});
});

describe('copyText', () => {
	it('uses the Clipboard API when it works', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		expect(await copyText('hi', { writeText }, document)).toBe(true);
		expect(writeText).toHaveBeenCalledWith('hi');
	});

	it('falls back to execCommand when the clipboard refuses or is missing', async () => {
		const writeText = vi.fn().mockRejectedValue(new Error('denied'));
		const exec = vi.fn().mockReturnValue(true);
		const doc = document as Document & { execCommand: typeof exec };
		const original = doc.execCommand;
		doc.execCommand = exec;
		try {
			expect(await copyText('hi', { writeText }, document)).toBe(true);
			expect(exec).toHaveBeenCalledWith('copy');
			expect(document.querySelector('textarea')).toBeNull();
			exec.mockImplementation(() => {
				throw new Error('nope');
			});
			expect(await copyText('hi', null, document)).toBe(false);
		} finally {
			doc.execCommand = original;
		}
	});

	it('gives up without a document', async () => {
		expect(await copyText('hi', null, null)).toBe(false);
		expect(await copyText('hi', null, {} as Document)).toBe(false);
	});

	it('defaults to the real navigator and document', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		try {
			expect(await copyText('x')).toBe(true);
			vi.stubGlobal('navigator', {});
			vi.stubGlobal('document', undefined);
			expect(await copyText('x')).toBe(false);
			vi.stubGlobal('navigator', undefined);
			expect(await copyText('x')).toBe(false);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

describe('explore', () => {
	function setup(count = 3) {
		const node = document.createElement('div');
		const onActive = vi.fn();
		const indexAt = vi.fn(() => 1);
		const action = explore(node, { count, indexAt, onActive });
		const key = (k: string) => {
			const event = new KeyboardEvent('keydown', { key: k, cancelable: true });
			node.dispatchEvent(event);
			return event.defaultPrevented;
		};
		return { node, onActive, indexAt, action, key };
	}

	it('takes one tab stop and steps through marks with the keys', () => {
		const { node, onActive, key } = setup();
		expect(node.getAttribute('tabindex')).toBe('0');
		expect(key('Escape')).toBe(false);
		expect(key('ArrowRight')).toBe(true);
		expect(onActive).toHaveBeenLastCalledWith(0);
		key('End');
		expect(onActive).toHaveBeenLastCalledWith(2);
		expect(key('Escape')).toBe(true);
		expect(onActive).toHaveBeenLastCalledWith(null);
		key('ArrowLeft');
		expect(onActive).toHaveBeenLastCalledWith(2);
		expect(key('a')).toBe(false);
	});

	it('follows the pointer, lets go on leave and blur, and skips repeats', () => {
		const { node, onActive, indexAt } = setup();
		node.dispatchEvent(new Event('pointermove'));
		node.dispatchEvent(new Event('pointermove'));
		expect(onActive).toHaveBeenCalledTimes(1);
		expect(onActive).toHaveBeenLastCalledWith(1);
		node.dispatchEvent(new Event('pointerleave'));
		expect(onActive).toHaveBeenLastCalledWith(null);
		indexAt.mockReturnValue(0);
		node.dispatchEvent(new Event('pointermove'));
		node.dispatchEvent(new Event('blur'));
		expect(onActive).toHaveBeenLastCalledWith(null);
	});

	it('drops a mark that no longer exists, and cleans up', () => {
		const { node, onActive, indexAt, action, key } = setup();
		key('End');
		const next = vi.fn();
		action.update({ count: 5, indexAt, onActive: next });
		expect(next).not.toHaveBeenCalled();
		action.update({ count: 2, indexAt, onActive: next });
		expect(next).toHaveBeenCalledWith(null);
		action.destroy();
		key('ArrowRight');
		expect(next).toHaveBeenCalledTimes(1);
		expect(node.getAttribute('tabindex')).toBe('0');
	});
});
