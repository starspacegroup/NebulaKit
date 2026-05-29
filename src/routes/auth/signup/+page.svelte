<script lang="ts">
	import { page } from '$app/stores';
	import AuthProviderButtons from '$lib/components/AuthProviderButtons.svelte';
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	let name = '';
	let email = '';
	let password = '';
	let confirmPassword = '';
	let isLoading = false;
	let error = '';

	const errorMessages: Record<string, string> = {
		oauth_failed: 'Authentication failed. Please try again.',
		no_code: 'No authorization code received from the provider.',
		not_configured: 'OAuth is not configured. Please contact support.',
		token_exchange_failed: 'Failed to exchange authorization code. Please try again.',
		no_access_token: 'Failed to obtain access token.',
		user_fetch_failed: 'Failed to fetch user information.',
		unauthorized: 'You must be logged in to access that page.'
	};

	onMount(() => {
		const errorCode = $page.url.searchParams.get('error');
		if (errorCode) {
			error = errorMessages[errorCode] || 'An unexpected error occurred. Please try again.';

			const url = new URL(window.location.href);
			url.searchParams.delete('error');

			if (typeof window.history?.replaceState === 'function') {
				window.history.replaceState({}, '', url);
			}
		}
	});

	async function handleSubmit() {
		error = '';
		isLoading = true;

		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			isLoading = false;
			return;
		}

		try {
			const response = await fetch('/api/auth/signup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, email, password, confirmPassword })
			});

			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(payload.message || 'Failed to create account.');
			}

			window.location.assign(payload.redirectTo || '/');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create account.';
			isLoading = false;
		}
	}

	function handleSSOSignup(provider: 'github' | 'discord') {
		isLoading = true;

		if (provider === 'github') {
			window.location.assign('/api/auth/github');
			return;
		}

		window.location.assign('/api/auth/discord');
	}
</script>

<SharingMeta title="Sign Up" description="Create your NebulaKit account" />

<div class="auth-page">
	<div class="auth-container">
		<div class="auth-header">
			<h1>Create Account</h1>
			<p>Create your account with the same providers you use to sign in</p>
		</div>

		<AuthProviderButtons
			configuredProviders={data.configuredProviders}
			simulatedProviders={data.simulatedProviders}
			disabled={isLoading}
			actionLabel="Continue"
			on:select={(event) => handleSSOSignup(event.detail.provider)}
		/>

		<form on:submit|preventDefault={handleSubmit}>
			{#if error}
				<div class="error-message">{error}</div>
			{/if}

			<div class="form-group">
				<label for="name">Name</label>
				<input
					id="name"
					type="text"
					bind:value={name}
					placeholder="Your name"
					autocomplete="name"
					required
				/>
			</div>

			<div class="form-group">
				<label for="email">Email</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					placeholder="you@example.com"
					autocomplete="email"
					required
				/>
			</div>

			<div class="form-group">
				<label for="password">Password</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					placeholder="••••••••"
					autocomplete="new-password"
					required
				/>
			</div>

			<div class="form-group">
				<label for="confirm-password">Confirm Password</label>
				<input
					id="confirm-password"
					type="password"
					bind:value={confirmPassword}
					placeholder="••••••••"
					autocomplete="new-password"
					required
				/>
			</div>

			<button type="submit" class="submit-button" disabled={isLoading}>
				{#if isLoading}
					Redirecting...
				{:else}
					Sign Up
				{/if}
			</button>
		</form>

		<div class="auth-footer">
			<p>Already have an account? <a href="/auth/login">Sign in</a></p>
		</div>
	</div>
</div>

<style>
	.auth-page {
		min-height: calc(100vh - 64px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-lg);
	}

	.auth-container {
		width: 100%;
		max-width: 400px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-xl);
	}

	.auth-header {
		text-align: center;
		margin-bottom: var(--spacing-xl);
	}

	.auth-header h1 {
		margin-bottom: var(--spacing-xs);
		font-size: 1.875rem;
	}

	.auth-header p {
		color: var(--color-text-secondary);
	}

	.form-group {
		margin-bottom: var(--spacing-md);
	}

	.form-group label {
		display: block;
		margin-bottom: var(--spacing-xs);
		font-weight: 500;
		color: var(--color-text);
	}

	.form-group input {
		width: 100%;
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text);
		font-size: 1rem;
		transition: border-color var(--transition-fast);
	}

	.form-group input:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.error-message {
		padding: var(--spacing-sm) var(--spacing-md);
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid var(--color-error);
		border-radius: var(--radius-md);
		color: var(--color-error);
		font-size: 0.875rem;
		margin-bottom: var(--spacing-md);
	}

	.submit-button {
		width: 100%;
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.submit-button:hover:not(:disabled) {
		background: var(--color-primary-hover);
		transform: translateY(-2px);
		box-shadow: var(--shadow-md);
	}

	.submit-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.auth-footer {
		margin-top: var(--spacing-lg);
		text-align: center;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.auth-footer a {
		color: var(--color-primary);
		font-weight: 500;
	}
</style>
