<!--
	Carousel — slides in a scroll-snap track, after the WAI-ARIA tabbed
	carousel pattern. Previous and next buttons, and a row of dots that is a
	tab list (arrow keys, Home and End move between slides). Slides out of
	view are inert, so focus never lands somewhere you cannot see. Swiping the
	track works too. Optional autoplay rotates every `autoplay` milliseconds,
	pauses while the pointer or focus is on it, has a visible pause button,
	and never runs under prefers-reduced-motion. Bind `index`.

	<Carousel items={slides} label="Highlights" bind:index let:item>…</Carousel>
-->
<script lang="ts" generics="T">
	import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte';
	import { nextIndex, uid } from './logic';
	import { indexFromScroll, shouldRotate, slideIndex } from './data-logic';

	export let items: T[] = [];
	/** Names the carousel: "Featured projects". */
	export let label: string;
	export let index = 0;
	/** Wrap from the last slide to the first with the buttons. */
	export let loop = false;
	/** Milliseconds between slides; 0 is off. */
	export let autoplay = 0;
	/** Autoplay stopped by the pause button. */
	export let paused = false;

	const dispatch = createEventDispatcher<{ change: { index: number } }>();
	const id = uid('carousel');

	let track: HTMLDivElement;
	let dots: HTMLButtonElement[] = [];
	let hovered = false;
	let focused = false;
	let reducedMotion = false;
	let timer: ReturnType<typeof setInterval> | undefined;
	let settle: ReturnType<typeof setTimeout> | undefined;

	$: count = items.length;
	$: current = slideIndex(index, count, false);
	$: if (track) scrollToSlide(current);
	$: rotating = shouldRotate({
		interval: autoplay,
		paused,
		hovered,
		focused,
		reducedMotion,
		count
	});
	$: restart(rotating, autoplay);

	function go(to: number) {
		const next = slideIndex(to, count, loop);
		if (next === current) return;
		index = next;
		dispatch('change', { index: next });
	}

	function scrollToSlide(i: number) {
		const left = i * track.clientWidth;
		if (Math.abs(track.scrollLeft - left) < 1) return;
		track.scrollTo?.({ left, behavior: reducedMotion ? 'auto' : 'smooth' });
	}

	// A swipe moves the track without a button; catch up once it comes to rest.
	function onScroll() {
		clearTimeout(settle);
		settle = setTimeout(() => {
			if (!(track.clientWidth > 0)) return;
			go(indexFromScroll(track.scrollLeft, track.clientWidth, count));
		}, 120);
	}

	function restart(on: boolean, interval: number) {
		clearInterval(timer);
		timer = on ? setInterval(() => go(slideIndex(current + 1, count, true)), interval) : undefined;
	}

	async function onDotKeydown(event: KeyboardEvent) {
		const next = nextIndex(current, count, event.key);
		if (next === null) return;
		event.preventDefault();
		go(next);
		await tick();
		dots[next]?.focus();
	}

	// The track scrolls, so it takes focus (axe: scrollable-region-focusable) and
	// the left and right arrows step through the slides from it. Listened to in
	// an action, like `presence`, so a linter does not read the track as a widget.
	function trackKeys(node: HTMLElement) {
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
			event.preventDefault();
			go(current + (event.key === 'ArrowRight' ? 1 : -1));
		};
		node.addEventListener('keydown', onKey);
		return { destroy: () => node.removeEventListener('keydown', onKey) };
	}

	// Pause while the pointer or keyboard is inside. Listened to in an action:
	// these handlers on a region element would read as interactive to a linter.
	function presence(node: HTMLElement) {
		const enter = () => (hovered = true);
		const leave = () => (hovered = false);
		const focusIn = () => (focused = true);
		const focusOut = (event: FocusEvent) => {
			if (!node.contains(event.relatedTarget as Node | null)) focused = false;
		};
		node.addEventListener('mouseenter', enter);
		node.addEventListener('mouseleave', leave);
		node.addEventListener('focusin', focusIn);
		node.addEventListener('focusout', focusOut);
		return {
			destroy() {
				node.removeEventListener('mouseenter', enter);
				node.removeEventListener('mouseleave', leave);
				node.removeEventListener('focusin', focusIn);
				node.removeEventListener('focusout', focusOut);
			}
		};
	}

	// Slides out of view leave the tab order and the accessibility tree.
	function hidden(node: HTMLElement, on: boolean) {
		const set = (value: boolean) => {
			node.toggleAttribute('inert', value);
			if (value) node.setAttribute('aria-hidden', 'true');
			else node.removeAttribute('aria-hidden');
		};
		set(on);
		return { update: set };
	}

	onMount(() => {
		const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
		if (!query) return;
		reducedMotion = query.matches;
		const change = (event: MediaQueryListEvent) => (reducedMotion = event.matches);
		query.addEventListener?.('change', change);
		return () => query.removeEventListener?.('change', change);
	});

	onDestroy(() => {
		clearInterval(timer);
		clearTimeout(settle);
	});
