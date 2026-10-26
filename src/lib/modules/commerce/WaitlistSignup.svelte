<!--
	WaitlistSignup — an email box that joins a waitlist, and what you see after:
	your position and a link to share for a better spot. It reports the email
	with a `join` event; you set `state`, `position` and `error` from the
	result. Focus moves to the confirmation when it appears.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import Button from '$lib/ui/Button.svelte';
	import Field from '$lib/ui/Field.svelte';
	import { uid } from '$lib/ui/logic';
	import { checkWaitlistEmail, positionText, shareLink } from './logic';

	export let state: 'idle' | 'submitting' | 'success' | 'error' = 'idle';
	export let email = '';
	/** Their place in line, once joined. */
	export let position: number | undefined = undefined;
	export let total: number | undefined = undefined;
	/** Their referral code. */
	export let referralCode = '';
	/** The page people are sent to; `?ref=code` is added. */
	export let shareUrl = '';
	/** A message from the server when `state` is "error". */
	export let error = '';
	export let locale = 'en-US';
	export let heading = 'Join the waitlist';
	export let level: 2 | 3 | 4 = 2;
	export let labels: Partial<typeof defaults> = {};

	const defaults = {
		intro: 'Be first in line when we open the doors.',
		email: 'Email address',
		submit: 'Join the waitlist',
		required: 'Enter your email address.',
		format: 'Enter a valid email address, like name@example.com.',
		joined: 'You are on the list',
		position: 'Your place in line: {position}',
		of: 'of {total}',
		bump: 'Move up the list: each friend who joins through your link moves you ahead.',
		link: 'Your share link',
		copy: 'Copy link',
		copied: 'Link copied',
		copyFailed: 'Could not copy. Select the link and copy it.',
		share: 'Share by email',
		shareSubject: 'Join me on the waitlist',
		again: 'Use a different email'
	};

	const dispatch = createEventDispatcher<{
		join: { email: string };
		copy: { url: string };
		reset: void;
	}>();
	const id = uid('waitlist');
	let message = '';
	let copyStatus = '';
	let confirmEl: HTMLElement;
	let lastState = state;

	$: t = { ...defaults, ...labels };
	$: link = shareLink(shareUrl, referralCode);
	$: shown = message || (state === 'error' ? error : '');
	$: if (state !== lastState) {
		lastState = state;
		if (state === 'success') tick().then(() => confirmEl?.focus());
	}

	function submit() {
		const result = checkWaitlistEmail(email);
		if (!result.ok) {
			message = result.code === 'required' ? t.required : t.format;
			return;
		}
		message = '';
		dispatch('join', { email: result.email });
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(link);
			copyStatus = t.copied;
			dispatch('copy', { url: link });
		} catch {
			copyStatus = t.copyFailed;
		}
	}

	function reset() {
		state = 'idle';
		email = '';
		dispatch('reset');
	}
</script>

<section class="waitlist" aria-labelledby="{id}-h">
	{#if state === 'success'}
		<div class="done">
			<svelte:element
				this={`h${level}`}
				class="waitlist__title"
				id="{id}-h"
				tabindex="-1"
				bind:this={confirmEl}><span aria-hidden="true">✓ </span>{t.joined}</svelte:element
			>
			<div role="status">
				{#if position !== undefined}
					<p class="done__pos">
						{t.position.replace('{position}', positionText(position, locale))}
						{#if total !== undefined}<span class="done__of"
								>{t.of.replace('{total}', new Intl.NumberFormat(locale).format(total))}</span
							>{/if}
					</p>
				{/if}
			</div>
			{#if shareUrl}
				<p class="done__bump">{t.bump}</p>
				<div class="share">
					<label class="share__label" for="{id}-link">{t.link}</label>
					<input id="{id}-link" class="share__input" type="text" readonly value={link} />
					<div class="share__actions">
						<Button variant="secondary" on:click={copy}>{t.copy}</Button>
						<Button
							variant="ghost"
							href="mailto:?subject={encodeURIComponent(t.shareSubject)}&body={encodeURIComponent(
								link
							)}">{t.share}</Button
						>
					</div>
					<p class="sr-only" role="status">{copyStatus}</p>
					{#if copyStatus}<p class="share__status" aria-hidden="true">{copyStatus}</p>{/if}
				</div>
			{/if}
			<button type="button" class="again" on:click={reset}>{t.again}</button>
		</div>
	{:else}
		<svelte:element this={`h${level}`} class="waitlist__title" id="{id}-h">{heading}</svelte:element
		>
		<p class="waitlist__intro">{t.intro}</p>
		<form class="form" novalidate on:submit|preventDefault={submit}>
			<Field label={t.email} error={shown} required id="{id}-email" let:describedBy let:invalid>
				<input
					id="{id}-email"
					name="email"
					type="email"
					autocomplete="email"
					inputmode="email"
					bind:value={email}
					required
					disabled={state === 'submitting'}
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
				/>
			</Field>
			<Button type="submit" loading={state === 'submitting'}>{t.submit}</Button>
		</form>
		<p class="sr-only" role="alert">{shown}</p>
	{/if}
</section>

<style>
	.waitlist {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
		max-width: 28rem;
		color: var(--color-text);
	}

	.waitlist__title {
		margin: 0;
		font-size: 1.375rem;
	}

	.waitlist__title:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 4px;
	}

	.waitlist__intro,
	.done__bump {
		margin: 0;
		color: var(--color-text-secondary);
	}

	.form {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
	}

	.waitlist :global(input[type='email']),
	.share__input {
		width: 100%;
		min-height: 2.75rem;
		box-sizing: border-box;
	}

	.waitlist :global(.btn) {
		min-height: 2.75rem;
	}

	.done {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
	}

	.done__pos {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 700;
	}

	.done__of {
		color: var(--color-text-secondary);
		font-size: 1rem;
		font-weight: 400;
	}

	.share {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
	}

	.share__label {
		font-size: 0.9375rem;
		font-weight: 600;
	}

	.share__actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.share__status {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.again {
		justify-self: start;
		min-height: 2.75rem;
		color: var(--color-primary);
		font-weight: 600;
		text-decoration: underline;
	}
</style>
