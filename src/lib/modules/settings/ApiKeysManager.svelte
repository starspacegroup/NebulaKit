<!--
	ApiKeysManager — create keys with scopes and an expiry, show the secret once
	(with a copy button), list keys masked with their last use, and revoke with
	a confirmation. It never makes the secret: the app does, then passes it back
	in `createdSecret`. Events carry what the app needs to act.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Checkbox from '$lib/ui/Checkbox.svelte';
	import Dialog from '$lib/ui/Dialog.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import Select from '$lib/ui/Select.svelte';
	import TextInput from '$lib/ui/TextInput.svelte';
	import {
		EXPIRY_OPTIONS,
		KEY_MESSAGES,
		computeExpiry,
		expiryStatus,
		formatSettingsDate,
		formatLastUsed,
		maskFromParts,
		summarizeScopes,
		toggleScope,
		validateKeyName,
		type ApiKey,
		type ScopeOption
	} from './logic';

	export let keys: ApiKey[] = [];
	export let scopes: ScopeOption[] = [];
	/** The new key's secret, set by the app right after it creates the key. Shown once. */
	export let createdSecret = '';
	export let createdName = '';
	export let busy = false;
	export let error = '';
	export let now: string = new Date().toISOString();
	export let locale = 'en';
	export let timeZone = 'UTC';
	export let level: 2 | 3 | 4 = 2;
	export let copy: Partial<typeof DEFAULT_COPY> = {};

	const DEFAULT_COPY = {
		title: 'API keys',
		create: 'Create key',
		createTitle: 'Create an API key',
		createDescription: 'Pick only the access this key needs.',
		name: 'Name',
		nameHint: 'Where the key is used, such as "CI deploy".',
		scopes: 'Scopes',
		expiry: 'Expires',
		submit: 'Create key',
		cancel: 'Cancel',
		errorsTitle: 'Fix these before creating the key:',
		secretTitle: 'Copy your new key now',
		secretNote: 'This is the only time it is shown. Store it somewhere safe.',
		copySecret: 'Copy key',
		copied: 'Copied to clipboard.',
		copyFailed: 'Could not copy. Select the key and copy it by hand.',
		secretDone: 'I have saved it',
		revoke: 'Revoke',
		revokeTitle: 'Revoke this key?',
		revokeBody: 'Anything using it stops working straight away. This cannot be undone.',
		revokeConfirm: 'Revoke key',
		emptyTitle: 'No API keys yet',
		emptyBody: 'Create a key to let a script or service use the API.',
		createdOn: 'Created',
		lastUsed: 'Last used',
		expires: 'Expires',
		noExpiry: 'Never expires',
		expired: 'Expired',
		expiring: 'Expires soon',
		list: 'Your API keys',
		neverUsed: 'Never used'
	};

	const dispatch = createEventDispatcher<{
		create: { name: string; scopes: string[]; expiresAt: string | null };
		revoke: { id: string };
		secretdismiss: void;
		copy: { ok: boolean };
	}>();

	$: t = { ...DEFAULT_COPY, ...copy };
	$: available = scopes.map((s) => s.value);

	let createOpen = false;
	let name = '';
	let selected: string[] = [];
	let expiry = 'never';
	let nameError = '';
	let scopeError = '';
	let submitted = false;
	let copyStatus = '';
	let revoking: ApiKey | null = null;
	let revokeOpen = false;
	let secretHeading: HTMLElement;
	let listHeading: HTMLElement;
	let createButton: HTMLElement | undefined;

	// Validate first: Svelte 4 cannot see that validate() assigns the errors, so it
	// orders these two by source. errorList must come after the call it reads from.
	$: if (submitted) validate(name, selected, keys);
	$: errorList = [nameError, scopeError].filter(Boolean);
	$: if (createdSecret) focusSecret();

	function validate(n: string, chosen: string[], existing: ApiKey[]) {
		nameError = validateKeyName(
			n,
			existing.map((k) => k.name),
			KEY_MESSAGES
		);
		scopeError = chosen.length === 0 ? KEY_MESSAGES.scopes : '';
		return !nameError && !scopeError;
	}

	function onExpiry(event: Event) {
		expiry = (event.target as HTMLSelectElement).value;
	}

	function openCreate() {
		name = '';
		selected = [];
		expiry = 'never';
		nameError = scopeError = '';
		submitted = false;
		createOpen = true;
	}

	function submit() {
		submitted = true;
		if (!validate(name, selected, keys)) return;
		dispatch('create', {
			name: name.trim(),
			scopes: selected,
			expiresAt: computeExpiry(expiry, now)
		});
		createOpen = false;
	}

	async function focusSecret() {
		await tick();
		secretHeading?.focus();
	}

	async function copySecret() {
		let ok = false;
		try {
			await navigator.clipboard.writeText(createdSecret);
			ok = true;
		} catch {
			ok = false;
		}
		copyStatus = ok ? t.copied : t.copyFailed;
		dispatch('copy', { ok });
	}

	async function dismissSecret() {
		copyStatus = '';
		dispatch('secretdismiss');
		await tick();
		(createButton?.querySelector('button') ?? listHeading)?.focus();
	}

	function askRevoke(key: ApiKey) {
		revoking = key;
		revokeOpen = true;
	}

	async function confirmRevoke() {
		if (revoking) dispatch('revoke', { id: revoking.id });
		revoking = null;
		await tick();
		listHeading?.focus();
	}

	function expiryText(
		key: ApiKey,
		nowIso: string,
		text: typeof DEFAULT_COPY,
		loc: string,
		zone: string
	): { label: string; tone: 'neutral' | 'warning' | 'danger' } {
		const status = expiryStatus(key.expiresAt, nowIso);
		if (status === 'never') return { label: text.noExpiry, tone: 'neutral' };
		const date = formatSettingsDate(key.expiresAt ?? '', loc, zone);
		if (status === 'expired') return { label: `${text.expired} ${date}`, tone: 'danger' };
		if (status === 'expiring') return { label: `${text.expiring}: ${date}`, tone: 'warning' };
		return { label: `${text.expires} ${date}`, tone: 'neutral' };
	}
