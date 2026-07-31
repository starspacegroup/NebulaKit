/**
 * Time-series helpers for the admin stats charts.
 *
 * The DB gives us sparse monthly counts (months with zero rows are simply
 * absent). Charts need a *dense*, gap-filled series and pre-computed SVG
 * geometry. Both are pure functions so they can be unit-tested without a
 * browser — the .svelte chart component just renders what these return.
 */

const MONTH_ABBR = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec'
];

/** A raw `{ ym: 'YYYY-MM', count }` row as returned by the grouped SQL query. */
export interface MonthCount {
	ym: string | null;
	count: number;
}

/** A dense point in the filled series: every month present, zeros included. */
export interface MonthlyPoint {
	/** 'YYYY-MM' */
	ym: string;
	/** Human label, e.g. "Nov '24". Built from the string — no Date/TZ involved. */
	label: string;
	/** New rows created in this month. */
	count: number;
	/** Running total up to and including this month. */
	cumulative: number;
}

/** Turn 'YYYY-MM' into a zero-based absolute month index for gap iteration. */
function ymToIndex(ym: string): number {
	const year = Number(ym.slice(0, 4));
	const month = Number(ym.slice(5, 7));
	return year * 12 + (month - 1);
}

/** Inverse of {@link ymToIndex}: absolute month index → 'YYYY-MM'. */
function indexToYm(index: number): string {
	const year = Math.floor(index / 12);
	const month = (index % 12) + 1;
	return `${year}-${String(month).padStart(2, '0')}`;
}

/** 'YYYY-MM' → "Nov '24". */
export function formatMonthLabel(ym: string): string {
	const month = Number(ym.slice(5, 7));
	const yy = ym.slice(2, 4);
	return `${MONTH_ABBR[month - 1] ?? '?'} '${yy}`;
}

/**
 * Expand sparse monthly counts into a dense, gap-filled series running from the
 * earliest present month to the latest, inclusive, with cumulative totals.
 * Rows with a null/empty `ym` (rows lacking a timestamp) are ignored. Returns
 * `[]` when there is no dated data.
 */
export function fillMonthlySeries(rows: MonthCount[]): MonthlyPoint[] {
	const counts = new Map<string, number>();
	for (const row of rows) {
		if (!row.ym) continue;
		counts.set(row.ym, (counts.get(row.ym) ?? 0) + (row.count ?? 0));
	}
	if (counts.size === 0) return [];

	const indices = [...counts.keys()].map(ymToIndex);
	const start = Math.min(...indices);
	const end = Math.max(...indices);

	const series: MonthlyPoint[] = [];
	let cumulative = 0;
	for (let i = start; i <= end; i++) {
		const ym = indexToYm(i);
		const count = counts.get(ym) ?? 0;
		cumulative += count;
		series.push({ ym, label: formatMonthLabel(ym), count, cumulative });
	}
	return series;
}

/** A raw `{ day: 'YYYY-MM-DD', count }` row (page-view daily counters). */
export interface DayCount {
	day: string;
	count: number;
}

/** 'YYYY-MM-DD' → "Jul 16". */
export function formatDayLabel(day: string): string {
	const month = Number(day.slice(5, 7));
	return `${MONTH_ABBR[month - 1] ?? '?'} ${Number(day.slice(8, 10))}`;
}

/**
 * Expand sparse daily counts into a dense series over [startDay, endDay]
 * (inclusive, 'YYYY-MM-DD' UTC), zeros included, with cumulative totals.
 * Returns MonthlyPoint-shaped points so StatBarChart can plot days directly.
 */
export function fillDailySeries(
	rows: DayCount[],
	startDay: string,
	endDay: string
): MonthlyPoint[] {
	const counts = new Map<string, number>();
	for (const row of rows) {
		if (!row.day) continue;
		counts.set(row.day, (counts.get(row.day) ?? 0) + (row.count ?? 0));
	}

	const series: MonthlyPoint[] = [];
	let cumulative = 0;
	const cursor = new Date(`${startDay}T00:00:00Z`);
	const end = new Date(`${endDay}T00:00:00Z`);
	if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) return [];

	while (cursor <= end) {
		const day = cursor.toISOString().slice(0, 10);
		const count = counts.get(day) ?? 0;
		cumulative += count;
		series.push({ ym: day, label: formatDayLabel(day), count, cumulative });
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}
	return series;
}

/** A raw `{ hourKey: 'YYYY-MM-DDTHH', count }` row (hourly page-view counters). */
export interface HourCount {
	hourKey: string;
	count: number;
}

/** 'YYYY-MM-DDTHH' → "14:00", or the day label ("Jul 23") at midnight so the
 *  x-axis still shows where one UTC day ends and the next begins. */
export function formatHourLabel(hourKey: string): string {
	const hh = hourKey.slice(11, 13);
	// Number('') is 0, so an hour-less key would masquerade as midnight.
	if (!/^\d{2}$/.test(hh)) return '?';
	const hour = Number(hh);
	return hour === 0 ? formatDayLabel(hourKey.slice(0, 10)) : `${String(hour).padStart(2, '0')}:00`;
}

/**
 * Expand sparse hourly counts into a dense series over the `hours` buckets
 * ending at `endHourKey` (inclusive, 'YYYY-MM-DDTHH' UTC), zeros included.
 * Returns MonthlyPoint-shaped points so StatBarChart can plot hours directly.
 */
