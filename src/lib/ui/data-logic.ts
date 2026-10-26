/**
 * The decisions the data-display components make: which rows a data table
 * shows and which are selected, the scales, ticks and paths a chart draws,
 * which slide a carousel lands on, how a stat words its change.
 *
 * Pure functions apart from `explore` (a Svelte action) and `copyText`, which
 * take the DOM they touch as arguments so they can be tested too.
 */

import { nextIndex } from './logic';

/* ------------------------------------------------------------------ table */

type Row = Record<string, unknown>;

/** Plain text of a value, the way a search should see it. */
export function cellText(value: unknown): string {
	if (value === null || value === undefined) return '';
	return String(value);
}

/**
 * Rows whose chosen columns match a query. Every word of the query has to
 * appear somewhere in the row (in any of the columns), case-insensitively, so
 * "ada london" finds Ada in London. An empty query keeps every row.
 */
export function filterRows<T extends Row>(
	rows: readonly T[],
	query: string,
	keys: readonly string[],
	text: (row: T, key: string) => string = (row, key) => cellText(row[key])
): T[] {
	const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
	if (terms.length === 0) return rows.slice();
	return rows.filter((row) => {
		const haystack = keys.map((key) => text(row, key).toLocaleLowerCase()).join('\n');
		return terms.every((term) => haystack.includes(term));
	});
}

export interface PageSlice {
	/** The page actually shown, held to [1, pageCount]. */
	page: number;
	pageCount: number;
	/** Index of the first row on the page, and one past the last. */
	start: number;
	end: number;
}

/**
 * Which slice of `count` rows a page shows. A page size of 0 or less shows
 * everything on one page. There is always at least one page, even when empty.
 */
export function paginate(count: number, page: number, pageSize: number): PageSlice {
	const total = Math.max(0, Math.floor(count));
	if (!(pageSize > 0)) return { page: 1, pageCount: 1, start: 0, end: total };
	const pageCount = Math.max(1, Math.ceil(total / pageSize));
	const current = Math.min(Math.max(1, Math.round(page) || 1), pageCount);
	const start = (current - 1) * pageSize;
	return { page: current, pageCount, start, end: Math.min(total, start + pageSize) };
}

/** "11–20 of 42", or "No results" when there is nothing. */
export function rangeText(start: number, end: number, count: number): string {
	if (count === 0 || end <= start) return 'No results';
	return `${start + 1}–${end} of ${count}`;
}

export type SelectionState = 'none' | 'some' | 'all';

/** What a select-all checkbox shows for the rows in view: off, mixed or on. */
export function selectionState<K>(selected: readonly K[], visible: readonly K[]): SelectionState {
	if (visible.length === 0) return 'none';
	const count = visible.filter((key) => selected.includes(key)).length;
	if (count === 0) return 'none';
	return count === visible.length ? 'all' : 'some';
}

/**
 * Select-all pressed: when every row in view is selected it clears them,
 * otherwise it adds the ones missing. Selections outside the view are kept.
 */
export function toggleAll<K>(selected: readonly K[], visible: readonly K[]): K[] {
	if (selectionState(selected, visible) === 'all') {
		return selected.filter((key) => !visible.includes(key));
	}
	return [...selected, ...visible.filter((key) => !selected.includes(key))];
}

/** One row's checkbox pressed. */
export function toggleSelected<K>(selected: readonly K[], key: K): K[] {
	return selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key];
}

/* ----------------------------------------------------------------- charts */

/** The chart palette, in order. Series cycle through it. */
export const SERIES_COLORS = [
	'var(--color-primary)',
	'var(--color-success)',
	'var(--color-warning)',
	'var(--color-danger)',
	'var(--color-secondary)'
] as const;

export function seriesColor(index: number): string {
	const n = SERIES_COLORS.length;
	return SERIES_COLORS[((Math.floor(index) % n) + n) % n];
}

/** Floating-point noise off a computed number: 0.30000000000000004 → 0.3. */
export function clean(n: number): number {
	return Number(n.toPrecision(12));
}

