<!--
	PrivacyControls — request an export of your data, or ask for it to be
	deleted, with each request's status in words (not just colour). Deletion
	asks you to type a phrase first. The app does the work: listen for
	`exportrequest`, `deleterequest` and `cancelrequest`, and pass the new
	status back in.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Dialog from '$lib/ui/Dialog.svelte';
	import TextInput from '$lib/ui/TextInput.svelte';
	import {
		canCancel,
		canRequest,
		settingsDaysUntil,
		formatSettingsDate,
		isDeleteConfirmed,
		requestStatusInfo,
		type PrivacyRequest
	} from './logic';

	export let exportRequest: PrivacyRequest = { status: 'idle' };
	export let deleteRequest: PrivacyRequest = { status: 'idle' };
	/** What the person types to confirm deletion. */
	export let confirmPhrase = 'DELETE';
	export let now: string = new Date().toISOString();
	export let locale = 'en';
	export let timeZone = 'UTC';
	export let level: 2 | 3 | 4 = 2;
	export let copy: Partial<typeof DEFAULT_COPY> = {};

	const DEFAULT_COPY = {
		title: 'Your data',
		exportTitle: 'Export my data',
		exportBody: 'We will gather everything we hold about you into a file you can download.',
		exportAction: 'Request export',
		exportAgain: 'Request a new export',
		download: 'Download export',
		expires: 'Link expires',
		deleteTitle: 'Delete my data',
		deleteBody: 'Permanently erase your account and everything attached to it.',
		deleteAction: 'Delete my data',
		deleteDialog: 'Delete all your data?',
		deleteDialogBody: 'This cannot be undone. Export first if you want a copy.',
		confirmLabel: 'Type {phrase} to confirm',
		confirmHint: 'The button turns on when the words match.',
		deleteConfirm: 'Delete everything',
		cancel: 'Cancel',
		cancelRequest: 'Cancel request',
		requestedOn: 'Requested',
		erasedOn: 'Scheduled for erasure',
		daysLeft: 'days left to change your mind',
		dayLeft: 'day left to change your mind',
		statusLabel: 'Status'
	};

	const dispatch = createEventDispatcher<{
		exportrequest: void;
		deleterequest: void;
		cancelrequest: { kind: 'export' | 'delete' };
	}>();

	$: t = { ...DEFAULT_COPY, ...copy };
	$: exportInfo = requestStatusInfo(exportRequest.status);
	$: deleteInfo = requestStatusInfo(deleteRequest.status);
	$: left = settingsDaysUntil(deleteRequest.expiresAt, now);

	let dialogOpen = false;
	let typed = '';
	let exportStatus: HTMLElement;
	let deleteStatus: HTMLElement;
	// Focus follows a request this person made, never an update that arrives on its own.
	let awaiting: 'export' | 'delete' | null = null;
	let lastExport = exportRequest.status;
	let lastDelete = deleteRequest.status;

	$: confirmed = isDeleteConfirmed(typed, confirmPhrase);
	$: if (exportRequest.status !== lastExport) {
		lastExport = exportRequest.status;
		if (awaiting === 'export') focusStatus(exportStatus);
	}
	$: if (deleteRequest.status !== lastDelete) {
		lastDelete = deleteRequest.status;
		if (awaiting === 'delete') focusStatus(deleteStatus);
	}

	async function focusStatus(node: HTMLElement) {
		awaiting = null;
		await tick();
		node?.focus();
	}

	function requestExport() {
		awaiting = 'export';
		dispatch('exportrequest');
	}

	function openDelete() {
		typed = '';
		dialogOpen = true;
	}

	function requestDelete() {
		if (!confirmed) return;
		awaiting = 'delete';
		dialogOpen = false;
		dispatch('deleterequest');
	}

	function cancel(kind: 'export' | 'delete') {
		awaiting = kind;
		dispatch('cancelrequest', { kind });
	}
</script>

