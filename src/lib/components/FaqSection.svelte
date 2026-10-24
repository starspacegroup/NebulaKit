<!--
  FaqSection — renders a visible FAQ and its FAQPage JSON-LD from one array,
  so the structured data always matches the text on the page.
  See docs/SEO_GUIDE.md.
-->
<script lang="ts">
	import { faqJsonLd, jsonLdScriptTag, type FaqItem } from '$lib/seo/faq';

	export let items: FaqItem[];
	export let heading: string = 'Questions';
	/** Set false when another FAQPage block already exists on the page. */
	export let structuredData: boolean = true;

	$: visible = items.filter((i) => i.question.trim() && i.answer.trim());
	$: script = jsonLdScriptTag(faqJsonLd(visible));
</script>

<svelte:head>
	{#if structuredData && visible.length}
		{@html script}
	{/if}
</svelte:head>

{#if visible.length}
	<section class="faq" aria-labelledby="faq-heading">
		<h2 id="faq-heading">{heading}</h2>
		{#each visible as item}
			<details class="faq-item">
				<summary>{item.question}</summary>
				<p>{item.answer}</p>
			</details>
		{/each}
	</section>
{/if}

<style>
	.faq {
		display: grid;
		gap: var(--spacing-sm);
	}
	.faq-item {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md, 0.5rem);
		background: var(--color-surface);
		padding: var(--spacing-sm) var(--spacing-md);
	}
	summary {
		cursor: pointer;
		font-weight: 600;
		color: var(--color-text);
	}
	p {
		margin: var(--spacing-sm) 0 0;
		color: var(--color-text-secondary);
	}
</style>
