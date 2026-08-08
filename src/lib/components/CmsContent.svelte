<!--
  CmsContent — public renderer for CMS richtext HTML.

  Content is stored as HTML with atom placeholders:

    <div data-svelte-embed="name" data-props="{&quot;key&quot;:1}"></div>

  A plain {@html} of that string emits the empty <div> and the component never
  mounts, so every richtext surface must render through this component instead.
  The sanitizer runs once at this rendering boundary for defense in depth over
  legacy/imported rows. parseContentSegments then splits the safe HTML into
  plain runs and embed segments; each embed resolves through the registry.

  An embed whose component is not registered renders nothing. The registry
  ships empty, so "not registered" is NebulaKit's default state rather than
  an error worth surfacing to a visitor.
-->
<script lang="ts">
	import { parseContentSegments } from '$lib/cms/embed';
	import { getEmbedComponent } from '$lib/cms/embeds';
	import { sanitizeRichTextHtml } from '$lib/cms/sanitize';

	// Typed to accept null/undefined because callers pass raw CMS field values,
	// which are nullable. The `html || ''` below already handles them at runtime.
	export let html: string | null | undefined = '';

	$: segments = parseContentSegments(sanitizeRichTextHtml(html ?? ''));
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
