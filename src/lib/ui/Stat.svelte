<!--
	Stat — a key figure: what it is, its value, how it changed, and optionally
	the trend it changed along. The change is signed with a real minus, gets an
	arrow and a colour from its sign, and is read as "Up 4.2%" rather than as
	symbols. `invert` flips the colours for a figure where down is good.

	<Stat label="Error rate" value="0.42%" delta={-12} invert series={[3, 4, 2, 1]} help="vs last week" />
-->
<script lang="ts">
	import { formatDelta, sparklinePath } from './data-logic';

	export let label: string;
	export let value: string | number;
	/** The change, as a number; null hides it. */
	export let delta: number | null = null;
	/** What the delta counts in. */
	export let deltaSuffix = '%';
	/** Down is good: errors, churn, load time. */
	export let invert = false;
	/** Recent readings, oldest first, for a sparkline. */
	export let series: number[] = [];
	/** A line under the value: "vs last month". */
	export let help = '';

	$: change = delta === null ? null : formatDelta(delta, { invert, suffix: deltaSuffix });
	$: spark = sparklinePath(series, 120, 32, 3);
	$: tone = change?.tone ?? 'neutral';
</script>

<div class="stat stat--{tone}">
	<p class="stat__label">{label}</p>
	<p class="stat__value">{value}</p>
	{#if change || help}
		<p class="stat__foot">
			{#if change}
				<span class="stat__delta" data-direction={change.direction}>
					<span aria-hidden="true"
						>{change.direction === 'up' ? '▲' : change.direction === 'down' ? '▼' : '■'}
						{change.text}</span
					>
					<span class="sr-only">{change.label}</span>
				</span>
			{/if}
			{#if help}<span class="stat__help">{help}</span>{/if}
		</p>
	{/if}
	{#if spark}
		<svg class="stat__spark" viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true">
			<path d={spark} />
		</svg>
	{/if}
</div>

<style>
	.stat {
		--tone: var(--color-text-secondary);
		display: grid;
		gap: var(--spacing-xs);
		min-width: 0;
	}

	.stat--success {
		--tone: var(--color-success);
	}

	.stat--danger {
		--tone: var(--color-danger);
	}

	.stat__label {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.stat__value {
		margin: 0;
		color: var(--color-text);
		font-size: 1.875rem;
		font-weight: 700;
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
		overflow-wrap: anywhere;
	}

	.stat__foot {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--spacing-xs) var(--spacing-sm);
		margin: 0;
		font-size: 0.8125rem;
	}

	.stat__delta {
		padding: 0.0625rem 0.375rem;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--tone) 14%, transparent);
		/* Pulled toward the text colour so the tone keeps 4.5:1 on its own tint in both themes. */
		color: color-mix(in srgb, var(--tone) 70%, var(--color-text));
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.stat--neutral .stat__delta {
		color: var(--color-text-secondary);
	}

	.stat__delta [aria-hidden='true'] {
		font-size: inherit;
	}

	.stat__help {
		color: var(--color-text-secondary);
	}

	.stat__spark {
		display: block;
		width: 100%;
		height: 2rem;
	}

	.stat__spark path {
		fill: none;
		stroke: var(--tone);
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
		vector-effect: non-scaling-stroke;
	}

	.stat--neutral .stat__spark path {
		stroke: var(--color-primary);
	}
</style>
