<!--
	Resizable — two panes and a divider between them (the APG window
	splitter). Drag the divider, or focus it and use the arrow keys; Home and
	End jump to the limits; Enter collapses the first pane and restores it.
	`size` is the first pane's share in percent — bind it. Panes go in the
	`first` and `second` slots.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { uid } from './logic';
	import { clamp, pointerPercent, splitLimits, splitterKey } from './layout-logic';

	export let size = 50;
	export let min = 10;
	export let max = 90;
	export let step = 5;
	export let orientation: 'horizontal' | 'vertical' = 'horizontal';
	export let label = 'Resize panes';

	const dispatch = createEventDispatcher<{ change: { size: number } }>();
	const id = uid('resizable');
	let root: HTMLDivElement;
	let dragging = false;
	let restore = size;

	$: limits = splitLimits(min, max);
	$: size = clamp(size, limits.min, limits.max);
	$: rounded = Math.round(size);

	function set(next: number) {
		if (next > limits.min) restore = next;
		if (next === size) return;
		size = next;
		dispatch('change', { size });
	}

	function onKeydown(event: KeyboardEvent) {
		const next = splitterKey(event.key, size, orientation, {
			min: limits.min,
			max: limits.max,
			step,
			restore
		});
		if (next === null) return;
		event.preventDefault();
		// Enter's collapse keeps the old size to come back to.
		if (event.key === 'Enter' && next === limits.min) {
			const back = size;
			set(next);
			restore = back;
			return;
		}
		set(next);
	}

	function fromPointer(event: PointerEvent) {
		const box = root.getBoundingClientRect();
		const at =
			orientation === 'horizontal'
				? pointerPercent(event.clientX, box.left, box.width)
				: pointerPercent(event.clientY, box.top, box.height);
		set(clamp(at, limits.min, limits.max));
	}

	function onPointerDown(event: PointerEvent) {
		if (event.button !== 0) return;
		event.preventDefault();
		dragging = true;
		const handle = event.currentTarget as HTMLElement;
		handle.setPointerCapture?.(event.pointerId);
		handle.focus();
	}

	function onPointerMove(event: PointerEvent) {
		if (dragging) fromPointer(event);
	}

	function onPointerUp(event: PointerEvent) {
		if (!dragging) return;
		dragging = false;
		const handle = event.currentTarget as HTMLElement;
		handle.releasePointerCapture?.(event.pointerId);
	}
</script>

<div
	bind:this={root}
	class="resizable resizable--{orientation}"
	class:resizable--dragging={dragging}
>
	<div class="resizable__pane" id="{id}-first" style="flex-basis: {size}%">
		<slot name="first" />
	</div>
	<!-- A focusable separator is a widget in ARIA; Svelte's check does not know that. -->
	<!-- svelte-ignore a11y-no-noninteractive-tabindex a11y-no-noninteractive-element-interactions -->
	<div
		class="resizable__handle"
		role="separator"
		tabindex="0"
		aria-label={label}
		aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
		aria-controls="{id}-first"
		aria-valuenow={rounded}
		aria-valuemin={Math.round(limits.min)}
		aria-valuemax={Math.round(limits.max)}
		on:keydown={onKeydown}
		on:pointerdown={onPointerDown}
		on:pointermove={onPointerMove}
		on:pointerup={onPointerUp}
		on:pointercancel={onPointerUp}
	>
		<span class="resizable__grip" aria-hidden="true"></span>
	</div>
	<div class="resizable__pane resizable__pane--second">
		<slot name="second" />
	</div>
</div>

<style>
	.resizable {
		display: flex;
		width: 100%;
		min-height: 12rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.resizable--vertical {
		flex-direction: column;
	}

	.resizable__pane {
		flex-grow: 0;
		flex-shrink: 0;
		min-width: 0;
		min-height: 0;
		overflow: auto;
	}

	.resizable__pane--second {
		flex: 1 1 0;
	}

	.resizable__handle {
		position: relative;
		display: flex;
		flex: 0 0 auto;
		align-items: center;
		justify-content: center;
		background: var(--color-border);
		touch-action: none;
		transition: background var(--transition-fast);
	}

	.resizable--horizontal > .resizable__handle {
		width: 1px;
		cursor: col-resize;
	}

	.resizable--vertical > .resizable__handle {
		height: 1px;
		cursor: row-resize;
	}

	/* A wider, invisible hit area than the 1px line, for fingers and mice. */
	.resizable__handle::before {
		content: '';
		position: absolute;
		inset: 0;
	}

	.resizable--horizontal > .resizable__handle::before {
		inset: 0 -6px;
	}

	.resizable--vertical > .resizable__handle::before {
		inset: -6px 0;
	}

	.resizable__grip {
		position: relative;
		z-index: 1;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: var(--color-surface);
	}

	.resizable--horizontal .resizable__grip {
		width: 0.5rem;
		height: 1.5rem;
	}

	.resizable--vertical .resizable__grip {
		width: 1.5rem;
		height: 0.5rem;
	}

	.resizable__handle:hover,
	.resizable--dragging > .resizable__handle {
		background: var(--color-primary);
	}

	/* The line is 1px and the frame clips, so focus rings the grip instead. */
	.resizable__handle:focus-visible {
		outline: none;
		background: var(--color-primary);
	}

	.resizable__handle:focus-visible .resizable__grip {
		outline: 2px solid var(--color-primary);
		outline-offset: 1px;
	}

	.resizable--dragging {
		user-select: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.resizable__handle {
			transition: none;
		}
	}
</style>
