<!--
  Renders stored CMS richtext, mounting Svelte embeds where the editor left
  placeholders.

  Content is stored as HTML with atom placeholders:

    <div data-svelte-embed="name" data-props="{&quot;key&quot;:1}"></div>

  A plain {@html} of that string emits the empty <div> and the component never
  mounts, so every richtext surface must render through this component instead.
  parseContentSegments splits the stored HTML into plain runs and embed
  segments; each embed resolves through the component registry.

  An embed whose component is not registered renders nothing. The registry
  ships empty, so "not registered" is the template's default state rather than
  an error worth surfacing to a visitor.
-->
<script lang="ts">
	import { parseContentSegments } from '$lib/cms/embed';
	import { getEmbedComponent } from '$lib/cms/embeds';

	export let html: string | null | undefined = '';

	$: segments = parseContentSegments(html ?? '');
</script>

{#each segments as segment}
	{#if segment.type === 'html'}
		{@html segment.html}
	{:else if segment.type === 'embed'}
		{@const Embed = getEmbedComponent(segment.name)}
		{#if Embed}
			<svelte:component this={Embed} {...segment.props} />
		{/if}
	{/if}
{/each}
