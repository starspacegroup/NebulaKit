<!-- /components demos: Data display. -->
<script lang="ts">
	import {
		Avatar,
		AvatarGroup,
		Badge,
		BarChart,
		Button,
		Card,
		Carousel,
		CodeBlock,
		DataTable,
		DonutChart,
		EmptyState,
		Item,
		Kbd,
		LineChart,
		Prose,
		Stat,
		Table,
		Timeline,
		toast
	} from '$lib/ui';
	import CatalogItem from '../CatalogItem.svelte';

	const deploys = [
		{ branch: 'main', status: 'Live', minutes: 2.4 },
		{ branch: 'feature/search', status: 'Preview', minutes: 3.1 },
		{ branch: 'fix/login', status: 'Failed', minutes: 0.8 },
		{ branch: 'docs', status: 'Preview', minutes: 1.2 }
	];

	const team = [
		{ id: 1, name: 'Ada Lovelace', role: 'Engineering lead', status: 'Active', commits: 1284 },
		{ id: 2, name: 'Alan Turing', role: 'Research', status: 'Active', commits: 642 },
		{ id: 3, name: 'Grace Hopper', role: 'Compilers', status: 'Away', commits: 2210 },
		{ id: 4, name: 'Edsger Dijkstra', role: 'Algorithms', status: 'Active', commits: 98 },
		{ id: 5, name: 'Barbara Liskov', role: 'Architecture', status: 'Active', commits: 873 },
		{ id: 6, name: 'Margaret Hamilton', role: 'Flight software', status: 'Away', commits: 1530 },
		{ id: 7, name: 'Donald Knuth', role: 'Typesetting', status: 'Invited', commits: 0 },
		{ id: 8, name: 'Katherine Johnson', role: 'Trajectories', status: 'Active', commits: 411 }
	];
	const teamColumns = [
		{ key: 'name', label: 'Name', sortable: true },
		{ key: 'role', label: 'Role', sortable: true },
		{ key: 'status', label: 'Status', sortable: true },
		{
			key: 'commits',
			label: 'Commits',
			sortable: true,
			align: 'end' as const,
			format: (v: unknown) => Number(v).toLocaleString()
		}
	];
	let teamSelected: unknown[] = [];

	const week = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	const slides = [
		{
			title: 'Ship on the edge',
			body: 'Cloudflare Pages and Workers, deployed from one command.',
			tone: 'primary'
		},
		{
			title: 'Own your auth',
			body: 'GitHub sign-in with signed sessions, no third-party service.',
			tone: 'success'
		},
		{
			title: 'Themes that hold up',
			body: 'Every colour is a token, checked in light and dark.',
			tone: 'warning'
		}
	];
	let slide = 0;

	const activity = [
		{ name: 'Ada Lovelace', text: 'Approved “Add the DataTable”', meta: '2m', href: '#item' },
		{ name: 'Grace Hopper', text: 'Commented on the release notes', meta: '1h', href: '#item' },
		{ name: 'Alan Turing', text: 'Pushed 3 commits to main', meta: 'Yesterday', href: '#item' }
	];

	const snippet = [
		'<script lang="ts">',
		"\timport { DataTable } from '$lib/ui';",
		'\texport let data;',
		'</' + 'script>',
		'',
		'<DataTable caption="Users" rows={data.users} {columns} selectable />'
	].join('\n');

	const article = `<h2>Shipping a release</h2>
	<p>Every release goes through <a href="#prose">the same three steps</a>, and none of them is skipped on a Friday.</p>
	<ol><li>Tag the commit.</li><li>Let CI build and test it.</li><li>Promote the preview.</li></ol>
	<blockquote>Small releases are boring releases. Boring is the goal.</blockquote>
	<p>Run <code>bun run deploy</code> once the checks are green.</p>
	<table><thead><tr><th>Step</th><th>Owner</th></tr></thead><tbody><tr><td>Tag</td><td>Release lead</td></tr><tr><td>Promote</td><td>On-call</td></tr></tbody></table>
	<hr />
	<p>Questions go in <strong>#releases</strong>.</p>`;
</script>

<CatalogItem id="card">
	<div class="cards">
		<Card title="Pro plan">
			Everything in Free, plus custom domains and priority support.
			<svelte:fragment slot="header"><Badge tone="info">Popular</Badge></svelte:fragment>
			<svelte:fragment slot="footer"><Button size="sm">Upgrade</Button></svelte:fragment>
		</Card>
		<Card title="A whole-card link" href="#card">The entire card is one link target.</Card>
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
		<EmptyState icon="✨" title="No projects yet" description="Projects you create show up here.">
			<Button size="sm">New project</Button>
		</EmptyState>
	</div>
