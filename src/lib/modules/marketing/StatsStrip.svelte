<!--
	StatsStrip — big numbers with labels, as a description list.

	Numbers count up once the strip scrolls into view, unless the visitor
	prefers reduced motion (then the final value shows at once). The moving
	number is hidden from assistive technology; the final value is always in
	the text, so nothing is read half-counted.
-->
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { countUpValue, formatStat } from './logic';

	export let stats: {
		label: string;
		value: number;
		prefix?: string;
		suffix?: string;
		decimals?: number;
		compact?: boolean;
	}[] = [];
	export let locale = 'en-US';
	/** Milliseconds a count-up lasts. */
	export let duration = 1600;
	export let reducedMotion: boolean | undefined = undefined;
	export let label = 'Key figures';

	let root: HTMLElement;
	let elapsed = 0;
	let phase: 'idle' | 'armed' | 'running' | 'done' = 'idle';
	let frame = 0;
	let observer: IntersectionObserver | undefined;
	let detected = false;

	$: reduced = reducedMotion ?? detected;
	$: animating = !reduced && (phase === 'armed' || phase === 'running');

	function shown(stat: (typeof stats)[number], live: boolean, at: number): string {
		const decimals = stat.decimals ?? 0;
		const value = live ? countUpValue(stat.value, at, duration, decimals) : stat.value;
		return `${stat.prefix ?? ''}${formatStat(value, { locale, decimals, compact: stat.compact })}${stat.suffix ?? ''}`;
	}

	function start() {
		observer?.disconnect();
		if (phase !== 'armed') return;
		phase = 'running';
		const t0 = performance.now();
		const tick = (now: number) => {
			elapsed = now - t0;
			if (elapsed < duration) frame = requestAnimationFrame(tick);
			else phase = 'done';
		};
		frame = requestAnimationFrame(tick);
	}

	onMount(() => {
		detected = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
		if (reducedMotion ?? detected) return;
		phase = 'armed';
		if (typeof IntersectionObserver === 'undefined') {
			start();
			return;
		}
		observer = new IntersectionObserver((entries) => {
			if (entries.some((e) => e.isIntersecting)) start();
		});
		observer.observe(root);
	});

	onDestroy(() => {
		observer?.disconnect();
		if (frame && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(frame);
	});
</script>

<section bind:this={root} class="strip" aria-label={label}>
	<dl class="strip__list">
		{#each stats as stat (stat.label)}
			<div class="stat">
				<dt class="stat__label">{stat.label}</dt>
				<dd class="stat__value">
					<span aria-hidden={animating ? 'true' : undefined}>{shown(stat, animating, elapsed)}</span
					>
					{#if animating}<span class="sr-only">{shown(stat, false, elapsed)}</span>{/if}
				</dd>
			</div>
		{/each}
	</dl>
</section>

<style>
	.strip {
		min-width: 0;
		padding: var(--spacing-lg) var(--spacing-md);
		border-block: 1px solid var(--color-border);
		background: var(--color-surface);
	}

	.strip__list {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--spacing-lg);
		margin: 0;
		text-align: center;
	}

	.stat {
		display: flex;
		flex-direction: column-reverse;
		min-width: 0;
	}

	.stat__value {
		margin: 0;
		font-size: clamp(1.75rem, 6vw, 2.75rem);
		font-variant-numeric: tabular-nums;
		font-weight: 800;
		line-height: 1.1;
	}

	.stat__label {
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	@media (min-width: 48rem) {
		.strip__list {
			grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		}
	}
</style>
