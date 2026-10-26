<!-- /components demos: Overlays. -->
<script lang="ts">
	import {
		AlertDialog,
		Avatar,
		Button,
		Checkbox,
		ContextMenu,
		Dialog,
		HoverCard,
		Kbd,
		Popover,
		Select,
		Sheet,
		TextInput,
		Tooltip,
		toast
	} from '$lib/ui';
	import CatalogItem from '../CatalogItem.svelte';

	let dialogOpen = false;

	// Popover
	let shareOpen = false;
	const shareLink = 'https://nebulakit.dev/p/aurora';

	// Sheet
	let sheetOpen = false;
	let drawerOpen = false;
	let sheetSide: 'left' | 'right' | 'top' | 'bottom' = 'right';

	// AlertDialog
	let alertOpen = false;
</script>

<CatalogItem id="dialog">
	<Button variant="danger" on:click={() => (dialogOpen = true)}>Delete project…</Button>
	<Dialog
		bind:open={dialogOpen}
		title="Delete project?"
		description="The project and its deploys go for good. This cannot be undone."
	>
		<svelte:fragment slot="actions">
			<Button variant="secondary" on:click={() => (dialogOpen = false)}>Cancel</Button>
			<Button
				variant="danger"
				on:click={() => {
					dialogOpen = false;
					toast.danger('Project deleted (not really)');
				}}>Delete</Button
			>
		</svelte:fragment>
	</Dialog>
</CatalogItem>
<CatalogItem id="tooltip">
	<Tooltip text="Copies the link to your clipboard">
		<Button variant="secondary">Copy link</Button>
	</Tooltip>
	<Tooltip text="Below, for controls near the top of the page" placement="bottom">
		<Button variant="ghost">Below</Button>
	</Tooltip>
</CatalogItem>
<CatalogItem id="popover">
	<Popover title="Share this project" align="start" bind:open={shareOpen}>
		<Button slot="trigger" variant="secondary">Share…</Button>
		<TextInput label="Public link" value={shareLink} readonly />
		<Button
			size="sm"
			on:click={() => {
				navigator.clipboard?.writeText(shareLink);
				shareOpen = false;
				toast.success('Link copied');
			}}>Copy link</Button
		>
	</Popover>
	<Popover label="Keyboard tips" placement="top">
		<Button slot="trigger" variant="ghost">Tips</Button>
		<p>Press <Kbd keys={['Esc']} /> to close and return to the button.</p>
	</Popover>
</CatalogItem>

<CatalogItem id="hover-card">
	<p>
		Built by
		<HoverCard>
			<a slot="trigger" href="https://en.wikipedia.org/wiki/Ada_Lovelace">@ada</a>
			<div style="display: flex; gap: var(--spacing-md); align-items: center">
				<Avatar name="Ada Lovelace" />
				<div>
					<strong>Ada Lovelace</strong>
					<p style="margin: 0; color: var(--color-text-secondary)">Mathematician · London</p>
				</div>
			</div>
			<p style="margin: 0">Wrote the first published algorithm meant for a machine.</p>
		</HoverCard>
		— hover or tab to the name.
	</p>
</CatalogItem>

<CatalogItem id="sheet">
	<Button variant="secondary" on:click={() => ((sheetSide = 'right'), (sheetOpen = true))}
		>Filters</Button
	>
	<Button variant="secondary" on:click={() => ((sheetSide = 'left'), (sheetOpen = true))}
		>From the left</Button
	>
	<Button variant="ghost" on:click={() => (drawerOpen = true)}>Bottom drawer</Button>
	<Sheet
		bind:open={sheetOpen}
		side={sheetSide}
		title="Filters"
		description="Narrow the project list. Changes apply when you press Apply."
	>
		<Checkbox label="Only projects I own" checked />
		<Checkbox label="Include archived" />
		<Select
			label="Region"
			options={[
				{ value: 'any', label: 'Any region' },
				{ value: 'eu', label: 'Europe' },
				{ value: 'us', label: 'United States' }
			]}
		/>
		<svelte:fragment slot="actions">
			<Button variant="secondary" on:click={() => (sheetOpen = false)}>Cancel</Button>
			<Button
				on:click={() => {
					sheetOpen = false;
					toast.success('Filters applied');
				}}>Apply</Button
			>
		</svelte:fragment>
	</Sheet>
	<Sheet bind:open={drawerOpen} side="bottom" title="Share to…">
		<div style="display: flex; flex-wrap: wrap; gap: var(--spacing-sm)">
			<Button variant="secondary" on:click={() => (drawerOpen = false)}>Copy link</Button>
			<Button variant="secondary" on:click={() => (drawerOpen = false)}>Email</Button>
			<Button variant="secondary" on:click={() => (drawerOpen = false)}>Embed</Button>
		</div>
	</Sheet>
</CatalogItem>

<CatalogItem id="alert-dialog">
	<Button variant="danger" on:click={() => (alertOpen = true)}>Delete project…</Button>
	<AlertDialog
		bind:open={alertOpen}
		title="Delete “Aurora”?"
		description="The project, its deploys and its domains go for good. This cannot be undone."
		confirmLabel="Delete project"
		cancelLabel="Keep it"
		tone="danger"
		on:confirm={() => toast.danger('Project deleted (not really)')}
		on:cancel={() => toast.info('Kept')}
	/>
</CatalogItem>

<CatalogItem id="context-menu">
	<ContextMenu
		label="File actions"
		items={[
			{ id: 'open', label: 'Open', shortcut: '↵' },
			{ id: 'rename', label: 'Rename', shortcut: 'F2' },
			{ id: 'duplicate', label: 'Duplicate', shortcut: '⌘D' },
			{ id: 'share', label: 'Share', disabled: true },
			{ separator: true },
			{ id: 'delete', label: 'Move to trash', shortcut: '⌫', danger: true }
		]}
		on:select={(e) => toast.info(`“${e.detail.id}” on report.pdf`)}
	>
		<button
			type="button"
			style="width: 100%; padding: var(--spacing-xl); border: 2px dashed var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-text); font: inherit; cursor: context-menu"
		>
			📄 report.pdf — right-click, or focus and press Shift+F10
		</button>
	</ContextMenu>
</CatalogItem>
