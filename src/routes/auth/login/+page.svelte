<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let email = '';
	let password = '';
	let isLoading = false;
	let error = '';

	// Map error codes to user-friendly messages
	const errorMessages: Record<string, string> = {
		oauth_failed: 'Authentication failed. Please try again.',
		no_code: 'No authorization code received from GitHub.',
		not_configured: 'GitHub OAuth is not configured. Please contact support.',
		token_exchange_failed: 'Failed to exchange authorization code. Please try again.',
		no_access_token: 'Failed to obtain access token from GitHub.',
		user_fetch_failed: 'Failed to fetch user information from GitHub.',
		unauthorized: 'You must be logged in to access that page.'
	};

	onMount(() => {
		// Check for error in URL query parameters
		const errorCode = $page.url.searchParams.get('error');
		if (errorCode) {
			error = errorMessages[errorCode] || 'An unexpected error occurred. Please try again.';

			// Clear the error from URL without reloading (cleaner UX)
			const url = new URL(window.location.href);
			url.searchParams.delete('error');
			window.history.replaceState({}, '', url);
		}
	});

	async function handleSubmit() {
		error = '';
		isLoading = true;

		// Simulate API call
		setTimeout(() => {
			isLoading = false;
			// In real implementation, this would call your auth API
			console.log('Login attempt:', { email, password });
		}, 1000);
	}

	function handleSSOLogin(provider: string) {
		if (provider === 'github') {
			// Redirect to GitHub OAuth flow
			window.location.href = '/api/auth/github';
		} else {
			console.log('SSO login with:', provider);
			// Other providers not yet implemented
		}
	}
</script>

<svelte:head>
	<title>Sign In - NebulaKit</title>
</svelte:head>

<div class="auth-page">
	<div class="auth-container">
		<div class="auth-header">
			<h1>Welcome Back</h1>
			<p>Sign in to your account</p>
		</div>

		<div class="sso-buttons">
			<button class="sso-button" on:click={() => handleSSOLogin('google')}>
				<svg width="20" height="20" viewBox="0 0 24 24">
					<path
						fill="currentColor"
						d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
					/>
					<path
						fill="currentColor"
						d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
					/>
					<path
						fill="currentColor"
						d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
					/>
					<path
						fill="currentColor"
						d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
					/>
				</svg>
				Continue with Google
			</button>

			<button class="sso-button" on:click={() => handleSSOLogin('github')}>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
					<path
						d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
					/>
				</svg>
				Continue with GitHub
			</button>
		</div>

		<div class="divider">
			<span>or</span>
		</div>

		<form on:submit|preventDefault={handleSubmit}>
			{#if error}
				<div class="error-message">{error}</div>
			{/if}

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
</style>
