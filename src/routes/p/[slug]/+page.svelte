<script lang="ts">
	import PageRenderer from '@nebulakit/builder/PageRenderer.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{data.page.title}</title></svelte:head>

{#if !data.page.published}<p class="draft">Draft — only admins can see this page.</p>{/if}
<PageRenderer document={data.page.document} products={data.products} />

<style>
	.draft {
		text-align: center;
		padding: 0.5rem;
		background: var(--color-surface);
		color: var(--color-warning);
	}
</style>
