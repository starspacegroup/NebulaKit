<!--
  Admin CMS — create a new content item (full page).
-->
<script lang="ts">
	import CmsItemEditor from '$lib/components/CmsItemEditor.svelte';
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<SharingMeta title="New {data.contentType.name} - CMS Admin" noindex={true} />

<CmsItemEditor contentType={data.contentType} tags={data.tags} />
