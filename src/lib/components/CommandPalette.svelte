<svelte:options accessors={true} />

<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import {
		resolvedTheme,
		systemTheme,
		themePreference,
		type ThemePreference
	} from '$lib/stores/theme';
	import { tick } from 'svelte';

	export let show = false;
	export let hasAIProviders = false;

	let searchInput: HTMLInputElement;
	let query = '';
	let selectedIndex = 0;
	let previousShow = false;
	let previewTheme: string | null = null;

	let currentPreference: ThemePreference;
	let currentSystemTheme: 'light' | 'dark';
	let currentResolvedTheme: 'light' | 'dark';

	themePreference.subscribe((value) => (currentPreference = value));
	systemTheme.subscribe((value) => (currentSystemTheme = value));
	resolvedTheme.subscribe((value) => (currentResolvedTheme = value));

	interface Command {
		id: string;
		label: string;
		description: string;
		action: () => void;
		icon: string;
		badge?: string;
		onPreview?: () => void;
		onPreviewEnd?: () => void;
	}

	function setTheme(preference: ThemePreference) {
		themePreference.set(preference);
		applyTheme(preference === 'system' ? currentSystemTheme : preference);
	}

	function applyTheme(theme: 'light' | 'dark') {
		if (browser) {
			document.documentElement.setAttribute('data-theme', theme);
		}
	}

	function previewThemeChange(theme: 'light' | 'dark') {
		previewTheme = theme;
		applyTheme(theme);
	}

	function endPreview() {
		if (previewTheme !== null) {
			previewTheme = null;
			applyTheme(currentResolvedTheme);
		}
	}

	$: commands = [
		{
			id: 'home',
			label: 'Home',
			description: 'Go to home page',
			action: () => goto('/'),
			icon: '🏠'
		},
		...(hasAIProviders
			? [
					{
						id: 'chat',
						label: 'Chat',
						description: 'Open LLM chat interface',
						action: () => goto('/chat'),
						icon: '💬'
					}
				]
			: []),
		{
			id: 'demo',
			label: 'Demo',
			description: 'View drag and drop demo',
			action: () => goto('/demo'),
			icon: '🎯'
		},
		{
			id: 'login',
			label: 'Sign In',
			description: 'Go to login page',
			action: () => goto('/auth/login'),
			icon: '🔐'
		},
		{
			id: 'signup',
			label: 'Sign Up',
			description: 'Create a new account',
			action: () => goto('/auth/signup'),
			icon: '✨'
		},
		{
			id: 'theme-light',
			label: 'Light Theme',
			description: `Switch to light mode${currentSystemTheme === 'light' ? ' (System preset)' : ''}`,
			action: () => {
				setTheme('light');
				show = false;
			},
			icon: '☀️',
			badge: currentPreference === 'light' ? '✓ Active' : undefined,
			onPreview: () => previewThemeChange('light'),
			onPreviewEnd: endPreview
		},
		{
			id: 'theme-dark',
			label: 'Dark Theme',
			description: `Switch to dark mode${currentSystemTheme === 'dark' ? ' (System preset)' : ''}`,
			action: () => {
				setTheme('dark');
				show = false;
			},
			icon: '🌙',
			badge: currentPreference === 'dark' ? '✓ Active' : undefined,
			onPreview: () => previewThemeChange('dark'),
			onPreviewEnd: endPreview
		},
		{
			id: 'theme-system',
			label: 'System Theme',
			description: `Follow system preference (currently ${currentSystemTheme})`,
			action: () => {
				setTheme('system');
				show = false;
			},
			icon: '💻',
			badge: currentPreference === 'system' ? '✓ Active' : undefined,
			onPreview: () => previewThemeChange(currentSystemTheme),
			onPreviewEnd: endPreview
		}
	] as Command[];

	$: filteredCommands = commands.filter(
		(cmd) =>
			cmd.label.toLowerCase().includes(query.toLowerCase()) ||
			cmd.description.toLowerCase().includes(query.toLowerCase())
	);

	$: if (show && !previousShow) {
		// Only reset when transitioning from closed to open
		previousShow = true;
		query = '';
		selectedIndex = 0;
		tick().then(() => {
			searchInput?.focus();
		});
	} else if (!show) {
		previousShow = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!show) return;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			// End preview of previous command
			if (selectedIndex >= 0 && selectedIndex < filteredCommands.length) {
				filteredCommands[selectedIndex].onPreviewEnd?.();
			}
			selectedIndex = Math.min(selectedIndex + 1, filteredCommands.length - 1);
			// Preview new command
			if (selectedIndex >= 0 && selectedIndex < filteredCommands.length) {
				filteredCommands[selectedIndex].onPreview?.();
			}
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			// End preview of previous command
			if (selectedIndex >= 0 && selectedIndex < filteredCommands.length) {
				filteredCommands[selectedIndex].onPreviewEnd?.();
			}
			selectedIndex = Math.max(selectedIndex - 1, 0);
			// Preview new command
			if (selectedIndex >= 0 && selectedIndex < filteredCommands.length) {
				filteredCommands[selectedIndex].onPreview?.();
			}
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (filteredCommands.length > 0) {
				executeCommand(filteredCommands[selectedIndex]);
			} else if (hasAIProviders) {
				sendToAIChat();
			}
		} else if (e.key === 'Escape') {
			e.preventDefault();
			closeCommandPalette();
		}
	}

	function executeCommand(command: Command) {
		if (command) {
			command.action();
			show = false;
		}
	}

	function sendToAIChat() {
		const trimmedQuery = query.trim();
		if (trimmedQuery) {
			goto(`/chat?q=${encodeURIComponent(trimmedQuery)}`);
			show = false;
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			endPreview();
			show = false;
		}
	}

	function closeCommandPalette() {
		endPreview();
		show = false;
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if show}
	<div
		class="backdrop"
		on:click={handleBackdropClick}
		role="presentation"
		on:keydown={(e) => e.key === 'Escape' && closeCommandPalette()}
	>
		<div class="palette" role="dialog" aria-label="Command palette">
			<div class="search-box">
				<svg
					class="search-icon"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="11" cy="11" r="8"></circle>
					<path d="m21 21-4.35-4.35"></path>
				</svg>
				<input
					bind:this={searchInput}
					bind:value={query}
					type="text"
					placeholder={hasAIProviders
						? 'Search commands or ask AI anything...'
						: 'Search commands...'}
					class="search-input"
				/>
			</div>

			<div class="commands">
				{#each filteredCommands as command, i}
					<button
						class="command"
						class:selected={i === selectedIndex}
						on:click={() => executeCommand(command)}
						on:mouseenter={() => {
							selectedIndex = i;
							command.onPreview?.();
						}}
						on:mouseleave={() => command.onPreviewEnd?.()}
						on:focus={() => {
							selectedIndex = i;
							command.onPreview?.();
						}}
						on:blur={() => command.onPreviewEnd?.()}
					>
						<span class="command-icon">{command.icon}</span>
						<div class="command-info">
							<div class="command-label">
								{command.label}
								{#if command.badge}
									<span class="command-badge">{command.badge}</span>
								{/if}
							</div>
							<div class="command-description">{command.description}</div>
						</div>
					</button>
				{:else}
					{#if query.trim() && hasAIProviders}
						<button class="command ai-chat-fallback" on:click={sendToAIChat}>
							<span class="command-icon">🤖</span>
							<div class="command-info">
								<div class="command-label">Ask AI: "{query.trim()}"</div>
								<div class="command-description">Send this question to the AI chat</div>
							</div>
						</button>
					{:else}
						<div class="no-results">
							{hasAIProviders
								? 'Type to search commands or ask AI anything...'
								: 'Type to search commands...'}
						</div>
					{/if}
				{/each}
			</div>

			<div class="footer">
				<div class="hint">
					<span class="hint-item"><kbd>↑↓</kbd> to navigate</span>
					<span class="hint-item"><kbd>↵</kbd> to select</span>
					<span class="hint-item"><kbd>esc</kbd> to close</span>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 20vh;
		z-index: 1000;
		animation: fadeIn 0.2s ease;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.palette {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-xl);
		width: 90%;
		max-width: 600px;
		max-height: 60vh;
		display: flex;
		flex-direction: column;
		animation: slideDown 0.2s ease;
	}

	@media (max-width: 768px) {
		.palette {
			width: 95%;
			max-width: 500px;
		}
	}

	@media (max-width: 480px) {
		.palette {
			width: 95%;
			max-width: none;
		}

		.search-box {
			padding: var(--spacing-sm);
		}

		.search-icon {
			width: 14px;
			height: 14px;
		}

		.search-input {
			font-size: 0.688rem;
		}

		.command {
			padding: var(--spacing-xs);
			gap: var(--spacing-xs);
		}

		.command-icon {
			font-size: 0.938rem;
		}

		.command-label {
			font-size: 0.688rem;
		}

		.command-badge {
			font-size: 0.563rem;
			padding: 0.0625rem 0.25rem;
		}

		.command-description {
			font-size: 0.625rem;
			line-height: 1.4;
		}

		.no-results {
			font-size: 0.688rem;
			padding: var(--spacing-sm);
		}

		.hint {
			font-size: 0.563rem;
			gap: 0.188rem;
		}

		kbd {
			font-size: 0.563rem;
			padding: 0.0625rem 0.188rem;
		}
	}

	@keyframes slideDown {
		from {
			transform: translateY(-20px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	.search-box {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-md);
		border-bottom: 1px solid var(--color-border);
	}

	.search-icon {
		color: var(--color-text-secondary);
		flex-shrink: 0;
	}

	.search-input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		font-size: 1rem;
		color: var(--color-text);
	}

	.search-input::placeholder {
		color: var(--color-text-secondary);
	}

	.commands {
		overflow-y: auto;
		max-height: 400px;
	}

	.command {
		width: 100%;
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		padding: var(--spacing-sm) var(--spacing-md);
		background: transparent;
		border: none;
		cursor: pointer;
		transition: background var(--transition-fast);
		text-align: left;
	}

	.command:hover,
	.command.selected {
		background: var(--color-surface-hover);
	}

	.command-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.command-info {
		flex: 1;
		min-width: 0;
	}

	.command-label {
		font-weight: 500;
		color: var(--color-text);
		margin-bottom: 0.125rem;
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.command-badge {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-primary);
		background: var(--color-surface-hover);
		padding: 0.125rem 0.5rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-primary);
	}

	.command-description {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.no-results {
		padding: var(--spacing-xl);
		text-align: center;
		color: var(--color-text-secondary);
	}

	.footer {
		padding: var(--spacing-sm) var(--spacing-md);
		border-top: 1px solid var(--color-border);
	}

	.hint {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		flex-wrap: wrap;
	}

	.hint-item {
		white-space: nowrap;
	}

	kbd {
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 0.125rem 0.375rem;
		font-family: var(--font-mono);
		font-size: 0.7rem;
	}
</style>
