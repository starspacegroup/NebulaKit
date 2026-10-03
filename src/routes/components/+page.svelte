<!--
	/components — every standard element and widget in the kit, running.

	Each demo is the real component from $lib/ui or $lib/widgets, with the code
	that produced it underneath. The list comes from $lib/ui/catalog.ts, and a
	test fails if a component or widget is added without an entry there.
-->
<script lang="ts">
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import { site } from '$lib/site.config';
	import {
		Accordion,
		Alert,
		Avatar,
		Badge,
		Breadcrumbs,
		Button,
		Card,
		Checkbox,
		Dialog,
		EmptyState,
		Field,
		Kbd,
		Menu,
		Pagination,
		Progress,
		RadioGroup,
		Select,
		Skeleton,
		Slider,
		Spinner,
		Switch,
		Table,
		Tabs,
		Textarea,
		TextInput,
		Tooltip,
		toast
	} from '$lib/ui';
	import { CATALOG_GROUPS, catalog } from '$lib/ui/catalog';
	import ChecklistWidget from '$lib/widgets/ChecklistWidget.svelte';
	import ClockWidget from '$lib/widgets/ClockWidget.svelte';
	import LinksWidget from '$lib/widgets/LinksWidget.svelte';
	import MeterWidget from '$lib/widgets/MeterWidget.svelte';
	import NotesWidget from '$lib/widgets/NotesWidget.svelte';
	import StatWidget from '$lib/widgets/StatWidget.svelte';
	import CatalogItem from './CatalogItem.svelte';

	const groupId = (group: string) => group.toLowerCase().replace(/\s+/g, '-');
	const inGroup = (group: string) => catalog.filter((e) => e.group === group);

	let loading = false;
	let lastAction = '';
	let email = '';
	let bio = '';
	let plan = '';
	let agree = true;
	let partial = true;
	let billing = 'monthly';
	let notify = true;
	let volume = 40;
	let dialogOpen = false;
	let tab = 'overview';
	let page = 3;
	let colour = '#3b82f6';

	$: emailError = email && !email.includes('@') ? 'That does not look like an email address.' : '';

	function fakeSave() {
		loading = true;
		setTimeout(() => {
			loading = false;
			toast.success('Saved');
		}, 1200);
	}

	const deploys = [
		{ branch: 'main', status: 'Live', minutes: 2.4 },
		{ branch: 'feature/search', status: 'Preview', minutes: 3.1 },
		{ branch: 'fix/login', status: 'Failed', minutes: 0.8 },
		{ branch: 'docs', status: 'Preview', minutes: 1.2 }
	];
</script>

<SharingMeta
	title="Components"
	description={`Every standard element and widget in ${site.name}, running: forms, buttons, dialogs, tabs, tables, toasts and dashboard widgets, with the code for each.`}
	url={`${site.url}/components`}
/>

