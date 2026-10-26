<!--
  One landing page. All text comes from the page object (src/lib/landing);
  this component only lays it out. The visible FAQ and its FAQPage JSON-LD
  come from the same array via FaqSection. See docs/SEO_LANDING_PAGES.md.
-->
<script lang="ts">
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import FaqSection from '$lib/components/FaqSection.svelte';
	import { jsonLdScriptTag } from '$lib/seo/faq';
	import {
		canonicalUrl,
		familyPages,
		hubPath,
		pageJsonLd,
		pagePath,
		type LandingFamily,
		type LandingPage,
		type LandingSiteConfig
	} from '$lib/landing';

	export let site: LandingSiteConfig;
	export let family: LandingFamily;
	export let page: LandingPage;

	$: url = canonicalUrl(site, pagePath(site, page));
	$: blocks = pageJsonLd(site, family, page).filter((b) => b['@type'] !== 'FAQPage');
	$: siblings = familyPages(site, family.key).filter((p) => p.slug !== page.slug);
	$: otherHubs = site.families.filter(
		(f) => f.key !== family.key && familyPages(site, f.key).length
	);
</script>

<SharingMeta
	title={page.title}
	description={page.description}
	{url}
	noindex={site.example}
	image={site.ogImage?.src ?? ''}
	imageAlt={site.ogImage?.alt ?? ''}
	imageWidth={site.ogImage?.width ?? 0}
	imageHeight={site.ogImage?.height ?? 0}
/>

<svelte:head>
	{#each blocks as block}
		{@html jsonLdScriptTag(block)}
	{/each}
</svelte:head>

<article class="landing">
	{#if site.example}
		<p class="example-notice" role="note">
			Example content. These pages show the shape of a landing page; nothing on them is real.
		</p>
	{/if}

	<nav class="crumbs" aria-label="Breadcrumb">
		<ol>
			<li><a href="/">Home</a></li>
			<li><a href={hubPath(family)}>{family.label}</a></li>
			<li aria-current="page">{page.name}</li>
		</ol>
	</nav>

	<header class="head">
		<h1>{page.h1}</h1>
		<p class="lede">{page.lede}</p>
		<div class="actions">
			<a class="btn btn-primary" href={site.cta.primary.href}>{site.cta.primary.label}</a>
			{#if site.cta.secondary}
				<a class="btn btn-ghost" href={site.cta.secondary.href}>{site.cta.secondary.label}</a>
			{/if}
		</div>
	</header>

	<section aria-labelledby="landing-sections">
		<h2 id="landing-sections">{page.sectionsHeading}</h2>
		<dl class="facts">
			{#each page.sections as item}
				<div class="fact">
					<dt>{item.heading}</dt>
					<dd>{item.body}</dd>
				</div>
			{/each}
		</dl>
	</section>

	{#if page.extra}
		<section aria-labelledby="landing-extra">
			<h2 id="landing-extra">{page.extra.heading}</h2>
			<dl class="facts">
				{#each page.extra.sections as item}
					<div class="fact">
						<dt>{item.heading}</dt>
						<dd>{item.body}</dd>
					</div>
				{/each}
			</dl>
		</section>
	{/if}

	{#if page.checks}
		<section aria-labelledby="landing-checks">
			<h2 id="landing-checks">{page.checks.heading}</h2>
			<ul class="list">
				{#each page.checks.items as item}
					<li>{item}</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section>
		<FaqSection items={page.faq} />
	</section>

	{#if siblings.length || otherHubs.length || page.related?.length}
		<nav class="more" aria-labelledby="landing-more">
			<h2 id="landing-more">More from {family.label.toLowerCase()}</h2>
			<ul>
				{#each siblings as s}
					<li><a href={pagePath(site, s)}>{s.name}</a></li>
				{/each}
				{#each page.related ?? [] as r}
					<li><a href={r.href}>{r.label}</a></li>
				{/each}
			</ul>
			{#if otherHubs.length}
				<ul>
					{#each otherHubs as h}
						<li><a href={hubPath(h)}>{h.label}</a></li>
					{/each}
				</ul>
			{/if}
		</nav>
	{/if}
</article>

<style>
	.landing {
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
	.crumbs ol {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
		list-style: none;
		padding: 0;
		margin: 0 0 var(--spacing-lg);
		color: var(--color-text-secondary);
	}
	.crumbs li + li::before {
		content: '/';
		margin-right: var(--spacing-sm);
	}
	.head {
		max-width: 44rem;
		margin-bottom: var(--spacing-2xl);
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
		margin: 0 0 var(--spacing-lg);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-md);
	}
	.btn {
		display: inline-block;
		padding: 0.8em 1.5em;
		border-radius: var(--radius-md, 0.5rem);
		font-weight: 600;
		text-decoration: none;
		border: 2px solid transparent;
	}
	.btn-primary {
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
	}
	.btn-primary:hover {
		background: var(--color-primary-solid-hover);
	}
	.btn-ghost {
		border-color: var(--color-border);
		color: var(--color-text);
	}
	section,
	.more {
		padding-top: var(--spacing-xl);
		margin-top: var(--spacing-xl);
		border-top: 1px solid var(--color-border);
	}
	h2 {
		font-size: clamp(1.4em, 3vw, 1.8em);
		margin: 0 0 var(--spacing-lg);
		color: var(--color-text);
	}
	.facts {
		display: grid;
		gap: var(--spacing-lg);
		margin: 0;
	}
	@media (min-width: 52rem) {
		.facts {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	dt {
		font-weight: 700;
		margin-bottom: var(--spacing-xs);
		color: var(--color-text);
	}
	dd {
		margin: 0;
		line-height: 1.7;
		color: var(--color-text-secondary);
	}
	.list li + li {
		margin-top: var(--spacing-xs);
	}
	.more ul {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm) var(--spacing-lg);
		list-style: none;
		padding: 0;
		margin: 0 0 var(--spacing-md);
	}
</style>
