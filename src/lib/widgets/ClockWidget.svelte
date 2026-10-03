<!--
	Clock — the widget that proves the live-vs-persisted split.

	It ticks once a second and reports the new time through a `live` event. The
	board forwards that to the app, which renders it as the widget's title. What
	it never does is write to `widget.title`, because that is persisted state: a
	value that changes on a timer would rewrite the whole layout every second.
	See docs/WIDGET_BOARD.md, rule P4.
-->
<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';

	/** IANA zone, e.g. `Europe/Lisbon`. Falls back to the browser's own zone. */
	export let timeZone: string | undefined = undefined;
	export let label = 'Local time';

	const dispatch = createEventDispatcher<{ live: string }>();

	let now = new Date();
	let timer: ReturnType<typeof setInterval> | undefined;

	/** An unusable zone is a bad prop, not a reason to show no clock at all. */
	function format(date: Date, options: Intl.DateTimeFormatOptions): string {
		try {
			return new Intl.DateTimeFormat(undefined, { ...options, timeZone }).format(date);
		} catch {
			return new Intl.DateTimeFormat(undefined, options).format(date);
		}
	}

	$: time = format(now, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	$: day = format(now, { weekday: 'long', month: 'short', day: 'numeric' });
	// Guarded on mount because Svelte attaches a parent's `on:live` listener
	// after constructing the component — a dispatch during init reaches nobody.
	$: if (mounted) dispatch('live', time);

	let mounted = false;

	onMount(() => {
		mounted = true;
		timer = setInterval(() => (now = new Date()), 1000);
	});

	onDestroy(() => clearInterval(timer));
</script>

<div class="clock">
	<p class="clock__time"><time data-testid="clock-time">{time}</time></p>
	<p class="clock__day">{day} · {label}</p>
</div>

<style>
	.clock {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.clock__time {
		margin: 0;
		font-size: 2rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		line-height: 1.1;
		color: var(--color-text);
	}

	.clock__day {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}
</style>
