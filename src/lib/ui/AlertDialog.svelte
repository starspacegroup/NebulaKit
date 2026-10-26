<!--
	AlertDialog — a confirmation that interrupts: "Delete this project?" The
	ARIA alertdialog pattern on the native <dialog>, so focus is trapped and
	the page behind is inert. Cancel takes focus first, so a stray Enter never
	confirms anything destructive. Escape cancels; a click on the backdrop does
	not, because a decision is being asked for. Bind `open`; the choice is
	reported with `on:confirm` or `on:cancel`, and either one closes it.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { uid } from './logic';

	export let open = false;
	export let title: string;
	export let description = '';
	export let confirmLabel = 'Confirm';
	export let cancelLabel = 'Cancel';
	export let tone: 'default' | 'danger' = 'default';

	const dispatch = createEventDispatcher<{ confirm: void; cancel: void }>();
	const id = uid('alert-dialog');
	let dialog: HTMLDialogElement;
	let cancelButton: HTMLButtonElement;
	let answered = false;

	$: if (dialog) sync(open);

	async function sync(want: boolean) {
		if (want && !dialog.open) {
			answered = false;
			if (typeof dialog.showModal === 'function') dialog.showModal();
			else dialog.setAttribute('open', '');
			await tick();
			cancelButton?.focus();
		} else if (!want && dialog.open) {
			if (typeof dialog.close === 'function') dialog.close();
			else dialog.removeAttribute('open');
		}
	}

	function answer(choice: 'confirm' | 'cancel') {
		answered = true;
		open = false;
		dispatch(choice);
	}

	// Closed some other way (Escape, or the parent setting open = false):
	// with no answer given, that is a cancel.
	function onClose() {
		if (!answered && open) {
			answered = true;
			dispatch('cancel');
		}
		open = false;
	}
</script>

<dialog
	bind:this={dialog}
	class="alert-dialog"
	role="alertdialog"
	aria-modal="true"
	aria-labelledby="{id}-title"
	aria-describedby={description ? `${id}-description` : undefined}
	on:close={onClose}
>
	<div class="alert-dialog__panel">
		<h2 id="{id}-title">{title}</h2>
		{#if description}<p id="{id}-description" class="alert-dialog__description">
				{description}
			</p>{/if}
		{#if $$slots.default}<div class="alert-dialog__body"><slot /></div>{/if}
		<footer class="alert-dialog__actions">
			<button
				bind:this={cancelButton}
				type="button"
				class="alert-dialog__button alert-dialog__button--cancel"
				on:click={() => answer('cancel')}>{cancelLabel}</button
			>
			<button
				type="button"
				class="alert-dialog__button alert-dialog__button--{tone}"
				on:click={() => answer('confirm')}>{confirmLabel}</button
			>
		</footer>
	</div>
</dialog>

<style>
	.alert-dialog {
		width: min(28rem, calc(100vw - 2rem));
		max-height: calc(100dvh - 2rem);
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-background);
		color: var(--color-text);
		box-shadow: var(--shadow-xl);
	}

	.alert-dialog::backdrop {
		background: rgb(0 0 0 / 0.5);
	}

	.alert-dialog__panel {
		display: grid;
		gap: var(--spacing-md);
		padding: var(--spacing-lg);
	}

	h2 {
		margin: 0;
		font-size: 1.25rem;
	}

	.alert-dialog__description {
		margin: 0;
		color: var(--color-text-secondary);
	}

	.alert-dialog__actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--spacing-sm);
	}

	.alert-dialog__button {
		padding: 0.625rem 1.125rem;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.alert-dialog__button:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.alert-dialog__button--cancel {
		border-color: var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
	}

	.alert-dialog__button--cancel:hover {
		background: var(--color-surface-hover);
	}

	.alert-dialog__button--default {
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
	}

	.alert-dialog__button--default:hover {
		background: var(--color-primary-solid-hover);
	}

	.alert-dialog__button--danger {
		background: var(--color-danger-solid);
		color: var(--color-on-solid);
	}

	.alert-dialog__button--danger:hover {
		filter: brightness(1.1);
	}

	@media (max-width: 30rem) {
		.alert-dialog__actions {
			flex-direction: column-reverse;
		}
	}
</style>
