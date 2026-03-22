<!--
  SharingMeta - Comprehensive sharing and SEO meta tags component.

  Renders Open Graph, Twitter Card, canonical URL, article metadata, and robots
  directives inside <svelte:head>. Use on every page with page-specific props.
-->
<script lang="ts">
	import { page } from '$app/stores';

	/** Page title (displayed in browser tab and social shares) */
	export let title: string;
	/** Page description for search engines and social shares */
	export let description: string = '';
	/** Absolute or root-relative URL to the page's share image */
	export let image: string = '';
	/** Alt text for the share image */
	export let imageAlt: string = '';
	/** Canonical URL for this page */
	export let url: string = '';
	/** Open Graph content type */
	export let type: 'website' | 'article' | 'profile' = 'website';
	/** Site name shown in OG tags and title suffix */
	export let siteName: string = 'NebulaKit';
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
	/** Width of the share image in pixels */
	export let imageWidth: number = 0;
	/** Height of the share image in pixels */
	export let imageHeight: number = 0;

	$: fullTitle = siteName ? `${title} - ${siteName}` : title;
	// Resolve root-relative image paths to absolute URLs for OG/Twitter compliance
	$: absoluteImage = image && image.startsWith('/') ? `${$page.url.origin}${image}` : image;
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
	{#if absoluteImage}
		<meta property="og:image" content={absoluteImage} />
		<meta property="og:image:alt" content={imageAlt || title} />
		{#if imageWidth}
			<meta property="og:image:width" content={String(imageWidth)} />
		{/if}
		{#if imageHeight}
			<meta property="og:image:height" content={String(imageHeight)} />
		{/if}
	{/if}
	{#if url}
		<meta property="og:url" content={url} />
	{/if}
	<meta property="og:site_name" content={siteName || 'NebulaKit'} />
	<meta property="og:locale" content={locale} />

	<!-- Twitter Card -->
	<meta name="twitter:card" content={twitterCard} />
	<meta name="twitter:title" content={title} />
	{#if description}
		<meta name="twitter:description" content={description} />
	{/if}
	{#if absoluteImage}
		<meta name="twitter:image" content={absoluteImage} />
		{#if imageAlt || title}
			<meta name="twitter:image:alt" content={imageAlt || title} />
		{/if}
	{/if}
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
</svelte:head>
