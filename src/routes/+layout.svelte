<script lang="ts">
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import Navigation from '$lib/components/Navigation.svelte';
	import { onMount } from 'svelte';
	import '../app.css';
	import type { PageData } from './$types';

	export let data: PageData;

	let showCommandPalette = false;

	onMount(() => {
		// Listen for keyboard shortcut (Cmd/Ctrl + K)
		const handleKeydown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault();
				showCommandPalette = !showCommandPalette;
			}
			if (e.key === 'Escape') {
				showCommandPalette = false;
			}
		};

		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});
</script>

<div class="app">
	<Navigation
		user={data.user}
		onCommandPaletteClick={() => (showCommandPalette = !showCommandPalette)}
	/>

	<main>
		<slot />
	</main>

	<CommandPalette bind:show={showCommandPalette} />
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
