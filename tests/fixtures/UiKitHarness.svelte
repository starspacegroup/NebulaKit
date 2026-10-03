<!--
	Fills the UI kit's slots so its tests can render the components the way a
	page would, and reports component events through `onEvent`. A callback prop
	works the same under Svelte 4 and 5; the testing-library event APIs do not.
-->
<script lang="ts">
	import {
		Accordion,
		Alert,
		Button,
		Card,
		Dialog,
		EmptyState,
		Menu,
		Pagination,
		Tabs,
		Tooltip
	} from '$lib/ui';
	import ClockWidget from '$lib/widgets/ClockWidget.svelte';

	export let which:
		| 'button'
		| 'pagination'
		| 'menu'
		| 'clock'
		| 'tabs'
		| 'dialog'
		| 'tooltip'
		| 'card'
		| 'empty'
		| 'alert'
		| 'accordion';
	export let open = false;
	export let active = 'one';
	export let props: Record<string, unknown> = {};
	// `any` so each test can type the detail it expects.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let onEvent: (name: string, detail: any) => void = () => {};
</script>

{#if which === 'button'}
	<Button {...props} on:click={() => onEvent('click', null)}>Go</Button>
{:else if which === 'pagination'}
	<Pagination page={1} total={20} {...props} on:change={(e) => onEvent('change', e.detail)} />
{:else if which === 'menu'}
	<Menu label="Actions" items={[]} {...props} on:select={(e) => onEvent('select', e.detail)} />
{:else if which === 'clock'}
	<ClockWidget {...props} on:live={(e) => onEvent('live', e.detail)} />
{:else if which === 'tabs'}
	<Tabs
		tabs={[
			{ id: 'one', label: 'One' },
			{ id: 'two', label: 'Two', disabled: true },
			{ id: 'three', label: 'Three' }
		]}
		bind:active
		let:active={current}
	>
		<p data-testid="panel">Panel {current}</p>
	</Tabs>
{:else if which === 'dialog'}
	<button type="button" on:click={() => (open = true)}>Open</button>
	<Dialog bind:open title="Delete file?" description="This cannot be undone.">
		<p>Body</p>
		<svelte:fragment slot="actions"
			><Button on:click={() => (open = false)}>Cancel</Button></svelte:fragment
		>
	</Dialog>
	<span data-testid="state">{open}</span>
{:else if which === 'tooltip'}
	<Tooltip text="Copies the link"><button type="button">Copy</button></Tooltip>
{:else if which === 'card'}
	<Card title="Plan" level={2}>
		<p>Body text</p>
		<svelte:fragment slot="footer"><Button>Go</Button></svelte:fragment>
	</Card>
	<Card title="Linked" href="/somewhere">Linked body</Card>
{:else if which === 'empty'}
	<EmptyState title="No projects" description="Make your first one." icon="✨">
		<Button>New project</Button>
	</EmptyState>
{:else if which === 'alert'}
	<Alert tone="danger" title="Failed" dismissible>Could not save.</Alert>
	<Alert tone="success">Saved.</Alert>
{:else if which === 'accordion'}
	<Accordion
		exclusive
		items={[
			{ title: 'First', content: 'A', open: true },
			{ title: 'Second', content: 'B' }
		]}
	/>
{/if}
