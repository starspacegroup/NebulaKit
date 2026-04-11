<script lang="ts">
	import { page } from '$app/stores';
	import { onDestroy, onMount } from 'svelte';
	import ThemeSwitcher from './ThemeSwitcher.svelte';
	import ThemeToggle from './ThemeToggle.svelte';

	let isMac = false;
	let isDesktopNav = false;
	let previousBodyOverflow = '';
	onMount(() => {
		isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

		const desktopNavQuery = window.matchMedia('(min-width: 768px)');
		const handleDesktopNavChange = (event: MediaQueryListEvent) => {
			isDesktopNav = event.matches;
			if (event.matches) {
				closeMobileMenu();
			}
		};

		isDesktopNav = desktopNavQuery.matches;
		desktopNavQuery.addEventListener('change', handleDesktopNavChange);

		return () => {
			desktopNavQuery.removeEventListener('change', handleDesktopNavChange);
		};
	});

	let mobileMenuOpen = false;
	let userDropdownOpen = false;

	export let onCommandPaletteClick: () => void = () => {};
	export let user: {
		id: string;
		login: string;
		email: string;
		name?: string;
		avatarUrl?: string;
		isOwner: boolean;
		isAdmin?: boolean;
	} | null = null;

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
		userDropdownOpen = false;
	}

	function toggleUserDropdown() {
		userDropdownOpen = !userDropdownOpen;
	}

	function closeUserDropdown() {
		userDropdownOpen = false;
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeUserDropdown();
			closeMobileMenu();
		}
	}

	$: {
		if (typeof document !== 'undefined') {
			if (mobileMenuOpen && !isDesktopNav) {
				if (document.body.style.overflow !== 'hidden') {
					previousBodyOverflow = document.body.style.overflow;
				}
				document.body.style.overflow = 'hidden';
			} else if (document.body.style.overflow === 'hidden') {
				document.body.style.overflow = previousBodyOverflow;
			}
		}
	}

	onDestroy(() => {
		if (typeof document !== 'undefined' && document.body.style.overflow === 'hidden') {
			document.body.style.overflow = previousBodyOverflow;
		}
	});

	// Close dropdown when clicking outside
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.user-dropdown-container')) {
			userDropdownOpen = false;
		}
	}
</script>

<svelte:window on:click={handleClickOutside} on:keydown={handleWindowKeydown} />

