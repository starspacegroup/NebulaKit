<script lang="ts">
	import { page } from '$app/stores';
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

	$: githubConfigured = data.configuredProviders?.github ?? false;
	$: discordConfigured = data.configuredProviders?.discord ?? false;
	$: hasAnyProvider = githubConfigured || discordConfigured;

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

		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}

		if (!hasAnyProvider) {
			error = 'No sign-in providers are configured. Please contact the administrator.';
			return;
		}

		error = 'Email/password sign up is not available yet. Continue with a configured provider.';
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

		<div class="sso-buttons">
			{#if githubConfigured}
				<button class="sso-button" on:click={() => handleSSOSignup('github')}>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
						/>
					</svg>
					Continue with GitHub
				</button>
			{/if}
			{#if discordConfigured}
				<button class="sso-button" on:click={() => handleSSOSignup('discord')}>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
						/>
					</svg>
					Continue with Discord
				</button>
			{/if}
			{#if !hasAnyProvider}
				<p class="no-providers-message">
					No OAuth providers configured. Please contact the administrator.
				</p>
			{/if}
		</div>

		{#if hasAnyProvider}
			<div class="divider">
				<span>or</span>
			</div>
		{/if}

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

	.sso-buttons {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-lg);
	}

	.sso-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text);
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.sso-button:hover {
		background: var(--color-surface-hover);
		transform: translateY(-2px);
		box-shadow: var(--shadow-sm);
	}

	.divider {
		position: relative;
		text-align: center;
		margin: var(--spacing-lg) 0;
	}

	.divider::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 0;
		right: 0;
		height: 1px;
		background: var(--color-border);
	}

	.divider span {
		position: relative;
		display: inline-block;
		padding: 0 var(--spacing-md);
		background: var(--color-surface);
		color: var(--color-text-secondary);
		font-size: 0.875rem;
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

	.no-providers-message {
		text-align: center;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		padding: var(--spacing-md);
	}
</style>
