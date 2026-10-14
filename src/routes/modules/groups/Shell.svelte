<!-- /modules demos: App shell. Fake local data only; nothing here touches the network. -->
<script lang="ts">
	import {
		AppShell,
		BottomNav,
		ConfirmDialog,
		EmptyStateCard,
		ErrorState,
		GlobalSearch,
		NotificationCenter,
		OnboardingChecklist,
		PageHeader,
		TabsPageNav,
		Toolbar,
		UserMenu,
		Wizard,
		runWizardRules,
		wizardRequiredRule,
		type ErrorKind,
		type EmptyKind,
		type NotificationItem,
		type SearchItem
	} from '$lib/modules/shell';
	import { Alert, Button, TextInput } from '$lib/ui';
	import ModuleItem from '../ModuleItem.svelte';

	const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
	const NOW = Date.UTC(2026, 9, 13, 15, 0, 0);

	// App shell
	let shellWidth: 'full' | 'phone' = 'full';
	let shellCollapsed = false;
	let shellPage = 'Overview';
	const shellLinks = ['Overview', 'Projects', 'Billing', 'Settings'];

	// Page header
	let headerLog = '';

	// Notifications
	let notifications: NotificationItem[] = [
		{
			id: 'n1',
			title: 'Deploy finished',
			body: 'nebulakit-site is live.',
			at: Date.UTC(2026, 9, 13, 14, 20),
			read: false
		},
		{
			id: 'n2',
			title: 'New comment from Glenda',
			body: '“Looks great on mobile.”',
			at: Date.UTC(2026, 9, 13, 9, 5),
			read: false
		},
		{
			id: 'n3',
			title: 'Invoice paid',
			at: Date.UTC(2026, 9, 12, 21, 40),
			read: true
		},
		{
			id: 'n4',
			title: 'Weekly report is ready',
			at: Date.UTC(2026, 9, 8, 8, 0),
			read: true
		}
	];
	let noNotifications: NotificationItem[] = [];
	let notificationLog = '';

	// Search
	const searchItems: SearchItem[] = [
		{ id: 'p-dash', label: 'Dashboard', group: 'Pages', description: 'Your overview' },
		{
			id: 'p-billing',
			label: 'Billing settings',
			group: 'Pages',
			description: 'Plans and invoices'
		},
		{ id: 'p-team', label: 'Team members', group: 'Pages', keywords: ['people', 'invite'] },
		{ id: 'a-invite', label: 'Invite a teammate', group: 'Actions', keywords: ['people', 'add'] },
		{ id: 'a-key', label: 'Create API key', group: 'Actions', keywords: ['token', 'developer'] },
		{
			id: 'a-theme',
			label: 'Switch theme',
			group: 'Actions',
			description: 'Light, dark or system'
		},
		{ id: 'a-locked', label: 'Export audit log', group: 'Actions', disabled: true }
	];
	let searchOpen = false;
	let searchQuery = '';
	let searchRecent: string[] = ['billing'];
	let searchLoading = false;
	let searchResults: SearchItem[] = searchItems;
	let searchPicked = '';
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	function onSearch(event: CustomEvent<{ query: string }>) {
		clearTimeout(searchTimer);
		searchLoading = true;
		const q = event.detail.query;
		searchTimer = setTimeout(() => {
			searchResults = searchItems;
			searchLoading = false;
			void q;
		}, 400);
	}

	// User menu
	let userLog = '';
	const user = { name: 'Ada Lovelace', email: 'ada@example.com' };

	// Checklist
	let checklist = [
		{
			id: 'profile',
			title: 'Complete your profile',
			description: 'Add a photo and a display name so teammates know who you are.',
			done: true,
			actionLabel: 'Open profile',
			href: '#onboarding-checklist'
		},
		{
			id: 'invite',
			title: 'Invite a teammate',
			description: 'Collaboration works better with two.',
			done: false,
			actionLabel: 'Invite',
			href: '#onboarding-checklist'
		},
		{
			id: 'project',
			title: 'Create your first project',
			description: 'Projects keep related work together.',
			done: false,
			actionLabel: 'New project',
			href: '#onboarding-checklist'
		}
	];
	let checklistDismissed = false;
	let checklistExpanded: string | null = 'invite';

	// Wizard
	const wizardSteps = [
		{ id: 'account', label: 'Account', description: 'Who is this for?' },
		{ id: 'plan', label: 'Plan', description: 'Pick what fits.' },
		{ id: 'review', label: 'Review', description: 'One last look.' }
	];
	let wizardName = '';
	let wizardEmail = '';
	let wizardPlan = 'free';
	$: wizardValues = { name: wizardName, email: wizardEmail, plan: wizardPlan };
	function wizardValidate(stepId: string, values: Record<string, unknown>) {
		if (stepId === 'account')
			return runWizardRules(
				{
					name: wizardRequiredRule('Enter your name.'),
					email: (v) =>
						/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v ?? ''))
							? null
							: 'Enter a valid email address.'
				},
				values
			);
		return {};
	}
	$: wizardSummary = [
		{ label: 'Name', value: wizardName || '—' },
		{ label: 'Email', value: wizardEmail || '—' },
		{ label: 'Plan', value: wizardPlan }
	];
	let wizardBusy = false;
	let wizardFinished = '';
	async function wizardFinish() {
		wizardBusy = true;
		await wait(600);
		wizardBusy = false;
		wizardFinished = `Submitted for ${wizardName}.`;
	}

	// Error state
	let errorKind: ErrorKind = '500';
	const errorKinds: ErrorKind[] = ['404', '403', '500', 'offline', 'maintenance'];
	let retrying = false;
	async function retry() {
		retrying = true;
		await wait(800);
		retrying = false;
	}

	// Empty state
	let emptyKind: EmptyKind = 'no-results';
	const emptyKinds: EmptyKind[] = ['no-data', 'no-results', 'first-run'];
	let emptyLog = '';

	// Confirm
	let confirmDialog: ConfirmDialog;
	let confirmResult = '';
	async function askDelete() {
		const ok = await confirmDialog.ask({
			title: 'Delete project “Atlas”?',
			description: 'This removes its files and history. You cannot undo this.',
			confirmLabel: 'Delete project'
		});
		confirmResult = ok ? 'Deleted.' : 'Kept.';
	}

	// Tabs
	let tabsCurrent = '/settings/billing';
	const tabItems = [
		{ id: 'general', label: 'General', href: '/settings/general' },
		{ id: 'members', label: 'Members', href: '/settings/members' },
		{ id: 'billing', label: 'Billing', href: '/settings/billing', badge: 2 },
		{ id: 'security', label: 'Security', href: '/settings/security' },
		{ id: 'integrations', label: 'Integrations', href: '/settings/integrations' },
		{ id: 'audit', label: 'Audit log', href: '/settings/audit' },
		{ id: 'danger', label: 'Danger zone', href: '/settings/danger' }
	];

	// Toolbar
	let toolbarGroups = [
		{
			id: 'text',
			label: 'Text style',
			items: [
				{ id: 'bold', label: 'Bold', icon: 'B', iconOnly: true, pressed: true },
				{ id: 'italic', label: 'Italic', icon: 'I', iconOnly: true, pressed: false },
				{ id: 'underline', label: 'Underline', icon: 'U', iconOnly: true, pressed: false }
			]
		},
		{
			id: 'insert',
			label: 'Insert',
			items: [
				{ id: 'link', label: 'Link', icon: '🔗' },
				{ id: 'image', label: 'Image', icon: '🖼️' },
				{ id: 'table', label: 'Table', icon: '▦' },
				{ id: 'code', label: 'Code block', icon: '</>' }
			]
		},
		{
			id: 'more',
			label: 'History',
			items: [
				{ id: 'undo', label: 'Undo', icon: '↶' },
				{ id: 'redo', label: 'Redo', icon: '↷', disabled: true }
			]
		}
	];
	let toolbarLog = '';

	// Bottom nav
	let bottomCurrent = '/inbox';
	const bottomItems = [
		{ id: 'home', label: 'Home', href: '/home', icon: '🏠' },
		{ id: 'inbox', label: 'Inbox', href: '/inbox', icon: '📥', badge: 3 },
		{ id: 'search', label: 'Search', href: '/search', icon: '🔍' },
		{ id: 'me', label: 'Profile', href: '/me', icon: '👤' }
	];
