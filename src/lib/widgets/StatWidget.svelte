<!--
	Stat — a number, how it moved, and the shape it moved in.

	Colours come from the validated `--chart-*` palette, so a stat tile reads the
	same as the admin charts and passes the same contrast checks.
-->
<script lang="ts">
	import { sparklinePoints } from '$lib/utils/sparkline';

	export let label = 'Metric';
	export let value = '0';
	/** Percentage change. Positive is up, negative is down, null hides the badge. */
	export let delta: number | null = null;
	/** Recent readings, oldest first. Fewer than two draws no line. */
	export let series: number[] = [];
	export let accent: 'views' | 'users' | 'content' | 'usage' = 'views';

	$: points = sparklinePoints(series, { width: 120, height: 32, padding: 3 });
	$: direction = delta === null || delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down';
	// One string rather than three interpolations in the markup: it keeps the
	// sign, the number and the unit from ever being split across text nodes.
	$: deltaLabel = delta === null ? '' : `${delta > 0 ? '+' : ''}${delta}%`;
</script>

<div class="stat" style:--stat-accent="var(--chart-{accent})">
	<p class="stat__label">{label}</p>
	<div class="stat__row">
		<p class="stat__value">{value}</p>
		{#if delta !== null}
			<span class="stat__delta" data-direction={direction}>{deltaLabel}</span>
		{/if}
	</div>
	{#if points}
		<svg class="stat__spark" viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true">
			<polyline {points} fill="none" stroke="var(--stat-accent)" stroke-width="2" />
		</svg>
	{/if}
</div>

<style>
	.stat {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.stat__label {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-secondary);
	}

	.stat__row {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-sm);
	}

	.stat__value {
		margin: 0;
		font-size: 1.75rem;
		font-weight: 700;
		line-height: 1.1;
		color: var(--color-text);
	}

	.stat__delta {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	.stat__delta[data-direction='up'] {
		color: var(--color-success);
	}

	.stat__delta[data-direction='down'] {
		color: var(--color-error);
	}

	.stat__spark {
		width: 100%;
		height: 2rem;
		overflow: visible;
	}
</style>
