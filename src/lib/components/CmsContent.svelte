<!--
  CmsContent — public renderer for CMS richtext HTML.

  Splits stored HTML into segments: plain chunks are injected with {@html}
  (content is sanitized server-side at write time), and Svelte embed
  placeholders mount their live components from the embed registry.
-->
<script lang="ts">
	import { parseContentSegments } from '$lib/cms/embed';
	import { getEmbedComponent } from '$lib/cms/embeds';

	export let html = '';

	$: segments = parseContentSegments(html || '');
</script>

{#each segments as segment, i (i)}
	{#if segment.type === 'html'}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized at write time -->
		{@html segment.html}
	{:else}
		{@const component = getEmbedComponent(segment.name)}
		{#if component}
			<svelte:component this={component} {...segment.props} />
		{/if}
	{/if}
{/each}
