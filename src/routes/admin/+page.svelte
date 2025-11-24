<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;

	$: setupInfo = data.setupInfo;

	// Mask client ID for security (show first 8 chars + ***)
	function maskClientId(clientId: string | null): string {
		if (!clientId) return 'Not configured';
		return clientId.slice(0, 8) + '***';
	}
</script>

<svelte:head>
	<title>Admin - NebulaKit</title>
</svelte:head>

<div class="admin-home">
	<h1>Admin Dashboard</h1>
	<p>Select a section from the sidebar to manage your settings.</p>

	<div class="setup-info">
		<h2>Configuration Summary</h2>

		<div class="info-grid">
			<!-- OAuth Configuration -->
			<div class="info-card">
				<h3>
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
					</svg>
					OAuth Configuration
				</h3>
				{#if setupInfo.hasOAuthConfig}
					<div class="info-row">
						<span class="label">Provider:</span>
						<span class="value"
							><span class="badge"
								>{setupInfo.oauthProvider === 'github' ? 'GitHub' : setupInfo.oauthProvider}</span
							></span
						>
					</div>
					<div class="info-row">
						<span class="label">Client ID:</span>
						<span class="value mono">{maskClientId(setupInfo.oauthClientId)}</span>
					</div>
					<div class="status status-success">
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M20 6L9 17l-5-5" />
						</svg>
						Configured
					</div>
				{:else}
					<div class="status status-warning">
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<circle cx="12" cy="12" r="10" />
							<line x1="12" y1="8" x2="12" y2="12" />
							<line x1="12" y1="16" x2="12.01" y2="16" />
						</svg>
						Not configured
					</div>
					<p class="hint">OAuth is required for authentication. Please configure it in setup.</p>
				{/if}
			</div>

			<!-- Admin User -->
			<div class="info-card">
				<h3>
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
						<circle cx="12" cy="7" r="4" />
					</svg>
					Admin User
				</h3>
				{#if setupInfo.adminUsername}
					<div class="info-row">
						<span class="label">Username:</span>
						<span class="value">
							<a
								href="https://github.com/{setupInfo.adminUsername}"
								target="_blank"
								rel="noopener noreferrer"
								class="github-link"
							>
								@{setupInfo.adminUsername}
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
									<polyline points="15 3 21 3 21 9" />
									<line x1="10" y1="14" x2="21" y2="3" />
								</svg>
							</a>
						</span>
					</div>
					<div class="info-row">
						<span class="label">User ID:</span>
						<span class="value mono">{setupInfo.adminId}</span>
					</div>
					<div class="status status-success">
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M20 6L9 17l-5-5" />
						</svg>
						Active
					</div>
				{:else}
					<div class="status status-warning">
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<circle cx="12" cy="12" r="10" />
							<line x1="12" y1="8" x2="12" y2="12" />
							<line x1="12" y1="16" x2="12.01" y2="16" />
						</svg>
						Not configured
					</div>
					<p class="hint">No admin user set. Please complete the initial setup.</p>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.admin-home {
		padding: var(--spacing-xl);
	}

	h1 {
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-text);
		margin-bottom: var(--spacing-md);
	}

	p {
		color: var(--color-text-secondary);
		font-size: 1.125rem;
	}

	.setup-info {
		margin-top: var(--spacing-2xl);
	}

	.setup-info h2 {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: var(--spacing-lg);
	}

	.info-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: var(--spacing-lg);
	}

	.info-card {
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-lg);
		transition: box-shadow var(--transition-fast);
	}

	.info-card:hover {
		box-shadow: var(--shadow-md);
	}

	.info-card h3 {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: var(--spacing-md);
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.info-card h3 svg {
		color: var(--color-primary);
	}

	.info-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-sm) 0;
		border-bottom: 1px solid var(--color-border);
	}

	.info-row:last-of-type {
		border-bottom: none;
	}

	.label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-secondary);
	}

	.value {
		font-size: 0.875rem;
		color: var(--color-text);
		font-weight: 500;
	}

	.mono {
		font-family: 'Courier New', monospace;
	}

	.badge {
		display: inline-block;
		padding: var(--spacing-xs) var(--spacing-sm);
		background-color: var(--color-primary);
		color: var(--color-background);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.github-link {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
		color: var(--color-primary);
		text-decoration: none;
		transition: opacity var(--transition-fast);
	}

	.github-link:hover {
		opacity: 0.8;
		text-decoration: underline;
	}

	.status {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		margin-top: var(--spacing-md);
		padding: var(--spacing-sm);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-weight: 500;
	}

	.status-success {
		background-color: rgba(34, 197, 94, 0.1);
		color: rgb(34, 197, 94);
		border: 1px solid rgba(34, 197, 94, 0.3);
	}

	.status-warning {
		background-color: rgba(234, 179, 8, 0.1);
		color: rgb(234, 179, 8);
		border: 1px solid rgba(234, 179, 8, 0.3);
	}

	.hint {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		margin-top: var(--spacing-sm);
		font-style: italic;
	}
</style>