<nav class="nav" class:menu-open={mobileMenuOpen}>
	<div class="container nav-container">
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
					<kbd class="command-palette-kbd">{isMac ? '⌘' : 'Ctrl+'}K</kbd>
				</button>
			</div>

			<button
				type="button"
				class="mobile-menu-btn"
				on:click={toggleMobileMenu}
				aria-label="Toggle menu"
				aria-controls="mobile-navigation"
				aria-expanded={mobileMenuOpen}
			>
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

			<div
				id="mobile-navigation"
				class="nav-links"
				class:open={mobileMenuOpen}
				aria-hidden={!mobileMenuOpen && !isDesktopNav}
			>
				<div class="mobile-menu-shell">
					<div class="mobile-menu-header">
						<a href="/" class="logo mobile-menu-logo" on:click={closeMobileMenu}>
							<span class="logo-icon">✨</span>
							<span class="logo-text">NebulaKit</span>
						</a>
						<button
							type="button"
							class="mobile-menu-close"
							on:click={closeMobileMenu}
							aria-label="Close menu"
						>
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
						</button>
					</div>
					<div class="mobile-menu-content">
						<div class="mobile-menu-items">
							{#if user}
								{#if user.isOwner || user.isAdmin}
									<a
										href="/admin"
										class:active={$page.url.pathname.startsWith('/admin')}
										on:click={closeMobileMenu}
									>
										Admin
									</a>
								{/if}
								<div class="user-nav-panel">
									<div class="dropdown-header user-nav-header">
										<div class="user-nav-avatar">
											{#if user.avatarUrl}
												<img src={user.avatarUrl} alt={user.name || user.login} class="avatar" />
											{:else}
												<div class="avatar-fallback user-avatar-fallback">
													{(user.name || user.login).charAt(0).toUpperCase()}
												</div>
											{/if}
										</div>
										<div class="user-info">
											<div class="user-name">{user.name || user.login}</div>
											<div class="user-email">{user.email}</div>
										</div>
									</div>
									<div class="dropdown-divider"></div>
									<a href="/profile" class="dropdown-item" on:click={closeMobileMenu}>
										<svg
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
										>
											<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
											<circle cx="12" cy="7" r="4" />
										</svg>
										Profile
									</a>
									<div class="dropdown-divider"></div>
									<div class="dropdown-section">
										<ThemeToggle />
									</div>
									<div class="dropdown-divider"></div>
									<form action="/api/auth/logout" method="POST">
										<button type="submit" class="dropdown-item logout-item">
											<svg
												width="16"
												height="16"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
											>
												<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
												<polyline points="16 17 21 12 16 7" />
												<line x1="21" y1="12" x2="9" y2="12" />
											</svg>
											Logout
										</button>
									</form>
								</div>
								{#if isDesktopNav}
									<div class="user-dropdown-container">
										<button
											type="button"
											class="user-avatar-btn"
											on:click|stopPropagation={toggleUserDropdown}
											aria-label="User menu"
											aria-expanded={userDropdownOpen}
										>
											{#if user.avatarUrl}
												<img src={user.avatarUrl} alt={user.name || user.login} class="avatar" />
											{:else}
												<div class="avatar-fallback">
													{(user.name || user.login).charAt(0).toUpperCase()}
												</div>
											{/if}
										</button>
										{#if userDropdownOpen}
											<div class="user-dropdown">
												<div class="dropdown-header">
													<div class="user-info">
														<div class="user-name">{user.name || user.login}</div>
														<div class="user-email">{user.email}</div>
													</div>
												</div>
												<div class="dropdown-divider"></div>
												<a
													href="/profile"
													class="dropdown-item"
													on:click={() => {
														closeUserDropdown();
														closeMobileMenu();
													}}
												>
													<svg
														width="16"
														height="16"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
													>
														<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
														<circle cx="12" cy="7" r="4" />
													</svg>
													Profile
												</a>
												<div class="dropdown-divider"></div>
												<div class="dropdown-section">
													<ThemeToggle />
												</div>
												<div class="dropdown-divider"></div>
												<form action="/api/auth/logout" method="POST">
													<button type="submit" class="dropdown-item logout-item">
														<svg
															width="16"
															height="16"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															stroke-width="2"
														>
															<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
															<polyline points="16 17 21 12 16 7" />
															<line x1="21" y1="12" x2="9" y2="12" />
														</svg>
														Logout
													</button>
												</form>
											</div>
										{/if}
									</div>
								{/if}
							{:else}
								<a
									href="/auth/login"
									class:active={$page.url.pathname.startsWith('/auth')}
									on:click={closeMobileMenu}
								>
									Sign In
								</a>
								<ThemeSwitcher variant="inline" simpleToggle={true} />
							{/if}
						</div>
					</div>
				</div>
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

	.nav.menu-open {
		z-index: 200;
	}

	.nav-container {
		max-width: none;
	}

	.nav-content {
		display: flex;
		position: relative;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-md);
		height: 64px;
	}

	.logo {
		display: flex;
		align-items: center;
		align-self: center;
		justify-self: start;
		width: fit-content;
		max-width: 100%;
		margin: 0;
		position: relative;
		inset: auto;
		transform: none;
		gap: var(--spacing-sm);
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--color-text);
		text-decoration: none;
		white-space: nowrap;
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
		align-self: center;
		justify-content: center;
		gap: var(--spacing-sm);
		margin: 0;
		min-width: 0;
		position: relative;
		inset: auto;
		transform: none;
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
		.logo {
			position: absolute;
			left: 0;
			top: 50%;
			transform: translateY(-50%);
			z-index: 1;
		}

		.nav-actions {
			position: absolute;
			left: 50%;
			top: 50%;
			transform: translate(-50%, -50%);
			z-index: 1;
		}

		.command-palette-btn {
			display: flex;
		}
	}

	.mobile-menu-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		align-self: center;
		margin-left: auto;
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
		position: fixed;
		inset: 0;
		width: 100vw;
		min-height: 100dvh;
		background: var(--color-surface);
		overflow-y: auto;
		overscroll-behavior: contain;
		align-items: stretch;
		justify-content: center;
		z-index: 120;
	}

	.nav-links.open {
		display: flex;
	}

	.mobile-menu-shell {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
		width: 100%;
		background: var(--color-surface);
	}

	.mobile-menu-header {
		position: sticky;
		top: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-md);
		min-height: 64px;
		padding: calc(env(safe-area-inset-top) + var(--spacing-sm)) var(--spacing-lg) var(--spacing-sm);
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
	}

	.mobile-menu-content {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		min-height: calc(100dvh - 72px);
		padding: var(--spacing-xl) var(--spacing-lg)
			calc(var(--spacing-2xl) + env(safe-area-inset-bottom));
	}

	.mobile-menu-items {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		justify-content: center;
		flex: 1;
		gap: var(--spacing-lg);
		width: min(100%, 26rem);
		margin: 0 auto;
	}

	.mobile-menu-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: var(--radius-md);
		color: var(--color-text);
		transition: background var(--transition-fast);
	}

	.mobile-menu-close:hover {
		background: var(--color-surface-hover);
	}

	@media (min-width: 768px) {
		.nav-links {
			display: flex;
			position: absolute;
			right: 0;
			top: 50%;
			width: auto;
			min-height: auto;
			overflow: visible;
			background: transparent;
			margin-left: 0;
			align-items: center;
			justify-content: flex-end;
			flex: 0 0 auto;
			transform: translateY(-50%);
			z-index: auto;
		}

		.mobile-menu-shell {
			display: contents;
		}

		.mobile-menu-header {
			display: none;
		}

		.mobile-menu-content {
			display: block;
			flex: none;
			min-height: auto;
			align-items: normal;
			justify-content: normal;
			padding: 0;
		}

		.mobile-menu-items {
			display: flex;
			flex-direction: row;
			flex: 0 1 auto;
			align-items: center;
			justify-content: flex-end;
			gap: var(--spacing-md);
			width: auto;
			margin: 0;
		}
	}

	.nav-links a {
		display: flex;
		align-items: center;
		justify-content: center;
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

	.user-dropdown-container {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.user-nav-panel {
		width: min(100%, 24rem);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		overflow: hidden;
	}

	.user-nav-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
	}

	.user-nav-avatar {
		width: 56px;
		height: 56px;
		flex: 0 0 auto;
		border-radius: 50%;
		overflow: hidden;
		border: 2px solid var(--color-primary);
	}

	.user-avatar-fallback {
		font-size: 1rem;
	}

	.user-avatar-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: transparent;
		border: 2px solid var(--color-border);
		cursor: pointer;
		transition: all var(--transition-fast);
		overflow: hidden;
	}

	.user-avatar-btn:hover {
		border-color: var(--color-primary);
		transform: scale(1.05);
	}

	.avatar {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar-fallback {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-primary);
		color: var(--color-background);
		font-weight: 600;
		font-size: 0.9rem;
	}

	.user-dropdown {
		position: static;
		width: min(100%, 24rem);
		margin-top: var(--spacing-md);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		z-index: 100;
		overflow: hidden;
	}

	.dropdown-header {
		padding: var(--spacing-md);
	}

	.user-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.user-name {
		color: var(--color-text);
		font-weight: 600;
		font-size: 0.95rem;
	}

	.user-email {
		color: var(--color-text-secondary);
		font-size: 0.85rem;
	}

	.dropdown-divider {
		height: 1px;
		background: var(--color-border);
	}

	.dropdown-section {
		padding: var(--spacing-sm);
	}

	.dropdown-item {
		width: 100%;
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm) var(--spacing-md);
		background: transparent;
		color: var(--color-text);
		border: none;
		text-align: left;
		font-size: 0.9rem;
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.dropdown-item:hover {
		background: var(--color-surface-hover);
	}

	.logout-item {
		color: var(--color-error);
	}

	.logout-item:hover {
		background: var(--color-surface-hover);
	}

	@media (min-width: 768px) {
		.user-nav-panel {
			display: none;
		}

		.user-dropdown-container {
			justify-content: flex-start;
		}

		.user-avatar-btn {
			width: 36px;
			height: 36px;
		}

		.user-dropdown {
			position: absolute;
			top: calc(100% + 8px);
			right: 0;
			width: auto;
			min-width: 240px;
			margin-top: 0;
		}
	}

	@media (max-width: 768px) {
		.user-dropdown-container {
			display: none;
		}

		.user-dropdown {
			max-width: 100%;
		}
	}
</style>