</script>

<section class="keys" aria-labelledby="keys-title">
	<header class="keys__head">
		<svelte:element
			this={`h${level}`}
			id="keys-title"
			class="keys__title"
			tabindex="-1"
			bind:this={listHeading}>{t.title}</svelte:element
		>
		<span bind:this={createButton} class="keys__create">
			<Button on:click={openCreate} disabled={busy}>{t.create}</Button>
		</span>
	</header>

	{#if error}
		<p class="keys__error" role="alert">{error}</p>
	{/if}

	{#if createdSecret}
		<div class="secret" role="group" aria-labelledby="secret-title">
			<h3 id="secret-title" class="secret__title" tabindex="-1" bind:this={secretHeading}>
				{t.secretTitle}{createdName ? `: ${createdName}` : ''}
			</h3>
			<p class="secret__note">{t.secretNote}</p>
			<code class="secret__value" aria-label={t.secretTitle}>{createdSecret}</code>
			<div class="secret__actions">
				<Button variant="secondary" on:click={copySecret}>{t.copySecret}</Button>
				<Button on:click={dismissSecret}>{t.secretDone}</Button>
			</div>
		</div>
	{/if}
	<p class="sr-only" role="status">{copyStatus}</p>

	{#if keys.length === 0}
		<EmptyState title={t.emptyTitle} description={t.emptyBody} icon="🔑">
			<Button on:click={openCreate} disabled={busy}>{t.create}</Button>
		</EmptyState>
	{:else}
		<ul class="keys__list" aria-label={t.list}>
			{#each keys as key (key.id)}
				{@const exp = expiryText(key, now, t, locale, timeZone)}
				<li class="key">
					<div class="key__main">
						<p class="key__name">{key.name}</p>
						<code class="key__mask">{maskFromParts(key.prefix, key.last4)}</code>
						<p class="key__scopes">{summarizeScopes(key.scopes, available)}</p>
					</div>
					<dl class="key__meta">
						<div>
							<dt>{t.createdOn}</dt>
							<dd>{formatSettingsDate(key.createdAt, locale, timeZone)}</dd>
						</div>
						<div>
							<dt>{t.lastUsed}</dt>
							<dd>{formatLastUsed(key.lastUsedAt, now, locale, t.neverUsed)}</dd>
						</div>
						<div>
							<dt>{t.expires}</dt>
							<dd><Badge tone={exp.tone}>{exp.label}</Badge></dd>
						</div>
					</dl>
					<Button variant="danger" size="sm" on:click={() => askRevoke(key)} disabled={busy}
						>{t.revoke}<span class="sr-only">&nbsp;{key.name}</span></Button
					>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<Dialog bind:open={createOpen} title={t.createTitle} description={t.createDescription}>
	<form class="form" on:submit|preventDefault={submit} novalidate>
		{#if submitted && errorList.length}
			<div class="form__errors" role="alert">
				<p>{t.errorsTitle}</p>
				<ul>
					{#each errorList as message}<li>{message}</li>{/each}
				</ul>
			</div>
		{/if}
		<TextInput label={t.name} hint={t.nameHint} bind:value={name} error={nameError} required />
		<fieldset class="form__scopes" aria-describedby={scopeError ? 'scope-error' : undefined}>
			<legend>{t.scopes}</legend>
			{#each scopes as scope (scope.value)}
				<Checkbox
					label={scope.label}
					hint={scope.hint ?? ''}
					value={scope.value}
					checked={selected.includes(scope.value)}
					on:change={() => (selected = toggleScope(selected, scope.value, available))}
				/>
			{/each}
			{#if scopeError}<p id="scope-error" class="form__error">{scopeError}</p>{/if}
		</fieldset>
		<Select
			label={t.expiry}
			value={expiry}
			on:change={onExpiry}
			options={EXPIRY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
		/>
		<div class="form__actions">
			<Button variant="secondary" on:click={() => (createOpen = false)}>{t.cancel}</Button>
			<Button type="submit" loading={busy}>{t.submit}</Button>
		</div>
	</form>
</Dialog>

<AlertDialog
	bind:open={revokeOpen}
	tone="danger"
	title={revoking ? `${t.revokeTitle} (${revoking.name})` : t.revokeTitle}
	description={t.revokeBody}
	confirmLabel={t.revokeConfirm}
	cancelLabel={t.cancel}
	on:confirm={confirmRevoke}
	on:cancel={() => (revoking = null)}
/>

<style>
	.keys {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
	}

	.keys__head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-sm);
	}

	.keys__title {
		margin: 0;
	}

	.keys__create {
		display: inline-block;
	}

	.keys__error,
	.form__error {
		margin: 0;
		color: var(--color-error);
		font-size: 0.9rem;
	}

	.keys__error::before,
	.form__error::before {
		content: '\26A0\00a0';
	}

	.secret {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		padding: var(--spacing-md);
		border: 2px solid var(--color-success);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	.secret__title {
		margin: 0;
		font-size: 1rem;
	}

	.secret__title:focus-visible,
	.keys__title:focus-visible {
		outline: 3px solid var(--color-primary);
		outline-offset: 2px;
	}

	.secret__note {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.secret__value {
		display: block;
		padding: var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-background);
		font-family: var(--font-mono);
		overflow-wrap: anywhere;
		user-select: all;
	}

	.secret__actions,
	.form__actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
		justify-content: flex-end;
	}

	.keys__list {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.key {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		min-width: 0;
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
	}

	@media (min-width: 48rem) {
		.key {
			grid-template-columns: minmax(0, 2fr) minmax(0, 3fr) auto;
			align-items: center;
		}
	}

	.key__main {
		min-width: 0;
	}

	.key__main > * {
		margin: 0;
	}

	.key__name {
		font-weight: 600;
	}

	.key__mask {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		overflow-wrap: anywhere;
	}

	.key__scopes {
		color: var(--color-text-secondary);
		font-size: 0.85rem;
	}

	.key__meta {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: var(--spacing-sm);
		margin: 0;
		min-width: 0;
	}

	.key__meta dt {
		color: var(--color-text-secondary);
		font-size: 0.75rem;
	}

	.key__meta dd {
		margin: 0;
		font-size: 0.9rem;
	}

	.form {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
	}

	.form__errors {
		padding: var(--spacing-sm) var(--spacing-md);
		border: 1px solid var(--color-error);
		border-radius: var(--radius-md);
		color: var(--color-error);
	}

	.form__errors p {
		margin: 0 0 var(--spacing-xs);
		font-weight: 600;
	}

	.form__errors ul {
		margin: 0;
		padding-inline-start: 1.25rem;
	}

	.form__scopes {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.form__scopes legend {
		margin-block-end: var(--spacing-xs);
		padding: 0;
		font-weight: 600;
	}
</style>
