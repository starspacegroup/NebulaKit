/**
 * Turn a series of numbers into SVG polyline points.
 *
 * Pure, so the shape of a sparkline can be asserted without rendering anything.
 * The viewBox is caller-supplied and the y axis is inverted here, because SVG
 * counts downward and a chart does not.
 */

export interface SparklineBox {
	width: number;
	height: number;
	/** Keeps the stroke from being clipped at the top and bottom edges. */
	padding?: number;
}

/**
 * Points for `<polyline points={...}>`, or an empty string when there is
 * nothing to draw.
 *
 * A flat series is drawn along the middle rather than at the bottom: zero
 * variation is not the same as zero value, and pinning it to the floor reads as
 * a collapse that never happened.
 */
export function sparklinePoints(series: number[], box: SparklineBox): string {
	if (series.length < 2) return '';

	const padding = box.padding ?? 2;
	const usableHeight = Math.max(0, box.height - padding * 2);
	const min = Math.min(...series);
	const max = Math.max(...series);
	const span = max - min;
	const step = box.width / (series.length - 1);

	return series
		.map((value, index) => {
			const ratio = span === 0 ? 0.5 : (value - min) / span;
			const y = padding + usableHeight * (1 - ratio);
			return `${(index * step).toFixed(2)},${y.toFixed(2)}`;
		})
		.join(' ');
}
