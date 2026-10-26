<script lang="ts">
	import LandingHub from '$lib/components/landing/LandingHub.svelte';
	import { LANDING } from '$lib/landing';
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<LandingHub site={LANDING} family={data.family} />
