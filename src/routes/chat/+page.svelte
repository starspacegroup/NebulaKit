<script lang="ts">
	import ChatInterface from '$lib/components/ChatInterface.svelte';
	import ChatSidebar from '$lib/components/ChatSidebar.svelte';
	import { chatHistoryStore } from '$lib/stores/chatHistory';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	$: isSidebarOpen = $chatHistoryStore.isSidebarOpen;

	// Initialize the store with the logged-in user's ID
	onMount(() => {
		if (data.userId) {
			chatHistoryStore.initializeForUser(data.userId);
		}
	});

	function toggleSidebar() {
		chatHistoryStore.toggleSidebar();
	}
</script>

<svelte:head>
	<title>AI Chat - NebulaKit</title>
</svelte:head>

<div class="chat-page-container">
	<ChatSidebar isOpen={isSidebarOpen} />

	<div class="chat-main">
		<!-- Sidebar toggle button -->
		<button
			class="sidebar-toggle"
			class:sidebar-closed={!isSidebarOpen}
			on:click={toggleSidebar}
			aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
			title={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
		>
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
				{#if isSidebarOpen}
					<polyline points="11 17 6 12 11 7" />
					<polyline points="18 17 13 12 18 7" />
				{:else}
					<polyline points="13 17 18 12 13 7" />
					<polyline points="6 17 11 12 6 7" />
				{/if}
			</svg>
		</button>

		<ChatInterface voiceAvailable={data.voiceAvailable} />
	</div>
</div>

<style>
	.chat-page-container {
		height: calc(100vh - 64px);
		width: 100%;
		display: flex;
		overflow: hidden;
	}

	.chat-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		position: relative;
		min-width: 0;
	}

	.sidebar-toggle {
		position: absolute;
		top: var(--spacing-md);
		left: var(--spacing-md);
		z-index: 20;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text-secondary);
		cursor: pointer;
		transition: all var(--transition-fast);
		box-shadow: var(--shadow-sm);
	}

	.sidebar-toggle:hover {
		background: var(--color-surface-hover);
		color: var(--color-text);
		border-color: var(--color-primary);
	}

	.sidebar-toggle.sidebar-closed {
		left: var(--spacing-md);
	}

	@media (max-width: 768px) {
		.chat-page-container {
			height: calc(100vh - 56px);
		}

		.sidebar-toggle {
			top: var(--spacing-sm);
			left: var(--spacing-sm);
		}
	}
</style>
