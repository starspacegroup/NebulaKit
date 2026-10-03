<!--
	Dialog — a modal on the native <dialog>, which brings focus trapping,
	Escape to close, the backdrop and inert background for free. Bind `open`.
	A click on the backdrop closes it too.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { uid } from './logic';

	export let open = false;
	export let title: string;
	export let description = '';

	const dispatch = createEventDispatcher<{ close: void }>();
	const id = uid('dialog');
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

	function onClick(event: MouseEvent) {
		if (event.target === dialog) open = false;
	}
</script>

<dialog
	bind:this={dialog}
	class="dialog"
	aria-labelledby="{id}-title"
	aria-describedby={description ? `${id}-description` : undefined}
	on:close={onClose}
	on:click={onClick}
>
	<div class="dialog__panel">
		<header class="dialog__header">
			<h2 id="{id}-title">{title}</h2>
			<button type="button" class="dialog__close" aria-label="Close" on:click={() => (open = false)}
				>×</button
			>
		</header>
		{#if description}<p id="{id}-description" class="dialog__description">{description}</p>{/if}
		<div class="dialog__body"><slot /></div>
		{#if $$slots.actions}<footer class="dialog__actions"><slot name="actions" /></footer>{/if}
	</div>
</dialog>

<style>
	.dialog {
		width: min(32rem, calc(100vw - 2rem));
		max-height: calc(100dvh - 2rem);
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-background);
		color: var(--color-text);
		box-shadow: var(--shadow-xl);
	}

	.dialog::backdrop {
		background: rgb(0 0 0 / 0.5);
	}

	.dialog__panel {
		display: grid;
		gap: var(--spacing-md);
		padding: var(--spacing-lg);
	}

	.dialog__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--spacing-md);
	}

	h2 {
		margin: 0;
		font-size: 1.25rem;
	}

	.dialog__description {
		margin: 0;
		color: var(--color-text-secondary);
	}

	.dialog__close {
		padding: 0 0.5rem;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text-secondary);
		font-size: 1.5rem;
		line-height: 1.2;
		cursor: pointer;
	}

	.dialog__close:hover {
		background: var(--color-surface-hover);
		color: var(--color-text);
	}

	.dialog__actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--spacing-sm);
	}
</style>