</script>

<section class="carousel" aria-roledescription="carousel" aria-label={label} use:presence>
	<div class="carousel__controls">
		{#if autoplay > 0 && !reducedMotion}
			<button
				type="button"
				class="carousel__button"
				aria-label={paused ? 'Start automatic slide show' : 'Stop automatic slide show'}
				on:click={() => (paused = !paused)}
			>
				<span aria-hidden="true">{paused ? '▶' : '❚❚'}</span>
			</button>
		{/if}
		<button
			type="button"
			class="carousel__button"
			aria-label="Previous slide"
			aria-controls="{id}-track"
			disabled={!loop && current === 0}
			on:click={() => go(current - 1)}
		>
			<span aria-hidden="true">‹</span>
		</button>
		<button
			type="button"
			class="carousel__button"
			aria-label="Next slide"
			aria-controls="{id}-track"
			disabled={!loop && current >= count - 1}
			on:click={() => go(current + 1)}
		>
			<span aria-hidden="true">›</span>
		</button>
	</div>

	<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
	<div
		class="carousel__track"
		id="{id}-track"
		role="group"
		aria-label="Slides"
		tabindex="0"
		aria-live={rotating ? 'off' : 'polite'}
		bind:this={track}
		use:trackKeys
		on:scroll={onScroll}
	>
		{#each items as item, i (i)}
			<div
				class="carousel__slide"
				id="{id}-slide-{i}"
				role="tabpanel"
				aria-roledescription="slide"
				aria-label="{i + 1} of {count}"
				use:hidden={i !== current}
			>
				<slot {item} index={i} />
			</div>
		{/each}
	</div>

	{#if count > 1}
		<div
			class="carousel__dots"
			role="tablist"
			aria-label="Slides"
			tabindex="-1"
			on:keydown={onDotKeydown}
		>
			{#each items as _, i (i)}
				<button
					bind:this={dots[i]}
					type="button"
					role="tab"
					class="carousel__dot"
					aria-label="Slide {i + 1} of {count}"
					aria-controls="{id}-slide-{i}"
					aria-selected={i === current}
					tabindex={i === current ? 0 : -1}
					on:click={() => go(i)}
				></button>
			{/each}
		</div>
	{/if}
</section>

<style>
	.carousel {
		position: relative;
		display: grid;
		gap: var(--spacing-sm);
		min-width: 0;
	}

	.carousel__controls {
		display: flex;
		justify-content: flex-end;
		gap: var(--spacing-xs);
	}

	.carousel__track {
		display: flex;
		overflow-x: auto;
		border-radius: var(--radius-lg);
		scroll-snap-type: x mandatory;
		overscroll-behavior-x: contain;
		scrollbar-width: none;
	}

	.carousel__track:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.carousel__track::-webkit-scrollbar {
		display: none;
	}

	.carousel__slide {
		flex: 0 0 100%;
		min-width: 0;
		scroll-snap-align: start;
		scroll-snap-stop: always;
	}

	.carousel__button {
		display: inline-grid;
		place-items: center;
		width: 2.5rem;
		height: 2.5rem;
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: 50%;
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
	}

	.carousel__button span {
		font-size: 0.875rem;
	}

	.carousel__button[aria-label$='slide'] span {
		font-size: 1.375rem;
	}

	.carousel__button:hover:not(:disabled) {
		background: var(--color-surface-hover);
	}

	.carousel__button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.carousel__dots {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
	}

	.carousel__dots:focus {
		outline: none;
	}

	/* A 24px target around an 8px dot. */
	.carousel__dot {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
		cursor: pointer;
	}

	.carousel__dot::before {
		content: '';
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--color-border);
		transition:
			width var(--transition-fast),
			background var(--transition-fast);
	}

	.carousel__dot:hover::before {
		background: var(--color-text-secondary);
	}

	.carousel__dot[aria-selected='true']::before {
		width: 1.25rem;
		border-radius: 999px;
		background: var(--color-primary);
	}

	.carousel__button:focus-visible,
	.carousel__dot:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.carousel__track {
			scroll-behavior: auto;
		}

		.carousel__dot::before {
			transition: none;
		}
	}
</style>
