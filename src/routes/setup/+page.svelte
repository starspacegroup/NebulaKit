<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let formData = {
		clientId: '',
		clientSecret: '',
		adminGithubUsername: ''
	};
	let errors: Record<string, string> = {};
	let loading = false;
	let successMessage = '';
	let hasExistingConfig = false;
	let hasExistingAdmin = false;
	let checkingConfig = true;

	// Check for error in URL params
	$: if ($page.url.searchParams.get('error') === 'oauth_not_configured') {
		errors.submit = 'GitHub OAuth is not configured. Please set it up below.';
	}

	// Check if configuration already exists
	onMount(async () => {
		try {
			const response = await fetch('/api/setup');
			if (response.ok) {
				const data = await response.json();
				hasExistingConfig = data.hasConfig;
				hasExistingAdmin = data.hasAdmin;
			}
		} catch (err) {
			console.error('Failed to check existing config:', err);
		} finally {
			checkingConfig = false;
		}
	});

	function validateForm() {
		errors = {};

		// Only require OAuth credentials if they don't already exist
		if (!hasExistingConfig) {
			if (!formData.clientId.trim()) {
				errors.clientId = 'Client ID is required';
			}

			if (!formData.clientSecret.trim()) {
				errors.clientSecret = 'Client Secret is required';
			}
		}

		if (!formData.adminGithubUsername.trim()) {
			errors.adminGithubUsername = 'Admin GitHub Username is required';
		} else {
			// Validate admin GitHub username format
			const usernameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
			if (!usernameRegex.test(formData.adminGithubUsername.trim())) {
				errors.adminGithubUsername = 'Invalid GitHub username format';
			}
		}

		return Object.keys(errors).length === 0;
	}

	async function handleSubmit() {
		if (!validateForm()) {
			return;
		}

		loading = true;
		successMessage = '';

		try {
			// Build request body - only include OAuth credentials if provided
			const requestBody: any = {
				provider: 'github',
				adminGithubUsername: formData.adminGithubUsername.trim()
			};

			// Only include OAuth credentials if they're filled in
			if (formData.clientId.trim()) {
				requestBody.clientId = formData.clientId;
			}
			if (formData.clientSecret.trim()) {
				requestBody.clientSecret = formData.clientSecret;
			}

			const response = await fetch('/api/setup', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to save configuration');
			}

			const result = await response.json();
			successMessage = result.message || 'Configuration saved!';

			// Don't clear form in case user needs to see values in console
			// formData = { clientId: '', clientSecret: '' };

			// Redirect to login after 3 seconds
			setTimeout(() => {
				goto('/auth/login');
			}, 3000);
		} catch (err) {
			errors.submit = err instanceof Error ? err.message : 'Failed to save configuration';
		} finally {
			loading = false;
		}
	}
</script>