</CatalogItem>
<CatalogItem id="data-table">
	<div class="stack">
		<DataTable
			caption="Team"
			rows={team}
			columns={teamColumns}
			pageSize={5}
			pageSizes={[5, 10, 0]}
			selectable
			bind:selected={teamSelected}
		>
			<svelte:fragment slot="toolbar" let:selected>
				<Button size="sm" variant="secondary" disabled={!selected.length}>Export</Button>
				<Button
					size="sm"
					variant="danger"
					disabled={!selected.length}
					on:click={() => toast.success(`Removed ${selected.length} people (not really).`)}
				>
					Remove
				</Button>
			</svelte:fragment>
			<svelte:fragment slot="cell" let:row let:column let:value>
				{#if column.key === 'status'}
					<Badge
						tone={row.status === 'Active'
							? 'success'
							: row.status === 'Away'
								? 'warning'
								: 'neutral'}>{value}</Badge
					>
				{:else}
					{value}
				{/if}
			</svelte:fragment>
		</DataTable>
	</div>
</CatalogItem>
<CatalogItem id="bar-chart">
	<div class="stack">
		<BarChart
			title="Deploys per day"
			labels={week.slice(0, 5)}
			series={[
				{ name: 'Production', values: [4, 7, 5, 9, 6] },
				{ name: 'Preview', values: [12, 9, 14, 11, 8] }
			]}
		/>
	</div>
</CatalogItem>
<CatalogItem id="line-chart">
	<div class="stack">
		<LineChart
			title="Visitors"
			area
			labels={week}
			series={[
				{ name: 'This week', values: [320, 410, 380, 520, 610, 450, 390] },
				{ name: 'Last week', values: [280, 300, null, 410, 470, 400, 350] }
			]}
		/>
	</div>
</CatalogItem>
<CatalogItem id="donut-chart">
	<div class="stack">
		<DonutChart
			title="Traffic sources"
			centerLabel="Visits"
			data={[
				{ label: 'Search', value: 5200 },
				{ label: 'Direct', value: 3100 },
				{ label: 'Social', value: 1400 },
				{ label: 'Referral', value: 900 }
			]}
		/>
	</div>
</CatalogItem>
<CatalogItem id="carousel">
	<div class="stack">
		<Carousel label="Highlights" items={slides} bind:index={slide} autoplay={6000} let:item>
			<div class="demo-slide demo-slide--{item.tone}">
				<h4>{item.title}</h4>
				<p>{item.body}</p>
			</div>
		</Carousel>
		<p class="demo-note">Slide {slide + 1} of {slides.length}</p>
	</div>
</CatalogItem>
<CatalogItem id="item">
	<div class="stack">
		{#each activity as a (a.name)}
			<Item title={a.name} description={a.text} meta={a.meta} href={a.href}>
				<Avatar slot="media" name={a.name} size="sm" />
			</Item>
		{/each}
		<Item
			variant="outline"
			title="Weekly digest"
			description="A summary of the week, every Monday."
		>
			<span slot="media" aria-hidden="true">✉️</span>
			<Button slot="actions" size="sm" variant="secondary">Subscribe</Button>
		</Item>
		<Item variant="muted" size="sm" title="Storage" meta="8.2 / 10 GB" />
	</div>
</CatalogItem>
<CatalogItem id="timeline">
	<div class="stack">
		<Timeline
			label="Deploy history"
			items={[
				{
					time: 'Today, 9:41',
					datetime: '2026-10-03T09:41',
					title: 'Deployed to production',
					description: 'v2.4.0 — the data-display kit.',
					tone: 'success'
				},
				{
					time: 'Today, 9:30',
					datetime: '2026-10-03T09:30',
					title: 'Preview checks failed',
					description: 'One flaky test, re-run and passed.',
					tone: 'danger'
				},
				{ time: 'Yesterday', datetime: '2026-10-02', title: 'Release branch cut', tone: 'warning' },
				{ time: 'Monday', datetime: '2026-09-28', title: 'Planning' }
			]}
		/>
	</div>
</CatalogItem>
<CatalogItem id="stat">
	<div class="demo-stats">
		<Stat
			label="Revenue"
			value="$48,210"
			delta={12.4}
			help="vs last month"
			series={[31, 34, 33, 39, 41, 44, 48]}
		/>
		<Stat
			label="Error rate"
			value="0.42%"
			delta={-18}
			invert
			help="vs last week"
			series={[0.8, 0.7, 0.66, 0.5, 0.45, 0.42]}
		/>
		<Stat label="Active users" value="1,204" delta={-3.1} series={[1290, 1275, 1260, 1240, 1204]} />
		<Stat label="Uptime" value="99.98%" delta={0} help="30 days" />
	</div>
</CatalogItem>
<CatalogItem id="avatar-group">
	<AvatarGroup
		label="Reviewers"
		size="sm"
		max={3}
		people={[
			{ name: 'Ada Lovelace' },
			{ name: 'Alan Turing' },
			{ name: 'Grace Hopper' },
			{ name: 'Edsger Dijkstra' },
			{ name: 'Barbara Liskov' }
		]}
	/>
	<AvatarGroup
		label="Owners"
		people={[{ name: 'Margaret Hamilton' }, { name: 'Katherine Johnson' }]}
	/>
</CatalogItem>
<CatalogItem id="code-block">
	<div class="stack">
		<CodeBlock
			filename="src/routes/users/+page.svelte"
			language="svelte"
			lineNumbers
			code={snippet}
		/>
		<CodeBlock language="sh" code="bun run deploy" />
	</div>
</CatalogItem>
<CatalogItem id="prose">
	<div class="stack">
		<Prose size="sm">{@html article}</Prose>
	</div>
</CatalogItem>

<style>
	.demo-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: var(--spacing-lg);
		width: 100%;
	}

	.demo-slide {
		display: grid;
		align-content: center;
		min-height: 10rem;
		padding: var(--spacing-lg);
		border-radius: var(--radius-lg);
		background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface));
		color: var(--color-text);
	}

	.demo-slide--success {
		background: color-mix(in srgb, var(--color-success) 14%, var(--color-surface));
	}

	.demo-slide--warning {
		background: color-mix(in srgb, var(--color-warning) 14%, var(--color-surface));
	}

	.demo-slide h4 {
		margin: 0 0 var(--spacing-xs);
		font-size: 1.125rem;
	}

	.demo-slide p,
	.demo-note {
		margin: 0;
		color: var(--color-text-secondary);
	}
</style>
