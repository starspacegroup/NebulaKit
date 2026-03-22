<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	let unlinkingProvider: string | null = null;
	let linkError = '';
	let linkSuccess = '';

	// Reactive connected accounts - needed for UI to update after disconnect
	$: connectedAccounts = data.connectedAccounts || [];
	// Reactive Set for O(1) lookup in template - triggers re-render when connectedAccounts changes
	$: connectedProviderIds = new Set(connectedAccounts.map((acc) => acc.provider));
	// Can only disconnect if there's more than one connected account (need at least one login method)
	$: canDisconnect = connectedAccounts.length > 1;

	// Filter providers to only show configured ones
	$: configuredProviders = data.configuredProviders || { github: false, discord: false };

	// Available providers (all defined, filtered in template based on configuration)
	const allProviders = [
		{
			id: 'github',
			name: 'GitHub',
			icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>`
		},
		{
			id: 'discord',
			name: 'Discord',
			icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`
		}
	];

	// Only show providers that are configured
	$: providers = allProviders.filter(
		(p) => configuredProviders[p.id as keyof typeof configuredProviders]
	);

	onMount(() => {
		// Check for success message in URL
		const linked = $page.url.searchParams.get('linked');
		if (linked) {
			linkSuccess = `Successfully connected ${linked.charAt(0).toUpperCase() + linked.slice(1)} account`;
			// Clear the URL param
			const url = new URL(window.location.href);
			url.searchParams.delete('linked');
			window.history.replaceState({}, '', url);
		}

		// Note: account_already_linked error is no longer possible as accounts are now merged automatically
	});

	function connectAccount(providerId: string) {
		// Redirect to OAuth flow - the callback will detect we're logged in and link the account
		window.location.href = `/api/auth/${providerId}`;
	}

	async function unlinkAccount(providerId: string) {
		unlinkingProvider = providerId;
		linkError = '';

		try {
			const response = await fetch('/api/auth/connections', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ provider: providerId })
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || 'Failed to unlink account');
			}

			// Update the reactive array to trigger UI update
			connectedAccounts = connectedAccounts.filter((acc) => acc.provider !== providerId);
			linkSuccess = `Successfully disconnected ${providerId.charAt(0).toUpperCase() + providerId.slice(1)} account`;
		} catch (err) {
			linkError = err instanceof Error ? err.message : 'Failed to unlink account';
		} finally {
			unlinkingProvider = null;
		}
	}
</script>

<SharingMeta
	title="Profile"
	noindex={true}
/>