export function fillHourlySeries(
	rows: HourCount[],
	endHourKey: string,
	hours: number
): MonthlyPoint[] {
	const counts = new Map<string, number>();
	for (const row of rows) {
		if (!row.hourKey) continue;
		counts.set(row.hourKey, (counts.get(row.hourKey) ?? 0) + (row.count ?? 0));
	}

	const end = new Date(`${endHourKey.slice(0, 10)}T${endHourKey.slice(11, 13)}:00:00Z`);
	if (Number.isNaN(end.getTime()) || !Number.isFinite(hours) || hours < 1) return [];

	const series: MonthlyPoint[] = [];
	let cumulative = 0;
	const cursor = new Date(end.getTime() - (Math.floor(hours) - 1) * 60 * 60 * 1000);
	while (cursor <= end) {
		const iso = cursor.toISOString();
		const hourKey = `${iso.slice(0, 10)}T${iso.slice(11, 13)}`;
		const count = counts.get(hourKey) ?? 0;
		cumulative += count;
		series.push({ ym: hourKey, label: formatHourLabel(hourKey), count, cumulative });
		cursor.setUTCHours(cursor.getUTCHours() + 1);
	}
	return series;
}

/** Round a value up to a "nice" axis maximum (1/2/5 × 10ⁿ). */
export function niceMax(value: number): number {
	if (value <= 0) return 1;
	const pow = Math.pow(10, Math.floor(Math.log10(value)));
	const n = value / pow;
	const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
	return step * pow;
}

export interface Bar {
	x: number;
	y: number;
	width: number;
	height: number;
	point: MonthlyPoint;
}

export interface AxisTick {
	x?: number;
	y?: number;
	value?: number;
	label?: string;
}

export interface BarChartGeometry {
	width: number;
	height: number;
	baselineY: number;
	plotLeft: number;
	plotRight: number;
	yMax: number;
	bars: Bar[];
	yTicks: AxisTick[];
	xTicks: AxisTick[];
	/** True when there is nothing to plot. */
	empty: boolean;
}

export interface BarChartOptions {
	width?: number;
	height?: number;
	padTop?: number;
	padRight?: number;
	padBottom?: number;
	padLeft?: number;
	/** Approximate number of x-axis labels to show (first & last always shown). */
	maxXLabels?: number;
	/** Gap in user units between adjacent bars. */
	barGap?: number;
}

/**
 * Compute SVG bar-chart geometry for a dense monthly series in a fixed
 * viewBox. Bars are anchored to the baseline; x labels are thinned to roughly
 * `maxXLabels` (always keeping the first and last month); y ticks are 0 / mid /
 * nice-max. All coordinates are in the returned `width`×`height` user space.
 */
export function buildBarChartGeometry(
	series: MonthlyPoint[],
	options: BarChartOptions = {}
): BarChartGeometry {
	const {
		width = 720,
		height = 220,
		padTop = 16,
		padRight = 16,
		padBottom = 28,
		padLeft = 36,
		maxXLabels = 8,
		barGap = 2
	} = options;

	const baselineY = height - padBottom;
	const plotLeft = padLeft;
	const plotRight = width - padRight;
	const plotWidth = plotRight - plotLeft;
	const plotHeight = baselineY - padTop;

	if (series.length === 0) {
		return {
			width,
			height,
			baselineY,
			plotLeft,
			plotRight,
			yMax: 1,
			bars: [],
			yTicks: [],
			xTicks: [],
			empty: true
		};
	}

	const rawMax = Math.max(...series.map((p) => p.count));
	const yMax = niceMax(rawMax);
	const slot = plotWidth / series.length;
	const barWidth = Math.max(1, slot - barGap);

	const bars: Bar[] = series.map((point, i) => {
		// yMax is niceMax(...) which is always >= 1, so no divide-by-zero guard needed.
		const h = (point.count / yMax) * plotHeight;
		const x = plotLeft + i * slot + (slot - barWidth) / 2;
		return { x, y: baselineY - h, width: barWidth, height: h, point };
	});

	// Y ticks: 0, midpoint, max (only add midpoint if it is a whole number for
	// clean labels; otherwise just 0 and max).
	const yTicks: AxisTick[] = [{ y: baselineY, value: 0 }];
	const mid = yMax / 2;
	if (Number.isInteger(mid) && mid > 0 && mid < yMax) {
		yTicks.push({ y: baselineY - (mid / yMax) * plotHeight, value: mid });
	}
	yTicks.push({ y: padTop, value: yMax });

	// X ticks: thin to ~maxXLabels, always keep first and last. Skip any strided
	// tick that falls within one stride of the (always-shown) last tick, so the
	// final label never collides with its neighbour.
	const lastIndex = series.length - 1;
	const stride = Math.max(1, Math.ceil(series.length / Math.max(1, maxXLabels)));
	const xTicks: AxisTick[] = [];
	series.forEach((point, i) => {
		const isFirst = i === 0;
		const isLast = i === lastIndex;
		const isStrided = i % stride === 0 && lastIndex - i >= stride;
		if (isFirst || isLast || isStrided) {
			xTicks.push({ x: bars[i].x + bars[i].width / 2, label: point.label });
		}
	});

	return {
		width,
		height,
		baselineY,
		plotLeft,
		plotRight,
		yMax,
		bars,
		yTicks,
		xTicks,
		empty: false
	};
}
