<!-- /components demos: Actions. -->
<script lang="ts">
	import {
		Button,
		ButtonGroup,
		Command,
		DropdownMenu,
		Kbd,
		Menu,
		Toggle,
		ToggleGroup,
		toast
	} from '$lib/ui';
	import CatalogItem from '../CatalogItem.svelte';

	let loading = false;
	let lastAction = '';

	function fakeSave() {
		loading = true;
		setTimeout(() => {
			loading = false;
			toast.success('Saved');
		}, 1200);
	}

	// DropdownMenu
	let viewState: Record<string, boolean | string> = { hidden: false, ext: true, sort: 'name' };

	// Command, inline and as a dialog. The demo opens it from a button only: the
	// site header already owns Ctrl+K for its own palette.
	let paletteOpen = false;
	const commands = [
		{
			id: 'new-project',
			label: 'New project',
			group: 'Projects',
			shortcut: '⌘N',
			keywords: ['create', 'add']
		},
		{
			id: 'import',
			label: 'Import from GitHub',
			group: 'Projects',
			keywords: ['repository', 'clone']
		},
		{
			id: 'deploy',
			label: 'Deploy to production',
			group: 'Projects',
			keywords: ['ship', 'release']
		},
		{
			id: 'settings',
			label: 'Settings',
			group: 'Account',
			shortcut: '⌘,',
			keywords: ['preferences', 'config']
		},
		{ id: 'billing', label: 'Billing', group: 'Account', keywords: ['plan', 'invoice'] },
		{ id: 'team', label: 'Invite teammates', group: 'Account', disabled: true },
		{ id: 'theme', label: 'Toggle theme', group: 'Appearance', keywords: ['dark', 'light'] },
		{ id: 'docs', label: 'Open documentation', group: 'Help', keywords: ['guide', 'manual'] }
	];

	let bold = true;
	let italic = false;
	let pinned = false;
	let align = 'left';
	let styles: string[] = ['b'];

	let groupAlign = 'left';
</script>

<CatalogItem id="button">
	<Button on:click={fakeSave} {loading}>Save</Button>
	<Button variant="secondary">Cancel</Button>
	<Button variant="ghost">Skip</Button>
	<Button variant="danger" size="sm">Delete</Button>
	<Button href="#button" size="lg">A link</Button>
	<Button disabled>Disabled</Button>
</CatalogItem>
<CatalogItem id="menu">
	<Menu
		label="Actions"
		items={[
			{ id: 'edit', label: 'Edit' },
			{ id: 'duplicate', label: 'Duplicate' },
			{ id: 'archive', label: 'Archive', disabled: true },
			{ id: 'delete', label: 'Delete', danger: true }
		]}
		on:select={(e) => (lastAction = e.detail.id)}
	/>
	<span class="note" aria-live="polite">{lastAction ? `Picked: ${lastAction}` : ''}</span>
</CatalogItem>
<CatalogItem id="dropdown-menu">
	<DropdownMenu
		label="View"
		bind:state={viewState}
		groups={[
			{ items: [{ id: 'refresh', label: 'Refresh', shortcut: '⌘R' }] },
			{
				label: 'Show',
				items: [
					{ id: 'hidden', label: 'Hidden files', checkbox: true },
					{ id: 'ext', label: 'File extensions', checkbox: true },
					{ id: 'previews', label: 'Previews', checkbox: true, disabled: true }
				]
			},
			{
				label: 'Sort by',
				radio: 'sort',
				items: [
					{ id: 'name', label: 'Name' },
					{ id: 'modified', label: 'Date modified' },
					{ id: 'size', label: 'Size' }
				]
			},
			{ items: [{ id: 'reset', label: 'Reset view', danger: true }] }
		]}
		on:select={(e) => toast.info(`Ran “${e.detail.id}”`)}
	/>
	<p class="demo-note">
		Hidden files {viewState.hidden ? 'shown' : 'hidden'} · extensions
		{viewState.ext ? 'shown' : 'hidden'} · sorted by {viewState.sort}
	</p>
</CatalogItem>

<CatalogItem id="command">
	<Command
		items={commands}
		placeholder="Search projects, settings, help…"
		on:select={(e) => toast.info(`Ran “${e.detail.id}”`)}
	/>
	<Button variant="secondary" on:click={() => (paletteOpen = true)}>Open as a dialog</Button>
	<Command
		dialog
		bind:open={paletteOpen}
		items={commands}
		on:select={(e) => toast.info(`Ran “${e.detail.id}”`)}
	/>
</CatalogItem>
<CatalogItem id="toggle">
	<div class="row">
		<Toggle bind:pressed={bold} label="Bold"><strong>B</strong></Toggle>
		<Toggle bind:pressed={italic} label="Italic"><em>I</em></Toggle>
		<Toggle bind:pressed={pinned} variant="outline" size="sm">
			{pinned ? 'Pinned' : 'Pin'}
		</Toggle>
		<Toggle disabled label="Locked">🔒</Toggle>
	</div>
</CatalogItem>
<CatalogItem id="toggle-group">
	<div class="stack">
		<ToggleGroup
			label="Text alignment"
			bind:value={align}
			items={[
				{ value: 'left', label: 'Left' },
				{ value: 'center', label: 'Centre' },
				{ value: 'right', label: 'Right' },
				{ value: 'justify', label: 'Justify', disabled: true }
			]}
		/>
		<ToggleGroup
			label="Text style"
			type="multiple"
			variant="default"
			iconOnly
			bind:value={styles}
			items={[
				{ value: 'b', label: 'Bold', icon: 'B' },
				{ value: 'i', label: 'Italic', icon: 'I' },
				{ value: 'u', label: 'Underline', icon: 'U' },
				{ value: 's', label: 'Strikethrough', icon: 'S' }
			]}
		/>
		<p class="note">Aligned {align}; styles: {styles.join(', ') || 'none'}.</p>
	</div>
</CatalogItem>
<CatalogItem id="button-group">
	<div class="stack">
		<ButtonGroup label="Text groupAlignment">
			{#each ['left', 'centre', 'right'] as option (option)}
				<Button
					variant={groupAlign === option ? 'primary' : 'secondary'}
					aria-pressed={groupAlign === option}
					on:click={() => (groupAlign = option)}>{option[0].toUpperCase() + option.slice(1)}</Button
				>
			{/each}
		</ButtonGroup>
		<ButtonGroup label="History" orientation="vertical">
			<Button variant="secondary" size="sm">Undo</Button>
			<Button variant="secondary" size="sm">Redo</Button>
		</ButtonGroup>
	</div>
</CatalogItem>

<style>
	.demo-note {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}
</style>
