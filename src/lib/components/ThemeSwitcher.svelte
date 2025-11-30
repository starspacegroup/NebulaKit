<script lang="ts">
	import { resolvedTheme, themePreference } from '$lib/stores/theme';

	// Props for styling control
	export let variant: 'fixed' | 'inline' | 'dropdown' = 'fixed';
	export let simpleToggle = false; // If true, just toggle between light/dark

	let currentTheme: 'light' | 'dark';
	resolvedTheme.subscribe((value) => {
		currentTheme = value;
	});

	function toggleTheme() {
		if (simpleToggle) {
			// Simple toggle between light and dark
			const newTheme = currentTheme === 'light' ? 'dark' : 'light';
			themePreference.set(newTheme);
		} else {
			// Cycle through light, dark, system
			const cycle = ['light', 'dark', 'system'] as const;
			const currentIndex = cycle.indexOf($themePreference);
			const nextIndex = (currentIndex + 1) % cycle.length;
			themePreference.set(cycle[nextIndex]);
		}
	}
</script>

<button
	class="theme-switcher"
	class:fixed={variant === 'fixed'}
	class:inline={variant === 'inline'}
	class:dropdown={variant === 'dropdown'}
	on:click={toggleTheme}
	aria-label="Toggle theme"
	title="Toggle {currentTheme === 'light' ? 'dark' : 'light'} mode"
>
	{#if simpleToggle}
		{#if currentTheme === 'dark'}
			<!-- Sun icon for dark mode (shows what you'll get) -->
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<circle cx="12" cy="12" r="5"></circle>
				<line x1="12" y1="1" x2="12" y2="3"></line>
				<line x1="12" y1="21" x2="12" y2="23"></line>
				<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
				<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
				<line x1="1" y1="12" x2="3" y2="12"></line>
				<line x1="21" y1="12" x2="23" y2="12"></line>
				<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
				<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
			</svg>
		{:else}
			<!-- Moon icon for light mode (shows what you'll get) -->
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
			</svg>
		{/if}
	{:else if $themePreference === 'system'}
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
			<line x1="8" y1="21" x2="16" y2="21"></line>
			<line x1="12" y1="17" x2="12" y2="21"></line>
		</svg>
	{:else if currentTheme === 'light'}
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
		</svg>
	{:else}
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<circle cx="12" cy="12" r="5"></circle>
			<line x1="12" y1="1" x2="12" y2="3"></line>
			<line x1="12" y1="21" x2="12" y2="23"></line>
			<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
			<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
			<line x1="1" y1="12" x2="3" y2="12"></line>
			<line x1="21" y1="12" x2="23" y2="12"></line>
			<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
			<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
		</svg>
	{/if}
</button>

<style>
	.theme-switcher {
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all var(--transition-fast);
		background: transparent;
		border: none;
		color: var(--color-text);
		padding: var(--spacing-xs);
	}

	/* Fixed variant - bottom right corner */
	.theme-switcher.fixed {
		position: fixed;
		bottom: var(--spacing-lg);
		right: var(--spacing-lg);
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		box-shadow: var(--shadow-md);
		z-index: 100;
	}

	.theme-switcher.fixed:hover {
		transform: scale(1.1);
		box-shadow: var(--shadow-lg);
	}

	.theme-switcher.fixed:active {
		transform: scale(0.95);
	}

	/* Inline variant - for use in navigation */
	.theme-switcher.inline {
		width: auto;
		height: auto;
		padding: var(--spacing-xs);
		border-radius: var(--radius-sm);
	}

	.theme-switcher.inline:hover {
		background: var(--color-surface-hover);
	}

	/* Dropdown variant - for use inside dropdowns */
	.theme-switcher.dropdown {
		width: 100%;
		height: auto;
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: 0;
		justify-content: flex-start;
		gap: var(--spacing-sm);
	}

	.theme-switcher.dropdown:hover {
		background: var(--color-surface-hover);
	}

	svg {
		color: var(--color-text);
		display: block;
	}
</style>
