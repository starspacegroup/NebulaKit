<!-- /components demos: Widgets. -->
<script lang="ts">
	import ChecklistWidget from '$lib/widgets/ChecklistWidget.svelte';
	import ClockWidget from '$lib/widgets/ClockWidget.svelte';
	import LinksWidget from '$lib/widgets/LinksWidget.svelte';
	import MeterWidget from '$lib/widgets/MeterWidget.svelte';
	import NotesWidget from '$lib/widgets/NotesWidget.svelte';
	import StatWidget from '$lib/widgets/StatWidget.svelte';
	import CatalogItem from '../CatalogItem.svelte';
</script>

<CatalogItem id="widget-stat">
	<div class="widget">
		<StatWidget
			label="Signups"
			value="312"
			delta={-4}
			accent="users"
			series={[42, 39, 44, 37, 35, 33, 31]}
		/>
	</div>
</CatalogItem>
<CatalogItem id="widget-meter">
	<div class="widget">
		<MeterWidget label="Storage" value={8.2} goal={10} unit=" GB" limit />
	</div>
</CatalogItem>
<CatalogItem id="widget-clock">
	<div class="widget"><ClockWidget label="your time" /></div>
</CatalogItem>
<CatalogItem id="widget-checklist">
	<div class="widget">
		<ChecklistWidget
			items={[
				{ id: 'a', text: 'Write the tests', done: true },
				{ id: 'b', text: 'Make them pass', done: true },
				{ id: 'c', text: 'Ship it' }
			]}
		/>
	</div>
</CatalogItem>
<CatalogItem id="widget-notes">
	<div class="widget"><NotesWidget text="Remember the release notes." /></div>
</CatalogItem>
<CatalogItem id="widget-links">
	<div class="widget">
		<LinksWidget
			links={[
				{ label: 'Documentation', href: '/documentation' },
				{ label: 'SvelteKit', href: 'https://svelte.dev/docs/kit' }
			]}
		/>
	</div>
</CatalogItem>
