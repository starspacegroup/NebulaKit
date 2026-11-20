<!--
  SharingMeta - Comprehensive sharing and SEO meta tags component.

  Renders Open Graph, Twitter Card, canonical URL, article metadata, and robots
  directives inside <svelte:head>. Use on every page with page-specific props.
-->
<script lang="ts">
	import { page } from '$app/stores';
	import { site } from '$lib/site.config';
	import { resolveShareImage } from '$lib/seo/share-image';
	import { jsonLdScript, sharingGraph, type SharingGraphInput } from '$lib/seo/structured-data';

	/** Page title (displayed in browser tab and social shares) */
	export let title: string;
	/** Page description for search engines and social shares */
	export let description: string = '';
	/**
	 * The page's own share image: absolute or root-relative. Leave it empty (or pass something
	 * unusable, like an SVG) and the site's default share image is used, so a shared link is
	 * never imageless. See `$lib/seo/share-image.ts`.
	 */
	export let image: string = '';
	/** Alt text for the share image */
	export let imageAlt: string = '';
	/** Canonical URL for this page */
	export let url: string = '';
	/** Open Graph content type */
	export let type: 'website' | 'article' | 'profile' = 'website';
	/** Site name shown in OG tags and title suffix */
	export let siteName: string = site.name;
	/** Locale for OG tags */
	export let locale: string = 'en_US';
	/** Twitter card type */
	export let twitterCard: 'summary' | 'summary_large_image' | 'app' | 'player' =
		'summary_large_image';
	/** Twitter @handle for the site */
	export let twitterSite: string = '';
	/** Twitter @handle for the content creator */
	export let twitterCreator: string = '';
	/** ISO 8601 date for article:published_time (only used when type is 'article') */
	export let publishedTime: string = '';
	/** ISO 8601 date for article:modified_time (only used when type is 'article') */
	export let modifiedTime: string = '';
	/** Author name for article:author (only used when type is 'article') */
	export let author: string = '';
	/** If true, adds noindex/nofollow robots meta */
	export let noindex: boolean = false;
	/** Width of the page's own share image in pixels; 0 omits the tag */
	export let imageWidth: number = 0;
	/** Height of the page's own share image in pixels; 0 omits the tag */
	export let imageHeight: number = 0;

	/**
	 * Extra facts for the page's JSON-LD graph (breadcrumb, listing items,
	 * product, article details). Pass `null` to emit no structured data. A
	 * noindex page never emits any. See docs/STRUCTURED_DATA.md.
	 */
	export let structured: SharingGraphInput['extra'] = {};

	$: fullTitle = siteName ? `${title} - ${siteName}` : title;
	// Every page is shared with an image: its own when usable, the site's default otherwise.
	// Absolute, because OG and Twitter crawlers do not resolve relative paths.
	$: shared = resolveShareImage({
		image,
		imageAlt,
		imageWidth,
		imageHeight,
		title,
		origin: $page.url.origin
	});
	$: jsonLd = jsonLdScript(
		sharingGraph({
			path: $page.url.pathname,
			title,
			description,
			image: shared.src,
			imageAlt: shared.alt,
			imageWidth: shared.width,
			imageHeight: shared.height,
			type,
			publishedTime,
			modifiedTime,
			author,
			noindex,
			extra: structured
		})
	);
</script>

<svelte:head>
	<!-- Primary -->
	<title>{fullTitle}</title>
	{#if description}
		<meta name="description" content={description} />
	{/if}

	<!-- Robots -->
	{#if noindex}
		<meta name="robots" content="noindex, nofollow" />
	{/if}

	<!-- Canonical -->
	{#if url}
		<link rel="canonical" href={url} />
	{/if}

	<!-- Open Graph -->
	<meta property="og:title" content={title} />
	{#if description}
		<meta property="og:description" content={description} />
	{/if}
	<meta property="og:type" content={type} />
	<meta property="og:image" content={shared.src} />
	<meta property="og:image:alt" content={shared.alt} />
	{#if shared.width}
		<meta property="og:image:width" content={String(shared.width)} />
	{/if}
	{#if shared.height}
		<meta property="og:image:height" content={String(shared.height)} />
	{/if}
	{#if url}
		<meta property="og:url" content={url} />
	{/if}
	<meta property="og:site_name" content={siteName || site.name} />
	<meta property="og:locale" content={locale} />

	<!-- Twitter Card -->
	<meta name="twitter:card" content={twitterCard} />
	<meta name="twitter:title" content={title} />
	{#if description}
		<meta name="twitter:description" content={description} />
	{/if}
	<meta name="twitter:image" content={shared.src} />
	<meta name="twitter:image:alt" content={shared.alt} />
	{#if twitterSite}
		<meta name="twitter:site" content={twitterSite} />
	{/if}
	{#if twitterCreator}
		<meta name="twitter:creator" content={twitterCreator} />
	{/if}

	<!-- Article metadata (only for type="article") -->
	{#if type === 'article'}
		{#if publishedTime}
			<meta property="article:published_time" content={publishedTime} />
		{/if}
		{#if modifiedTime}
			<meta property="article:modified_time" content={modifiedTime} />
		{/if}
		{#if author}
			<meta property="article:author" content={author} />
		{/if}
	{/if}

	<!-- Structured data (JSON-LD), escaped by jsonLdScript -->
	{@html jsonLd}
</svelte:head>
