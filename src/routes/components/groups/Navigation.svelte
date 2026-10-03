<!-- /components demos: Navigation. -->
<script lang="ts">
	import {
		Accordion,
		Breadcrumbs,
		Button,
		Menubar,
		NavigationMenu,
		Pagination,
		Sidebar,
		Stepper,
		Tabs,
		toast
	} from '$lib/ui';
	import CatalogItem from '../CatalogItem.svelte';

	let tab = 'overview';
	let page = 3;

	// The sidebar demo navigates in place (items without href report on:select),
	// so trying it does not leave the catalog.
	let sidebarCurrent = 'inbox';
	let sidebarCollapsed = false;
	let step = 2;
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
<CatalogItem id="menubar">
	<Menubar
		label="Editor"
		menus={[
			{
				id: 'file',
				label: 'File',
				items: [
					{ id: 'new', label: 'New file', shortcut: '⌘N' },
					{ id: 'open', label: 'Open…', shortcut: '⌘O' },
					{ id: 'save', label: 'Save', shortcut: '⌘S' },
					{ separator: true },
					{ id: 'close', label: 'Close window', shortcut: '⌘W' }
				]
			},
			{
				id: 'edit',
				label: 'Edit',
				items: [
					{ id: 'undo', label: 'Undo', shortcut: '⌘Z' },
					{ id: 'redo', label: 'Redo', shortcut: '⇧⌘Z', disabled: true },
					{ separator: true },
					{ id: 'cut', label: 'Cut', shortcut: '⌘X' },
					{ id: 'copy', label: 'Copy', shortcut: '⌘C' },
					{ id: 'paste', label: 'Paste', shortcut: '⌘V' }
				]
			},
			{
				id: 'view',
				label: 'View',
				items: [
					{ id: 'zoom-in', label: 'Zoom in', shortcut: '⌘+' },
					{ id: 'zoom-out', label: 'Zoom out', shortcut: '⌘−' },
					{ id: 'fullscreen', label: 'Full screen', shortcut: 'F11' }
				]
			}
		]}
		on:select={(e) => toast.info(`${e.detail.menu} → ${e.detail.id}`)}
	/>
</CatalogItem>
<CatalogItem id="sidebar">
	<div class="sidebar-demo">
		<Sidebar
			label="Demo app"
			bind:collapsed={sidebarCollapsed}
			current={sidebarCurrent}
			breakpoint={480}
			sections={[
				{
					heading: 'Workspace',
					items: [
						{ id: 'home', label: 'Home', icon: '⌂' },
						{ id: 'inbox', label: 'Inbox', icon: '✉', badge: 3 },
						{ id: 'projects', label: 'Projects', icon: '▦', badge: 12 }
					]
				},
				{
					heading: 'Account',
					items: [
						{
							id: 'settings',
							label: 'Settings',
							icon: '⚙',
							children: [
								{ id: 'profile', label: 'Profile' },
								{ id: 'billing', label: 'Billing' },
								{ id: 'team', label: 'Team' }
							]
						},
						{ id: 'help', label: 'Help', icon: '?' }
					]
				}
			]}
			on:select={(e) => (sidebarCurrent = e.detail.id)}
		>
			<strong slot="header">{sidebarCollapsed ? 'A' : 'Acme'}</strong>
		</Sidebar>
		<p class="note">
			Showing <strong>{sidebarCurrent}</strong>. Collapse it to icons with the button at the bottom;
			on a phone it opens from a Menu button.
		</p>
	</div>
</CatalogItem>
<CatalogItem id="navigation-menu">
	<NavigationMenu
		label="Demo site"
		current="/components"
		items={[
			{ id: 'home', label: 'Home', href: '/' },
			{
				id: 'product',
				label: 'Product',
				links: [
					{ label: 'Components', href: '/components', description: 'Every element, running' },
					{ label: 'Features', href: '/features', description: 'What the kit gives you' },
					{ label: 'Pricing', href: '/pricing', description: 'Free and open source' }
				]
			},
			{
				id: 'learn',
				label: 'Learn',
				links: [
					{
						label: 'Documentation',
						href: '/documentation',
						description: 'Set up, theme and deploy'
					},
					{ label: 'Quick reference', href: '/documentation#reference' }
				]
			}
		]}
	/>
</CatalogItem>
<CatalogItem id="stepper">
	<div class="stack">
		<Stepper
			current={step}
			clickable
			on:select={(e) => (step = e.detail.index)}
			steps={[
				{ label: 'Account', description: 'Name and email' },
				{ label: 'Plan', description: 'Pro, monthly' },
				{ label: 'Payment', description: 'Card details' },
				{ label: 'Done' }
			]}
		/>
		<Stepper
			orientation="vertical"
			current={1}
			steps={[
				{ label: 'Build', description: '42 s' },
				{ label: 'Deploy', description: 'Upload failed', error: true },
				{ label: 'Verify' }
			]}
		/>
		<div class="row">
			<Button variant="secondary" size="sm" disabled={step === 0} on:click={() => (step -= 1)}
				>Back</Button
			>
			<Button size="sm" disabled={step === 3} on:click={() => (step += 1)}>Next</Button>
		</div>
	</div>
</CatalogItem>

<style>
	.sidebar-demo {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: start;
		gap: var(--spacing-md);
		height: 22rem;
	}

	.sidebar-demo :global(.sidebar) {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	@media (max-width: 480px) {
		.sidebar-demo {
			grid-template-columns: 1fr;
			height: auto;
		}
	}
</style>
