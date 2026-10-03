<!--
	DonutChart — parts of a whole, as a ring in plain SVG with the total (or
	your own figure) in the middle and a legend giving each part's value and
	share. Point at a slice, or focus the chart and use the arrow keys, for a
	tooltip. Screen readers get each slice's share in the summary and the
	numbers as a hidden table. `thickness` 1 makes it a pie.

	<DonutChart title="Traffic" data={[{ label: 'Search', value: 52 }, { label: 'Direct', value: 30 }]} />
-->
<script lang="ts">
	import {
		arcCentroid,
		arcPath,
		donutArcs,
		donutSummary,
		explore,
		formatNumber,
		percentText,
		seriesColor,
		tooltipShift
	} from './data-logic';

	/** Names the chart, for everyone: shown above it and read first. */
	export let title: string;
	export let data: { label: string; value: number }[] = [];
	/** How much of the radius the ring takes, from 0.1 to 1 (a pie). */
	export let thickness = 0.32;
	/** The figure in the middle; the total by default. */
	export let centerValue: string | undefined = undefined;
	export let centerLabel = 'Total';
	export let format: (n: number) => string = formatNumber;
	/** Show the title above the chart. Off when the page already heads it. */
	export let showTitle = true;

	const size = 200;
	const c = size / 2;
	const outer = c - 4;

	let active: number | null = null;

	$: inner = outer * (1 - Math.min(1, Math.max(0.1, thickness)));
	$: arcs = donutArcs(data.map((d) => d.value));
	$: total = data.reduce(
		(sum, d) => sum + (Number.isFinite(d.value) && d.value > 0 ? d.value : 0),
		0
	);
	$: summary = donutSummary(title, data);
	$: tip = active !== null && arcs[active] ? arcCentroid(c, c, outer, inner, arcs[active]) : null;

	function indexAt(event: PointerEvent) {
		const mark = (event.target as Element | null)?.closest?.('[data-index]');
		return mark ? Number(mark.getAttribute('data-index')) : null;
	}
</script>

<figure class="donut">
	{#if showTitle}<figcaption class="donut__title">{title}</figcaption>{/if}
	<div class="donut__body">
		<div class="donut__plot">
			<svg
				viewBox="0 0 {size} {size}"
				role="img"
				aria-label={summary}
				use:explore={{ count: data.length, indexAt, onActive: (i) => (active = i) }}
			>
				<circle
					class="donut__track"
					cx={c}
					cy={c}
					r={(outer + inner) / 2}
					stroke-width={outer - inner}
				/>
				{#each arcs as arc, i (i)}
					<path
						class="donut__slice"
						class:donut__slice--dim={active !== null && active !== i}
						data-index={i}
						d={arcPath(c, c, outer, inner, arc.start, arc.end)}
						fill-rule="evenodd"
						style:fill={seriesColor(i)}
					/>
				{/each}
				{#if inner > 20}
					<text class="donut__value" x={c} y={c} text-anchor="middle" dy="0.1em"
						>{centerValue ?? format(total)}</text
					>
					<text class="donut__caption" x={c} y={c} text-anchor="middle" dy="1.6em"
						>{centerLabel}</text
					>
				{/if}
			</svg>
			{#if active !== null && tip}
				<div
					class="donut__tooltip"
					aria-hidden="true"
					style:left="{(tip.x / size) * 100}%"
					style:top="{(tip.y / size) * 100}%"
					style:transform="translate({tooltipShift(tip.x / size)}%, -110%)"
				>
					<strong>{data[active].label}</strong>
					<span>{format(data[active].value)} · {percentText(arcs[active].fraction)}</span>
				</div>
			{/if}
		</div>
		<ul class="donut__legend" aria-hidden="true">
			{#each data as d, i (i)}
				<li class:donut__legend--active={active === i}>
					<i style:background={seriesColor(i)}></i>
					<span class="donut__name">{d.label}</span>
					<span class="donut__figure">{format(d.value)}</span>
					<span class="donut__share">{percentText(arcs[i]?.fraction ?? 0)}</span>
				</li>
			{/each}
		</ul>
	</div>
	<!-- A table ignores width: 1px, so the hiding goes on a wrapper. -->
	<div class="sr-only">
		<table>
			<caption>{title}</caption>
			<thead>
				<tr><th scope="col">Part</th><th scope="col">Value</th><th scope="col">Share</th></tr>
			</thead>
			<tbody>
				{#each data as d, i (i)}
					<tr>
						<th scope="row">{d.label}</th>
						<td>{format(d.value)}</td>
						<td>{percentText(arcs[i]?.fraction ?? 0)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</figure>

<style>
	.donut {
		display: grid;
		gap: var(--spacing-sm);
		min-width: 0;
		margin: 0;
	}

	.donut__title {
		color: var(--color-text);
		font-weight: 700;
	}

	.donut__body {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-lg);
	}

	.donut__plot {
		position: relative;
		flex: 0 1 12rem;
		min-width: 8rem;
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 50%;
	}

	svg:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 4px;
	}

	.donut__track {
		fill: none;
		stroke: var(--color-surface);
	}

	.donut__slice {
		stroke: var(--color-background);
		stroke-width: 1.5;
		transition: opacity var(--transition-fast);
	}

	.donut__slice--dim {
		opacity: 0.4;
	}

	.donut__value {
		fill: var(--color-text);
		font-family: var(--font-sans);
		font-size: 22px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.donut__caption {
		fill: var(--color-text-secondary);
		font-family: var(--font-sans);
		font-size: 11px;
	}

	.donut__tooltip {
		position: absolute;
		z-index: 5;
		display: grid;
		gap: 2px;
		padding: 0.375rem 0.625rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-background);
		box-shadow: var(--shadow-md);
		color: var(--color-text);
		font-size: 0.8125rem;
		line-height: 1.35;
		white-space: nowrap;
		pointer-events: none;
	}

	.donut__legend {
		display: grid;
		flex: 1 1 12rem;
		gap: var(--spacing-xs);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.875rem;
	}

	.donut__legend li {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		align-items: center;
		gap: var(--spacing-sm);
		padding: 2px var(--spacing-xs);
		border-radius: var(--radius-sm);
		color: var(--color-text);
	}

	.donut__legend--active {
		background: var(--color-surface);
	}

	.donut__legend i {
		width: 0.625rem;
		height: 0.625rem;
		border-radius: 2px;
	}

	.donut__figure,
	.donut__share {
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.donut__share {
		min-width: 3ch;
		color: var(--color-text-secondary);
	}

	@media (prefers-reduced-motion: reduce) {
		.donut__slice {
			transition: none;
		}
	}
</style>
