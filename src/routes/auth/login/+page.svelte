<script lang="ts">
	import { page } from '$app/stores';
	import AuthProviderButtons from '$lib/components/AuthProviderButtons.svelte';
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import { fieldName } from '$lib/utils/form-fields';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	export let data: PageData;
	type PretendRole = 'user' | 'admin' | 'superadmin';

	let email = '';
	let password = '';
	let isLoading = false;
	let error = '';
	let selectedPretendRole: PretendRole = 'user';

	// Site-unique field identifiers so a password manager does not confuse this
	// login with another NebulaKit deployment's.
	const emailField = fieldName('email');
	const passwordField = fieldName('password');

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

		try {
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});

			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(payload.message || 'Failed to sign in.');
			}

			window.location.assign(payload.redirectTo || '/');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to sign in.';
			isLoading = false;
		}
	}

	function isSimulatedProvider(provider: 'github' | 'discord') {
		return Boolean(data.simulatedProviders?.[provider]);
	}

	function buildProviderAuthPath(provider: 'github' | 'discord') {
		if (!isSimulatedProvider(provider)) {
			return `/api/auth/${provider}`;
		}

		const params = new URLSearchParams({ role: selectedPretendRole });
		return `/api/auth/${provider}?${params.toString()}`;
	}

	function handleSSOLogin(provider: 'github' | 'discord') {
		window.location.assign(buildProviderAuthPath(provider));
	}
</script>

<SharingMeta title="Sign In" description="Sign in to your NebulaKit account" />

<div class="auth-page">
	<div class="auth-container">
		{#if data.devAuthSimulationEnabled}
			<div class="pretend-role-panel" role="group" aria-label="Pretend login role selection">
				<span class="pretend-role-label">Pretend Role</span>
				<div class="pretend-role-toggle">
					<button
						type="button"
						class:selected={selectedPretendRole === 'user'}
						on:click={() => (selectedPretendRole = 'user')}
						disabled={isLoading}
					>
						User
					</button>
					<button
						type="button"
						class:selected={selectedPretendRole === 'admin'}
						on:click={() => (selectedPretendRole = 'admin')}
						disabled={isLoading}
					>
						Admin
					</button>
					<button
						type="button"
						class:selected={selectedPretendRole === 'superadmin'}
						on:click={() => (selectedPretendRole = 'superadmin')}
						disabled={isLoading}
					>
						Superadmin
					</button>
				</div>
			</div>
		{/if}

		<div class="auth-header">
			<h1>Welcome Back</h1>
			<p>Sign in to your account</p>
		</div>

		<AuthProviderButtons
			configuredProviders={data.configuredProviders}
			simulatedProviders={data.simulatedProviders}
			disabled={isLoading}
			actionLabel="Continue"
			on:select={(event) => handleSSOLogin(event.detail.provider)}
		/>

		<form on:submit|preventDefault={handleSubmit}>
			{#if error}
				<div class="error-message">{error}</div>
			{/if}

			<div class="form-group">
				<label for={emailField}>Email</label>
				<input
					id={emailField}
					name={emailField}
					type="email"
					bind:value={email}
					placeholder="you@example.com"
					autocomplete="email"
					required
				/>
			</div>

			<div class="form-group">
				<label for={passwordField}>Password</label>
				<input
					id={passwordField}
					name={passwordField}
					type="password"
					bind:value={password}
					placeholder="••••••••"
					autocomplete="current-password"
					required
				/>
			</div>

			<button type="submit" class="submit-button" disabled={isLoading}>
				{#if isLoading}
					Signing in...
				{:else}
					Sign In
				{/if}
			</button>
		</form>

		<div class="auth-footer">
			<p>Don't have an account? <a href="/auth/signup">Sign up</a></p>
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

	.pretend-role-panel {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-lg);
		padding: var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
	}

	.pretend-role-label {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-text-secondary);
	}

	.pretend-role-toggle {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--spacing-xs);
	}

	.pretend-role-toggle button {
		padding: var(--spacing-xs) var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: var(--color-text-secondary);
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.pretend-role-toggle button:hover:not(:disabled) {
		color: var(--color-text);
		border-color: var(--color-primary);
	}

	.pretend-role-toggle button.selected {
		color: var(--color-text);
		background: var(--color-surface-hover);
		border-color: var(--color-primary);
	}

	.pretend-role-toggle button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
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
