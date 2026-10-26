<!--
	ProfileForm — avatar (with a preview of a newly picked image), name, email
	and a bio with a live character count. It tracks what changed: Save and
	Discard only work when something differs from `initial`, and a status line
	says so in words. Pass a new `initial` after saving to reset the baseline.
	The picked image is not uploaded here; it comes back in the `save` event.
	Events: `save` with { values, avatar (File or null), removeAvatar }, `discard`.
-->
<script lang="ts">
	import { createEventDispatcher, onDestroy, tick } from 'svelte';
	import { Alert, Avatar, Button, Textarea, TextInput, uid } from '$lib/ui';
	import FormErrorSummary from './FormErrorSummary.svelte';
	import {
		AVATAR_MAX_BYTES,
		AVATAR_TYPES,
		BIO_MAX,
		avatarFileError,
		isDirty,
		validateProfile,
		type AccountMessages,
		type FieldErrors,
		type ProfileValues
	} from './logic';

	export let title = 'Profile';
	export let description = '';
	export let level: 1 | 2 | 3 | 4 = 2;
	export let initial: ProfileValues & { avatarUrl?: string } = { name: '', email: '', bio: '' };
	export let saving = false;
	/** Set true (or a message) after a successful save. */
	export let saved = false;
	export let error = '';
	export let errors: FieldErrors = {};
	export let bioMax = BIO_MAX;
	export let avatarTypes = AVATAR_TYPES;
	export let avatarMaxBytes = AVATAR_MAX_BYTES;
	export let messages: Partial<AccountMessages> = {};

	export let nameLabel = 'Name';
	export let emailLabel = 'Email';
	export let bioLabel = 'Bio';
	export let bioHint = 'A sentence or two about you.';
	export let avatarLabel = 'Profile photo';
	export let avatarHint = 'PNG, JPEG, WebP or GIF, up to 2 MB.';
	export let changePhotoLabel = 'Change photo';
	export let removePhotoLabel = 'Remove photo';
	export let saveLabel = 'Save changes';
	export let savingLabel = 'Saving';
	export let discardLabel = 'Discard changes';
	export let dirtyText = 'You have unsaved changes.';
	export let cleanText = 'No changes yet.';
	export let savedText = 'Your changes were saved.';
	export let summaryTitle = 'Please fix the following';

	const dispatch = createEventDispatcher<{
		save: { values: ProfileValues; avatar: File | null; removeAvatar: boolean };
		discard: void;
	}>();

	const id = uid('profile');
	let name = initial.name;
	let email = initial.email;
	let bio = initial.bio;
	let avatarFile: File | null = null;
	let avatarPreview = '';
	let removeAvatar = false;
	let avatarError = '';
	let clientErrors: FieldErrors = {};
	let fileInput: HTMLInputElement;
	let summary: FormErrorSummary;

	$: applyInitial(initial);
	let shown: FieldErrors = {};
	$: shown = { ...clientErrors, ...errors, ...(avatarError ? { avatar: avatarError } : {}) };
	$: avatarChanged = avatarFile !== null || removeAvatar;
	$: dirty = isDirty(
		{ name: initial.name, email: initial.email, bio: initial.bio },
		{ name, email, bio },
		avatarChanged
	);
	$: shownAvatar =
		removeAvatar || (avatarFile && !avatarPreview) ? undefined : avatarPreview || initial.avatarUrl;
	$: hasAvatar = Boolean(shownAvatar);
	$: summaryLevel = (level + 1) as 2 | 3 | 4 | 5;
	$: fields = [
		{ name: 'avatar', label: avatarLabel, id: `${id}-photo` },
		{ name: 'name', label: nameLabel, id: `${id}-name` },
		{ name: 'email', label: emailLabel, id: `${id}-email` },
		{ name: 'bio', label: bioLabel, id: `${id}-bio` }
	];

	function applyInitial(next: typeof initial) {
		name = next.name;
		email = next.email;
		bio = next.bio;
		resetAvatar();
		clientErrors = {};
	}

	function resetAvatar() {
		if (avatarPreview && typeof URL.revokeObjectURL === 'function')
			URL.revokeObjectURL(avatarPreview);
		avatarFile = null;
		avatarPreview = '';
		removeAvatar = false;
		avatarError = '';
	}

	onDestroy(() => {
		if (avatarPreview && typeof URL.revokeObjectURL === 'function')
			URL.revokeObjectURL(avatarPreview);
	});

	function clear(field: string) {
		if (clientErrors[field]) clientErrors = { ...clientErrors, [field]: '' };
	}

	function pick(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		const problem = avatarFileError(file, { types: avatarTypes, maxBytes: avatarMaxBytes });
		if (problem) {
			avatarError = problem;
			return;
		}
		if (avatarPreview && typeof URL.revokeObjectURL === 'function')
			URL.revokeObjectURL(avatarPreview);
		avatarError = '';
		avatarFile = file;
		removeAvatar = false;
		avatarPreview = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '';
	}

	function removePhoto() {
		if (avatarPreview && typeof URL.revokeObjectURL === 'function')
			URL.revokeObjectURL(avatarPreview);
		avatarFile = null;
		avatarPreview = '';
		avatarError = '';
		removeAvatar = Boolean(initial.avatarUrl);
		fileInput?.focus();
	}

	function discard() {
		applyInitial(initial);
		dispatch('discard');
	}

	async function submit() {
		if (saving || !dirty) return;
		clientErrors = validateProfile({ name, email, bio }, { bioMax, messages });
		if (Object.keys(clientErrors).length > 0 || avatarError) {
			await tick();
			summary?.focus();
			return;
		}
		dispatch('save', {
			values: { name: name.trim(), email: email.trim(), bio },
			avatar: avatarFile,
			removeAvatar
		});
	}
