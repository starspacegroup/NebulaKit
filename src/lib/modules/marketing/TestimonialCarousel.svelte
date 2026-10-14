<!--
	TestimonialCarousel — quotes, one at a time.

	Autoplay is opt-in (`autoplay` = ms per slide), stops for visitors who
	prefer reduced motion, and pauses while the pointer or focus is inside or
	after the visitor presses Pause. The slide region is `aria-live="off"`
	while rotating (so it does not chatter) and "polite" otherwise, so Previous
	and Next are announced. Fires `change` with the new index.
-->
<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	import Avatar from '$lib/ui/Avatar.svelte';
	import { uid } from '$lib/ui/logic';
	import { canAutoplay, clampSlideIndex, isRotating, stepSlide } from './logic';

	export let items: { quote: string; name: string; role?: string; avatar?: string }[] = [];
	export let index = 0;
	/** Milliseconds per slide. 0 (the default) never rotates on its own. */
	export let autoplay = 0;
	/** Force reduced motion on or off; left alone it follows the visitor's setting. */
	export let reducedMotion: boolean | undefined = undefined;
	export let label = 'Customer testimonials';
	export let labels = {
		previous: 'Previous testimonial',
		next: 'Next testimonial',
		pause: 'Pause rotation',
		play: 'Start rotation',
		slide: (n: number, total: number) => `${n} of ${total}`,
		goTo: (n: number) => `Show testimonial ${n}`
	};

	const dispatch = createEventDispatcher<{ change: { index: number } }>();
	const slidesId = uid('slides');

	let root: HTMLElement;
	let detected = false;
	let paused = false;
	let engaged = false;
	let timer: ReturnType<typeof setInterval> | undefined;
	let media: MediaQueryList | undefined;

	$: reduced = reducedMotion ?? detected;
	$: count = items.length;
	$: current = clampSlideIndex(index, count);
	$: state = { interval: autoplay, reducedMotion: reduced, paused, engaged, count };
	$: offerPause = canAutoplay(state);
	$: rotating = isRotating(state);
	$: schedule(rotating, autoplay);

	function schedule(on: boolean, ms: number) {
		if (timer) clearInterval(timer);
		timer = on ? setInterval(() => go(1), ms) : undefined;
	}

	function go(delta: number) {
		index = stepSlide(current, delta, count);
		dispatch('change', { index });
	}

	function show(i: number) {
		index = i;
		dispatch('change', { index: i });
	}

	function onMedia() {
		detected = Boolean(media?.matches);
	}

	function leave(event: FocusEvent) {
		if (!root.contains(event.relatedTarget as Node | null)) engaged = false;
	}

	onMount(() => {
		media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
		onMedia();
		media?.addEventListener?.('change', onMedia);
	});

	onDestroy(() => {
		if (timer) clearInterval(timer);
		media?.removeEventListener?.('change', onMedia);
	});
</script>

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<section
	bind:this={root}
	class="carousel"
	aria-roledescription="carousel"
	aria-label={label}
	on:mouseenter={() => (engaged = true)}
	on:mouseleave={() => (engaged = false)}
	on:focusin={() => (engaged = true)}
	on:focusout={leave}
>
	<div id={slidesId} class="slides" aria-live={rotating ? 'off' : 'polite'} aria-atomic="false">
		{#each items as item, i (i)}
			<div
				class="slide"
				role="group"
				aria-roledescription="slide"
				aria-label={labels.slide(i + 1, count)}
				hidden={i !== current}
			>
				<blockquote class="slide__quote">
					<p>{item.quote}</p>
				</blockquote>
				<div class="slide__who">
					<Avatar name={item.name} src={item.avatar} />
					<span>
						<strong>{item.name}</strong>
						{#if item.role}<span class="slide__role">{item.role}</span>{/if}
					</span>
				</div>
			</div>
		{/each}
	</div>

	{#if count > 1}
		<div class="controls">
			<button type="button" class="ctl" aria-controls={slidesId} on:click={() => go(-1)}>
				<span aria-hidden="true">←</span><span class="sr-only">{labels.previous}</span>
			</button>
			{#if offerPause}
				<button type="button" class="ctl" aria-pressed={paused} on:click={() => (paused = !paused)}>
					<span aria-hidden="true">{paused ? '▶' : '⏸'}</span><span class="sr-only"
						>{paused ? labels.play : labels.pause}</span
					>
				</button>
			{/if}
			<button type="button" class="ctl" aria-controls={slidesId} on:click={() => go(1)}>
				<span aria-hidden="true">→</span><span class="sr-only">{labels.next}</span>
			</button>
			<ul class="dots">
				{#each items as _, i (i)}
					<li>
						<button
							type="button"
							class="dot"
							aria-label={labels.goTo(i + 1)}
							aria-current={i === current ? 'true' : undefined}
							on:click={() => show(i)}
						>
							<span class="dot__mark" class:dot__mark--on={i === current}></span>
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</section>

<style>
	.carousel {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
		padding: var(--spacing-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}

	.slides {
		display: grid;
	}

	.slide {
		grid-area: 1 / 1;
		margin: 0;
	}

	/* Every slide shares one cell, so the box is as tall as the tallest quote and
	   changing slides never moves what is below. A hidden slide is invisible to
	   everyone, including screen readers and the tab key. */
	.slide[hidden] {
		display: block;
		visibility: hidden;
	}

	.slide__quote {
		margin: 0;
		font-size: 1.25rem;
		line-height: 1.5;
	}

	.slide__quote p {
		margin: 0;
	}

	.slide__who {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		margin-block-start: var(--spacing-md);
	}

	.slide__role {
		display: block;
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.ctl,
	.dot {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-inline-size: 2.75rem;
		min-block-size: 2.75rem;
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
		cursor: pointer;
	}

	.ctl:hover {
		background: var(--color-surface-hover);
	}

	.ctl:focus-visible,
	.dot:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.dots {
		display: flex;
		flex-wrap: wrap;
		margin: 0;
		margin-inline-start: auto;
		padding: 0;
		list-style: none;
	}

	.dot {
		border-color: transparent;
		background: transparent;
	}

	.dot__mark {
		inline-size: 0.75rem;
		block-size: 0.75rem;
		border: 2px solid var(--color-primary);
		border-radius: 50%;
	}

	.dot__mark--on {
		background: var(--color-primary);
	}

	@media (forced-colors: active) {
		.dot__mark--on {
			background: Highlight;
		}
	}
</style>
