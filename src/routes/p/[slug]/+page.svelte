<script lang="ts">
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import { firstDocumentImage } from '$lib/seo/share-image';
	import PageRenderer from '@nebulakit/builder/PageRenderer.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	// The page's first picture is its share image; a page with none is shared with the site's.
	const picture = $derived(firstDocumentImage(data.page.document));
</script>

<SharingMeta
	title={data.page.title}
	image={picture?.src ?? ''}
	imageAlt={picture?.alt || data.page.title}
	noindex={!data.page.published}
	structured={{ breadcrumb: [{ name: data.page.title, path: `/p/${data.page.slug}` }] }}
/>

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