<div class="profile-container">
	<div class="profile-card">
		<div class="profile-header">
			{#if data.user.avatarUrl}
				<img src={data.user.avatarUrl} alt={data.user.name || data.user.login} class="avatar" />
			{:else}
				<div class="avatar-placeholder" aria-label="Default avatar">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
						<circle cx="12" cy="7" r="4" />
					</svg>
				</div>
			{/if}
			<div class="profile-info">
				<h1>{data.user.name || data.user.login}</h1>
				<p class="username">@{data.user.login}</p>
				{#if data.user.isOwner}
					<span class="badge owner-badge">Owner</span>
				{/if}
				{#if data.user.isAdmin}
					<span class="badge admin-badge">Admin</span>
				{/if}
			</div>
		</div>

		<div class="profile-details">
			<div class="detail-item">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="icon"
				>
					<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
					<polyline points="22,6 12,13 2,6" />
				</svg>
				<div class="detail-content">
					<span class="detail-label">Email</span>
					<span class="detail-value">{data.user.email}</span>
				</div>
			</div>

			<div class="detail-item">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="icon"
				>
					<path
						d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"
					/>
				</svg>
				<div class="detail-content">
					<span class="detail-label">GitHub</span>
					<a
						href="https://github.com/{data.user.login}"
						target="_blank"
						rel="noopener noreferrer"
						class="detail-value link"
					>
						github.com/{data.user.login}
					</a>
				</div>
			</div>

			<div class="detail-item">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="icon"
				>
					<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
					<circle cx="12" cy="7" r="4" />
				</svg>
				<div class="detail-content">
					<span class="detail-label">User ID</span>
					<span class="detail-value mono">{data.user.id}</span>
				</div>
			</div>
		</div>

		<!-- Connected Accounts Section -->
		<div class="connected-accounts-section">
			<h2>Connected Accounts</h2>
			<p class="section-description">
				Link your social accounts to enable additional login methods.
			</p>

			{#if linkError}
				<div class="alert alert-error">{linkError}</div>
			{/if}
			{#if linkSuccess}
				<div class="alert alert-success">{linkSuccess}</div>
			{/if}

			<div class="accounts-list">
				{#each providers as provider}
					<div class="account-item">
						<div class="account-info">
							<span class="account-icon">{@html provider.icon}</span>
							<span class="account-name">{provider.name}</span>
							{#if connectedProviderIds.has(provider.id)}
								<span class="connected-badge">Connected</span>
							{/if}
						</div>
						<div class="account-actions">
							{#if connectedProviderIds.has(provider.id)}
								<button
									class="btn btn-outline btn-sm"
									on:click={() => unlinkAccount(provider.id)}
									disabled={unlinkingProvider === provider.id || !canDisconnect}
									title={!canDisconnect ? 'You need at least one connected account to log in' : ''}
								>
									{#if unlinkingProvider === provider.id}
										Unlinking...
									{:else}
										Disconnect
									{/if}
								</button>
							{:else}
								<button class="btn btn-primary btn-sm" on:click={() => connectAccount(provider.id)}>
									Connect
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.profile-container {
		max-width: 48rem;
		margin: 0 auto;
		padding: var(--spacing-xl);
	}

	.profile-card {
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-xl);
	}

	.profile-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-lg);
		margin-bottom: var(--spacing-xl);
		padding-bottom: var(--spacing-xl);
		border-bottom: 1px solid var(--color-border);
	}

	.avatar {
		width: 6rem;
		height: 6rem;
		border-radius: var(--radius-full);
		border: 2px solid var(--color-border);
		object-fit: cover;
	}

	.avatar-placeholder {
		width: 6rem;
		height: 6rem;
		border-radius: var(--radius-full);
		background-color: var(--color-background);
		border: 2px solid var(--color-border);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-secondary);
	}

	.avatar-placeholder svg {
		width: 3rem;
		height: 3rem;
	}

	.profile-info {
		flex: 1;
	}

	.profile-info h1 {
		margin: 0 0 var(--spacing-xs) 0;
		font-size: 1.875rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.username {
		margin: 0 0 var(--spacing-sm) 0;
		font-size: 1rem;
		color: var(--color-text-secondary);
	}

	.badge {
		display: inline-block;
		padding: var(--spacing-xs) var(--spacing-sm);
		border-radius: var(--radius-md);
		font-size: 0.75rem;
		font-weight: 500;
		margin-right: var(--spacing-xs);
		border: 1px solid var(--color-border);
	}

	.owner-badge {
		background-color: var(--color-primary);
		color: var(--color-background);
		border-color: var(--color-primary);
	}

	.admin-badge {
		background-color: var(--color-success);
		color: var(--color-background);
		border-color: var(--color-success);
	}

	.profile-details {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
	}

	.detail-item {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-md);
	}

	.icon {
		width: 1.25rem;
		height: 1.25rem;
		color: var(--color-text-secondary);
		flex-shrink: 0;
		margin-top: 0.25rem;
	}

	.detail-content {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
		flex: 1;
	}

	.detail-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-secondary);
	}

	.detail-value {
		font-size: 1rem;
		color: var(--color-text);
	}

	.detail-value.mono {
		font-family: 'Courier New', monospace;
		font-size: 0.875rem;
	}

	.link {
		color: var(--color-primary);
		text-decoration: none;
		transition: color var(--transition-fast);
	}

	.link:hover {
		color: var(--color-primary-hover);
		text-decoration: underline;
	}

	/* Connected Accounts Section */
	.connected-accounts-section {
		margin-top: var(--spacing-xl);
		padding-top: var(--spacing-xl);
		border-top: 1px solid var(--color-border);
	}

	.connected-accounts-section h2 {
		margin: 0 0 var(--spacing-xs) 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.section-description {
		margin: 0 0 var(--spacing-lg) 0;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.alert {
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-md);
		font-size: 0.875rem;
	}

	.alert-error {
		background-color: rgba(239, 68, 68, 0.1);
		border: 1px solid var(--color-error);
		color: var(--color-error);
	}

	.alert-success {
		background-color: rgba(34, 197, 94, 0.1);
		border: 1px solid var(--color-success);
		color: var(--color-success);
	}

	.accounts-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.account-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-md);
		background-color: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.account-info {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.account-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text);
	}

	.account-name {
		font-weight: 500;
		color: var(--color-text);
	}

	.connected-badge {
		padding: var(--spacing-xs) var(--spacing-sm);
		background-color: rgba(34, 197, 94, 0.1);
		border: 1px solid var(--color-success);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-success);
	}

	.account-actions {
		display: flex;
		gap: var(--spacing-sm);
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition-fast);
		border: 1px solid transparent;
	}

	.btn-sm {
		padding: var(--spacing-xs) var(--spacing-sm);
		font-size: 0.75rem;
	}

	.btn-primary {
		background-color: var(--color-primary);
		color: var(--color-background);
		border-color: var(--color-primary);
	}

	.btn-primary:hover {
		background-color: var(--color-primary-hover);
	}

	.btn-outline {
		background-color: transparent;
		color: var(--color-text);
		border-color: var(--color-border);
	}

	.btn-outline:hover {
		background-color: var(--color-surface-hover);
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	@media (max-width: 640px) {
		.profile-container {
			padding: var(--spacing-md);
		}

		.profile-card {
			padding: var(--spacing-md);
		}

		.profile-header {
			flex-direction: column;
			text-align: center;
		}

		.avatar,
		.avatar-placeholder {
			width: 5rem;
			height: 5rem;
		}

		.profile-info h1 {
			font-size: 1.5rem;
		}

		.account-item {
			flex-direction: column;
			gap: var(--spacing-sm);
			align-items: stretch;
		}

		.account-info {
			justify-content: center;
		}

		.account-actions {
			justify-content: center;
		}
	}
</style>
