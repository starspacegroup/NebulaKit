<!--
	Tooltip — a short description of the control in the slot, shown on hover
	and on keyboard focus, and read with the control through aria-describedby.
	For labels, not for anything someone needs to act on.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { uid } from './logic';

	export let text: string;
	export let placement: 'top' | 'bottom' = 'top';

	const id = uid('tooltip');
	let wrapper: HTMLSpanElement;
	let hidden = false;

	// The described element is the first focusable thing in the slot.
	onMount(() => {
		const target = wrapper.querySelector('a, button, input, select, textarea, [tabindex]');
		target?.setAttribute('aria-describedby', id);
	});

	// Escape hides it without moving focus, as WCAG 1.4.13 asks.
	function onKeydown(event: KeyboardEvent) {
		// Claimed, so a page-level Escape shortcut (the command palette) does not also fire.
		if (event.key === 'Escape' && !hidden) {
			event.preventDefault();
			hidden = true;
		}
	}
</script>

<span
	class="tooltip tooltip--{placement}"
	class:tooltip--hidden={hidden}
	bind:this={wrapper}
	role="presentation"
	on:keydown={onKeydown}
	on:mouseleave={() => (hidden = false)}
	on:focusout={() => (hidden = false)}
>
	<slot />
	<span {id} role="tooltip" class="tooltip__bubble">{text}</span>
</span>

<style>
	.tooltip {
		position: relative;
		display: inline-flex;
	}

	/* Out of layout until shown: an invisible bubble still counts toward the
	   page's scroll width, and near a screen edge it made the page scroll
	   sideways on a phone. */
	.tooltip__bubble {
		position: absolute;
		left: 50%;
		z-index: 50;
		display: none;
		width: max-content;
		max-width: min(16rem, 80vw);
		padding: 0.375rem 0.625rem;
		border-radius: var(--radius-sm);
		background: var(--color-text);
		color: var(--color-background);
		font-size: 0.8125rem;
		line-height: 1.35;
		pointer-events: none;
		transform: translate(-50%, 0);
	}

	.tooltip--top .tooltip__bubble {
		bottom: calc(100% + 6px);
	}

	.tooltip--bottom .tooltip__bubble {
		top: calc(100% + 6px);
	}

	.tooltip:hover .tooltip__bubble,
	.tooltip:focus-within .tooltip__bubble {
		display: block;
		opacity: 1;
	}

	.tooltip--hidden .tooltip__bubble {
		display: none !important;
	}
</style>
