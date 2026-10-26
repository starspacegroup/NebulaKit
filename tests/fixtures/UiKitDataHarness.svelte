<!--
	Fills the data-display components' slots so their tests can render them the
	way a page would, and reports component events through `onEvent`. A
	callback prop works the same under Svelte 4 and 5; the testing-library
	event APIs do not.
-->
<script lang="ts">
	import Avatar from '$lib/ui/Avatar.svelte';
	import Carousel from '$lib/ui/Carousel.svelte';
	import DataTable from '$lib/ui/DataTable.svelte';
	import Item from '$lib/ui/Item.svelte';
	import Prose from '$lib/ui/Prose.svelte';
	import Timeline from '$lib/ui/Timeline.svelte';

	export let which: 'datatable' | 'carousel' | 'item' | 'timeline' | 'prose';
	export let index = 0;
	export let selected: unknown[] = [];
	export let props: Record<string, unknown> = {};
	// `any` so each test can type the detail it expects.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let onEvent: (name: string, detail: any) => void = () => {};

	const people = [
		{ id: 1, name: 'Ada Lovelace', city: 'London', commits: 1200 },
		{ id: 2, name: 'Alan Turing', city: 'Manchester', commits: 640 },
		{ id: 3, name: 'Grace Hopper', city: 'New York', commits: 2210 },
		{ id: 4, name: 'Edsger Dijkstra', city: 'Austin', commits: 98 },
		{ id: 5, name: 'Barbara Liskov', city: 'Boston', commits: 870 }
	];
	const slides = [{ title: 'First' }, { title: 'Second' }, { title: 'Third' }];
</script>

{#if which === 'datatable'}
	<DataTable
		caption="People"
		rows={people}
		columns={[
			{ key: 'name', label: 'Name', sortable: true },
			{ key: 'city', label: 'City' },
			{
				key: 'commits',
				label: 'Commits',
				sortable: true,
				align: 'end',
				format: (v) => `${v} commits`
			}
		]}
		pageSize={2}
		pageSizes={[2, 0]}
		selectable
		bind:selected
		{...props}
		on:selection={(e) => onEvent('selection', e.detail)}
		on:sort={(e) => onEvent('sort', e.detail)}
	>
		<svelte:fragment slot="toolbar" let:selected={picked}>
			<span data-testid="toolbar">{picked.length} picked</span>
		</svelte:fragment>
	</DataTable>
{:else if which === 'carousel'}
	<Carousel
		items={slides}
		label="Highlights"
		bind:index
		{...props}
		let:item
		on:change={(e) => onEvent('change', e.detail)}
	>
		<p>{item.title} <a href="/{item.title}">Open</a></p>
	</Carousel>
	<span data-testid="index">{index}</span>
{:else if which === 'item'}
	<Item title="Ada Lovelace" description="Analyst" meta="2h" href="/ada" variant="outline">
		<Avatar slot="media" name="Ada Lovelace" size="sm" />
		<button slot="actions" type="button">Message</button>
	</Item>
	<Item>
		<svelte:fragment slot="title">Slotted title</svelte:fragment>
		<svelte:fragment slot="description">Slotted description</svelte:fragment>
	</Item>
{:else if which === 'timeline'}
	<Timeline
		label="History"
		items={[
			{ time: 'Today', datetime: '2026-10-03', title: 'Shipped', tone: 'success' },
			{ time: 'Yesterday', title: 'Reviewed', description: 'Two approvals' }
		]}
	>
		<span slot="icon" let:item>{item.tone === 'success' ? '✓' : '•'}</span>
	</Timeline>
{:else if which === 'prose'}
	<Prose size="lg"
		><h2>Heading</h2>
		<p>Body <a href="/x">link</a></p></Prose
	>
{/if}
