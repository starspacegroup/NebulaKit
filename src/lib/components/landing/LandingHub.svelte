<!--
  A family hub (/who, /where, …): the family's intro and one card per
  published page, with CollectionPage JSON-LD. See docs/SEO_LANDING_PAGES.md.
-->
<script lang="ts">
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import { jsonLdScriptTag } from '$lib/seo/faq';
	import {
		canonicalUrl,
		familyPages,
		hubJsonLd,
		hubPath,
		pagePath,
		type LandingFamily,
		type LandingSiteConfig
	} from '$lib/landing';

	export let site: LandingSiteConfig;
	export let family: LandingFamily;

	$: pages = familyPages(site, family.key);
	$: otherHubs = site.families.filter(
		(f) => f.key !== family.key && familyPages(site, f.key).length
	);
</script>

<SharingMeta
	title={family.hubTitle}
	description={family.hubDescription}
	url={canonicalUrl(site, hubPath(family))}
	noindex={site.example}
	image={site.ogImage?.src ?? ''}
	imageAlt={site.ogImage?.alt ?? ''}
	imageWidth={site.ogImage?.width ?? 0}
	imageHeight={site.ogImage?.height ?? 0}
/>

<svelte:head>
	{@html jsonLdScriptTag(hubJsonLd(site, family))}
</svelte:head>

<div class="hub">
	{#if site.example}
		<p class="example-notice" role="note">
			Example content. These pages show the shape of a landing page; nothing on them is real.
		</p>
	{/if}
	<header>
		<h1>{family.hubH1}</h1>
		<p class="lede">{family.hubIntro}</p>
	</header>
	<ul class="cards">
		{#each pages as p}
			<li>
				<a href={pagePath(site, p)}>{p.name}</a>
				<p>{p.blurb}</p>
			</li>
		{/each}
	</ul>
	{#if otherHubs.length}
		<nav aria-label="Other sections">
			<ul class="hubs">
				{#each otherHubs as h}
					<li><a href={hubPath(h)}>{h.label}</a></li>
				{/each}
			</ul>
		</nav>
	{/if}
</div>

<style>
	.hub {
		max-width: 60rem;
		margin: 0 auto;
		padding: clamp(1.5rem, 5vw, 4rem) var(--spacing-lg);
	}
	.example-notice {
		border: 1px dashed var(--color-border);
		background: var(--color-surface);
		color: var(--color-text-secondary);
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius-md, 0.5rem);
		margin: 0 0 var(--spacing-lg);
	}
	h1 {
		font-size: clamp(2em, 6vw, 3em);
		line-height: 1.1;
		margin: 0 0 var(--spacing-md);
		color: var(--color-text);
	}
	.lede {
		font-size: 1.2em;
		line-height: 1.6;
		color: var(--color-text-secondary);
		max-width: 44rem;
	}
	.cards {
		list-style: none;
		padding: 0;
		margin: var(--spacing-xl) 0;
		display: grid;
		gap: var(--spacing-lg);
	}
	@media (min-width: 46rem) {
		.cards {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	.cards li {
		border-top: 1px solid var(--color-border);
		padding-top: var(--spacing-md);
	}
	.cards a {
		font-weight: 700;
		font-size: 1.15em;
	}
	.cards p {
		margin: var(--spacing-xs) 0 0;
		line-height: 1.6;
		color: var(--color-text-secondary);
	}
	.hubs {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm) var(--spacing-lg);
		list-style: none;
		padding: 0;
	}
</style>
