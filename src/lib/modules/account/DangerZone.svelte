<!--
	DangerZone — a destructive action behind a type-to-confirm step. The button
	opens an alert dialog (Cancel is focused first, Escape cancels); the delete
	only goes ahead once the typed text matches `confirmPhrase`. Pressing the
	confirm button early keeps the dialog open, explains what to type and puts
	focus in the field. Events: `delete` (confirmed), `cancel`.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { Alert, AlertDialog, Button, TextInput, uid } from '$lib/ui';
	import { confirmMatches, fillMessage } from './logic';

	export let title = 'Delete account';
	export let description =
		'Permanently delete your account and everything in it. This cannot be undone.';
	export let level: 2 | 3 | 4 = 2;
	/** What must be typed to confirm, e.g. the account name or "DELETE". */
	export let confirmPhrase = 'DELETE';
	export let caseSensitive = true;
	export let deleting = false;
	export let error = '';

	export let triggerLabel = 'Delete account…';
	export let deletingLabel = 'Deleting';
	export let dialogTitle = 'Delete your account?';
	export let dialogText = 'All your data will be erased for good. This cannot be undone.';
	export let inputLabel = 'Type {phrase} to confirm';
	export let mismatchText = 'That does not match. Type {phrase} exactly.';
	export let matchText = 'Matches. You can delete now.';
	export let confirmLabel = 'Delete forever';
	export let cancelLabel = 'Cancel';

	const dispatch = createEventDispatcher<{ delete: void; cancel: void }>();
	const id = uid('danger');

	let open = false;
	let typed = '';
	let tried = false;

	$: matches = confirmMatches(typed, confirmPhrase, caseSensitive);
	$: label = fillMessage(inputLabel, { phrase: confirmPhrase });
	$: problem = tried && !matches ? fillMessage(mismatchText, { phrase: confirmPhrase }) : '';

	function show() {
		typed = '';
		tried = false;
		open = true;
	}

	async function confirm() {
		if (matches) {
			dispatch('delete');
			return;
		}
		// Not yet: keep the dialog up and bring the person to the field.
		tried = true;
		open = true;
		await tick();
		document.getElementById(`${id}-input`)?.focus();
	}
</script>

<section class="danger" aria-labelledby="{id}-title">
	<svelte:element this={`h${level}`} id="{id}-title" class="danger__title">{title}</svelte:element>
	<p class="danger__text" id="{id}-desc">{description}</p>
	{#if error}<Alert tone="danger">{error}</Alert>{/if}
	<div>
		<Button variant="danger" loading={deleting} aria-describedby="{id}-desc" on:click={show}>
			{deleting ? deletingLabel : triggerLabel}
		</Button>
	</div>

	<AlertDialog
		bind:open
		title={dialogTitle}
		description={dialogText}
		{confirmLabel}
		{cancelLabel}
		tone="danger"
		on:confirm={confirm}
		on:cancel={() => dispatch('cancel')}
	>
		<TextInput
			id="{id}-input"
			{label}
			name="confirm"
			autocomplete="off"
			spellcheck="false"
			autocapitalize="off"
			bind:value={typed}
			error={problem}
			hint={matches ? matchText : ''}
		/>
	</AlertDialog>
</section>

<style>
	.danger {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
		padding: var(--spacing-lg);
		border: 2px solid var(--color-danger);
		border-radius: var(--radius-lg);
		background: var(--color-background);
		color: var(--color-text);
	}

	.danger__title {
		margin: 0;
		color: var(--color-danger);
		font-size: 1.25rem;
	}

	.danger__text {
		margin: 0;
		color: var(--color-text-secondary);
	}
</style>