<div class="catalog">
	<header class="catalog__header">
		<p class="eyebrow">Component catalog</p>
		<h1>Every standard element, running</h1>
		<p class="lede">
			{catalog.filter((e) => e.group !== 'Widgets').length} elements and
			{inGroup('Widgets').length} widgets, all themed with CSS variables, all usable by keyboard, all
			in light and dark. Import from <code>$lib/ui</code>; register widgets in
			<code>$lib/widgets</code>.
		</p>
		<nav aria-label="Catalog sections" class="catalog__nav">
			{#each CATALOG_GROUPS as group (group)}
				<a href="#{groupId(group)}">{group} <span>{inGroup(group).length}</span></a>
			{/each}
		</nav>
	</header>

	{#each CATALOG_GROUPS as group (group)}
		<section class="group" id={groupId(group)} aria-labelledby="{groupId(group)}-title">
			<h2 id="{groupId(group)}-title">{group}</h2>
			<div class="grid">
				{#if group === 'Actions'}
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
				{:else if group === 'Forms'}
					<CatalogItem id="text-input">
						<div class="stack">
							<TextInput
								label="Email"
								type="email"
								bind:value={email}
								placeholder="you@example.com"
								hint="Type something without an @ to see the error."
								error={emailError}
								required
							/>
						</div>
					</CatalogItem>
					<CatalogItem id="textarea">
						<div class="stack">
							<Textarea label="Bio" bind:value={bio} maxlength={160} rows={3} />
						</div>
					</CatalogItem>
					<CatalogItem id="select">
						<div class="stack">
							<Select
								label="Plan"
								bind:value={plan}
								placeholder="Choose a plan"
								options={[
									{ value: 'free', label: 'Free' },
									{ value: 'pro', label: 'Pro' },
									{ value: 'team', label: 'Team', disabled: true }
								]}
							/>
						</div>
					</CatalogItem>
					<CatalogItem id="checkbox">
						<div class="stack">
							<Checkbox label="Email me updates" hint="About once a month." bind:checked={agree} />
							<Checkbox
								label="Select all (some selected)"
								indeterminate={partial}
								on:change={() => (partial = false)}
							/>
							<Checkbox label="Disabled" disabled />
						</div>
					</CatalogItem>
					<CatalogItem id="radio-group">
						<RadioGroup
							legend="Billing"
							bind:value={billing}
							inline
							options={[
								{ value: 'monthly', label: 'Monthly' },
								{ value: 'yearly', label: 'Yearly', hint: 'Two months free' },
								{ value: 'lifetime', label: 'Lifetime', disabled: true }
							]}
						/>
					</CatalogItem>
					<CatalogItem id="switch">
						<Switch label="Notifications" bind:checked={notify} />
						<Switch label="Disabled" disabled />
					</CatalogItem>
					<CatalogItem id="slider">
						<div class="stack"><Slider label="Volume" bind:value={volume} unit="%" /></div>
					</CatalogItem>
					<CatalogItem id="field">
						<div class="stack">
							<Field
								label="Accent colour"
								hint="Any colour; this one is native."
								let:id
								let:describedBy
							>
								<input {id} type="color" bind:value={colour} aria-describedby={describedBy} />
							</Field>
						</div>
					</CatalogItem>
				{:else if group === 'Feedback'}
					<CatalogItem id="alert">
						<div class="stack">
							<Alert tone="info" title="Heads up">A new version is available.</Alert>
							<Alert tone="success">Your changes were saved.</Alert>
							<Alert tone="warning" title="Trial ends soon" dismissible>Three days left.</Alert>
							<Alert tone="danger" title="Payment failed">Check your card details.</Alert>
						</div>
					</CatalogItem>
					<CatalogItem id="toaster">
						<Button variant="secondary" on:click={() => toast.info('Heads up')}>Info</Button>
						<Button variant="secondary" on:click={() => toast.success('Saved')}>Success</Button>
						<Button variant="secondary" on:click={() => toast.warning('Almost full')}
							>Warning</Button
						>
						<Button variant="secondary" on:click={() => toast.danger('Could not connect', 0)}>
							Sticky error
						</Button>
					</CatalogItem>
					<CatalogItem id="badge">
						<Badge>Draft</Badge>
						<Badge tone="info">Preview</Badge>
						<Badge tone="success">Live</Badge>
						<Badge tone="warning">Degraded</Badge>
						<Badge tone="danger">Failed</Badge>
					</CatalogItem>
					<CatalogItem id="progress">
						<div class="stack">
							<Progress label="Uploading" value={volume} />
							<Progress label="Quota" value={92} tone="warning" />
							<Progress label="Working on it" />
						</div>
					</CatalogItem>
					<CatalogItem id="spinner">
						<Spinner size="sm" />
						<Spinner />
						<Spinner size="lg" label="Loading the report" />
					</CatalogItem>
					<CatalogItem id="skeleton">
						<div class="row">
							<Skeleton shape="circle" height="3rem" />
							<div class="grow"><Skeleton lines={3} /></div>
						</div>
					</CatalogItem>
				{:else if group === 'Overlays'}
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
				{:else if group === 'Navigation'}
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
				{:else if group === 'Data display'}
					<CatalogItem id="card">
						<div class="cards">
							<Card title="Pro plan">
								Everything in Free, plus custom domains and priority support.
								<svelte:fragment slot="header"><Badge tone="info">Popular</Badge></svelte:fragment>
								<svelte:fragment slot="footer"><Button size="sm">Upgrade</Button></svelte:fragment>
							</Card>
							<Card title="A whole-card link" href="#card">The entire card is one link target.</Card
							>
						</div>
					</CatalogItem>
					<CatalogItem id="table">
						<div class="stack">
							<Table
								caption="Recent deploys"
								rows={deploys}
								columns={[
									{ key: 'branch', label: 'Branch', sortable: true },
									{ key: 'status', label: 'Status', sortable: true },
									{ key: 'minutes', label: 'Minutes', sortable: true, align: 'end' }
								]}
							/>
						</div>
					</CatalogItem>
					<CatalogItem id="avatar">
						<Avatar name="Ada Lovelace" size="sm" />
						<Avatar name="Grace Hopper" />
						<Avatar name="Alan Turing" size="lg" />
					</CatalogItem>
					<CatalogItem id="kbd">
						<Kbd keys={['Ctrl', 'K']} />
						<Kbd keys={['⌘', 'Shift', 'P']} />
						<Kbd>Esc</Kbd>
					</CatalogItem>
					<CatalogItem id="empty-state">
						<div class="stack">
							<EmptyState
								icon="✨"
								title="No projects yet"
								description="Projects you create show up here."
							>
								<Button size="sm">New project</Button>
							</EmptyState>
						</div>
					</CatalogItem>
				{:else if group === 'Widgets'}
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
				{/if}
			</div>
			{#if group === 'Widgets'}
				<p class="note note--after">
					Widgets render inside the drag-and-drop <code>&lt;WidgetBoard&gt;</code>. Each is one
					manifest entry and one registry line in <code>$lib/widgets</code>; see the documentation
					for the board.
				</p>
			{/if}
		</section>
	{/each}
</div>

<style>
	.catalog {
		width: 100%;
		max-width: 90rem;
		margin: 0 auto;
		padding: var(--spacing-2xl) var(--spacing-md);
		box-sizing: border-box;
	}

	@media (min-width: 768px) {
		.catalog {
			padding-inline: var(--spacing-xl);
		}
	}

	.catalog__header {
		max-width: 48rem;
		margin-bottom: var(--spacing-2xl);
	}

	.eyebrow {
		margin: 0 0 var(--spacing-sm);
		color: var(--color-primary);
		font-size: 0.8125rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0 0 var(--spacing-md);
		font-size: clamp(2rem, 5vw, 3rem);
		line-height: 1.1;
		letter-spacing: -0.02em;
	}

	.lede {
		margin: 0 0 var(--spacing-lg);
		color: var(--color-text-secondary);
		font-size: 1.125rem;
		line-height: 1.6;
	}

	.catalog__nav {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.catalog__nav a {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
		padding: 0.375rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		color: var(--color-text);
		font-size: 0.875rem;
		text-decoration: none;
	}

	.catalog__nav a:hover {
		border-color: var(--color-primary);
	}

	.catalog__nav span {
		color: var(--color-text-secondary);
		font-variant-numeric: tabular-nums;
	}

	.group {
		margin-bottom: var(--spacing-2xl);
		scroll-margin-top: 5rem;
	}

	h2 {
		margin: 0 0 var(--spacing-lg);
		padding-bottom: var(--spacing-sm);
		border-bottom: 1px solid var(--color-border);
		font-size: 1.5rem;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 26rem), 1fr));
		gap: var(--spacing-lg);
	}

	.stack {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		width: 100%;
	}

	.row {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		width: 100%;
	}

	.grow {
		flex: 1;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
		gap: var(--spacing-md);
		width: 100%;
	}

	.widget {
		width: 100%;
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
	}

	.note {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.9375rem;
	}

	.note--after {
		margin-top: var(--spacing-lg);
	}

	input[type='color'] {
		width: 4rem;
		height: 2.5rem;
		padding: 0.125rem;
	}
</style>
