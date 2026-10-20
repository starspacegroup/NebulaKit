<!--
	HoverCard — a rich preview of what the trigger points at (the profile
	behind an @mention, the page behind a link). It opens on hover after
	`openDelay`, and at once when the trigger takes keyboard focus. It stays
	open while the pointer is over the card or focus is inside it, and closes
	`closeDelay` after both leave; Escape hides it without moving focus. It
	follows the card placement and flip rules of Popover.

	A preview, never the only way to reach anything: touch screens do not
	hover, so whatever the card shows must also be one tap away through the
	trigger itself.
-->
<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { uid } from './logic';
	import { hoverDelay, placeFloating, type Align, type Side } from './overlay-logic';

	export let open = false;
	export let placement: Side = 'bottom';
	export let align: Align = 'center';
	/** Milliseconds the pointer rests on the trigger before the card opens. */
	export let openDelay = 500;
	/** Milliseconds after the pointer leaves before it closes. */
	export let closeDelay = 200;

	const id = uid('hover-card');
	let root: HTMLSpanElement;
	let slot: HTMLSpanElement;
	let card: HTMLDivElement;
	let trigger: HTMLElement | null = null;
	let side: Side = placement;
	let top = 0;
	let left = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		// The first focusable element, in document order.
		trigger =
			[...slot.querySelectorAll<HTMLElement>('*')].find((el) =>
				el.matches('a[href], button, input, select, textarea, [tabindex]')
			) ?? null;
		trigger?.setAttribute('aria-controls', id);
	});

	onDestroy(() => clearTimeout(timer));

	$: trigger?.setAttribute('aria-expanded', String(open));

	function schedule(want: boolean, source: 'pointer' | 'focus') {
		clearTimeout(timer);
		if (want === open) return;
		const ms = hoverDelay(want ? 'open' : 'close', source, openDelay, closeDelay);
		if (ms === 0) set(want);
		else timer = setTimeout(() => set(want), ms);
	}

	async function set(want: boolean) {
		open = want;
		if (!want) return;
		await tick();
		place();
	}

	function place() {
		if (!open || !trigger || !card) return;
		({ side, top, left } = placeFloating(
			trigger.getBoundingClientRect(),
			{ width: card.offsetWidth, height: card.offsetHeight },
			{ width: window.innerWidth, height: window.innerHeight },
			placement,
			align
		));
	}

	// Pointer, focus and key handling on the wrapper, attached as an action:
	// the wrapper is not a control, and the real control in the slot keeps its
	// own role and name.
	function listen(node: HTMLElement) {
		const handlers: [string, (event: Event) => void][] = [
			[
				'pointerenter',
				(event) => {
					if ((event as PointerEvent).pointerType !== 'touch') schedule(true, 'pointer');
				}
			],
			['pointerleave', () => schedule(false, 'pointer')],
			['focusin', () => schedule(true, 'focus')],
			[
				'focusout',
				(event) => {
					const next = (event as FocusEvent).relatedTarget as Node | null;
					if (!next || !node.contains(next)) schedule(false, 'focus');
				}
			],
			[
				'keydown',
				(event) => {
					if ((event as KeyboardEvent).key === 'Escape' && open) {
						event.preventDefault();
						clearTimeout(timer);
						open = false;
					}
				}
			]
		];
		for (const [name, handler] of handlers) node.addEventListener(name, handler);
		return {
			destroy() {
				for (const [name, handler] of handlers) node.removeEventListener(name, handler);
			}
		};
	}
</script>

<svelte:window on:resize={place} />

<span class="hover-card" bind:this={root} use:listen>
	<span class="hover-card__trigger" bind:this={slot}><slot name="trigger" /></span>
	{#if open}
		<div
			bind:this={card}
			{id}
			class="hover-card__card hover-card__card--{side}"
			style="top: {top}px; left: {left}px"
		>
			<slot />
		</div>
	{/if}
</span>

<style>
	.hover-card {
		display: inline-flex;
	}

	.hover-card__trigger {
		display: contents;
	}

	.hover-card__card {
		position: fixed;
		z-index: 55;
		display: grid;
		gap: var(--spacing-sm);
		width: max-content;
		max-width: min(20rem, calc(100vw - 16px));
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		box-shadow: var(--shadow-lg);
	}

	@media (prefers-reduced-motion: no-preference) {
		.hover-card__card {
			animation: hover-card-in var(--transition-fast);
		}
	}

	@keyframes hover-card-in {
		from {
			opacity: 0;
		}
	}
</style>