</script>

<section class="profile" aria-labelledby="{id}-title">
	<header>
		<svelte:element this={`h${level}`} id="{id}-title">{title}</svelte:element>
		{#if description}<p class="muted">{description}</p>{/if}
	</header>

	<form novalidate aria-busy={saving} on:submit|preventDefault={submit}>
		{#if error}<Alert tone="danger">{error}</Alert>{/if}
		<FormErrorSummary
			bind:this={summary}
			errors={shown}
			{fields}
			title={summaryTitle}
			level={summaryLevel}
		/>

		<div
			class="photo"
			role="group"
			aria-labelledby="{id}-photo-label"
			aria-describedby="{id}-photo-hint"
		>
			<span id="{id}-photo-label" class="photo__label">{avatarLabel}</span>
			<div class="photo__row">
				<Avatar name={name || initial.name || nameLabel} src={shownAvatar} size="lg" />
				<div class="photo__actions">
					<Button id="{id}-photo" variant="secondary" on:click={() => fileInput.click()}>
						{changePhotoLabel}
					</Button>
					{#if hasAvatar}
						<Button variant="ghost" on:click={removePhoto}>{removePhotoLabel}</Button>
					{/if}
				</div>
			</div>
			<input
				bind:this={fileInput}
				type="file"
				hidden
				tabindex="-1"
				accept={avatarTypes.join(',')}
				aria-label={avatarLabel}
				on:change={pick}
			/>
			<p id="{id}-photo-hint" class="hint" class:hint--error={avatarError}>
				{avatarError || avatarHint}
			</p>
		</div>

		<TextInput
			id="{id}-name"
			label={nameLabel}
			name="name"
			autocomplete="name"
			required
			bind:value={name}
			error={shown.name ?? ''}
			on:input={() => clear('name')}
		/>
		<TextInput
			id="{id}-email"
			label={emailLabel}
			type="email"
			name="email"
			autocomplete="email"
			required
			bind:value={email}
			error={shown.email ?? ''}
			on:input={() => clear('email')}
		/>
		<Textarea
			id="{id}-bio"
			label={bioLabel}
			hint={bioHint}
			rows={4}
			maxlength={bioMax}
			bind:value={bio}
			error={shown.bio ?? ''}
			on:input={() => clear('bio')}
		/>

		<p class="state" role="status">
			{#if saved && !dirty}{savedText}{:else if dirty}{dirtyText}{:else}{cleanText}{/if}
		</p>
		<div class="actions">
			<Button type="submit" disabled={!dirty} loading={saving}>
				{saving ? savingLabel : saveLabel}
			</Button>
			<Button variant="secondary" disabled={!dirty || saving} on:click={discard}
				>{discardLabel}</Button
			>
		</div>
	</form>
</section>

<style>
	.profile {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		inline-size: 100%;
		max-inline-size: 36rem;
		min-width: 0;
		padding: var(--spacing-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-background);
		color: var(--color-text);
	}

	h1,
	h2,
	h3,
	h4 {
		margin: 0;
		font-size: 1.5rem;
	}

	.muted {
		margin: var(--spacing-xs) 0 0;
		color: var(--color-text-secondary);
	}

	form {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
	}

	.photo {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		min-width: 0;
	}

	.photo__label {
		font-weight: 600;
		font-size: 0.9rem;
	}

	.photo__row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-md);
	}

	.photo__actions,
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.hint {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
	}

	.hint--error {
		color: var(--color-error);
	}

	.hint--error::before {
		content: '! ';
		font-weight: 700;
	}

	.state {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}
</style>
