<!--
	BarChart — grouped vertical bars in plain SVG, one colour per series from
	the theme. The scale starts at zero and lands on round ticks; it is sized
	to its container, so text stays legible on a phone. Point at a bar, or
	focus the chart and use the arrow keys, for a tooltip. Screen readers get
	a one-line summary and then the numbers as a hidden table.

	<BarChart title="Signups" labels={['Mon', 'Tue']} series={[{ name: 'Web', values: [4, 7] }]} />
-->
<script lang="ts">
	import {
		axisWidth,
		bands,
		chartSummary,
		explore,
		formatNumber,
		labelStep,
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
	/** One label per category, along the bottom. */
	export let labels: string[] = [];
	export let series: Series[] = [];
	export let height = 240;
	export let format: (n: number) => string = formatNumber;
	/** Show the title above the chart. Off when the page already heads it. */
	export let showTitle = true;

	let width = 0;
	let active: number | null = null;

	const top = 12;
	const bottom = 28;

	$: w = width || 600;
	$: extent = seriesExtent(series) ?? [0, 0];
	$: scale = niceTicks(Math.min(0, extent[0]), Math.max(0, extent[1]), 5);
	$: left = axisWidth(scale.ticks.map(format));
	$: right = w - 8;
	$: y = scaleLinear([scale.min, scale.max], [height - bottom, top]);
	$: groups = bands(labels.length, left, right, 0.25);
	$: step = labelStep(labels.length, right - left);
	$: summary = chartSummary(title, 'bar chart', labels, series, format);

	function bar(group: { x: number; width: number }, s: number, value: number | null) {
		const each = group.width / Math.max(1, series.length);
		const v = value ?? 0;
		const y0 = y(0);
		const y1 = y(v);
		return {
			x: group.x + s * each,
			width: Math.max(1, each - 1),
			y: Math.min(y0, y1),
			h: Math.abs(y1 - y0)
		};
	}

	function indexAt(event: PointerEvent) {
		const svg = event.currentTarget as SVGSVGElement;
		const rect = svg.getBoundingClientRect();
		const x = pointerRatio(event.clientX, rect.left, rect.width) * w;
		return nearestIndex(
			x,
			groups.map((g) => g.center)
		);
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
					<line x1={left} x2={right} y1={y(tick)} y2={y(tick)} class:chart__zero={tick === 0} />
					<text x={left - 6} y={y(tick)} dy="0.32em" text-anchor="end">{format(tick)}</text>
				</g>
			{/each}
			{#each groups as group, i (i)}
				{#if active === i}
					<rect
						class="chart__hover"
						x={group.x - 4}
						y={top}
						width={group.width + 8}
						height={height - top - bottom}
					/>
				{/if}
				{#each series as s, si (si)}
					{@const b = bar(group, si, s.values[i] ?? null)}
					<rect
						class="chart__bar"
						class:chart__bar--dim={active !== null && active !== i}
						x={b.x}
						y={b.y}
						width={b.width}
						height={b.h}
						rx="2"
						style:fill={seriesColor(si)}
					/>
				{/each}
				{#if i % step === 0}
					<text class="chart__label" x={group.center} y={height - 8} text-anchor="middle"
						>{labels[i]}</text
					>
				{/if}
			{/each}
		</svg>
		{#if active !== null && groups[active]}
			<div
				class="chart__tooltip"
				aria-hidden="true"
				style:left="{(groups[active].center / w) * 100}%"
				style:transform="translateX({tooltipShift(groups[active].center / w)}%)"
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
					<th scope="col">Category</th>
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

	.chart__tick line.chart__zero {
		stroke: var(--color-text-secondary);
		stroke-dasharray: none;
	}

	text {
		fill: var(--color-text-secondary);
		font-family: var(--font-sans);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
	}

	.chart__hover {
		fill: var(--color-surface-hover);
	}

	.chart__bar {
		transition: opacity var(--transition-fast);
	}

	.chart__bar--dim {
		opacity: 0.45;
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

	@media (prefers-reduced-motion: reduce) {
		.chart__bar {
			transition: none;
		}
	}
</style>
