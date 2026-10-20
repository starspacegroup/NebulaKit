<!--
	Fills the overlay components' slots so their tests can render them the way
	a page would, and reports component events through `onEvent`. A callback
	prop works the same under Svelte 4 and 5; the testing-library event APIs
	do not.
-->
<script lang="ts">
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Command from '$lib/ui/Command.svelte';
	import ContextMenu from '$lib/ui/ContextMenu.svelte';
	import DropdownMenu from '$lib/ui/DropdownMenu.svelte';
	import HoverCard from '$lib/ui/HoverCard.svelte';
	import Menubar from '$lib/ui/Menubar.svelte';
	import Popover from '$lib/ui/Popover.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';

	export let which:
		| 'popover'
		| 'hover-card'
		| 'sheet'
		| 'alert-dialog'
		| 'context-menu'
		| 'command'
		| 'menubar'
		| 'dropdown-menu';
	export let open = false;
	export let props: Record<string, unknown> = {};
	// `any` so each test can type the detail it expects.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let onEvent: (name: string, detail: any) => void = () => {};
</script>

{#if which === 'popover'}
	<Popover
		bind:open
		title="Share"
		{...props}
		on:open={() => onEvent('open', null)}
		on:close={() => onEvent('close', null)}
	>
		<button slot="trigger" type="button">Share</button>
		<input aria-label="Link" value="https://example.com" />
		<button type="button">Copy</button>
	</Popover>
	<button type="button">Elsewhere</button>
{:else if which === 'hover-card'}
	<HoverCard bind:open {...props}>
		<a slot="trigger" href="/people/ada">@ada</a>
		<p>Ada Lovelace</p>
		<a href="/people/ada/posts">Posts</a>
	</HoverCard>
	<button type="button">Elsewhere</button>
{:else if which === 'sheet'}
	<button type="button" on:click={() => (open = true)}>Open</button>
	<Sheet
		bind:open
		title="Settings"
		description="Changes save as you go."
		{...props}
		on:close={() => onEvent('close', null)}
	>
		<p>Body</p>
		<svelte:fragment slot="actions"
			><button type="button" on:click={() => (open = false)}>Done</button></svelte:fragment
		>
	</Sheet>
	<span data-testid="state">{open}</span>
{:else if which === 'alert-dialog'}
	<AlertDialog
		bind:open
		title="Delete project?"
		description="This cannot be undone."
		confirmLabel="Delete"
		tone="danger"
		{...props}
		on:confirm={() => onEvent('confirm', null)}
		on:cancel={() => onEvent('cancel', null)}
	/>
	<span data-testid="state">{open}</span>
{:else if which === 'context-menu'}
	<ContextMenu items={[]} {...props} on:select={(e) => onEvent('select', e.detail)}>
		<button type="button" data-testid="target">report.pdf</button>
	</ContextMenu>
{:else if which === 'command'}
	<Command bind:open items={[]} {...props} on:select={(e) => onEvent('select', e.detail)} />
	<span data-testid="state">{open}</span>
{:else if which === 'menubar'}
	<Menubar menus={[]} {...props} on:select={(e) => onEvent('select', e.detail)} />
{:else if which === 'dropdown-menu'}
	<DropdownMenu
		label="View"
		{...props}
		on:select={(e) => onEvent('select', e.detail)}
		on:change={(e) => onEvent('change', e.detail)}
	/>
{/if}
