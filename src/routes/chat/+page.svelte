<script lang="ts">
	import ChatInterface from '$lib/components/ChatInterface.svelte';
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<svelte:head>
	<title>AI Chat - NebulaKit</title>
</svelte:head>

<div class="chat-page-container">
	<ChatInterface voiceAvailable={data.voiceAvailable} />
</div>

<style>
	.chat-page-container {
		height: calc(100vh - 64px);
		width: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	@media (max-width: 768px) {
		.chat-page-container {
			height: calc(100vh - 56px);
		}
	}
</style>
