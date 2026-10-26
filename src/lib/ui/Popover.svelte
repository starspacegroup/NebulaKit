<!--
	Popover — a trigger and a floating panel of rich, interactive content: the
	ARIA disclosure pattern, with the panel a non-modal dialog. The trigger is
	the first focusable element in the `trigger` slot, and gets aria-expanded
	and aria-controls. Opening moves focus into the panel. Escape closes it and
	returns focus to the trigger; a click outside, or tabbing out, closes it
	where focus already is. The panel sits on `placement`, lined up by `align`,
	and flips to the other side when it would leave the viewport. Bind `open`.
-->
<script lang="ts">
	import { createEventDispatcher, onMount, tick } from 'svelte';
	import { uid } from './logic';
	import { placeFloating, type Align, type Side } from './overlay-logic';

	export let open = false;
	export let placement: Side = 'bottom';
	export let align: Align = 'center';
	/** A heading for the panel, which also names it. */
	export let title = '';
	/** Names the panel for a screen reader when there is no title. */
	export let label = '';

	const dispatch = createEventDispatcher<{ open: void; close: void }>();
	const id = uid('popover');
	const FOCUSABLE =
		'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
	let root: HTMLSpanElement;

	/** The first focusable element inside `node`, in document order. */
	function firstFocusable(node: HTMLElement): HTMLElement | null {
		const all = node.querySelectorAll<HTMLElement>('*');
		return [...all].find((el) => el.matches(FOCUSABLE)) ?? null;
	}
	let slot: HTMLSpanElement;
	let panel: HTMLDivElement;
	let trigger: HTMLElement | null = null;
	let side: Side = placement;
	let top = 0;
	let left = 0;
	let shown = false;

	onMount(() => {
		trigger = firstFocusable(slot);
		trigger?.setAttribute('aria-haspopup', 'dialog');
		trigger?.setAttribute('aria-controls', id);
		trigger?.setAttribute('aria-expanded', String(open));
		const onClick = () => (open = !open);
		trigger?.addEventListener('click', onClick);
		window.addEventListener('scroll', place, true);
		return () => {
			trigger?.removeEventListener('click', onClick);
			window.removeEventListener('scroll', place, true);
		};
	});

	$: trigger?.setAttribute('aria-expanded', String(open));
	$: if (open !== shown) changed(open);

	async function changed(now: boolean) {
		shown = now;
		if (!now) {
			dispatch('close');
			return;
		}
		await tick();
		place();
		const first = panel ? firstFocusable(panel) : null;
		(first ?? panel)?.focus();
		dispatch('open');
	}

	function place() {
		if (!open || !trigger || !panel) return;
		const at = placeFloating(
			trigger.getBoundingClientRect(),
			{ width: panel.offsetWidth, height: panel.offsetHeight },
			{ width: window.innerWidth, height: window.innerHeight },
			placement,
			align
		);
		({ side, top, left } = at);
	}

	function hide(returnFocus: boolean) {
		open = false;
		if (returnFocus) trigger?.focus();
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			// Claimed, so a page-level Escape shortcut does not also fire.
			event.preventDefault();
			event.stopPropagation();
			hide(true);
		}
	}

	function onFocusout(event: FocusEvent) {
		const next = event.relatedTarget as Node | null;
		if (next && !root.contains(next)) hide(false);
	}

	function onWindowPointer(event: PointerEvent) {
		if (open && !root.contains(event.target as Node)) hide(false);
	}

	// Key and focus handling on the panel, attached as an action: the panel is
	// a dialog, and Svelte's markup checks would read handlers on it as noise.
	function listen(node: HTMLElement) {
		node.addEventListener('keydown', onKeydown);
		node.addEventListener('focusout', onFocusout);
		return {
			destroy() {
				node.removeEventListener('keydown', onKeydown);
				node.removeEventListener('focusout', onFocusout);
			}
		};
	}
</script>

<svelte:window on:pointerdown={onWindowPointer} on:resize={place} />

<span class="popover" bind:this={root}>
	<span class="popover__trigger" bind:this={slot}><slot name="trigger" /></span>
	{#if open}
		<div
			bind:this={panel}
			{id}
			class="popover__panel popover__panel--{side}"
			role="dialog"
			aria-labelledby={title ? `${id}-title` : undefined}
			aria-label={title ? undefined : label || undefined}
			tabindex="-1"
			style="top: {top}px; left: {left}px"
			use:listen
		>
			{#if title}<h2 id="{id}-title" class="popover__title">{title}</h2>{/if}
			<slot />
		</div>
	{/if}
</span>

<style>
	.popover {
		display: inline-flex;
	}

	.popover__trigger {
		display: contents;
	}

	.popover__panel {
		position: fixed;
		z-index: 60;
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

	.popover__panel:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.popover__title {
		margin: 0;
		font-size: 1rem;
	}

	@media (prefers-reduced-motion: no-preference) {
		.popover__panel {
			animation: popover-in var(--transition-fast);
		}

		.popover__panel--top {
			--popover-from: translateY(4px);
		}

		.popover__panel--bottom {
			--popover-from: translateY(-4px);
		}

		.popover__panel--left {
			--popover-from: translateX(4px);
		}

		.popover__panel--right {
			--popover-from: translateX(-4px);
		}
	}

	@keyframes popover-in {
		from {
			opacity: 0;
			transform: var(--popover-from);
		}
	}
</style>
