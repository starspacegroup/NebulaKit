<!--
	CouponBanner — a promo message with a code and a countdown to when it ends.

	Time is injected: pass `now` (a Date) to freeze or drive the clock; leave it
	null and the banner reads the clock itself after it mounts, once a second
	(once a minute, without seconds, when the visitor prefers reduced motion).
	The digits are aria-hidden and the timer has aria-live="off", so a screen
	reader is not read to every second; a plain-language remaining time sits in
	the label instead. Nothing here animates.
-->
<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	import { countdownParts, countdownSpoken, type CountdownParts } from './logic';

	export let message = 'Spring sale: 20% off everything';
	export let code = '';
	/** ISO date-time the offer ends. */
	export let endsAt: string;
	/** The current time. Null: the banner keeps its own clock once mounted. */
	export let now: Date | null = null;
	/** Milliseconds between updates when it keeps its own clock. 0 stops it. */
	export let tick = 1000;
	export let dismissible = true;
	export let labels: Partial<typeof defaults> = {};

	const defaults = {
		code: 'Use code',
		copy: 'Copy code',
		copied: 'Code copied',
		copyFailed: 'Could not copy the code',
		endsIn: 'Ends in',
		ended: 'This offer has ended',
		days: 'days',
		day: 'day',
		hours: 'hours',
		minutes: 'min',
		seconds: 'sec',
		dismiss: 'Dismiss offer',
		remaining: '{time} left'
	};

	const dispatch = createEventDispatcher<{ dismiss: void; expire: void; copy: { code: string } }>();
	let clock: Date | null = null;
	let reduced = false;
	let timer: ReturnType<typeof setInterval> | undefined;
	let hidden = false;
	let status = '';
	let expired = false;
	let mounted = false;

	$: t = { ...defaults, ...labels };
	$: current = now ?? clock;
	$: parts = current ? countdownParts(endsAt, current) : null;
	$: spoken = parts ? countdownSpoken(parts) : '';
	// Wait for the mount: Svelte 4 attaches a parent's on:expire only after the
	// child is built, so an event fired while it initialises would be lost.
	$: if (mounted && parts?.done && !expired) {
		expired = true;
		dispatch('expire');
	}

	const pad = (n: number) => String(n).padStart(2, '0');

	function units(c: CountdownParts): { value: string; label: string }[] {
		const out = [];
		if (c.days > 0) out.push({ value: String(c.days), label: c.days === 1 ? t.day : t.days });
		out.push({ value: pad(c.hours), label: t.hours });
		out.push({ value: pad(c.minutes), label: t.minutes });
		if (!reduced) out.push({ value: pad(c.seconds), label: t.seconds });
		return out;
	}

	onMount(() => {
		mounted = true;
		reduced =
			typeof window.matchMedia === 'function' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (now === null) {
			clock = new Date();
			const every = reduced ? Math.max(tick, 60_000) : tick;
			if (tick > 0) timer = setInterval(() => (clock = new Date()), every);
		}
	});

	onDestroy(() => {
		if (timer) clearInterval(timer);
	});

	async function copy() {
		try {
			await navigator.clipboard.writeText(code);
			status = t.copied;
			dispatch('copy', { code });
		} catch {
			status = t.copyFailed;
		}
	}

	function dismiss() {
		hidden = true;
		dispatch('dismiss');
	}
</script>

{#if !hidden}
	<aside class="coupon" class:coupon--ended={parts?.done} aria-label={message}>
		<p class="coupon__message">{message}</p>
		{#if code && !parts?.done}
			<p class="coupon__code">
				<span class="coupon__codelabel">{t.code}</span>
				<code>{code}</code>
				<button type="button" class="coupon__copy" on:click={copy}>{t.copy}</button>
			</p>
		{/if}
		<div class="coupon__time" role="timer" aria-live="off">
			{#if parts?.done}
				<span class="coupon__ended">{t.ended}</span>
			{:else if parts}
				<span class="coupon__endsin" aria-hidden="true">{t.endsIn}</span>
				<span class="coupon__digits" aria-hidden="true">
					{#each units(parts) as u (u.label)}
						<span class="unit"><strong>{u.value}</strong><span>{u.label}</span></span>
					{/each}
				</span>
				<span class="sr-only">{t.remaining.replace('{time}', spoken)}</span>
			{/if}
		</div>
		{#if dismissible}
			<button type="button" class="coupon__close" aria-label={t.dismiss} on:click={dismiss}>
				<span aria-hidden="true">×</span>
			</button>
		{/if}
		<p class="sr-only" role="status">{status}</p>
	</aside>
{/if}

<style>
	.coupon {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		min-width: 0;
		padding: var(--spacing-md) 3.25rem var(--spacing-md) var(--spacing-md);
		border: 1px solid var(--color-primary);
		border-radius: var(--radius-lg);
		background: color-mix(in srgb, var(--color-primary) 10%, var(--color-background));
		color: var(--color-text);
	}

	.coupon--ended {
		border-color: var(--color-border);
		background: var(--color-surface);
		color: var(--color-text-secondary);
	}

	.coupon__message {
		margin: 0;
		font-size: 1.0625rem;
		font-weight: 700;
	}

	.coupon__code {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-sm);
		margin: 0;
	}

	.coupon__code code {
		padding: var(--spacing-xs) var(--spacing-sm);
		border: 1px dashed var(--color-text);
		border-radius: var(--radius-sm);
		background: var(--color-background);
		font-family: var(--font-mono);
		font-weight: 700;
		letter-spacing: 0.05em;
	}

	.coupon__copy {
		min-height: 2.75rem;
		padding: 0 var(--spacing-sm);
		color: var(--color-primary);
		font-weight: 600;
		text-decoration: underline;
	}

	.coupon__time {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.coupon__digits {
		display: inline-flex;
		gap: var(--spacing-sm);
	}

	.unit {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		justify-items: center;
		min-width: 3rem;
		padding: var(--spacing-xs) var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		line-height: 1.2;
	}

	.unit strong {
		font-size: 1.25rem;
		font-variant-numeric: tabular-nums;
	}

	.unit span {
		color: var(--color-text-secondary);
		font-size: 0.6875rem;
	}

	.coupon__close {
		position: absolute;
		inset-block-start: var(--spacing-xs);
		inset-inline-end: var(--spacing-xs);
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 50%;
		color: var(--color-text);
		font-size: 1.5rem;
	}

	.coupon__close:hover {
		background: var(--color-surface-hover);
	}

	@media (min-width: 40rem) {
		.coupon {
			grid-template-columns: 1fr auto;
			align-items: center;
			column-gap: var(--spacing-lg);
		}
	}
</style>
