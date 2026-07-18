<script lang="ts">
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';

	// Supplied by the admin +layout.svelte via setContext.
	const canRevealPii = getContext<boolean>('canRevealPii');
	const piiRevealed = getContext<Writable<boolean>>('piiRevealed');
	const toggleReveal = getContext<() => Promise<void>>('toggleReveal');
</script>

{#if canRevealPii}
	<button
		class="privacy-toggle"
		class:active={$piiRevealed}
		type="button"
		on:click={toggleReveal}
		title={$piiRevealed
			? 'Hide personal data (screen-sharing safe)'
			: 'Reveal personal data — off by default for privacy'}
	>
		{#if $piiRevealed}
			<svg
				class="nav-icon"
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"
			>
				<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
				<circle cx="12" cy="12" r="3" />
			</svg>
			<span>PII Visible</span>
		{:else}
			<svg
				class="nav-icon"
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"
			>
				<path
					d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
				/>
				<line x1="1" y1="1" x2="23" y2="23" />
			</svg>
			<span>PII Hidden</span>
		{/if}
	</button>
{:else}
	<div class="privacy-locked" title="Personal data is always hidden for your role">
		<svg
			class="nav-icon"
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"
		>
			<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
			<path d="M7 11V7a5 5 0 0 1 10 0v4" />
		</svg>
		<span>PII Locked</span>
	</div>
{/if}

<style>
	.privacy-toggle,
	.privacy-locked {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		flex: 0 0 auto;
		min-width: max-content;
		width: 100%;
		padding: var(--spacing-md);
		border-radius: var(--radius-md);
		font: inherit;
		text-align: left;
		transition: all var(--transition-fast);
	}

	.privacy-toggle {
		background: transparent;
		color: var(--color-text-secondary);
		border: none;
		cursor: pointer;
	}

	.privacy-toggle:hover {
		background: var(--color-background);
		color: var(--color-text);
	}

	/* Red (not amber): while revealed, the toggle is a live warning that real
	   personal data is currently on screen. */
	.privacy-toggle.active {
		background: color-mix(in srgb, var(--color-error) 12%, transparent);
		color: var(--color-error);
	}

	.privacy-locked {
		background: transparent;
		color: var(--color-text-secondary);
		opacity: 0.6;
		cursor: default;
	}

	.nav-icon {
		flex-shrink: 0;
	}
</style>
