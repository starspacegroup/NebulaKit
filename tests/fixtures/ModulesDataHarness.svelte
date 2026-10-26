<!--
	Renders one data module the way a page would — bound, with events heard
	through `onEvent` — so tests can read the bound state back from
	`data-testid="state"`. A callback prop works the same under Svelte 4 and 5.
-->
<script lang="ts">
	import ActivityFeed from '$lib/modules/data/ActivityFeed.svelte';
	import AuditLog from '$lib/modules/data/AuditLog.svelte';
	import CalendarSchedule from '$lib/modules/data/CalendarSchedule.svelte';
	import CommentThread from '$lib/modules/data/CommentThread.svelte';
	import DataGrid from '$lib/modules/data/DataGrid.svelte';
	import FileManager from '$lib/modules/data/FileManager.svelte';
	import FilterBar from '$lib/modules/data/FilterBar.svelte';
	import KanbanBoard from '$lib/modules/data/KanbanBoard.svelte';
	import TeamMembers from '$lib/modules/data/TeamMembers.svelte';
	import TreeView from '$lib/modules/data/TreeView.svelte';

	export let which:
		| 'grid'
		| 'filterbar'
		| 'kanban'
		| 'feed'
		| 'thread'
		| 'team'
		| 'files'
		| 'calendar'
		| 'tree'
		| 'audit';
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let props: Record<string, any> = {};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let onEvent: (name: string, detail: any) => void = () => {};

	/* eslint-disable @typescript-eslint/no-explicit-any */
	let selected: any[] = props.selected ?? [];
	let sorts: any[] = props.sorts ?? [];
	let filters: any[] = props.filters ?? [];
	let active: any[] = props.active ?? [];
	let cards: any[] = props.cards ?? [];
	let comments: any[] = props.comments ?? [];
	let members: any[] = props.members ?? [];
	let invites: any[] = props.invites ?? [];
	let entries: any[] = props.entries ?? [];
	let folderId: string | null = props.folderId ?? null;
	let uploads: any[] = props.uploads ?? [];
	let events: any[] = props.events ?? [];
	let expanded: string[] = props.expanded ?? [];
	let treeSelected: string | null = props.selectedNode ?? null;
	$: items = props.items ?? [];
	let focused = props.focused ?? '';
	let selectedDay = props.selectedDay ?? '';
	/* eslint-enable @typescript-eslint/no-explicit-any */

	$: state = JSON.stringify({
		selected,
		sorts,
		filters,
		active,
		cards,
		comments,
		members,
		invites,
		entries,
		folderId,
		uploads,
		events,
		expanded,
		treeSelected,
		focused,
		selectedDay
	});

	const rest = (): any => {
		const {
			selected: _a,
			sorts: _b,
			filters: _c,
			active: _d,
			cards: _e,
			comments: _f,
			members: _g,
			invites: _h,
			entries: _i,
			folderId: _j,
			uploads: _k,
			events: _l,
			expanded: _m,
			selectedNode: _n,
			focused: _o,
			selectedDay: _p,
			...others
		} = props;
		return others;
	};
	$: other = rest();
</script>

{#if which === 'grid'}
	<DataGrid
		{...other}
		bind:selected
		bind:sorts
		bind:filters
		on:sort={(e) => onEvent('sort', e.detail)}
		on:filter={(e) => onEvent('filter', e.detail)}
		on:pagechange={(e) => onEvent('pagechange', e.detail)}
		on:selection={(e) => onEvent('selection', e.detail)}
		on:rowaction={(e) => onEvent('rowaction', e.detail)}
		on:bulkaction={(e) => onEvent('bulkaction', e.detail)}
		on:export={(e) => onEvent('export', e.detail)}
		on:retry={() => onEvent('retry', null)}
	/>
{:else if which === 'filterbar'}
	<FilterBar
		{...other}
		bind:active
		on:change={(e) => onEvent('change', e.detail)}
		on:clear={() => onEvent('clear', null)}
	/>
{:else if which === 'kanban'}
	<KanbanBoard
		{...other}
		bind:cards
		on:change={(e) => onEvent('change', e.detail)}
		on:move={(e) => onEvent('move', e.detail)}
		on:add={(e) => onEvent('add', e.detail)}
		on:remove={(e) => onEvent('remove', e.detail)}
	/>
{:else if which === 'feed'}
	<ActivityFeed
		{...other}
		{items}
		on:loadmore={() => onEvent('loadmore', null)}
		on:retry={() => onEvent('retry', null)}
	/>
{:else if which === 'thread'}
	<CommentThread
		{...other}
		bind:comments
		on:post={(e) => onEvent('post', e.detail)}
		on:edit={(e) => onEvent('edit', e.detail)}
		on:delete={(e) => onEvent('delete', e.detail)}
		on:react={(e) => onEvent('react', e.detail)}
	/>
{:else if which === 'team'}
	<TeamMembers
		{...other}
		bind:members
		bind:invites
		on:rolechange={(e) => onEvent('rolechange', e.detail)}
		on:remove={(e) => onEvent('remove', e.detail)}
		on:invite={(e) => onEvent('invite', e.detail)}
		on:resend={(e) => onEvent('resend', e.detail)}
		on:revoke={(e) => onEvent('revoke', e.detail)}
	/>
{:else if which === 'files'}
	<FileManager
		{...other}
		bind:entries
		bind:folderId
		bind:uploads
		bind:selected
		on:open={(e) => onEvent('open', e.detail)}
		on:navigate={(e) => onEvent('navigate', e.detail)}
		on:upload={(e) => onEvent('upload', e.detail)}
		on:cancelupload={(e) => onEvent('cancelupload', e.detail)}
		on:rename={(e) => onEvent('rename', e.detail)}
		on:delete={(e) => onEvent('delete', e.detail)}
		on:createfolder={(e) => onEvent('createfolder', e.detail)}
	/>
{:else if which === 'calendar'}
	<CalendarSchedule
		{...other}
		bind:events
		bind:focused
		bind:selected={selectedDay}
		on:select={(e) => onEvent('select', e.detail)}
		on:monthchange={(e) => onEvent('monthchange', e.detail)}
		on:add={(e) => onEvent('add', e.detail)}
		on:update={(e) => onEvent('update', e.detail)}
		on:remove={(e) => onEvent('remove', e.detail)}
	/>
{:else if which === 'tree'}
	<TreeView
		{...other}
		bind:expanded
		bind:selected={treeSelected}
		on:select={(e) => onEvent('select', e.detail)}
		on:toggle={(e) => onEvent('toggle', e.detail)}
	/>
{:else if which === 'audit'}
	<AuditLog
		{...other}
		events={props.events ?? []}
		on:filter={(e) => onEvent('filter', e.detail)}
		on:export={(e) => onEvent('export', e.detail)}
		on:toggle={(e) => onEvent('toggle', e.detail)}
		on:retry={() => onEvent('retry', null)}
	/>
{/if}

<pre data-testid="state" hidden>{state}</pre>
