<script lang="ts">
	import LandingPageView from '$lib/components/landing/LandingPageView.svelte';
	import { LANDING } from '$lib/landing';
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<LandingPageView site={LANDING} family={data.family} page={data.page} />
