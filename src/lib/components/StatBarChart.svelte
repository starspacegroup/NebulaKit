<script lang="ts">
	import { buildBarChartGeometry, type MonthlyPoint } from '$lib/utils/stats-timeseries';

	/** Dense monthly series (gap-filled) to plot. */
	export let series: MonthlyPoint[] = [];
	/** CSS color for the bars — pass a theme-aware custom property. */
	export let accent = 'var(--color-primary)';
	/** Noun for the tooltip/aria, e.g. "poems" or "members". */
	export let unit = 'items';
	/** Period each bar represents, used in the a11y label ("per month"/"per day"). */
	export let periodLabel = 'month';

	// Geometry is rebuilt at the element's real rendered width, so SVG text is
	// never stretched (the old fixed 720px viewBox + preserveAspectRatio="none"
	// distorted labels on narrow screens). SSR/first paint falls back to 720.
	let measuredWidth = 0;
	$: chartWidth = Math.round(measuredWidth) || 720;
	// Shorter plot on phones, capped on desktop; labels stay readable at 1:1.
	$: chartHeight = Math.round(Math.min(240, Math.max(150, chartWidth * 0.32)));
	// Thin out x labels as space shrinks (~1 label per 88px, never fewer than 3).
	$: maxXLabels = Math.max(3, Math.min(12, Math.floor(chartWidth / 88)));

	$: geometry = buildBarChartGeometry(series, {
		width: chartWidth,
		height: chartHeight,
		maxXLabels
	});
	$: slot =
		geometry.bars.length > 0 ? (geometry.plotRight - geometry.plotLeft) / geometry.bars.length : 0;
	$: total = series.reduce((sum, p) => sum + p.count, 0);
	$: peak = series.reduce<MonthlyPoint | null>((a, p) => (!a || p.count > a.count ? p : a), null);

	let hovered = -1;
	$: hoveredPoint = hovered >= 0 && hovered < series.length ? series[hovered] : null;
	$: tooltipLeftPct =
		hoveredPoint && geometry.bars[hovered]
			? ((geometry.bars[hovered].x + geometry.bars[hovered].width / 2) / chartWidth) * 100
			: 0;
</script>

<figure class="chart" style={`--accent:${accent}`}>
	{#if geometry.empty}
		<p class="empty">No data yet.</p>
	{:else}
		<div class="plot-wrap" bind:clientWidth={measuredWidth}>
			<svg
				viewBox={`0 0 ${chartWidth} ${chartHeight}`}
				preserveAspectRatio="none"
				role="img"
				aria-label={`New ${unit} per ${periodLabel} — ${total} total, peak ${peak?.count ?? 0} in ${peak?.label ?? 'n/a'}`}
			>
				<!-- gridlines + y labels -->
				{#each geometry.yTicks as tick}
					<line
						class="grid"
						x1={geometry.plotLeft}
						x2={geometry.plotRight}
						y1={tick.y}
						y2={tick.y}
					/>
					<text class="y-label" x={geometry.plotLeft - 6} y={(tick.y ?? 0) + 3} text-anchor="end">
						{tick.value}
					</text>
				{/each}

				<!-- bars -->
				{#each geometry.bars as bar, i}
					{#if bar.height > 0}
						<rect
							class="bar"
							class:dim={hovered !== -1 && hovered !== i}
							x={bar.x}
							y={bar.y}
							width={bar.width}
							height={bar.height}
							rx={Math.min(3, bar.width / 2)}
						/>
					{/if}
				{/each}

				<!-- x labels -->
				{#each geometry.xTicks as tick}
					<text class="x-label" x={tick.x} y={geometry.baselineY + 16} text-anchor="middle">
						{tick.label}
					</text>
				{/each}

				<!-- baseline -->
				<line
					class="axis"
					x1={geometry.plotLeft}
					x2={geometry.plotRight}
					y1={geometry.baselineY}
					y2={geometry.baselineY}
				/>

				<!-- full-height hover/tap hit targets (one per point). click toggles
				     for touch, where mouseenter alone can be unreliable. -->
				{#each geometry.bars as _bar, i}
					<rect
						class="hit"
						x={geometry.plotLeft + i * slot}
						y={0}
						width={slot}
						height={geometry.baselineY}
						on:mouseenter={() => (hovered = i)}
						on:mouseleave={() => (hovered = -1)}
						on:click={() => (hovered = hovered === i ? -1 : i)}
						role="presentation"
					/>
				{/each}
			</svg>

			{#if hoveredPoint}
				<!-- clamped so edge tooltips never overflow the card on phones -->
				<div class="tooltip" style={`left:clamp(18%, ${tooltipLeftPct}%, 82%)`} aria-hidden="true">
					<span class="tt-count">{hoveredPoint.count.toLocaleString()}</span>
					<span class="tt-unit">{unit}</span>
					<span class="tt-month">{hoveredPoint.label}</span>
				</div>
			{/if}
		</div>

		<!-- screen-reader data table. NB: the visually-hidden class must sit on a
		     wrapping div, not the table — display:table ignores the 1px collapse
		     (width/height act as minimums), and the clipped-but-absolute table
		     then stretches the page's scrollable height by its full size. -->
		<div class="visually-hidden">
			<table>
				<caption>New {unit} per month</caption>
				<thead><tr><th>Month</th><th>New {unit}</th><th>Cumulative</th></tr></thead>
				<tbody>
					{#each series as p}
						<tr><td>{p.label}</td><td>{p.count}</td><td>{p.cumulative}</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</figure>

<style>
	.chart {
		margin: 0;
	}

	.plot-wrap {
		position: relative;
	}

	svg {
		width: 100%;
		height: auto;
		display: block;
		overflow: visible;
	}

	.grid {
		stroke: var(--color-border);
		stroke-width: 1;
		opacity: 0.5;
	}

	.axis {
		stroke: var(--color-border);
		stroke-width: 1.5;
	}

	.bar {
		fill: var(--accent);
		transition: opacity var(--transition-fast);
	}

	.bar.dim {
		opacity: 0.35;
	}

	.hit {
		fill: transparent;
	}

	.y-label,
	.x-label {
		fill: var(--color-text-secondary);
		font-size: 11px;
		font-family: inherit;
	}

	.tooltip {
		position: absolute;
		top: -4px;
		transform: translateX(-50%);
		display: inline-flex;
		align-items: baseline;
		gap: 0.3rem;
		padding: 0.3rem 0.6rem;
		background: var(--color-surface-elevated, var(--color-surface));
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm, 6px);
		box-shadow: 0 4px 14px color-mix(in srgb, var(--color-text) 18%, transparent);
		white-space: nowrap;
		pointer-events: none;
		z-index: 2;
	}

	.tt-count {
		font-weight: 700;
		color: var(--accent);
		font-size: 1rem;
	}

	.tt-unit {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.tt-month {
		font-size: 0.75rem;
		color: var(--color-text);
		padding-left: 0.3rem;
		border-left: 1px solid var(--color-border);
	}

	.empty {
		color: var(--color-text-secondary);
		font-style: italic;
		padding: var(--spacing-lg);
		text-align: center;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
