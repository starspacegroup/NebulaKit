<!--
	SignInForm — email and password, with show/hide, "remember me", and optional
	provider buttons (OAuth) above or replaced by the `providers` slot.
	Checks the fields itself, summarises the problems and moves focus to the
	summary; a failure from your server goes in `error` (the whole form) or
	`errors` (by field: email, password). While `loading` the button spins and
	further submits are ignored, but nothing is disabled, so focus stays put.
	Events: `submit` with { email, password, remember }, `provider` with { id }.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { Alert, Button, Checkbox, TextInput, uid } from '$lib/ui';
	import FormErrorSummary from './FormErrorSummary.svelte';
	import { validateSignIn, type AccountMessages, type FieldErrors } from './logic';

	export let title = 'Sign in';
	export let description = '';
	/** Heading level for the title, so the form fits the page's outline. */
	export let level: 1 | 2 | 3 | 4 = 2;
	export let email = '';
	export let password = '';
	export let remember = false;
	export let loading = false;
	/** A problem with the whole form, such as "Wrong email or password". */
	export let error = '';
	/** Problems by field, from your server. */
	export let errors: FieldErrors = {};
	export let providers: { id: string; label: string }[] = [];
	export let messages: Partial<AccountMessages> = {};
	export let forgotHref = '';
	export let signUpHref = '';

	export let emailLabel = 'Email';
	export let passwordLabel = 'Password';
	export let showPasswordLabel = 'Show password';
	export let rememberLabel = 'Keep me signed in on this device';
	export let submitLabel = 'Sign in';
	export let loadingLabel = 'Signing in';
	export let forgotLabel = 'Forgot your password?';
	export let signUpPrompt = 'No account yet?';
	export let signUpLabel = 'Create one';
	export let providersLabel = 'Sign in with';
	export let dividerLabel = 'or use your email';
	export let summaryTitle = 'Please fix the following';

	const dispatch = createEventDispatcher<{
		submit: { email: string; password: string; remember: boolean };
		provider: { id: string };
	}>();

	const id = uid('sign-in');
	let summary: FormErrorSummary;
	let clientErrors: FieldErrors = {};
	let showPassword = false;
	$: summaryLevel = (level + 1) as 2 | 3 | 4 | 5 | 6;

	$: shown = { ...clientErrors, ...errors };
	$: fields = [
		{ name: 'email', label: emailLabel, id: `${id}-email` },
		{ name: 'password', label: passwordLabel, id: `${id}-password` }
	];

	function clear(field: string) {
		if (clientErrors[field]) clientErrors = { ...clientErrors, [field]: '' };
	}

	async function submit() {
		if (loading) return;
		clientErrors = validateSignIn({ email, password }, messages);
		if (Object.keys(clientErrors).length > 0) {
			await tick();
			summary?.focus();
			return;
		}
		dispatch('submit', { email: email.trim(), password, remember });
	}
</script>

<section class="signin" aria-labelledby="{id}-title">
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
			id="{id}-email"
			label={emailLabel}
			type="email"
			name="email"
			autocomplete="username"
			required
			bind:value={email}
			error={shown.email ?? ''}
			on:input={() => clear('email')}
		/>
		<TextInput
			id="{id}-password"
			label={passwordLabel}
			type={showPassword ? 'text' : 'password'}
			name="password"
			autocomplete="current-password"
			required
			bind:value={password}
			error={shown.password ?? ''}
			on:input={() => clear('password')}
		/>
		<Checkbox label={showPasswordLabel} bind:checked={showPassword} />
		<Checkbox label={rememberLabel} bind:checked={remember} />

		<Button type="submit" block {loading}>{loading ? loadingLabel : submitLabel}</Button>
		<p class="status sr-only" role="status">{loading ? loadingLabel : ''}</p>
	</form>

	{#if forgotHref || signUpHref}
		<footer>
			{#if forgotHref}<a href={forgotHref}>{forgotLabel}</a>{/if}
			{#if signUpHref}<p>{signUpPrompt} <a href={signUpHref}>{signUpLabel}</a></p>{/if}
		</footer>
	{/if}
</section>

<style>
	.signin {
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

	form {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
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

	footer {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		font-size: 0.9rem;
	}

	footer p {
		margin: 0;
	}

	a {
		display: inline-block;
		padding-block: var(--spacing-sm);
		color: var(--color-primary);
	}

	a:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
</style>