/** A "nice" number near `x`: 1, 2 or 5 times a power of ten. */
export function niceNumber(x: number, round: boolean): number {
	const exponent = Math.floor(Math.log10(x));
	const power = 10 ** exponent;
	const f = x / power;
	let nice: number;
	if (round) nice = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
	else nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
	return nice * power;
}

export interface Ticks {
	min: number;
	max: number;
	step: number;
	ticks: number[];
}

/**
 * Axis ticks on round numbers that cover [min, max] in about `count` steps
 * (Heckbert's "nice numbers"). A flat range is widened so the axis still has
 * height; anything not finite falls back to 0–1.
 */
export function niceTicks(min: number, max: number, count = 5): Ticks {
	let lo = Number.isFinite(min) ? min : 0;
	let hi = Number.isFinite(max) ? max : 1;
	if (lo > hi) [lo, hi] = [hi, lo];
	if (lo === hi) {
		const pad = lo === 0 ? 1 : Math.abs(lo) / 2;
		lo -= lo === 0 ? 0 : pad;
		hi += pad;
	}
	const range = niceNumber(hi - lo, false);
	const step = niceNumber(range / Math.max(1, count - 1), true);
	const niceMin = clean(Math.floor(lo / step) * step);
	const niceMax = clean(Math.ceil(hi / step) * step);
	const ticks: number[] = [];
	for (let v = niceMin; v <= niceMax + step / 2; v += step) ticks.push(clean(v));
	return { min: niceMin, max: niceMax, step, ticks };
}

/** Maps a domain onto a range in a straight line. A zero-width domain maps to the middle. */
export function scaleLinear(
	domain: readonly [number, number],
	range: readonly [number, number]
): (value: number) => number {
	const [d0, d1] = domain;
	const [r0, r1] = range;
	if (d0 === d1) return () => (r0 + r1) / 2;
	return (value) => r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
}

/** `count` equal bands across [start, end], each with `padding` of its step left empty. */
export function bands(
	count: number,
	start: number,
	end: number,
	padding = 0.2
): { x: number; width: number; center: number }[] {
	if (count < 1) return [];
	const step = (end - start) / count;
	const width = step * (1 - padding);
	return Array.from({ length: count }, (_, i) => {
		const x = start + i * step + (step - width) / 2;
		return { x, width, center: x + width / 2 };
	});
}

/** The index whose position is nearest `x`, or null when there are none. */
export function nearestIndex(x: number, positions: readonly number[]): number | null {
	let best: number | null = null;
	let distance = Infinity;
	positions.forEach((p, i) => {
		const d = Math.abs(p - x);
		if (d < distance) {
			distance = d;
			best = i;
		}
	});
	return best;
}

/** Where a pointer sits across an element, from 0 to 1. A zero-width element is 0. */
export function pointerRatio(clientX: number, left: number, width: number): number {
	if (!(width > 0)) return 0;
	return Math.min(1, Math.max(0, (clientX - left) / width));
}

/** Every `step`th category label is drawn, so labels never collide. */
export function labelStep(count: number, width: number, minGap = 56): number {
	if (count < 1 || !(width > 0)) return 1;
	return Math.max(1, Math.ceil((count * minGap) / width));
}

