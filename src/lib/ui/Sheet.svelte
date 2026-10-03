<!--
	Sheet — a modal panel that slides in from an edge of the screen: from the
	side for settings and detail views, from the bottom for a mobile drawer.
	Built on the native <dialog>, like Dialog, so focus is trapped, Escape
	closes it and the page behind is inert. A click on the backdrop closes it
	too. Bind `open`. The slide is skipped for prefers-reduced-motion.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { uid } from './logic';

	export let open = false;
	export let title: string;
	export let description = '';
	export let side: 'left' | 'right' | 'top' | 'bottom' = 'right';

	const dispatch = createEventDispatcher<{ close: void }>();
	const id = uid('sheet');
	let dialog: HTMLDialogElement;

	$: if (dialog) sync(open);

	function sync(want: boolean) {
		if (want && !dialog.open) {
			if (typeof dialog.showModal === 'function') dialog.showModal();
			else dialog.setAttribute('open', '');
		} else if (!want && dialog.open) {
			if (typeof dialog.close === 'function') dialog.close();
			else dialog.removeAttribute('open');
		}
	}

	function onClose() {
		open = false;
		dispatch('close');
	}

	// A click on the dialog element itself, not its panel, is a click on the
	// backdrop. Escape already closes it natively.
	function backdrop(node: HTMLDialogElement) {
		const onClick = (event: MouseEvent) => {
			if (event.target === node) open = false;
		};
		node.addEventListener('click', onClick);
		return { destroy: () => node.removeEventListener('click', onClick) };
	}
</script>

<dialog
	bind:this={dialog}
	class="sheet sheet--{side}"
	aria-labelledby="{id}-title"
	aria-describedby={description ? `${id}-description` : undefined}
	use:backdrop
	on:close={onClose}
>
	<div class="sheet__panel">
		<header class="sheet__header">
			<h2 id="{id}-title">{title}</h2>
			<button type="button" class="sheet__close" aria-label="Close" on:click={() => (open = false)}
				>×</button
			>
		</header>
		{#if description}<p id="{id}-description" class="sheet__description">{description}</p>{/if}
		<div class="sheet__body"><slot /></div>
		{#if $$slots.actions}<footer class="sheet__actions"><slot name="actions" /></footer>{/if}
	</div>
</dialog>

<style>
	.sheet {
		position: fixed;
		margin: 0;
		padding: 0;
		border: 0 solid var(--color-border);
		background: var(--color-background);
		color: var(--color-text);
		box-shadow: var(--shadow-xl);
	}

	.sheet--left,
	.sheet--right {
		top: 0;
		bottom: 0;
		width: min(24rem, calc(100vw - 3rem));
		max-width: none;
		height: 100dvh;
		max-height: none;
	}

	.sheet--left {
		left: 0;
		right: auto;
		border-right-width: 1px;
	}

	.sheet--right {
		left: auto;
		right: 0;
		border-left-width: 1px;
	}

	.sheet--top,
	.sheet--bottom {
		left: 0;
		right: 0;
		width: 100vw;
		max-width: none;
		max-height: min(85dvh, 40rem);
	}

	.sheet--top {
		top: 0;
		bottom: auto;
		border-bottom-width: 1px;
		border-radius: 0 0 var(--radius-lg) var(--radius-lg);
	}

	.sheet--bottom {
		top: auto;
		bottom: 0;
		border-top-width: 1px;
		border-radius: var(--radius-lg) var(--radius-lg) 0 0;
	}

	.sheet::backdrop {
		background: rgb(0 0 0 / 0.5);
	}

	.sheet__panel {
		display: grid;
		grid-template-rows: auto auto 1fr auto;
		gap: var(--spacing-md);
		box-sizing: border-box;
		min-height: 100%;
		padding: var(--spacing-lg);
	}

	.sheet--top .sheet__panel,
	.sheet--bottom .sheet__panel {
		grid-template-rows: auto;
		min-height: 0;
	}

	.sheet__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--spacing-md);
	}

	h2 {
		margin: 0;
		font-size: 1.25rem;
	}

	.sheet__description {
		margin: 0;
		color: var(--color-text-secondary);
	}

	.sheet__body {
		min-width: 0;
		overflow: auto;
	}

	.sheet__close {
		padding: 0 0.5rem;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text-secondary);
		font-size: 1.5rem;
		line-height: 1.2;
		cursor: pointer;
	}

	.sheet__close:hover {
		background: var(--color-surface-hover);
		color: var(--color-text);
	}

	.sheet__close:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.sheet__actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--spacing-sm);
	}

	@media (prefers-reduced-motion: no-preference) {
		.sheet[open] {
			animation: sheet-in var(--transition-slow);
		}

		.sheet[open]::backdrop {
			animation: sheet-fade var(--transition-slow);
		}

		.sheet--left {
			--sheet-from: translateX(-100%);
		}

		.sheet--right {
			--sheet-from: translateX(100%);
		}

		.sheet--top {
			--sheet-from: translateY(-100%);
		}

		.sheet--bottom {
			--sheet-from: translateY(100%);
		}
	}

	@keyframes sheet-in {
		from {
			transform: var(--sheet-from);
		}
	}

	@keyframes sheet-fade {
		from {
			opacity: 0;
		}
	}
</style>
