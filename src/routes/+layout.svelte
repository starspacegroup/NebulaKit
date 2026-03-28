<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Navigation from '$lib/components/Navigation.svelte';
	import { showCommandPalette, toggleCommandPalette } from '$lib/stores/commandPalette';
	import { resolvedTheme } from '$lib/stores/theme';
	import { onMount } from 'svelte';
	import '../app.css';
	import type { PageData } from './$types';

	export let data: PageData;

	// Pages where we don't show the footer (full-screen experiences)
	$: hideFooter =
		$page.url.pathname.startsWith('/chat') ||
		$page.url.pathname.startsWith('/admin') ||
		$page.url.pathname.startsWith('/setup');

	// Subscribe to theme changes and apply to DOM
	if (browser) {
		resolvedTheme.subscribe((theme) => {
			document.documentElement.setAttribute('data-theme', theme);
		});
	}

	onMount(() => {
		// Listen for keyboard shortcuts (Cmd/Ctrl + K, Cmd/Ctrl + Shift + P)
		const handleKeydown = (e: KeyboardEvent) => {
			const isModifierPressed = e.metaKey || e.ctrlKey;
			const key = e.key.toLowerCase();
			const isPaletteShortcut = isModifierPressed && (key === 'k' || (e.shiftKey && key === 'p'));

			if (isPaletteShortcut) {
				e.preventDefault();
				toggleCommandPalette();
			}
		};

		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});
</script>

<div class="app">
	<Navigation user={data.user} onCommandPaletteClick={toggleCommandPalette} />

	<main>
		<slot />
	</main>

	{#if !hideFooter}
		<Footer />
	{/if}

	<CommandPalette bind:show={$showCommandPalette} hasAIProviders={data.hasAIProviders} />
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	main {
		flex: 1;
		width: 100%;
		display: flex;
		flex-direction: column;
		padding-bottom: var(--spacing-2xl);
	}
</style>
