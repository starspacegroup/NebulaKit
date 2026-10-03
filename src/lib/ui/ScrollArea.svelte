<!--
	ScrollArea — a scroll region with thin, themed scrollbars. It is a labelled
	region and a tab stop, so keyboard users can scroll it with the arrow keys.
	A soft shadow shows at each edge only while there is more to scroll that
	way. `direction` picks the axes; `maxHeight` caps it (any CSS length).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { scrollEdges } from './layout-logic';
	import type { ScrollEdges } from './layout-logic';

	export let label: string;
	export let direction: 'vertical' | 'horizontal' | 'both' = 'vertical';
	export let maxHeight = '20rem';

	let viewport: HTMLDivElement;
	let edges: ScrollEdges = { top: false, bottom: false, left: false, right: false };

	function measure() {
		if (viewport) edges = scrollEdges(viewport);
	}

	// Content can grow or the box can resize without a scroll event, so watch both.
	onMount(() => {
		measure();
		if (typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(measure);
		observer.observe(viewport);
		for (const child of Array.from(viewport.children)) observer.observe(child);
		return () => observer.disconnect();
	});

	$: vertical = direction !== 'horizontal';
	$: horizontal = direction !== 'vertical';
</script>

<svelte:window on:resize={measure} />

<div
	class="scroll-area"
	class:scroll-area--top={vertical && edges.top}
	class:scroll-area--bottom={vertical && edges.bottom}
	class:scroll-area--left={horizontal && edges.left}
	class:scroll-area--right={horizontal && edges.right}
>
	<!-- A tab stop so the region scrolls from the keyboard (axe: scrollable-region-focusable). -->
	<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
	<div
		bind:this={viewport}
		class="scroll-area__viewport scroll-area__viewport--{direction}"
		style="max-height: {maxHeight}"
		role="region"
		aria-label={label}
		tabindex="0"
		on:scroll={measure}
	>
		<div class="scroll-area__content" class:scroll-area__content--wide={horizontal}>
			<slot />
		</div>
	</div>
	<span class="scroll-area__fade scroll-area__fade--top" aria-hidden="true"></span>
	<span class="scroll-area__fade scroll-area__fade--bottom" aria-hidden="true"></span>
	<span class="scroll-area__fade scroll-area__fade--left" aria-hidden="true"></span>
	<span class="scroll-area__fade scroll-area__fade--right" aria-hidden="true"></span>
</div>

<style>
	.scroll-area {
		position: relative;
		min-width: 0;
		max-width: 100%;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.scroll-area__viewport {
		overscroll-behavior: contain;
		scrollbar-width: thin;
		scrollbar-color: var(--color-border) transparent;
	}

	.scroll-area__viewport--vertical {
		overflow-x: hidden;
		overflow-y: auto;
	}

	.scroll-area__viewport--horizontal {
		overflow-x: auto;
		overflow-y: hidden;
	}

	.scroll-area__viewport--both {
		overflow: auto;
	}

	.scroll-area__viewport:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.scroll-area__viewport::-webkit-scrollbar {
		width: 8px;
		height: 8px;
	}

	.scroll-area__viewport::-webkit-scrollbar-track {
		background: transparent;
	}

	.scroll-area__viewport::-webkit-scrollbar-thumb {
		border: 2px solid transparent;
		border-radius: 999px;
		background: var(--color-border);
		background-clip: padding-box;
	}

	.scroll-area__viewport::-webkit-scrollbar-thumb:hover {
		background-color: var(--color-text-secondary);
	}

	.scroll-area__content {
		padding: var(--spacing-md);
	}

	.scroll-area__content--wide {
		width: max-content;
		min-width: 100%;
		box-sizing: border-box;
	}

	/* A shadow, not a fade to the background colour, so it reads on any surface
	   in either theme. */
	.scroll-area__fade {
		position: absolute;
		z-index: 1;
		opacity: 0;
		pointer-events: none;
		transition: opacity var(--transition-fast);
	}

	.scroll-area__fade--top,
	.scroll-area__fade--bottom {
		left: 0;
		right: 0;
		height: 0.75rem;
	}

	.scroll-area__fade--left,
	.scroll-area__fade--right {
		top: 0;
		bottom: 0;
		width: 0.75rem;
	}

	.scroll-area__fade--top {
		top: 0;
		background: linear-gradient(to bottom, rgb(0 0 0 / 0.16), rgb(0 0 0 / 0));
	}

	.scroll-area__fade--bottom {
		bottom: 0;
		background: linear-gradient(to top, rgb(0 0 0 / 0.16), rgb(0 0 0 / 0));
	}

	.scroll-area__fade--left {
		left: 0;
		background: linear-gradient(to right, rgb(0 0 0 / 0.16), rgb(0 0 0 / 0));
	}

	.scroll-area__fade--right {
		right: 0;
		background: linear-gradient(to left, rgb(0 0 0 / 0.16), rgb(0 0 0 / 0));
	}

	.scroll-area--top .scroll-area__fade--top,
	.scroll-area--bottom .scroll-area__fade--bottom,
	.scroll-area--left .scroll-area__fade--left,
	.scroll-area--right .scroll-area__fade--right {
		opacity: 1;
	}

	@media (prefers-reduced-motion: reduce) {
		.scroll-area__fade {
			transition: none;
		}
	}
</style>
