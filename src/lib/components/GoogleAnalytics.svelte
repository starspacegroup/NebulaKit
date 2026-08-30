<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { installGtag, isAnalyticsExcludedPath, sendPageView } from '$lib/utils/analytics';

	/** `null` whenever GA is unconnected or paused — then this renders and does
	 *  nothing, and no third-party request is made. */
	export let measurementId: string | null = null;

	// gtag.js is a browser tag, so it is attached after hydration rather than
	// server-rendered into <head>. That also means the reactive block below runs
	// once per client-side navigation, which is how views get counted past the
	// first page — gtag's own automatic page_view is switched off in installGtag.
	let mounted = false;
	onMount(() => {
		mounted = true;
	});

	$: if (browser && mounted && measurementId && !isAnalyticsExcludedPath($page.url.pathname)) {
		installGtag(window, document, measurementId);
		sendPageView(window, measurementId, {
			path: `${$page.url.pathname}${$page.url.search}`,
			title: document.title,
			location: $page.url.href
		});
	}
</script>
