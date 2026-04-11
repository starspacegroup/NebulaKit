<script lang="ts">
	import { page } from '$app/stores';

	const navItems = [
		{ path: '/admin', label: 'Dashboard', icon: 'home' },
		{ path: '/admin/users', label: 'Users', icon: 'users' },
		{ path: '/admin/auth-keys', label: 'Auth Keys', icon: 'key' },
		{ path: '/admin/ai-keys', label: 'AI Keys', icon: 'sparkles' },
		{ path: '/admin/cms', label: 'CMS', icon: 'document' }
	];
</script>

<div class="admin-layout">
	<aside class="admin-sidebar">
		<h2 class="admin-title">Admin Settings</h2>
		<nav class="admin-nav">
			{#each navItems as item}
				<a
					href={item.path}
					class="nav-item"
					class:active={$page.url.pathname === item.path}
					aria-current={$page.url.pathname === item.path ? 'page' : undefined}
				>
					{#if item.icon === 'home'}
						<svg
							class="nav-icon"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
							<polyline points="9 22 9 12 15 12 15 22" />
						</svg>
					{:else if item.icon === 'users'}
						<svg
							class="nav-icon"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
							<circle cx="9" cy="7" r="4" />
							<path d="M23 21v-2a4 4 0 0 0-3-3.87" />
							<path d="M16 3.13a4 4 0 0 1 0 7.75" />
						</svg>
					{:else if item.icon === 'key'}
						<svg
							class="nav-icon"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"
							/>
						</svg>
					{:else if item.icon === 'sparkles'}
						<svg
							class="nav-icon"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M12 3v18m0-18l-3 3m3-3l3 3M3 12h18M3 12l3-3m-3 3l3 3m12-3l-3-3m3 3l-3 3" />
						</svg>
					{:else if item.icon === 'document'}
						<svg
							class="nav-icon"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
							<polyline points="14 2 14 8 20 8" />
							<line x1="16" y1="13" x2="8" y2="13" />
							<line x1="16" y1="17" x2="8" y2="17" />
							<polyline points="10 9 9 9 8 9" />
						</svg>
					{/if}
					<span>{item.label}</span>
				</a>
			{/each}
		</nav>
	</aside>
	<main class="admin-content">
		<slot />
	</main>
</div>

<style>
	.admin-layout {
		--admin-sidebar-width: 17rem;
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		min-height: calc(100vh - 64px);
		background: var(--color-background);
	}

	.admin-sidebar {
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
		padding: var(--spacing-md);
	}

	.admin-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-text);
		margin-bottom: var(--spacing-xl);
	}

	.admin-nav {
		display: flex;
		flex-direction: row;
		gap: var(--spacing-sm);
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scrollbar-width: thin;
		padding-bottom: var(--spacing-xs);
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		flex: 0 0 auto;
		min-width: max-content;
		padding: var(--spacing-md);
		border-radius: var(--radius-md);
		color: var(--color-text-secondary);
		text-decoration: none;
		transition: all var(--transition-fast);
	}

	.nav-item:hover {
		background: var(--color-background);
		color: var(--color-text);
	}

	.nav-item.active {
		background: var(--color-primary);
		color: var(--color-background);
	}

	.nav-icon {
		flex-shrink: 0;
	}

	.admin-content {
		min-width: 0;
		padding: var(--spacing-lg) var(--spacing-md) var(--spacing-2xl);
	}

	@media (min-width: 768px) {
		.admin-layout {
			grid-template-columns: var(--admin-sidebar-width) minmax(0, 1fr);
			align-items: start;
		}

		.admin-layout::before {
			content: '';
			position: absolute;
			inset: 0 auto 0 0;
			width: var(--admin-sidebar-width);
			background: var(--color-surface);
			border-right: 1px solid var(--color-border);
			pointer-events: none;
		}

		.admin-sidebar {
			position: sticky;
			top: calc(64px + var(--spacing-lg));
			align-self: start;
			max-height: calc(100dvh - 64px - (var(--spacing-lg) * 2));
			overflow-y: auto;
			background: transparent;
			border-bottom: none;
			padding: var(--spacing-xl) var(--spacing-lg);
		}

		.admin-nav {
			flex-direction: column;
			overflow: visible;
			padding-bottom: 0;
		}

		.nav-item {
			width: 100%;
		}

		.admin-content {
			width: min(100%, 1200px);
			padding: var(--spacing-xl) clamp(var(--spacing-lg), 3vw, var(--spacing-2xl))
				var(--spacing-2xl);
		}
	}
</style>
