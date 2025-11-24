<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<svelte:head>
	<title>Profile - NebulaKit</title>
</svelte:head>

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
	}
</style>