</script>

<div class="groups">
	<ModuleItem id="app-shell">
		<div class="row" role="group" aria-label="Preview width">
			<Button
				size="sm"
				variant={shellWidth === 'full' ? 'primary' : 'secondary'}
				aria-pressed={shellWidth === 'full'}
				on:click={() => (shellWidth = 'full')}>Full width</Button
			>
			<Button
				size="sm"
				variant={shellWidth === 'phone' ? 'primary' : 'secondary'}
				aria-pressed={shellWidth === 'phone'}
				on:click={() => (shellWidth = 'phone')}>Phone width</Button
			>
		</div>
		<div class="box" class:box--phone={shellWidth === 'phone'}>
			<AppShell bind:collapsed={shellCollapsed} height="22rem" navLabel="Demo navigation">
				<strong slot="brand">Acme</strong>
				<UserMenu slot="header" {user} items={[]} />
				<ul slot="nav" class="shell-nav">
					{#each shellLinks as link}
						<li>
							<a
								href="#app-shell"
								aria-current={shellPage === link ? 'page' : undefined}
								on:click|preventDefault={() => (shellPage = link)}>{link}</a
							>
						</li>
					{/each}
				</ul>
				<h4 class="shell-title">{shellPage}</h4>
				<p>
					Content for {shellPage}. Use the menu button to {shellWidth === 'phone'
						? 'open the off-canvas sidebar'
						: 'collapse the sidebar'}.
				</p>
				<p slot="footer">© Acme 2026</p>
			</AppShell>
		</div>
	</ModuleItem>

	<ModuleItem id="page-header">
		<PageHeader
			title="Projects"
			level={3}
			description="Everything your team is building, in one place."
			breadcrumbs={[
				{ label: 'Home', href: '#page-header' },
				{ label: 'Workspace', href: '#page-header' },
				{ label: 'Projects' }
			]}
			actions={[
				{ id: 'export', label: 'Export', variant: 'secondary' },
				{ id: 'import', label: 'Import', variant: 'secondary' },
				{ id: 'new', label: 'New project', variant: 'primary' }
			]}
			collapseAt={480}
			on:action={(e) => (headerLog = `Action: ${e.detail.id}`)}
		/>
		<p class="log" role="status">{headerLog}</p>
	</ModuleItem>

	<ModuleItem id="notification-center">
		<div class="row">
			<NotificationCenter
				bind:items={notifications}
				now={NOW}
				timeZone="America/Phoenix"
				on:select={(e) => (notificationLog = `Opened ${e.detail.id}`)}
			/>
			<span>With items</span>
			<NotificationCenter bind:items={noNotifications} now={NOW} label="Alerts" />
			<span>Empty</span>
		</div>
		<p class="log" role="status">{notificationLog}</p>
	</ModuleItem>

	<ModuleItem id="global-search">
		<div class="row">
			<GlobalSearch
				bind:open={searchOpen}
				bind:query={searchQuery}
				items={searchResults}
				recent={searchRecent}
				loading={searchLoading}
				on:search={onSearch}
				on:recent={(e) =>
					(searchRecent = [
						e.detail.query,
						...searchRecent.filter((r) => r !== e.detail.query)
					].slice(0, 5))}
				on:select={(e) => (searchPicked = `Picked: ${e.detail.item.label}`)}
			/>
			<span>Or press Ctrl K / ⌘K.</span>
		</div>
		<p class="log" role="status">{searchPicked}</p>
	</ModuleItem>

	<ModuleItem id="user-menu">
		<div class="row end">
			<UserMenu
				{user}
				items={[
					{ id: 'profile', label: 'Profile' },
					{ id: 'settings', label: 'Settings' },
					{ id: 'delete', label: 'Delete account', danger: true }
				]}
				on:select={(e) => (userLog = `Chose ${e.detail.id}`)}
				on:signout={() => (userLog = 'Signed out')}
			/>
		</div>
		<p class="log" role="status">{userLog}</p>
	</ModuleItem>

	<ModuleItem id="onboarding-checklist">
		<OnboardingChecklist
			bind:steps={checklist}
			bind:dismissed={checklistDismissed}
			bind:expanded={checklistExpanded}
			level={4}
		/>
		{#if checklistDismissed}
			<Button
				variant="secondary"
				on:click={() => {
					checklistDismissed = false;
				}}>Show the checklist again</Button
			>
		{/if}
	</ModuleItem>

	<ModuleItem id="step-wizard">
		<Wizard
			steps={wizardSteps}
			values={wizardValues}
			validate={wizardValidate}
			summary={wizardSummary}
			busy={wizardBusy}
			level={4}
			on:finish={wizardFinish}
			let:step
			let:errors
			let:fieldId
		>
			{#if step.id === 'account'}
				<TextInput
					id={fieldId('name')}
					label="Full name"
					bind:value={wizardName}
					error={errors.name}
					required
				/>
				<TextInput
					id={fieldId('email')}
					label="Email"
					type="email"
					bind:value={wizardEmail}
					error={errors.email}
					required
				/>
			{:else if step.id === 'plan'}
				<label class="radio">
					<input type="radio" bind:group={wizardPlan} value="free" /> Free
				</label>
				<label class="radio">
					<input type="radio" bind:group={wizardPlan} value="pro" /> Pro
				</label>
			{:else}
				<p>Check the summary below, then finish.</p>
			{/if}
		</Wizard>
		<p class="log" role="status">{wizardFinished}</p>
	</ModuleItem>

	<ModuleItem id="error-state">
		<div class="row" role="group" aria-label="Error kind">
			{#each errorKinds as kind}
				<Button
					size="sm"
					variant={errorKind === kind ? 'primary' : 'secondary'}
					aria-pressed={errorKind === kind}
					on:click={() => (errorKind = kind)}>{kind}</Button
				>
			{/each}
		</div>
		<ErrorState
			kind={errorKind}
			level={4}
			requestId="req_7f3a91c2"
			homeHref="#error-state"
			{retrying}
			on:retry={retry}
		/>
	</ModuleItem>

	<ModuleItem id="empty-state-card">
		<div class="row" role="group" aria-label="Empty state kind">
			{#each emptyKinds as kind}
				<Button
					size="sm"
					variant={emptyKind === kind ? 'primary' : 'secondary'}
					aria-pressed={emptyKind === kind}
					on:click={() => (emptyKind = kind)}>{kind}</Button
				>
			{/each}
		</div>
		<EmptyStateCard
			kind={emptyKind}
			query="invoice 2019"
			level={4}
			action={{
				id: 'primary',
				label:
					emptyKind === 'no-results'
						? 'Clear filters'
						: emptyKind === 'first-run'
							? 'Create project'
							: 'Add item'
			}}
			secondaryAction={{ id: 'learn', label: 'Learn more' }}
			on:action={(e) => (emptyLog = `Action: ${e.detail.id}`)}
		/>
		<p class="log" role="status">{emptyLog}</p>
	</ModuleItem>

	<ModuleItem id="confirm-dialog">
		<Button variant="danger" on:click={askDelete}>Delete project…</Button>
		<ConfirmDialog bind:this={confirmDialog} />
		<p class="log" role="status">{confirmResult}</p>
	</ModuleItem>

	<ModuleItem id="tabs-page-nav">
		<TabsPageNav
			items={tabItems}
			current={tabsCurrent}
			label="Settings sections"
			badgeWord="alerts"
		/>
		<div class="row">
			<Button size="sm" variant="secondary" on:click={() => (tabsCurrent = '/settings/general')}
				>Go to General</Button
			>
			<Button size="sm" variant="secondary" on:click={() => (tabsCurrent = '/settings/danger')}
				>Go to Danger zone</Button
			>
		</div>
	</ModuleItem>

	<ModuleItem id="action-toolbar">
		<Toolbar
			bind:groups={toolbarGroups}
			label="Editor toolbar"
			on:action={(e) =>
				(toolbarLog = `Action: ${e.detail.id}${e.detail.pressed === undefined ? '' : e.detail.pressed ? ' on' : ' off'}`)}
		/>
		<p class="log" role="status">{toolbarLog}</p>
	</ModuleItem>

	<ModuleItem id="bottom-nav">
		<Alert tone="info"
			>On a phone this sits at the bottom of the screen and hides on wider ones. It is kept visible
			here so you can see it.</Alert
		>
		<div class="phone">
			<BottomNav items={bottomItems} current={bottomCurrent} hideAbove="never" />
		</div>
		<div class="row">
			{#each bottomItems as item}
				<Button size="sm" variant="secondary" on:click={() => (bottomCurrent = item.href)}
					>Select {item.label}</Button
				>
			{/each}
		</div>
	</ModuleItem>
</div>

<style>
	.groups {
		display: contents;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-sm);
		margin-block-end: var(--spacing-sm);
	}

	.row.end {
		justify-content: flex-end;
	}

	.log {
		min-height: 1.5em;
		margin: var(--spacing-sm) 0 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.box {
		min-width: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.box--phone {
		max-width: 22.5rem;
	}

	.shell-nav {
		display: grid;
		gap: var(--spacing-xs);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.shell-nav a {
		display: block;
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius-md);
		color: var(--color-text);
		text-decoration: none;
	}

	.shell-nav a:hover {
		background: var(--color-surface-hover);
	}

	.shell-nav a[aria-current='page'] {
		background: var(--color-surface-hover);
		font-weight: 700;
		box-shadow: inset 3px 0 0 var(--color-primary);
	}

	.shell-title {
		margin: 0 0 var(--spacing-xs);
	}

	.radio {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		min-height: 44px;
	}

	.phone {
		max-width: 24rem;
		margin-block: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}
</style>
