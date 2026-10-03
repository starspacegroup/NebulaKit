<!-- /components demos: Navigation. -->
<script lang="ts">
	import { Accordion, Breadcrumbs, Pagination, Tabs } from '$lib/ui';
	import CatalogItem from '../CatalogItem.svelte';

	let tab = 'overview';
	let page = 3;
</script>

<CatalogItem id="tabs">
	<div class="stack">
		<Tabs
			label="Project"
			tabs={[
				{ id: 'overview', label: 'Overview' },
				{ id: 'deploys', label: 'Deploys' },
				{ id: 'billing', label: 'Billing', disabled: true },
				{ id: 'settings', label: 'Settings' }
			]}
			bind:active={tab}
			let:active
		>
			<p class="note">The {active} panel. Focus a tab and use the arrow keys.</p>
		</Tabs>
	</div>
</CatalogItem>
<CatalogItem id="accordion">
	<div class="stack">
		<Accordion
			exclusive
			items={[
				{
					title: 'Is it free?',
					content: 'Yes. MIT-licensed, for any project.',
					open: true
				},
				{
					title: 'Where does it run?',
					content: 'Cloudflare Workers, with D1, KV and R2.'
				},
				{
					title: 'Can I remove what I do not use?',
					content: 'Every component stands alone.'
				}
			]}
		/>
	</div>
</CatalogItem>
<CatalogItem id="breadcrumbs">
	<Breadcrumbs
		items={[
			{ label: 'Home', href: '/' },
			{ label: 'Components', href: '/components' },
			{ label: 'Breadcrumbs' }
		]}
	/>
</CatalogItem>
<CatalogItem id="pagination">
	<Pagination bind:page total={24} />
</CatalogItem>
