<script lang="ts">
	import { browser } from '$app/environment';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import Navigation from '$lib/components/Navigation.svelte';
	import {
		closeCommandPalette,
		showCommandPalette,
		toggleCommandPalette
	} from '$lib/stores/commandPalette';
	import { resolvedTheme } from '$lib/stores/theme';
	import { onMount } from 'svelte';
	import '../app.css';
	import type { PageData } from './$types';

	export let data: PageData;

	// Subscribe to theme changes and apply to DOM
	if (browser) {
		resolvedTheme.subscribe((theme) => {
			document.documentElement.setAttribute('data-theme', theme);
		});
	}

	onMount(() => {
		// Listen for keyboard shortcut (Cmd/Ctrl + K)
		const handleKeydown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault();
				toggleCommandPalette();
			}
			if (e.key === 'Escape') {
				closeCommandPalette();
			}
		};

		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});
</script>

<div class="app">
	<Navigation
		user={data.user}
		hasAIProviders={data.hasAIProviders}
		onCommandPaletteClick={toggleCommandPalette}
	/>

	<main>
		<slot />
	</main>

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
	}
</style>