/** Room for the widest tick label, roughly, at the chart's font size. */
export function axisWidth(labels: readonly string[], charWidth = 7): number {
	const longest = labels.reduce((n, label) => Math.max(n, label.length), 1);
	return Math.ceil(longest * charWidth) + 10;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export type Point = { x: number; y: number } | null;

/** Runs of consecutive points, split wherever a point is missing. */
function segments(points: readonly Point[]): { x: number; y: number }[][] {
	const runs: { x: number; y: number }[][] = [];
	let run: { x: number; y: number }[] = [];
	for (const p of points) {
		if (p && Number.isFinite(p.y)) run.push(p);
		else if (run.length) {
			runs.push(run);
			run = [];
		}
	}
	if (run.length) runs.push(run);
	return runs;
}

/** An SVG path through the points; a missing point leaves a gap in the line. */
export function linePath(points: readonly Point[]): string {
	return segments(points)
		.map((run) => run.map((p, i) => `${i ? 'L' : 'M'}${r2(p.x)},${r2(p.y)}`).join(''))
		.join('');
}

/** The area between the line and `baseline`, one closed shape per unbroken run. */
export function areaPath(points: readonly Point[], baseline: number): string {
	return segments(points)
		.map((run) => {
			const first = run[0];
			const last = run[run.length - 1];
			const top = run.map((p) => `L${r2(p.x)},${r2(p.y)}`).join('');
			return `M${r2(first.x)},${r2(baseline)}${top}L${r2(last.x)},${r2(baseline)}Z`;
		})
		.join('');
}

/** A sparkline path through `values`, fitted to a width × height box. */
export function sparklinePath(
	values: readonly number[],
	width: number,
	height: number,
	padding = 2
): string {
	const finite = values.filter((v) => Number.isFinite(v));
	if (finite.length === 0) return '';
	const lo = Math.min(...finite);
	const hi = Math.max(...finite);
	const x = scaleLinear([0, Math.max(1, values.length - 1)], [padding, width - padding]);
	const y = scaleLinear([lo, hi], [height - padding, padding]);
	if (values.length === 1) {
		const mid = y(finite[0]);
		return linePath([
			{ x: padding, y: mid },
			{ x: width - padding, y: mid }
		]);
	}
	return linePath(values.map((v, i) => (Number.isFinite(v) ? { x: x(i), y: y(v) } : null)));
}

export interface Arc {
	start: number;
	end: number;
	/** This slice's share of the whole, 0–1. */
	fraction: number;
}

/**
 * Slices of a donut, in radians, clockwise from 12 o'clock. Negative or
 * missing values count as nothing; when everything is nothing, every slice
 * is empty.
 */
export function donutArcs(values: readonly number[], startAngle = -Math.PI / 2): Arc[] {
	const safe = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
	const total = safe.reduce((a, b) => a + b, 0);
	let angle = startAngle;
	return safe.map((v) => {
		const fraction = total > 0 ? v / total : 0;
		const start = angle;
		angle += fraction * Math.PI * 2;
		return { start, end: angle, fraction };
	});
}

/** A point on a circle. Angles are radians clockwise from 3 o'clock, as SVG draws them. */
export function polar(cx: number, cy: number, r: number, angle: number): { x: number; y: number } {
	return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

/**
 * An SVG path for one ring slice between radii `inner` and `outer`. An inner
 * radius of 0 draws a pie slice. A full turn draws the whole ring (use
 * fill-rule="evenodd" so the hole stays empty). An empty slice draws nothing.
 */
export function arcPath(
	cx: number,
	cy: number,
	outer: number,
	inner: number,
	start: number,
	end: number
): string {
	const sweep = end - start;
	if (!(sweep > 0)) return '';
	if (sweep >= Math.PI * 2 - 1e-6) {
		const circle = (r: number) =>
			`M${r2(cx + r)},${r2(cy)}A${r},${r} 0 1 1 ${r2(cx - r)},${r2(cy)}A${r},${r} 0 1 1 ${r2(cx + r)},${r2(cy)}Z`;
		return inner > 0 ? circle(outer) + circle(inner) : circle(outer);
	}
	const large = sweep > Math.PI ? 1 : 0;
	const o0 = polar(cx, cy, outer, start);
	const o1 = polar(cx, cy, outer, end);
	const outerArc = `M${r2(o0.x)},${r2(o0.y)}A${outer},${outer} 0 ${large} 1 ${r2(o1.x)},${r2(o1.y)}`;
	if (!(inner > 0)) return `${outerArc}L${r2(cx)},${r2(cy)}Z`;
	const i0 = polar(cx, cy, inner, start);
	const i1 = polar(cx, cy, inner, end);
	return `${outerArc}L${r2(i1.x)},${r2(i1.y)}A${inner},${inner} 0 ${large} 0 ${r2(i0.x)},${r2(i0.y)}Z`;
}

/** The middle of a slice, between its radii — where its tooltip points. */
export function arcCentroid(
	cx: number,
	cy: number,
	outer: number,
	inner: number,
	arc: Arc
): { x: number; y: number } {
	return polar(cx, cy, (outer + inner) / 2, (arc.start + arc.end) / 2);
}

/** A whole-number percentage of a fraction: 0.4567 → "46%". */
export function percentText(fraction: number): string {
	return `${Math.round((Number.isFinite(fraction) ? fraction : 0) * 100)}%`;
}

/** The kit's default number format: grouped, at most two decimals. */
export function formatNumber(n: number): string {
	return clean(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** A value as a cell or tooltip shows it; a missing one is a dash. */
export function valueText(
	value: number | null | undefined,
	format: (n: number) => string = formatNumber
): string {
	return typeof value === 'number' && Number.isFinite(value) ? format(value) : '—';
}

/**
 * How far to pull a tooltip back over its anchor, in percent of its own
 * width: centred in the middle of a chart, flush to the edge near either
 * side, so it never hangs off the chart on a narrow screen.
 */
export function tooltipShift(fraction: number): number {
	if (fraction < 0.2) return 0;
	if (fraction > 0.8) return -100;
	return -50;
}

export interface Series {
	name: string;
	values: readonly (number | null)[];
}

/** Every finite value across the series, for working out a domain. */
export function seriesExtent(series: readonly Series[]): [number, number] | null {
	const all = series.flatMap((s) => s.values).filter((v): v is number => Number.isFinite(v));
	if (all.length === 0) return null;
	return [Math.min(...all), Math.max(...all)];
}

/**
 * What a screen reader hears for a chart before it reaches the data table:
 * the title, the kind, how much data, and the range it spans.
 */
export function chartSummary(
	title: string,
	kind: string,
	labels: readonly string[],
	series: readonly Series[],
	format: (n: number) => string = formatNumber
): string {
	const what = series.length === 1 ? series[0].name : `${series.length} series`;
	const head = `${title}: ${kind} of ${what} across ${labels.length} ${labels.length === 1 ? 'point' : 'points'}`;
	const extent = seriesExtent(series);
	if (!extent) return `${head}, no data.`;
	return `${head}, ranging from ${format(extent[0])} to ${format(extent[1])}.`;
}

/** A donut's summary: each slice's label and share, largest first. */
export function donutSummary(
	title: string,
	data: readonly { label: string; value: number }[]
): string {
	const arcs = donutArcs(data.map((d) => d.value));
	const parts = data
		.map((d, i) => ({ label: d.label, fraction: arcs[i].fraction }))
		.filter((d) => d.fraction > 0)
		.sort((a, b) => b.fraction - a.fraction)
		.map((d) => `${d.label} ${percentText(d.fraction)}`);
	return parts.length
		? `${title}: donut chart. ${parts.join(', ')}.`
		: `${title}: donut chart, no data.`;
}

export interface ExploreOptions {
	/** How many marks there are to step through. */
	count: number;
	/** Which mark a pointer event is over, or null for none. */
	indexAt: (event: PointerEvent) => number | null;
	/** Called with the mark to show a tooltip for, or null to hide it. */
	onActive: (index: number | null) => void;
}

/**
 * Svelte action: makes a chart explorable. A pointer over the chart picks the
 * mark under it; the chart itself takes one tab stop, and arrow keys, Home and
 * End step through the marks while Escape lets go. The marks stay out of the
 * tab order — the hidden data table is how a screen reader gets the numbers.
 */
export function explore(node: Element, options: ExploreOptions) {
	let opts = options;
	let current = -1;

	const set = (index: number | null) => {
		if ((index ?? -1) === current) return;
		current = index ?? -1;
		opts.onActive(index);
	};

	const keydown = (event: Event) => {
		const key = (event as KeyboardEvent).key;
		if (key === 'Escape') {
			if (current < 0) return;
			event.preventDefault();
			set(null);
			return;
		}
		const from = current < 0 && key === 'ArrowLeft' ? opts.count : current;
		const next = nextIndex(from, opts.count, key);
		if (next === null) return;
		event.preventDefault();
		set(next);
	};
	const move = (event: Event) => set(opts.indexAt(event as PointerEvent));
	const leave = () => set(null);

	node.setAttribute('tabindex', '0');
	node.addEventListener('keydown', keydown);
	node.addEventListener('pointermove', move);
	node.addEventListener('pointerleave', leave);
	node.addEventListener('blur', leave);

	return {
		update(next: ExploreOptions) {
			opts = next;
			if (current >= next.count) set(null);
		},
		destroy() {
			node.removeEventListener('keydown', keydown);
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerleave', leave);
			node.removeEventListener('blur', leave);
		}
	};
}

/* --------------------------------------------------------------- carousel */

/** A slide index kept in range: wrapped round when looping, held at the ends when not. */
export function slideIndex(index: number, count: number, loop: boolean): number {
	if (count < 1) return 0;
	const i = Math.round(index) || 0;
	if (loop) return ((i % count) + count) % count;
	return Math.min(count - 1, Math.max(0, i));
}

/** Which slide a carousel's track is scrolled to. */
export function indexFromScroll(scrollLeft: number, slideWidth: number, count: number): number {
	if (!(slideWidth > 0)) return 0;
	return slideIndex(scrollLeft / slideWidth, count, false);
}

/**
 * Whether autoplay should turn the slides now: only when it is on, nobody has
 * paused it, the pointer and focus are elsewhere, and reduced motion is off.
 */
export function shouldRotate(state: {
	interval: number;
	paused: boolean;
	hovered: boolean;
	focused: boolean;
	reducedMotion: boolean;
	count: number;
}): boolean {
	return (
		state.interval > 0 &&
		state.count > 1 &&
		!state.paused &&
		!state.hovered &&
		!state.focused &&
		!state.reducedMotion
	);
}

/* ----------------------------------------------------- stat, avatars, code */

export interface Delta {
	/** "+4.2%", "−3%" (a real minus sign), "0%". */
	text: string;
	direction: 'up' | 'down' | 'flat';
	tone: 'success' | 'danger' | 'neutral';
	/** "Up 4.2%" — what a screen reader hears in place of the arrow. */
	label: string;
}

/**
 * How a stat words its change. Up is good and green unless `invert` (for a
 * metric where falling is the win, like errors or churn).
 */
export function formatDelta(
	delta: number,
	options: { invert?: boolean; suffix?: string; digits?: number } = {}
): Delta {
	const { invert = false, suffix = '%', digits = 1 } = options;
	const size = clean(Number(Math.abs(delta).toFixed(digits)));
	const magnitude = `${size.toLocaleString('en-US', { maximumFractionDigits: digits })}${suffix}`;
	if (!Number.isFinite(delta) || size === 0) {
		return { text: `0${suffix}`, direction: 'flat', tone: 'neutral', label: 'No change' };
	}
	const up = delta > 0;
	const good = up !== invert;
	return {
		text: `${up ? '+' : '−'}${magnitude}`,
		direction: up ? 'up' : 'down',
		tone: good ? 'success' : 'danger',
		label: `${up ? 'Up' : 'Down'} ${magnitude}`
	};
}

/** How many avatars a group draws before "+N", and what N is. */
export function avatarOverflow(count: number, max: number): { shown: number; rest: number } {
	const total = Math.max(0, Math.floor(count));
	const limit = max > 0 ? Math.floor(max) : total;
	const shown = Math.min(total, limit);
	return { shown, rest: total - shown };
}

/** A code string as lines, without the one trailing newline most files end with. */
export function codeLines(code: string): string[] {
	return code.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
}

/**
 * Copy text to the clipboard: the async Clipboard API where there is one and
 * it is allowed, otherwise the old hidden-textarea `execCommand('copy')`.
 * Resolves true when something was copied.
 */
export async function copyText(
	text: string,
	clipboard: Pick<Clipboard, 'writeText'> | null = globalThis.navigator?.clipboard ?? null,
	doc: Document | null = globalThis.document ?? null
): Promise<boolean> {
	if (clipboard) {
		try {
			await clipboard.writeText(text);
			return true;
		} catch {
			// Denied (no focus, insecure origin); fall through to the old way.
		}
	}
	if (!doc?.body) return false;
	const area = doc.createElement('textarea');
	area.value = text;
	area.setAttribute('readonly', '');
	area.style.position = 'fixed';
	area.style.opacity = '0';
	doc.body.appendChild(area);
	area.select();
	try {
		return doc.execCommand('copy');
	} catch {
		return false;
	} finally {
		area.remove();
	}
}