<section class="privacy" aria-labelledby="privacy-title">
	<svelte:element this={`h${level}`} id="privacy-title" class="privacy__title"
		>{t.title}</svelte:element
	>

	<div class="privacy__cards">
		<article class="card" aria-labelledby="export-title">
			<svelte:element this={`h${level + 1}`} id="export-title" class="card__title"
				>{t.exportTitle}</svelte:element
			>
			<p class="card__body">{t.exportBody}</p>
			<p class="card__status" tabindex="-1" bind:this={exportStatus} role="status">
				<span class="card__status-label">{t.statusLabel}:</span>
				<Badge tone={exportInfo.tone}>{exportInfo.label}</Badge>
				{#if exportRequest.requestedAt}
					<span class="card__date"
						>{t.requestedOn} {formatSettingsDate(exportRequest.requestedAt, locale, timeZone)}</span
					>
				{/if}
			</p>
			{#if exportRequest.status === 'ready' && exportRequest.downloadUrl}
				<p class="card__body">
					<a href={exportRequest.downloadUrl} download>{t.download}</a>
					{#if exportRequest.expiresAt}
						({t.expires} {formatSettingsDate(exportRequest.expiresAt, locale, timeZone)}){/if}
				</p>
			{/if}
			<div class="card__actions">
				{#if canRequest(exportRequest.status)}
					<Button on:click={requestExport}
						>{exportRequest.status === 'idle' ? t.exportAction : t.exportAgain}</Button
					>
				{:else if canCancel(exportRequest.status)}
					<Button variant="secondary" on:click={() => cancel('export')}>{t.cancelRequest}</Button>
				{/if}
			</div>
		</article>

		<article class="card card--danger" aria-labelledby="delete-title">
			<svelte:element this={`h${level + 1}`} id="delete-title" class="card__title"
				>{t.deleteTitle}</svelte:element
			>
			<p class="card__body">{t.deleteBody}</p>
			<p class="card__status" tabindex="-1" bind:this={deleteStatus} role="status">
				<span class="card__status-label">{t.statusLabel}:</span>
				<Badge tone={deleteInfo.tone}>{deleteInfo.label}</Badge>
				{#if deleteRequest.requestedAt}
					<span class="card__date"
						>{t.requestedOn} {formatSettingsDate(deleteRequest.requestedAt, locale, timeZone)}</span
					>
				{/if}
			</p>
			{#if deleteRequest.expiresAt && (deleteRequest.status === 'pending' || deleteRequest.status === 'processing')}
				<p class="card__body">
					<span>{t.erasedOn} {formatSettingsDate(deleteRequest.expiresAt, locale, timeZone)}</span>
					{#if left !== null}
						<span>({left} {left === 1 ? t.dayLeft : t.daysLeft})</span>
					{/if}
				</p>
			{/if}
			<div class="card__actions">
				{#if canRequest(deleteRequest.status)}
					<Button variant="danger" on:click={openDelete}>{t.deleteAction}</Button>
				{:else if canCancel(deleteRequest.status)}
					<Button variant="secondary" on:click={() => cancel('delete')}>{t.cancelRequest}</Button>
				{/if}
			</div>
		</article>
	</div>
</section>

<Dialog bind:open={dialogOpen} title={t.deleteDialog} description={t.deleteDialogBody}>
	<form class="confirm" on:submit|preventDefault={requestDelete}>
		<TextInput
			label={t.confirmLabel.replace('{phrase}', confirmPhrase)}
			hint={t.confirmHint}
			bind:value={typed}
			autocomplete="off"
		/>
		<div class="confirm__actions">
			<Button variant="secondary" on:click={() => (dialogOpen = false)}>{t.cancel}</Button>
			<Button type="submit" variant="danger" disabled={!confirmed}>{t.deleteConfirm}</Button>
		</div>
	</form>
</Dialog>

<style>
	.privacy {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
	}

	.privacy__title,
	.card__title {
		margin: 0;
	}

	.privacy__cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
		gap: var(--spacing-md);
	}

	.card {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		gap: var(--spacing-sm);
		min-width: 0;
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
	}

	.card--danger {
		border-color: var(--color-danger);
	}

	.card__title {
		font-size: 1.05rem;
	}

	.card__body {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.card__body a {
		color: var(--color-primary);
	}

	.card__status {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-xs) var(--spacing-sm);
		margin: 0;
		font-size: 0.9rem;
	}

	.card__status:focus-visible {
		outline: 3px solid var(--color-primary);
		outline-offset: 2px;
	}

	.card__date {
		color: var(--color-text-secondary);
	}

	.card__actions,
	.confirm__actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.confirm {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
	}

	.confirm__actions {
		justify-content: flex-end;
	}
</style>
