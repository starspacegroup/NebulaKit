<!--
	NewsletterSignup — email, consent and a honeypot.

	The form validates before it asks anything of the app: a failed submit
	shows errors tied to the fields (`aria-invalid` + `aria-describedby`) and
	moves focus to the first one. A valid submit fires `subscribe`; the app
	reports back through `status` ("idle" | "submitting" | "success" | "error")
	and `message`. A live region announces every outcome. The honeypot field is
	hidden from people and assistive technology; if a bot fills it the form
	pretends to succeed and fires nothing.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import Button from '$lib/ui/Button.svelte';
	import Checkbox from '$lib/ui/Checkbox.svelte';
	import TextInput from '$lib/ui/TextInput.svelte';
	import { uid } from '$lib/ui/logic';
	import { validateNewsletter, type MarketingFormMessages } from './logic';

	export let title = 'Stay in the loop';
	export let description = 'One email a month. Unsubscribe whenever you like.';
	export let level: 2 | 3 | 4 = 2;
	export let status: 'idle' | 'submitting' | 'success' | 'error' = 'idle';
	/** Text for the success or error state. */
	export let message = '';
	export let requireConsent = true;
	export let email = '';
	export let labels = {
		email: 'Email address',
		consent: 'I agree to receive the newsletter.',
		submit: 'Subscribe',
		success: 'Thanks. Check your inbox to confirm.',
		error: 'Something went wrong. Please try again.'
	};
	export let messages: Partial<MarketingFormMessages> = {};

	const id = uid('news');
	const dispatch = createEventDispatcher<{ subscribe: { email: string; consent: boolean } }>();

	let consent = false;
	let website = '';
	let errors: { email?: string; consent?: string } = {};
	let faked = false;
	let form: HTMLFormElement;
	let statusEl: HTMLElement;
	let wasDone = false;

	$: done = status === 'success' || faked;
	$: live = done ? message || labels.success : status === 'error' ? message || labels.error : '';

	$: if (done !== wasDone) {
		wasDone = done;
		if (done) tick().then(() => statusEl?.focus());
	}

	async function submit() {
		const result = validateNewsletter({ email, consent, website }, { requireConsent, messages });
		errors = result.errors;
		if (!result.valid) {
			await tick();
			form
				.querySelector<HTMLElement>(errors.email ? 'input[type="email"]' : 'input[type="checkbox"]')
				?.focus();
			return;
		}
		if (result.spam) {
			faked = true;
			return;
		}
		dispatch('subscribe', { email: email.trim(), consent });
	}
</script>

<section class="news" aria-labelledby="{id}-title">
	<svelte:element this={`h${level}`} id="{id}-title" class="news__title">{title}</svelte:element>
	<p class="news__desc">{description}</p>

	{#if !done}
		<form bind:this={form} novalidate on:submit|preventDefault={submit} class="news__form">
			<TextInput
				type="email"
				label={labels.email}
				bind:value={email}
				error={errors.email ?? ''}
				required
				disabled={status === 'submitting'}
				autocomplete="email"
				inputmode="email"
			/>
			{#if requireConsent}
				<div
					class="news__consent"
					role="group"
					aria-label={labels.consent}
					aria-describedby={errors.consent ? `${id}-consent-error` : undefined}
				>
					<Checkbox
						label={labels.consent}
						bind:checked={consent}
						disabled={status === 'submitting'}
					/>
					{#if errors.consent}<p class="news__error" id="{id}-consent-error">
							{errors.consent}
						</p>{/if}
				</div>
			{/if}
			<div class="news__trap" aria-hidden="true">
				<label>
					Leave this empty
					<input type="text" name="website" tabindex="-1" autocomplete="off" bind:value={website} />
				</label>
			</div>
			<Button type="submit" size="lg" loading={status === 'submitting'}>{labels.submit}</Button>
		</form>
	{/if}

	<p
		bind:this={statusEl}
		tabindex="-1"
		class="news__status"
		class:news__status--error={status === 'error'}
		class:news__status--ok={done}
		role="status"
		aria-live="polite"
	>
		{#if live}<span aria-hidden="true">{done ? '✓' : '⚠'}</span> {live}{/if}
	</p>
</section>

<style>
	.news {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		min-width: 0;
		padding: var(--spacing-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}

	.news__title {
		margin: 0;
		font-size: 1.5rem;
	}

	.news__desc {
		margin: 0;
		color: var(--color-text-secondary);
	}

	.news__form {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		margin-block-start: var(--spacing-sm);
	}

	.news__error {
		margin: var(--spacing-xs) 0 0;
		color: var(--color-error);
		font-size: 0.875rem;
	}

	.news__error::before {
		content: '⚠ ';
	}

	.news__trap {
		position: absolute;
		inline-size: 1px;
		block-size: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
	}

	.news__status {
		margin: 0;
		min-block-size: 1.5em;
		font-weight: 600;
	}

	.news__status--error {
		color: var(--color-error);
	}

	.news__status--ok {
		color: var(--color-success);
	}
</style>
