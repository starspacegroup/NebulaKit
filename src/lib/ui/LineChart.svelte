<!--
	LineChart — one or more lines in plain SVG, one colour per series from the
	theme, with an optional area fill. A missing value (null) breaks the line
	rather than inventing a point. Ticks land on round numbers; the chart is
	sized to its container. Point at it, or focus it and use the arrow keys,
	for a tooltip of every series at that point. Screen readers get a summary
	and then the numbers as a hidden table.

	<LineChart title="Visitors" labels={days} series={[{ name: 'Visitors', values }]} area />
-->
<script lang="ts">
	import {
		areaPath,
		axisWidth,
		chartSummary,
		explore,
		formatNumber,
		labelStep,
		linePath,
		nearestIndex,
		niceTicks,
		pointerRatio,
		scaleLinear,
		seriesColor,
		seriesExtent,
		tooltipShift,
		valueText,
		type Series
	} from './data-logic';

	/** Names the chart, for everyone: shown above it and read first. */
	export let title: string;
	/** One label per point, along the bottom. */
	export let labels: string[] = [];
	export let series: Series[] = [];
	export let height = 240;
	/** Fill the area under each line. */
	export let area = false;
	/** Draw a dot on every point. */
	export let dots = false;
	/** Start the scale at zero even when the data does not reach it. */
	export let zero = false;
	export let format: (n: number) => string = formatNumber;
	/** Show the title above the chart. Off when the page already heads it. */
	export let showTitle = true;

	let width = 0;
	let active: number | null = null;

	const top = 12;
	const bottom = 28;

	$: w = width || 600;
	$: extent = seriesExtent(series) ?? [0, 0];
	$: scale = niceTicks(
		zero || area ? Math.min(0, extent[0]) : extent[0],
		zero || area ? Math.max(0, extent[1]) : extent[1],
		5
	);
	$: left = axisWidth(scale.ticks.map(format));
	$: right = w - 12;
	$: x = scaleLinear([0, Math.max(0, labels.length - 1)], [left + 6, right - 6]);
	$: y = scaleLinear([scale.min, scale.max], [height - bottom, top]);
	$: xs = labels.map((_, i) => x(i));
	$: step = labelStep(labels.length, right - left);
	$: summary = chartSummary(title, 'line chart', labels, series, format);
	$: lines = series.map((s) => {
		const points = labels.map((_, i) => {
			const v = s.values[i];
			return typeof v === 'number' && Number.isFinite(v) ? { x: xs[i], y: y(v) } : null;
		});
		return { points, line: linePath(points), fill: area ? areaPath(points, y(scale.min)) : '' };
	});

	function indexAt(event: PointerEvent) {
		const svg = event.currentTarget as SVGSVGElement;
		const rect = svg.getBoundingClientRect();
		return nearestIndex(pointerRatio(event.clientX, rect.left, rect.width) * w, xs);
	}
</script>

<figure class="chart">
	{#if showTitle}<figcaption class="chart__title">{title}</figcaption>{/if}
	<div class="chart__plot" bind:clientWidth={width}>
		<svg
			viewBox="0 0 {w} {height}"
			role="img"
			aria-label={summary}
			use:explore={{ count: labels.length, indexAt, onActive: (i) => (active = i) }}
		>
			{#each scale.ticks as tick (tick)}
				<g class="chart__tick">
					<line x1={left} x2={right} y1={y(tick)} y2={y(tick)} />
					<text x={left - 6} y={y(tick)} dy="0.32em" text-anchor="end">{format(tick)}</text>
				</g>
			{/each}
			{#each labels as label, i (i)}
				{#if i % step === 0}
					<text class="chart__label" x={xs[i]} y={height - 8} text-anchor="middle">{label}</text>
				{/if}
			{/each}
			{#if active !== null && xs[active] !== undefined}
				<line class="chart__cursor" x1={xs[active]} x2={xs[active]} y1={top} y2={height - bottom} />
			{/if}
			{#each lines as l, si (si)}
				{#if l.fill}
					<path class="chart__area" d={l.fill} style:fill={seriesColor(si)} />
				{/if}
				<path class="chart__line" d={l.line} style:stroke={seriesColor(si)} />
				{#each l.points as p, i (i)}
					{#if p && (dots || active === i || l.points.length === 1)}
						<circle
							class="chart__dot"
							cx={p.x}
							cy={p.y}
							r={active === i ? 4.5 : 3}
							style:stroke={seriesColor(si)}
						/>
					{/if}
				{/each}
			{/each}
		</svg>
		{#if active !== null && xs[active] !== undefined}
			<div
				class="chart__tooltip"
				aria-hidden="true"
				style:left="{(xs[active] / w) * 100}%"
				style:transform="translateX({tooltipShift(xs[active] / w)}%)"
				style:top="{top}px"
			>
				<strong>{labels[active]}</strong>
				{#each series as s, si (si)}
					<span
						><i style:background={seriesColor(si)}></i>{s.name}: {valueText(
							s.values[active],
							format
						)}</span
					>
				{/each}
			</div>
		{/if}
	</div>
	{#if series.length > 1}
		<ul class="chart__legend" aria-hidden="true">
			{#each series as s, si (si)}
				<li><i style:background={seriesColor(si)}></i>{s.name}</li>
			{/each}
		</ul>
	{/if}
	<!-- A table ignores width: 1px, so the hiding goes on a wrapper. -->
	<div class="sr-only">
		<table>
			<caption>{title}</caption>
			<thead>
				<tr>
					<th scope="col">Point</th>
					{#each series as s, si (si)}<th scope="col">{s.name}</th>{/each}
				</tr>
			</thead>
			<tbody>
				{#each labels as label, i (i)}
					<tr>
						<th scope="row">{label}</th>
						{#each series as s, si (si)}
							<td>{valueText(s.values[i], format)}</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</figure>

<style>
	.chart {
		position: relative;
		display: grid;
		gap: var(--spacing-sm);
		min-width: 0;
		margin: 0;
	}

	.chart__title {
		color: var(--color-text);
		font-weight: 700;
	}

	.chart__plot {
		position: relative;
		min-width: 0;
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
		border-radius: var(--radius-sm);
	}

	svg:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 4px;
	}

	.chart__tick line {
		stroke: var(--color-border);
		stroke-dasharray: 3 3;
	}

	text {
		fill: var(--color-text-secondary);
		font-family: var(--font-sans);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
	}

	.chart__cursor {
		stroke: var(--color-text-secondary);
		stroke-width: 1;
	}

	.chart__area {
		opacity: 0.14;
	}

	.chart__line {
		fill: none;
		stroke-width: 2.25;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.chart__dot {
		fill: var(--color-background);
		stroke-width: 2;
	}

	.chart__tooltip {
		position: absolute;
		z-index: 5;
		display: grid;
		gap: 2px;
		min-width: 7rem;
		max-width: 14rem;
		padding: 0.375rem 0.625rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-background);
		box-shadow: var(--shadow-md);
		color: var(--color-text);
		font-size: 0.8125rem;
		line-height: 1.35;
		pointer-events: none;
	}

	.chart__tooltip span,
	.chart__legend li {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		white-space: nowrap;
	}

	.chart__tooltip i,
	.chart__legend i {
		width: 0.625rem;
		height: 0.625rem;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.chart__legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs) var(--spacing-md);
		margin: 0;
		padding: 0;
		list-style: none;
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
	}
</style>