<div class="setup-container">
	<div class="setup-card">
		<h1>Initial Setup</h1>
		<p class="subtitle">
			{#if hasExistingConfig}
				{hasExistingAdmin ? 'Update admin access' : 'Set up admin access'}
			{:else}
				Configure your GitHub OAuth application
			{/if}
		</p>

		{#if hasExistingConfig && !hasExistingAdmin}
			<div class="info-message">
				<strong>✓ OAuth credentials are already configured.</strong>
				You can now add an admin username to complete the setup.
			</div>
		{:else if hasExistingConfig && hasExistingAdmin}
			<div class="info-message">
				<strong>✓ OAuth and admin are already configured.</strong>
				You can update the admin username or reconfigure OAuth credentials if needed.
			</div>
		{:else}
			<div class="warning-section">
				<strong>⚠️ Important:</strong> You must create a real GitHub OAuth App first. This will not work
				with placeholder credentials.
			</div>
		{/if}

		<div class="info-section">
			<h2>Step-by-step setup:</h2>
			<ol>
				<li>
					Go to <a
						href="https://github.com/settings/developers"
						target="_blank"
						rel="noopener noreferrer">GitHub Developer Settings</a
					>
				</li>
				<li>Click <strong>"New OAuth App"</strong></li>
				<li>
					Fill in the form:
					<ul>
						<li><strong>Application name:</strong> NebulaKit (or your choice)</li>
						<li><strong>Homepage URL:</strong> <code>http://localhost:5173</code></li>
						<li>
							<strong>Authorization callback URL:</strong>
							<code>http://localhost:5173/api/auth/github/callback</code>
						</li>
					</ul>
				</li>
				<li>Click <strong>"Register application"</strong></li>
				<li>Copy your <strong>Client ID</strong> from the next page</li>
				<li>
					Click <strong>"Generate a new client secret"</strong> and copy it immediately (you won't see
					it again!)
				</li>
				<li>Paste both values in the form below</li>
				<li>Enter your GitHub username to grant yourself admin access to the application.</li>
			</ol>
		</div>

		{#if successMessage}
			<div class="success-message" role="alert">
				{successMessage}
			</div>
		{/if}

		{#if errors.submit}
			<div class="error-message" role="alert">
				{errors.submit}
			</div>
		{/if}

		<form on:submit|preventDefault={handleSubmit} class="setup-form">
			{#if !hasExistingConfig}
				<div class="form-group">
					<label for="clientId">
						GitHub Client ID
						<span class="required" aria-label="required">*</span>
					</label>
					<input
						type="text"
						id="clientId"
						bind:value={formData.clientId}
						class:error={errors.clientId}
						placeholder="Enter your GitHub OAuth Client ID"
						disabled={loading}
					/>
					{#if errors.clientId}
						<span class="error-text">{errors.clientId}</span>
					{/if}
				</div>

				<div class="form-group">
					<label for="clientSecret">
						GitHub Client Secret
						<span class="required" aria-label="required">*</span>
					</label>
					<input
						type="password"
						id="clientSecret"
						bind:value={formData.clientSecret}
						class:error={errors.clientSecret}
						placeholder="Enter your GitHub OAuth Client Secret"
						disabled={loading}
					/>
					{#if errors.clientSecret}
						<span class="error-text">{errors.clientSecret}</span>
					{/if}
				</div>
			{:else}
				<details class="oauth-override">
					<summary>Update OAuth credentials (optional)</summary>
					<div class="form-group">
						<label for="clientId">GitHub Client ID</label>
						<input
							type="text"
							id="clientId"
							bind:value={formData.clientId}
							placeholder="Leave empty to keep existing"
							disabled={loading}
						/>
					</div>

					<div class="form-group">
						<label for="clientSecret">GitHub Client Secret</label>
						<input
							type="password"
							id="clientSecret"
							bind:value={formData.clientSecret}
							placeholder="Leave empty to keep existing"
							disabled={loading}
						/>
					</div>
				</details>
			{/if}

			<div class="form-group">
				<label for="adminGithubUsername">
					Admin GitHub Username
					<span class="required" aria-label="required">*</span>
				</label>
				<input
					type="text"
					id="adminGithubUsername"
					bind:value={formData.adminGithubUsername}
					class:error={errors.adminGithubUsername}
					placeholder="e.g. octocat"
					disabled={loading}
				/>
				<small class="help-text">
					The GitHub user who will have admin access to this application.
				</small>
				{#if errors.adminGithubUsername}
					<span class="error-text">{errors.adminGithubUsername}</span>
				{/if}
			</div>

			<button type="submit" class="save-button" disabled={loading}>
				{loading ? 'Saving...' : 'Save Configuration'}
			</button>
		</form>
	</div>
</div>

<style>
	.setup-container {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 100vh;
		padding: var(--spacing-lg);
		background-color: var(--color-background);
	}

	.setup-card {
		width: 100%;
		max-width: 600px;
		background-color: var(--color-surface);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
		padding: var(--spacing-xl);
		box-shadow: var(--shadow-md);
	}

	h1 {
		margin: 0 0 var(--spacing-sm) 0;
		color: var(--color-text);
		font-size: 2rem;
		font-weight: 600;
	}

	.subtitle {
		margin: 0 0 var(--spacing-lg) 0;
		color: var(--color-text-secondary);
		font-size: 1rem;
	}

	.warning-section {
		background-color: var(--color-surface);
		border: 2px solid var(--color-primary);
		border-radius: var(--radius-md);
		padding: var(--spacing-md);
		margin-bottom: var(--spacing-lg);
		color: var(--color-text);
		font-size: 0.95rem;
	}

	.warning-section strong {
		color: var(--color-primary);
	}

	.info-message {
		background-color: var(--color-background);
		border: 1px solid var(--color-primary);
		border-radius: var(--radius-md);
		padding: var(--spacing-md);
		margin-bottom: var(--spacing-lg);
		color: var(--color-text);
		font-size: 0.95rem;
	}

	.info-message strong {
		color: var(--color-primary);
	}

	.oauth-override {
		background-color: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-md);
		margin-bottom: var(--spacing-lg);
	}

	.oauth-override summary {
		cursor: pointer;
		color: var(--color-text);
		font-weight: 500;
		list-style: none;
		user-select: none;
		transition: color var(--transition-fast);
	}

	.oauth-override summary::-webkit-details-marker {
		display: none;
	}

	.oauth-override summary::before {
		content: '▶ ';
		display: inline-block;
		transition: transform var(--transition-fast);
	}

	.oauth-override[open] summary::before {
		transform: rotate(90deg);
	}

	.oauth-override summary:hover {
		color: var(--color-primary);
	}

	.oauth-override .form-group {
		margin-top: var(--spacing-md);
	}

	.info-section {
		background-color: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-md);
		margin-bottom: var(--spacing-lg);
	}

	.info-section h2 {
		margin: 0 0 var(--spacing-sm) 0;
		color: var(--color-text);
		font-size: 1.1rem;
		font-weight: 500;
	}

	.info-section ol,
	.info-section ul {
		margin: var(--spacing-xs) 0;
		padding-left: var(--spacing-lg);
		color: var(--color-text);
	}

	.info-section li {
		margin-bottom: var(--spacing-xs);
	}

	.info-section ul {
		margin-top: var(--spacing-xs);
		font-size: 0.9rem;
	}

	.info-section ul li {
		margin-bottom: 4px;
	}

	.info-section a {
		color: var(--color-primary);
		text-decoration: none;
		transition: color var(--transition-fast);
	}

	.info-section a:hover {
		color: var(--color-primary-hover);
		text-decoration: underline;
	}

	.info-section code {
		background-color: var(--color-surface);
		color: var(--color-text);
		padding: 2px 6px;
		border-radius: var(--radius-sm);
		font-family: monospace;
		font-size: 0.9em;
	}

	.success-message {
		background-color: var(--color-surface);
		border: 1px solid var(--color-primary);
		color: var(--color-primary);
		padding: var(--spacing-md);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-lg);
	}

	.error-message {
		background-color: var(--color-surface);
		border: 1px solid var(--color-error);
		color: var(--color-error);
		padding: var(--spacing-md);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-lg);
	}

	.setup-form {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	label {
		color: var(--color-text);
		font-weight: 500;
		font-size: 0.9rem;
	}

	.required {
		color: var(--color-error);
		margin-left: 2px;
	}

	.help-text {
		color: var(--color-text-secondary);
		font-size: 0.85rem;
		line-height: 1.4;
	}

	input {
		padding: var(--spacing-sm) var(--spacing-md);
		background-color: var(--color-background);
		color: var(--color-text);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 1rem;
		transition: border-color var(--transition-fast);
	}

	input:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	input.error {
		border-color: var(--color-error);
	}

	input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	input::placeholder {
		color: var(--color-text-secondary);
	}

	.error-text {
		color: var(--color-error);
		font-size: 0.85rem;
		margin-top: -4px;
	}

	.save-button {
		padding: var(--spacing-md) var(--spacing-lg);
		background-color: var(--color-primary);
		color: var(--color-background);
		border: none;
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color var(--transition-fast);
	}

	.save-button:hover:not(:disabled) {
		background-color: var(--color-primary-hover);
	}

	.save-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	@media (max-width: 768px) {
		.setup-container {
			padding: var(--spacing-md);
		}

		.setup-card {
			padding: var(--spacing-lg);
		}

		h1 {
			font-size: 1.5rem;
		}
	}
</style>
