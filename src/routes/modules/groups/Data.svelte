<!-- /modules demos: Data. -->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import {
		ActivityFeed,
		AuditLog,
		CalendarSchedule,
		CommentThread,
		DataGrid,
		FileManager,
		FilterBar,
		KanbanBoard,
		TeamMembers,
		TreeView,
		gridView,
		setUploadProgress,
		toColumnFilters,
		type ActiveFilter,
		type AuditEvent,
		type CalendarEvent,
		type FileEntry,
		type FilterDef,
		type KanbanCard,
		type KanbanColumn,
		type TeamInvite,
		type TeamMember,
		type ThreadComment,
		type TreeNode,
		type UploadJob
	} from '$lib/modules';
	import ModuleItem from '../ModuleItem.svelte';

	/** Every demo measures time from this fixed moment, so nothing depends on the clock. */
	const NOW = '2026-10-13T15:00:00Z';

	/* ------------------------------------------------------------ DataGrid */
	const names = [
		'Ada Lovelace',
		'Alan Turing',
		'Grace Hopper',
		'Barbara Liskov',
		'Edsger Dijkstra',
		'Margaret Hamilton',
		'Donald Knuth',
		'Radia Perlman',
		'Linus Torvalds',
		'Katherine Johnson',
		'Dennis Ritchie',
		'Frances Allen'
	];
	const roles = ['Engineer', 'Designer', 'Manager', 'Support'];
	const statuses = ['Active', 'Away', 'Offline'];
	const people = Array.from({ length: 37 }, (_, i) => ({
		id: `p${i + 1}`,
		name: `${names[i % names.length]}${i >= names.length ? ` ${Math.floor(i / names.length) + 1}` : ''}`,
		role: roles[(i * 7) % roles.length],
		status: statuses[(i * 5) % statuses.length],
		commits: ((i * 197) % 1500) + 12,
		joined: `20${15 + (i % 11)}-0${(i % 9) + 1}-1${i % 9}`
	}));
	let gridRows = people;
	let gridSelected: unknown[] = [];
	let gridLoading = false;
	let gridError = '';
	let gridNote = '';
	const gridColumns = [
		{ key: 'name', label: 'Name', sortable: true },
		{
			key: 'role',
			label: 'Role',
			sortable: true,
			filter: 'select' as const,
			options: roles.map((r) => ({ value: r, label: r }))
		},
		{
			key: 'status',
			label: 'Status',
			sortable: true,
			filter: 'select' as const,
			options: statuses.map((s) => ({ value: s, label: s }))
		},
		{
			key: 'commits',
			label: 'Commits',
			sortable: true,
			align: 'end' as const,
			format: (v: unknown) => Number(v).toLocaleString('en-US')
		},
		{ key: 'joined', label: 'Joined', sortable: true, filter: 'text' as const }
	];

	function onBulk(event: CustomEvent<{ action: string; rows: Record<string, unknown>[] }>) {
		if (event.detail.action === 'delete') {
			const gone = event.detail.rows.map((r) => r.id);
			gridRows = gridRows.filter((r) => !gone.includes(r.id));
			gridSelected = [];
			gridNote = `Deleted ${gone.length} rows (demo only).`;
		}
	}

	function onRowAction(event: CustomEvent<{ action: string; row: Record<string, unknown> }>) {
		gridNote = `${event.detail.action}: ${event.detail.row.name}`;
	}

	function simulate(kind: 'loading' | 'error' | 'reset') {
		gridError = kind === 'error' ? 'Could not load people.' : '';
		gridLoading = kind === 'loading';
		if (kind === 'loading') setTimeout(() => (gridLoading = false), 1500);
	}

	/* ----------------------------------------------------------- FilterBar */
	const orders = [
		{ id: 1, customer: 'Ada', status: 'paid', region: 'EU' },
		{ id: 2, customer: 'Alan', status: 'pending', region: 'US' },
		{ id: 3, customer: 'Grace', status: 'paid', region: 'US' },
		{ id: 4, customer: 'Barbara', status: 'refunded', region: 'EU' },
		{ id: 5, customer: 'Edsger', status: 'paid', region: 'APAC' },
		{ id: 6, customer: 'Margaret', status: 'pending', region: 'EU' }
	];
	const orderDefs: FilterDef[] = [
		{
			key: 'status',
			label: 'Status',
			options: [
				{ value: 'paid', label: 'Paid' },
				{ value: 'pending', label: 'Pending' },
				{ value: 'refunded', label: 'Refunded' }
			]
		},
		{
			key: 'region',
			label: 'Region',
			options: [
				{ value: 'EU', label: 'Europe' },
				{ value: 'US', label: 'United States' },
				{ value: 'APAC', label: 'Asia-Pacific' }
			]
		},
		{ key: 'customer', label: 'Customer' }
	];
	let activeFilters: ActiveFilter[] = [{ key: 'status', value: 'paid' }];
	$: matchingOrders = gridView(orders, { filters: toColumnFilters(orderDefs, activeFilters) }).rows;

	/* --------------------------------------------------------- KanbanBoard */
	const boardColumns: KanbanColumn[] = [
		{ id: 'todo', title: 'To do' },
		{ id: 'doing', title: 'In progress', limit: 3 },
		{ id: 'done', title: 'Done' }
	];
	let boardCards: KanbanCard[] = [
		{ id: 'k1', group: 'todo', order: 0, title: 'Write the launch post', tags: ['content'] },
		{ id: 'k2', group: 'todo', order: 1, title: 'Fix the empty-cart bug', tags: ['bug'] },
		{ id: 'k3', group: 'todo', order: 2, title: 'Audit colour contrast' },
		{
			id: 'k4',
			group: 'doing',
			order: 0,
			title: 'Billing webhooks',
			description: 'Retries and idempotency.'
		},
		{ id: 'k5', group: 'doing', order: 1, title: 'Onboarding emails' },
		{ id: 'k6', group: 'done', order: 0, title: 'Set up CI' }
	];

	/* -------------------------------------------------------- ActivityFeed */
	const feedAll = [
		{
			id: 'a1',
			at: '2026-10-13T14:58:00Z',
			actor: { name: 'Ada Lovelace' },
			action: 'commented on',
			target: 'Billing webhooks',
			href: '#kanban-board'
		},
		{
			id: 'a2',
			at: '2026-10-13T12:10:00Z',
			actor: { name: 'Alan Turing' },
			action: 'merged',
			target: 'Pull request #212',
			detail: 'Retry failed webhook deliveries with backoff.'
		},
		{
			id: 'a3',
			at: '2026-10-13T02:30:00Z',
			actor: { name: 'Grace Hopper' },
			action: 'invited',
			target: 'margaret@example.com'
		},
		{
			id: 'a4',
			at: '2026-10-12T17:45:00Z',
			actor: { name: 'Barbara Liskov' },
			action: 'closed',
			target: 'Issue #98'
		},
		{
			id: 'a5',
			at: '2026-10-12T09:05:00Z',
			actor: { name: 'Edsger Dijkstra' },
			action: 'deployed',
			target: 'v2.4.1 to production'
		},
		{
			id: 'a6',
			at: '2026-10-08T11:00:00Z',
			actor: { name: 'Ada Lovelace' },
			action: 'created',
			target: 'the Q4 roadmap'
		},
		{
			id: 'a7',
			at: '2026-10-07T16:20:00Z',
			actor: { name: 'Alan Turing' },
			action: 'renamed',
			target: 'staging environment'
		},
		{
			id: 'a8',
			at: '2026-09-28T08:00:00Z',
			actor: { name: 'Grace Hopper' },
			action: 'joined',
			target: 'the workspace'
		}
	];
	let feedCount = 4;
	let feedLoading = false;
	$: feedItems = feedAll.slice(0, feedCount);
	function loadOlder() {
		feedLoading = true;
		setTimeout(() => {
			feedCount = Math.min(feedAll.length, feedCount + 3);
			feedLoading = false;
		}, 600);
	}

	/* ------------------------------------------------------- CommentThread */
	const me = { id: 'u1', name: 'Ada Lovelace' };
	let comments: ThreadComment[] = [
		{
			id: 'c1',
			parentId: null,
			author: { id: 'u2', name: 'Alan Turing' },
			body: 'Should the retry window be configurable?',
			createdAt: '2026-10-13T10:00:00Z',
			reactions: { '👍': ['u1', 'u3'] }
		},
		{
			id: 'c2',
			parentId: 'c1',
			author: me,
			body: 'Yes, per endpoint. Default to 24 hours.',
			createdAt: '2026-10-13T10:20:00Z'
		},
		{
			id: 'c3',
			parentId: 'c2',
			author: { id: 'u2', name: 'Alan Turing' },
			body: 'Agreed. I will add it to the schema.',
			createdAt: '2026-10-13T11:05:00Z'
		},
		{
			id: 'c4',
			parentId: 'c3',
			author: me,
			body: 'Thanks! This one is nested at the deepest level, so it cannot be replied to.',
			createdAt: '2026-10-13T12:40:00Z'
		},
		{
			id: 'c5',
			parentId: null,
			author: { id: 'u3', name: 'Grace Hopper' },
			body: 'Docs updated.',
			createdAt: '2026-10-13T14:30:00Z'
		}
	];

	/* ---------------------------------------------------------- TeamMembers */
	let members: TeamMember[] = [
		{ id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com', role: 'owner' },
		{ id: 'u2', name: 'Alan Turing', email: 'alan@example.com', role: 'admin' },
		{ id: 'u3', name: 'Grace Hopper', email: 'grace@example.com', role: 'member' },
		{ id: 'u4', name: 'Edsger Dijkstra', email: 'edsger@example.com', role: 'viewer' }
	];
	let invites: TeamInvite[] = [
		{ id: 'i1', email: 'margaret@example.com', role: 'member', sentAt: '2026-10-11T09:00:00Z' },
		{ id: 'i2', email: 'linus@example.com', role: 'viewer', sentAt: '2026-09-01T09:00:00Z' }
	];

	/* ---------------------------------------------------------- FileManager */
	let entries: FileEntry[] = [
		{ id: 'f-docs', name: 'Documents', type: 'folder', parentId: null },
		{ id: 'f-img', name: 'Images', type: 'folder', parentId: null },
		{ id: 'f-rep', name: 'Reports', type: 'folder', parentId: 'f-docs' },
		{
			id: 'e1',
			name: 'Roadmap.pdf',
			type: 'file',
			parentId: 'f-docs',
			size: 1_240_000,
			modifiedAt: '2026-10-02T10:00:00Z'
		},
		{
			id: 'e2',
			name: 'Budget.xlsx',
			type: 'file',
			parentId: 'f-rep',
			size: 86_000,
			modifiedAt: '2026-09-21T10:00:00Z'
		},
		{
			id: 'e3',
			name: 'logo.svg',
			type: 'file',
			parentId: 'f-img',
			size: 4_200,
			modifiedAt: '2026-08-14T10:00:00Z'
		},
		{
			id: 'e4',
			name: 'photo.jpg',
			type: 'file',
			parentId: 'f-img',
			size: 3_400_000,
			modifiedAt: '2026-10-10T10:00:00Z'
		},
		{
			id: 'e5',
			name: 'notes.md',
			type: 'file',
			parentId: null,
			size: 900,
			modifiedAt: '2026-10-12T10:00:00Z'
		},
		{
			id: 'e6',
			name: 'backup.zip',
			type: 'file',
			parentId: null,
			size: 52_000_000,
			modifiedAt: '2026-07-01T10:00:00Z'
		}
	];
	let folderId: string | null = null;
	let uploads: UploadJob[] = [];
	const timers = new Map<string, ReturnType<typeof setInterval>>();

	function startUpload(
		event: CustomEvent<{ files: File[]; jobs: UploadJob[]; folderId: string | null }>
	) {
		const target = event.detail.folderId;
		for (const job of event.detail.jobs) {
			if (job.status !== 'queued') continue;
			let progress = 0;
			const timer = setInterval(() => {
				const current = uploads.find((u) => u.id === job.id);
				if (!current || current.status === 'cancelled') {
					clearInterval(timer);
					timers.delete(job.id);
					return;
				}
				progress += 8 + Math.random() * 12;
				uploads = setUploadProgress(uploads, job.id, progress);
				if (progress >= 100) {
					clearInterval(timer);
					timers.delete(job.id);
					entries = [
						...entries,
						{
							id: `up-${job.id}`,
							name: job.name,
							type: 'file',
							parentId: target,
							size: job.size,
							modifiedAt: NOW
						}
					];
				}
			}, 350);
			timers.set(job.id, timer);
		}
	}
	onDestroy(() => timers.forEach((t) => clearInterval(t)));

	/* ----------------------------------------------------- CalendarSchedule */
	let calendarEvents: CalendarEvent[] = [
		{ id: 'v1', title: 'Sprint planning', date: '2026-10-13', start: '09:30', end: '10:30' },
		{
			id: 'v2',
			title: 'Design review',
			date: '2026-10-13',
			start: '14:00',
			end: '15:00',
			tone: 'info'
		},
		{ id: 'v3', title: 'Offsite', date: '2026-10-19', endDate: '2026-10-21', tone: 'success' },
		{
			id: 'v4',
			title: 'Release freeze',
			date: '2026-10-27',
			tone: 'warning',
			description: 'No deploys after noon.'
		},
		{ id: 'v5', title: 'Payroll', date: '2026-10-30', start: '08:00' }
	];

	/* ------------------------------------------------------------- TreeView */
	const treeNodes: TreeNode[] = [
		{
			id: 'src',
			label: 'src',
			children: [
				{
					id: 'lib',
					label: 'lib',
					children: [
						{
							id: 'ui',
							label: 'ui',
							children: [
								{ id: 'button', label: 'Button.svelte' },
								{ id: 'dialog', label: 'Dialog.svelte' }
							]
						},
						{ id: 'modules', label: 'modules' },
						{ id: 'utils', label: 'utils', children: [{ id: 'reorder', label: 'reorder.ts' }] }
					]
				},
				{
					id: 'routes',
					label: 'routes',
					children: [
						{ id: 'page', label: '+page.svelte' },
						{ id: 'layout', label: '+layout.svelte' }
					]
				},
				{ id: 'appcss', label: 'app.css' }
			]
		},
		{
			id: 'static',
			label: 'static',
			children: [
				{ id: 'favicon', label: 'favicon.svg' },
				{ id: 'robots', label: 'robots.txt', disabled: true }
			]
		},
		{ id: 'pkg', label: 'package.json' },
		{ id: 'readme', label: 'README.md' }
	];
	let treeExpanded: string[] = ['src', 'lib'];
	let treeSelected: string | null = 'button';

	/* -------------------------------------------------------------- AuditLog */
	const auditEvents: AuditEvent[] = [
		{
			id: 'x1',
			at: '2026-10-13T14:02:00Z',
			actor: 'ada',
			action: 'api_key.revoke',
			target: 'key_live_41',
			severity: 'critical',
			ip: '203.0.113.7',
			details: { reason: 'leaked in a public repo', revokedBy: 'ada' }
		},
		{
			id: 'x2',
			at: '2026-10-13T11:15:00Z',
			actor: 'alan',
			action: 'member.role_change',
			target: 'grace',
			severity: 'warning',
			ip: '198.51.100.23',
			details: { from: 'member', to: 'admin' }
		},
		{
			id: 'x3',
			at: '2026-10-12T16:40:00Z',
			actor: 'grace',
			action: 'export.create',
			target: 'customers.csv',
			severity: 'notice',
			details: { rows: 1824 }
		},
		{
			id: 'x4',
			at: '2026-10-12T09:01:00Z',
			actor: 'ada',
			action: 'user.login',
			severity: 'info',
			ip: '203.0.113.7'
		},
		{
			id: 'x5',
			at: '2026-10-11T22:30:00Z',
			actor: 'system',
			action: 'login.failed',
			target: 'edsger',
			severity: 'warning',
			ip: '192.0.2.99',
			details: { attempts: 5, locked: true }
		},
		{
			id: 'x6',
			at: '2026-10-10T08:12:00Z',
			actor: 'edsger',
			action: 'user.login',
			severity: 'info',
			ip: '192.0.2.45'
		},
		{
			id: 'x7',
			at: '2026-10-09T13:05:00Z',
			actor: 'alan',
			action: 'billing.plan_change',
			target: 'workspace',
			severity: 'notice',
			details: { from: 'starter', to: 'team' }
		},
		{
			id: 'x8',
			at: '2026-10-08T10:50:00Z',
			actor: 'ada',
			action: 'webhook.update',
			target: 'https://hooks.example.com',
			severity: 'info'
		},
		{
			id: 'x9',
			at: '2026-10-07T19:20:00Z',
			actor: 'system',
			action: 'backup.complete',
			severity: 'info',
			details: { sizeMb: 842 }
		},
		{
			id: 'x10',
			at: '2026-10-06T07:44:00Z',
			actor: 'grace',
			action: 'member.remove',
			target: 'linus',
			severity: 'warning'
		},
		{
			id: 'x11',
			at: '2026-10-05T12:00:00Z',
			actor: 'ada',
			action: 'sso.configure',
			severity: 'notice'
		},
		{ id: 'x12', at: '2026-10-04T15:30:00Z', actor: 'alan', action: 'user.login', severity: 'info' }
	];
</script>

<ModuleItem id="data-grid">
	<div class="stack">
		<div class="row">
			<button type="button" on:click={() => simulate('loading')}>Simulate loading</button>
			<button type="button" on:click={() => simulate('error')}>Simulate error</button>
			<button type="button" on:click={() => simulate('reset')}>Reset</button>
			<button type="button" on:click={() => (gridRows = [])}>Empty it</button>
			<button type="button" on:click={() => (gridRows = people)}>Restore</button>
		</div>
		<DataGrid
			label="People"
			rows={gridRows}
			columns={gridColumns}
			selectable
			bind:selected={gridSelected}
			pageSize={8}
			pageSizes={[8, 16, 32]}
			loading={gridLoading}
			error={gridError}
			rowActions={[
				{ id: 'view', label: 'View profile' },
				{ id: 'message', label: 'Send message' },
				{ id: 'remove', label: 'Remove', danger: true }
			]}
			bulkActions={[{ id: 'delete', label: 'Delete selected', danger: true }]}
			exportName="people.csv"
			on:bulkaction={onBulk}
			on:rowaction={onRowAction}
			on:export={(e) =>
				(gridNote = `Exported ${e.detail.count} rows to ${e.detail.name} (${e.detail.csv.length} characters).`)}
			on:retry={() => simulate('reset')}
		/>
		<p class="note" role="status">{gridNote}</p>
	</div>
</ModuleItem>

<ModuleItem id="filter-bar">
	<div class="stack">
		<FilterBar defs={orderDefs} bind:active={activeFilters} count={matchingOrders.length} />
		<ul class="plain">
			{#each matchingOrders as order (order.id)}
				<li>#{order.id} {order.customer} — {order.status}, {order.region}</li>
			{/each}
		</ul>
	</div>
</ModuleItem>

<ModuleItem id="kanban-board">
	<KanbanBoard
		label="Sprint board"
		columns={boardColumns}
		bind:cards={boardCards}
		board="demo-board"
	/>
</ModuleItem>

<ModuleItem id="activity-feed">
	<ActivityFeed
		label="Recent activity"
		items={feedItems}
		now={NOW}
		hasMore={feedCount < feedAll.length}
		loading={feedLoading}
		on:loadmore={loadOlder}
	/>
</ModuleItem>

<ModuleItem id="comment-thread">
	<CommentThread bind:comments currentUser={me} now={NOW} maxLength={280} />
</ModuleItem>

<ModuleItem id="team-members">
	<TeamMembers bind:members bind:invites currentUserId="u1" now={NOW} />
</ModuleItem>

<ModuleItem id="file-manager">
	<FileManager
		label="Project files"
		bind:entries
		bind:folderId
		bind:uploads
		maxBytes={20_000_000}
		on:upload={startUpload}
	/>
</ModuleItem>

<ModuleItem id="calendar-schedule">
	<CalendarSchedule label="Team calendar" bind:events={calendarEvents} now={NOW} weekStart={1} />
</ModuleItem>

<ModuleItem id="tree-view">
	<div class="stack">
		<TreeView
			label="Project files"
			nodes={treeNodes}
			bind:expanded={treeExpanded}
			bind:selected={treeSelected}
		/>
		<p class="note" role="status">Selected: {treeSelected ?? 'nothing'}</p>
	</div>
</ModuleItem>

<ModuleItem id="audit-log">
	<AuditLog label="Security events" events={auditEvents} pageSize={6} />
</ModuleItem>

<style>
	.stack {
		display: grid;
		gap: var(--spacing-md);
		min-width: 0;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.row button {
		min-height: 2.75rem;
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
		cursor: pointer;
	}

	.row button:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.note {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.plain {
		margin: 0;
		padding-inline-start: var(--spacing-lg);
	}
</style>
