<!-- Meter — progress toward a goal: a number, the goal, and a bar that changes tone near and past it. -->
<script lang="ts">
	import Progress from '$lib/ui/Progress.svelte';

	export let label = 'Goal';
	export let value = 0;
	export let goal = 100;
	export let unit = '';
	/** Over the goal is bad (a budget), not good (a target). */
	export let limit = false;

	type Tone = 'primary' | 'success' | 'warning' | 'danger';

	$: ratio = goal > 0 ? value / goal : 0;
	let tone: Tone;
	$: tone = limit
		? ratio >= 1
			? 'danger'
			: ratio >= 0.8
				? 'warning'
				: 'success'
		: ratio >= 1
			? 'success'
			: 'primary';
	$: fmt = (n: number) => `${n.toLocaleString()}${unit}`;
</script>

<div class="meter" data-tone={tone}>
	<p class="meter__value">{fmt(value)} <span>of {fmt(goal)}</span></p>
	<Progress {value} max={goal} {label} {tone} />
</div>

<style>
	.meter {
		display: grid;
		gap: var(--spacing-sm);
	}

	.meter__value {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--color-text);
	}

	.meter__value span {
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--color-text-secondary);
	}
</style>
