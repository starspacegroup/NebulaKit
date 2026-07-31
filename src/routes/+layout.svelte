<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Navigation from '$lib/components/Navigation.svelte';
	import { goto } from '$app/navigation';
	import { showCommandPalette, toggleCommandPalette } from '$lib/stores/commandPalette';
	import { resolvedTheme, themePreference } from '$lib/stores/theme';
	import { registerWebMcpTools } from '$lib/webmcp';
	import { onMount } from 'svelte';
	import '../app.css';
	import type { PageData } from './$types';

	export let data: PageData;

	// Pages where we don't show the footer (full-screen experiences)
	$: hideFooter =
		$page.url.pathname.startsWith('/chat') ||
		$page.url.pathname.startsWith('/admin') ||
		$page.url.pathname.startsWith('/setup');

	$: commandPaletteProps = {
		hasAIProviders: data.hasAIProviders,
		isAuthenticated: Boolean(data.user),
		canAccessAdmin: Boolean(data.user?.isAdmin || data.user?.isOwner),
		cmsCommands: data.cmsPaletteItems
	} as Record<string, unknown>;

	// Subscribe to theme changes and apply to DOM
	if (browser) {
		resolvedTheme.subscribe((theme) => {
			document.documentElement.setAttribute('data-theme', theme);
		});
	}

	onMount(() => {
		requestAnimationFrame(() => {
			document.documentElement.classList.remove('theme-preload');
		});

		// WebMCP (docs/AGENT_READINESS.md): offer this site's read/navigate actions
		// to an in-browser AI agent. No-ops on browsers without the API, which is
		// currently almost all of them.
		registerWebMcpTools({
			origin: $page.url.origin,
			// Read lazily so an agent calling the tool later sees current data.
			items: () => data.cmsPaletteItems ?? [],
			navigate: (path) => goto(path),
			setTheme: (theme) => themePreference.set(theme)
		});

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

	// Viewport beacon (admin stats "Viewports" card; docs/ADMIN_STATS.md).
	// Reports the bucketed window width once per session — viewport is the one
	// audience dimension request headers can't supply. Cookieless: the server
	// stores only a daily bucket counter. Admin/setup surfaces are excluded, the
	// same way the page-view hook excludes them.
	if (browser) {
		try {
			const path = window.location.pathname;
			const excluded = path.startsWith('/admin') || path.startsWith('/setup');
			if (!excluded && !sessionStorage.getItem('nk-vp-sent')) {
				sessionStorage.setItem('nk-vp-sent', '1');
				fetch('/api/stats/viewport', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ width: window.innerWidth }),
					keepalive: true
				}).catch(() => {});
			}
		} catch {
			// sessionStorage unavailable (private-mode edge cases) — skip silently.
		}
	}
</script>

<div class="app">
	<Navigation user={data.user} onCommandPaletteClick={toggleCommandPalette} />

	<main>
		<slot />
	</main>

	{#if !hideFooter}
		<Footer />
	{/if}

	<CommandPalette {...commandPaletteProps} bind:show={$showCommandPalette} />
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
