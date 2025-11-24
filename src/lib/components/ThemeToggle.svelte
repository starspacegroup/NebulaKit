<script lang="ts">
	import { themePreference } from '$lib/stores/theme';

	function setTheme(theme: 'light' | 'dark' | 'system') {
		themePreference.set(theme);
	}
</script>

<div class="theme-toggle" role="group" aria-label="Theme selector">
	<button
		class="theme-option"
		class:active={$themePreference === 'light'}
		on:click={() => setTheme('light')}
		aria-label="Light theme"
		title="Light theme"
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
	</button>

	<button
		class="theme-option"
		class:active={$themePreference === 'dark'}
		on:click={() => setTheme('dark')}
		aria-label="Dark theme"
		title="Dark theme"
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
			<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
		</svg>
	</button>

	<button
		class="theme-option"
		class:active={$themePreference === 'system'}
		on:click={() => setTheme('system')}
		aria-label="System theme"
		title="System theme"
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
			<rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
			<line x1="8" y1="21" x2="16" y2="21"></line>
			<line x1="12" y1="17" x2="12" y2="21"></line>
		</svg>
	</button>
</div>

<style>
	.theme-toggle {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		padding: var(--spacing-xs);
		background: var(--color-surface-hover);
		border-radius: var(--radius-md);
		width: 100%;
	}

	.theme-option {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-sm);
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		color: var(--color-text-secondary);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.theme-option:hover {
		background: var(--color-surface);
		color: var(--color-text);
		border-color: var(--color-border);
	}

	.theme-option.active {
		background: var(--color-primary);
		color: var(--color-background);
		border-color: var(--color-primary);
	}

	.theme-option.active:hover {
		background: var(--color-primary);
		opacity: 0.9;
	}

	svg {
		display: block;
	}
</style>
