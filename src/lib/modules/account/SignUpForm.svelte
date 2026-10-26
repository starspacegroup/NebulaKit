<!--
	SignUpForm — name, email and a new password with a live strength meter and
	requirement checklist, plus a terms checkbox. Every field reports its own
	error next to it (aria-invalid + aria-describedby) and the form lists them
	all in a summary that takes focus after a failed submit. Server problems go
	in `error` (whole form) or `errors` (by field: name, email, password, terms).
	The `terms` slot holds the label of the checkbox, so it can contain links.
	Events: `submit` with { name, email, password }, `provider` with { id }.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { Alert, Button, Checkbox, TextInput, uid } from '$lib/ui';
	import FormErrorSummary from './FormErrorSummary.svelte';
	import PasswordStrength from './PasswordStrength.svelte';
	import {
		defaultPasswordRules,
		validateSignUp,
		type AccountMessages,
		type FieldErrors,
		type PasswordRule
	} from './logic';

	export let title = 'Create your account';
	export let description = '';
	export let level: 1 | 2 | 3 | 4 = 2;
	export let name = '';
	export let email = '';
	export let password = '';
	export let terms = false;
	export let loading = false;
	export let error = '';
	export let errors: FieldErrors = {};
	export let providers: { id: string; label: string }[] = [];
	export let rules: PasswordRule[] = defaultPasswordRules();
	export let messages: Partial<AccountMessages> = {};
	export let signInHref = '';

	export let nameLabel = 'Full name';
	export let emailLabel = 'Email';
	export let passwordLabel = 'Password';
	export let showPasswordLabel = 'Show password';
	export let termsLabel = 'I agree to the terms of service and privacy policy';
	export let submitLabel = 'Create account';
	export let loadingLabel = 'Creating your account';
	export let signInPrompt = 'Already have an account?';
	export let signInLabel = 'Sign in';
	export let providersLabel = 'Sign up with';
	export let dividerLabel = 'or use your email';
	export let summaryTitle = 'Please fix the following';

	const dispatch = createEventDispatcher<{
		submit: { name: string; email: string; password: string };
		provider: { id: string };
	}>();

	const id = uid('sign-up');
	let summary: FormErrorSummary;
	let clientErrors: FieldErrors = {};
	let showPassword = false;
	$: summaryLevel = (level + 1) as 2 | 3 | 4 | 5 | 6;

	$: shown = { ...clientErrors, ...errors };
	$: fields = [
		{ name: 'name', label: nameLabel, id: `${id}-name` },
		{ name: 'email', label: emailLabel, id: `${id}-email` },
		{ name: 'password', label: passwordLabel, id: `${id}-password` },
		{ name: 'terms', label: termsLabel, id: `${id}-terms` }
	];
	$: passwordDescribedBy = [shown.password ? `${id}-password-error` : '', `${id}-strength`]
		.filter(Boolean)
		.join(' ');

	function clear(field: string) {
		if (clientErrors[field]) clientErrors = { ...clientErrors, [field]: '' };
	}

	async function submit() {
		if (loading) return;
		clientErrors = validateSignUp({ name, email, password, terms }, { rules, messages });
		if (Object.keys(clientErrors).length > 0) {
			await tick();
			summary?.focus();
			return;
		}
		dispatch('submit', { name: name.trim(), email: email.trim(), password });
	}
</script>

<section class="signup" aria-labelledby="{id}-title">
	<header>
		<svelte:element this={`h${level}`} id="{id}-title">{title}</svelte:element>
		{#if description}<p class="muted">{description}</p>{/if}
	</header>

	{#if providers.length > 0 || $$slots.providers}
		<div class="providers" role="group" aria-label={providersLabel}>
			<slot name="providers">
				{#each providers as provider (provider.id)}
					<Button
						variant="secondary"
						block
						disabled={loading}
						on:click={() => dispatch('provider', { id: provider.id })}
					>
						{provider.label}
					</Button>
				{/each}
			</slot>
		</div>
		<p class="divider"><span>{dividerLabel}</span></p>
	{/if}

	<form novalidate aria-busy={loading} on:submit|preventDefault={submit}>
		{#if error}<Alert tone="danger">{error}</Alert>{/if}
		<FormErrorSummary
			bind:this={summary}
			errors={shown}
			{fields}
			title={summaryTitle}
			level={summaryLevel}
		/>

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
		<div class="password">
			<TextInput
				id="{id}-password"
				label={passwordLabel}
				type={showPassword ? 'text' : 'password'}
				name="password"
				autocomplete="new-password"
				required
				aria-describedby={passwordDescribedBy}
				bind:value={password}
				error={shown.password ?? ''}
				on:input={() => clear('password')}
			/>
			<Checkbox label={showPasswordLabel} bind:checked={showPassword} />
			<PasswordStrength id="{id}-strength" {password} {rules} />
		</div>

		<div class="terms" class:terms--invalid={shown.terms}>
			<label class="terms__row">
				<input
					id="{id}-terms"
					type="checkbox"
					name="terms"
					required
					bind:checked={terms}
					aria-invalid={shown.terms ? 'true' : undefined}
					aria-describedby={shown.terms ? `${id}-terms-error` : undefined}
					on:change={() => clear('terms')}
				/>
				<span><slot name="terms">{termsLabel}</slot></span>
			</label>
			{#if shown.terms}<p id="{id}-terms-error" class="terms__error">{shown.terms}</p>{/if}
		</div>

		<Button type="submit" block {loading}>{loading ? loadingLabel : submitLabel}</Button>
		<p class="sr-only" role="status">{loading ? loadingLabel : ''}</p>
	</form>

	{#if signInHref}
		<footer>
			<p>{signInPrompt} <a href={signInHref}>{signInLabel}</a></p>
		</footer>
	{/if}
</section>

<style>
	.signup {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		inline-size: 100%;
		max-inline-size: 26rem;
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

	form,
	.password {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
	}

	.password {
		gap: var(--spacing-sm);
	}

	.providers {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
	}

	.divider {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		border-block-start: 1px solid var(--color-border);
	}

	.terms__row {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-sm);
		min-block-size: 44px;
		padding-block: var(--spacing-sm);
		cursor: pointer;
	}

	.terms__row input {
		flex: none;
		inline-size: 1.5rem;
		block-size: 1.5rem;
		margin-block-start: 0.125rem;
		accent-color: var(--color-primary-solid);
	}

	.terms__row input:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.terms__error {
		margin: 0;
		color: var(--color-error);
		font-size: 0.875rem;
	}

	.terms__error::before {
		content: '! ';
		font-weight: 700;
	}

	footer p {
		margin: 0;
		font-size: 0.9rem;
	}

	a {
		display: inline-block;
		padding-block: var(--spacing-sm);
		color: var(--color-primary);
	}
</style>
