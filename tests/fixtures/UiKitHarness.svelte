<!-- Fills the UI kit's slots so its tests can render the components the way a page would. -->
<script lang="ts">
	import { Button, Card, Dialog, EmptyState, Tabs, Tooltip, Alert, Accordion } from '$lib/ui';

	export let which: 'tabs' | 'dialog' | 'tooltip' | 'card' | 'empty' | 'alert' | 'accordion';
	export let open = false;
	export let active = 'one';
</script>

{#if which === 'tabs'}
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
