<script lang="ts">
	import { page } from '$app/stores';
	import ThemeSwitcher from './ThemeSwitcher.svelte';

	let mobileMenuOpen = false;

	export let onCommandPaletteClick: () => void = () => {};

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}
</script>

<nav class="nav">
	<div class="container">
		<div class="nav-content">
			<a href="/" class="logo" on:click={closeMobileMenu}>
				<span class="logo-icon">✨</span>
				<span class="logo-text">NebulaKit</span>
			</a>

			<div class="nav-actions">
				<button
					class="command-palette-btn"
					on:click={onCommandPaletteClick}
					aria-label="Open command palette"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polyline points="4 17 10 11 4 5"></polyline>
						<line x1="12" y1="19" x2="20" y2="19"></line>
					</svg>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<circle cx="11" cy="11" r="8"></circle>
						<path d="m21 21-4.35-4.35"></path>
					</svg>
					<kbd class="command-palette-kbd">⌘K</kbd>
				</button>
			</div>

			<button class="mobile-menu-btn" on:click={toggleMobileMenu} aria-label="Toggle menu">
				{#if mobileMenuOpen}
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				{:else}
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<line x1="3" y1="12" x2="21" y2="12"></line>
						<line x1="3" y1="6" x2="21" y2="6"></line>
						<line x1="3" y1="18" x2="21" y2="18"></line>
					</svg>
				{/if}
			</button>

			<div class="nav-links" class:open={mobileMenuOpen}>
				<a href="/chat" class:active={$page.url.pathname === '/chat'} on:click={closeMobileMenu}>
					Chat
				</a>
				<a
					href="/auth/login"
					class:active={$page.url.pathname.startsWith('/auth')}
					on:click={closeMobileMenu}
				>
					Sign In
				</a>
				<ThemeSwitcher variant="inline" simpleToggle={true} />
			</div>
		</div>
	</div>
</nav>

<style>
	.nav {
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
		position: sticky;
		top: 0;
		z-index: 50;
		backdrop-filter: blur(10px);
	}

	.nav-content {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: var(--spacing-md);
		height: 64px;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--color-text);
		text-decoration: none;
		transition: opacity var(--transition-fast);
	}

	.logo:hover {
		opacity: 0.8;
	}

	.logo-icon {
		font-size: 1.5rem;
	}

	.nav-actions {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.command-palette-btn {
		display: none;
		align-items: center;
		gap: var(--spacing-xs);
		padding: var(--spacing-xs) var(--spacing-sm);
		background: var(--color-surface-hover);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text-secondary);
		cursor: pointer;
		transition: all var(--transition-fast);
		font-size: 0.875rem;
	}

	.command-palette-btn:hover {
		background: var(--color-surface);
		border-color: var(--color-primary);
		color: var(--color-text);
	}

	.command-palette-kbd {
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 0.125rem 0.375rem;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--color-text-secondary);
	}

	@media (min-width: 768px) {
		.command-palette-btn {
			display: flex;
		}
	}

	.mobile-menu-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		color: var(--color-text);
		cursor: pointer;
		border-radius: var(--radius-md);
		transition: background var(--transition-fast);
	}

	.mobile-menu-btn:hover {
		background: var(--color-surface-hover);
	}

	@media (min-width: 768px) {
		.mobile-menu-btn {
			display: none;
		}
	}

	.nav-links {
		display: none;
		flex-direction: column;
		position: absolute;
		top: 64px;
		left: 0;
		right: 0;
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
		padding: var(--spacing-md);
		gap: var(--spacing-xs);
		grid-column: 1 / -1;
	}

	.nav-links.open {
		display: flex;
	}

	@media (min-width: 768px) {
		.nav-links {
			display: flex;
			flex-direction: row;
			position: static;
			border: none;
			padding: 0;
			gap: var(--spacing-md);
			grid-column: 3;
			justify-content: flex-end;
			align-items: center;
		}
	}

	.nav-links a {
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius-md);
		color: var(--color-text-secondary);
		text-decoration: none;
		transition: all var(--transition-fast);
		font-weight: 500;
	}

	.nav-links a:hover {
		color: var(--color-text);
		background: var(--color-surface-hover);
	}

	.nav-links a.active {
		color: var(--color-primary);
		background: var(--color-surface-hover);
	}
</style>
