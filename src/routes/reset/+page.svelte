<script lang="ts">
	import { goto } from '$app/navigation';

	let loading = false;
	let error = '';
	let confirmText = '';
	let showConfirm = false;

	const CONFIRM_PHRASE = 'RESET';

	async function handleReset() {
		if (confirmText !== CONFIRM_PHRASE) {
			error = `Please type "${CONFIRM_PHRASE}" to confirm`;
			return;
		}

		loading = true;
		error = '';

		try {
			const response = await fetch('/api/reset', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to reset');
			}

			// Redirect to setup page after successful reset
			goto('/setup');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to reset configuration';
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Reset Configuration - NebulaKit</title>
</svelte:head>

<div class="container">
	<div class="reset-card">
		<div class="warning-icon">⚠️</div>
		<h1>Reset Configuration</h1>

		<p class="warning-text">
			This will clear all setup configuration and allow you to re-run the setup process.
		</p>

		<div class="what-gets-reset">
			<h3>What will be reset:</h3>
			<ul>
				<li>GitHub OAuth credentials</li>
				<li>Admin owner ID</li>
				<li>Setup lock (allows setup page access again)</li>
			</ul>
		</div>

		<div class="what-stays">
			<h3>What will NOT be reset:</h3>
			<ul>
				<li>User accounts in the database</li>
				<li>AI provider keys</li>
				<li>Chat history</li>
				<li>Other application data</li>
			</ul>
		</div>

		<div class="security-note">
			<h3>🔒 Security Note</h3>
			<p>
				This reset page is currently accessible without authentication. After logging in as the
				owner, you should disable this route from the Admin panel to prevent unauthorized resets.
			</p>
		</div>

		{#if !showConfirm}
			<button class="btn btn-danger" on:click={() => (showConfirm = true)}>
				I understand, show reset option
			</button>
		{:else}
			<div class="confirm-section">
				<label for="confirm-input">
					Type <strong>{CONFIRM_PHRASE}</strong> to confirm:
				</label>
				<input
					id="confirm-input"
					type="text"
					bind:value={confirmText}
					placeholder={CONFIRM_PHRASE}
					class="confirm-input"
					disabled={loading}
				/>

				{#if error}
					<p class="error-message">{error}</p>
				{/if}

				<div class="button-group">
					<button
						class="btn btn-secondary"
						on:click={() => {
							showConfirm = false;
							confirmText = '';
							error = '';
						}}
						disabled={loading}
					>
						Cancel
					</button>
					<button
						class="btn btn-danger"
						on:click={handleReset}
						disabled={loading || confirmText !== CONFIRM_PHRASE}
					>
						{#if loading}
							Resetting...
						{:else}
							Reset Configuration
						{/if}
					</button>
				</div>
			</div>
		{/if}

		<a href="/admin" class="back-link">← Back to Admin</a>
	</div>
</div>

<style>
	.container {
		min-height: calc(100vh - 64px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-lg);
	}

	.reset-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-xl);
		max-width: 500px;
		width: 100%;
		text-align: center;
	}

	.warning-icon {
		font-size: 3rem;
		margin-bottom: var(--spacing-md);
	}

	h1 {
		color: var(--color-text);
		margin-bottom: var(--spacing-md);
		font-size: 1.5rem;
	}

	.warning-text {
		color: var(--color-text-secondary);
		margin-bottom: var(--spacing-lg);
	}

	.what-gets-reset,
	.what-stays,
	.security-note {
		text-align: left;
		margin-bottom: var(--spacing-lg);
		padding: var(--spacing-md);
		border-radius: var(--radius-md);
	}

	.what-gets-reset {
		background: color-mix(in srgb, var(--color-error) 10%, transparent);
		border: 1px solid var(--color-error);
	}

	.what-stays {
		background: color-mix(in srgb, var(--color-success) 10%, transparent);
		border: 1px solid var(--color-success);
	}

	.security-note {
		background: color-mix(in srgb, var(--color-warning) 10%, transparent);
		border: 1px solid var(--color-warning);
	}

	.security-note p {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.85rem;
		line-height: 1.5;
	}

	h3 {
		font-size: 0.9rem;
		font-weight: 600;
		margin-bottom: var(--spacing-sm);
		color: var(--color-text);
	}

	ul {
		margin: 0;
		padding-left: var(--spacing-lg);
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	li {
		margin-bottom: var(--spacing-xs);
	}

	.confirm-section {
		margin-top: var(--spacing-lg);
		text-align: left;
	}

	label {
		display: block;
		margin-bottom: var(--spacing-sm);
		color: var(--color-text);
		font-size: 0.9rem;
	}

	.confirm-input {
		width: 100%;
		padding: var(--spacing-sm) var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font-size: 1rem;
		margin-bottom: var(--spacing-md);
	}

	.confirm-input:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.error-message {
		color: var(--color-error);
		font-size: 0.875rem;
		margin-bottom: var(--spacing-md);
	}

	.button-group {
		display: flex;
		gap: var(--spacing-md);
		justify-content: flex-end;
	}

	.btn {
		padding: var(--spacing-sm) var(--spacing-lg);
		border-radius: var(--radius-md);
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition-fast);
		border: none;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-danger {
		background: var(--color-error);
		color: white;
	}

	.btn-danger:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.btn-secondary {
		background: var(--color-surface-hover);
		color: var(--color-text);
		border: 1px solid var(--color-border);
	}

	.btn-secondary:hover:not(:disabled) {
		background: var(--color-border);
	}

	.back-link {
		display: inline-block;
		margin-top: var(--spacing-lg);
		color: var(--color-text-secondary);
		text-decoration: none;
		font-size: 0.9rem;
	}

	.back-link:hover {
		color: var(--color-text);
	}
</style>
