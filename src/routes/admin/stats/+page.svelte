<script lang="ts">
	import StatBarChart from '$lib/components/StatBarChart.svelte';
	import PagedRows from '$lib/components/admin/PagedRows.svelte';
	import { fillDailySeries, fillHourlySeries } from '$lib/utils/stats-timeseries';
	import type { PageData } from './$types';

	export let data: PageData;

	$: stats = data.stats;
	$: traffic = data.traffic;
	$: trafficWindow = data.trafficWindow;

	const TRAFFIC_WINDOW_OPTIONS = [
		{ value: 1, label: '1 day' },
		{ value: 7, label: '7 days' },
		{ value: 30, label: '30 days' },
		{ value: 90, label: '90 days' }
	];

	// Views chart: the 1-day window is plotted as 24 hourly buckets (a day series
	// over one day is just two bars); wider windows stay daily. Both are
	// gap-filled so quiet hours/days render as zero bars, not missing ones.
	const TRAFFIC_HOURS = 24;
	$: hourly = trafficWindow === 1;
	$: viewsSeries = !traffic
		? []
		: hourly
			? fillHourlySeries(
					traffic.hourly.map((h) => ({ hourKey: h.hourKey, count: h.views })),
					data.trafficNowHour,
					TRAFFIC_HOURS
				)
			: fillDailySeries(
					traffic.daily.map((d) => ({ day: d.day, count: d.views })),
					utcDayOffset(-trafficWindow),
					utcDayOffset(0)
				);

	// Totals follow the chart's window so the caption and the bars agree.
	$: viewRows = traffic ? (hourly ? traffic.hourly : traffic.daily) : [];
	$: totalViews = viewRows.reduce((sum, r) => sum + r.views, 0);
	$: signedInViews = viewRows.reduce((sum, r) => sum + r.signedIn, 0);

	// Platform-usage history: the 30-day request series already rides on the
	// usage counters; render it as a gap-filled bar chart.
	$: usageSeries = data.usage
		? fillDailySeries(
				data.usage.days.map((d) => ({ day: d.day, count: d.requests })),
				utcDayOffset(-29),
				utcDayOffset(0)
			)
		: [];

	function utcDayOffset(days: number): string {
		return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
	}

	// Per-card maxima for the in-row meters. Each meter reads "share of this
	// card's biggest row", so every table doubles as a bar chart.
	const maxOf = (values: number[]) => Math.max(1, ...values);
	$: byPathMax = traffic ? maxOf(traffic.byPath.map((r) => r.views)) : 1;
	$: referrersMax = traffic ? maxOf(traffic.referrers.map((r) => r.views)) : 1;
	$: countriesMax = traffic ? maxOf(traffic.countries.map((r) => r.views)) : 1;

	function meterStyle(views: number, max: number): string {
		return `--pct:${Math.max(2, Math.round((views / max) * 100))}%`;
	}

	// Audience cards: one config drives all five loops.
	$: audienceCards = traffic?.audience
		? [
				{ key: 'os', title: 'Operating systems', rows: traffic.audience.os },
				{ key: 'browsers', title: 'Browsers', rows: traffic.audience.browsers },
				{ key: 'devices', title: 'Devices', rows: traffic.audience.devices },
				{ key: 'languages', title: 'Languages', rows: traffic.audience.languages },
				{ key: 'viewports', title: 'Viewports', rows: traffic.audience.viewports }
			].map((card) => ({
				...card,
				max: maxOf(card.rows.map((r) => r.views)),
				total: card.rows.reduce((sum, r) => sum + r.views, 0)
			}))
		: [];

	// Display-time labels. Values are stored as raw buckets; every prettification
	// below is presentational only, so the stored vocabulary stays stable.
	const languageNames =
		typeof Intl !== 'undefined' && 'DisplayNames' in Intl
			? new Intl.DisplayNames(['en'], { type: 'language' })
			: null;

	const VIEWPORT_LABELS: Record<string, string> = {
		'under-640': 'Phone (under 640px)',
		'640-1023': 'Small tablet (640–1023px)',
		'1024-1535': 'Laptop (1024–1535px)',
		'1536-plus': 'Large (1536px and up)'
	};

	function audienceLabel(dimension: string, value: string): string {
		if (value === '(unknown)' || value === '(other)') return value;
		if (dimension === 'languages') {
			try {
				return languageNames?.of(value) ?? value;
			} catch {
				return value;
			}
		}
		if (dimension === 'devices') return value.charAt(0).toUpperCase() + value.slice(1);
		if (dimension === 'viewports') return VIEWPORT_LABELS[value] ?? value;
		return value;
	}

	// Referrer bucketing is presentational: hosts are stored raw, grouped here.
	function referrerBucket(host: string): string {
		if (host === '(direct)') return 'Direct';
		if (/google|bing|duckduckgo|yahoo|ecosia|qwant|startpage/.test(host)) return 'Search';
		if (
			/facebook|instagram|fb\.com|twitter|^t\.co$|tiktok|reddit|discord|threads|bsky|bluesky|linkedin|youtube|pinterest|pinimg/.test(
				host
			)
		)
			return 'Social';
		return 'Other';
	}

	$: referrerBuckets = ((): { bucket: string; views: number }[] => {
		if (!traffic) return [];
		const buckets = new Map<string, number>();
		for (const r of traffic.referrers) {
			const bucket = referrerBucket(r.referrerHost);
			buckets.set(bucket, (buckets.get(bucket) ?? 0) + r.views);
		}
		return [...buckets.entries()]
			.map(([bucket, views]) => ({ bucket, views }))
			.sort((a, b) => b.views - a.views);
	})();

	// Country display: codes are stored raw (ISO alpha-2 from the edge, or the
	// '(unknown)'/'T1'/'XX' specials); names and flags are presentational.
	const countryNames =
		typeof Intl !== 'undefined' && 'DisplayNames' in Intl
			? new Intl.DisplayNames(['en'], { type: 'region' })
			: null;

	function countryLabel(code: string): string {
		if (code === '(unknown)' || code === 'XX') return 'Unknown';
		if (code === 'T1') return 'Tor network';
		try {
			return countryNames?.of(code) ?? code;
		} catch {
			return code;
		}
	}

	function countryFlag(code: string): string {
		if (!/^[A-Z]{2}$/.test(code)) return '·';
		return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
	}

	$: countryTotal = traffic ? traffic.countries.reduce((sum, c) => sum + c.views, 0) : 0;

	$: contentStatusRows = stats
		? [
				{ key: 'published', label: 'Published', count: stats.contentByStatus.published },
				{ key: 'draft', label: 'Draft', count: stats.contentByStatus.draft },
				{ key: 'archived', label: 'Archived', count: stats.contentByStatus.archived }
			].sort((a, b) => b.count - a.count)
		: [];
	$: contentStatusMax = maxOf(contentStatusRows.map((r) => r.count));

	function formatHours(hours: number): string {
		if (!Number.isFinite(hours)) return 'never at this rate';
		if (hours < 1) return `${Math.round(hours * 60)} min`;
		return `${hours.toFixed(1)} h`;
	}
</script>

<svelte:head>
	<title>Admin Stats</title>
</svelte:head>

<div class="stats-page">
	<header class="page-head">
		<h1>Stats</h1>
		<p class="lede">
			First-party, cookie-free analytics — aggregate counters only, no per-visitor data.
		</p>
	</header>

	<!-- Overview -->
	<section class="panel">
		<h2>Overview</h2>
		{#if stats}
			<div class="tiles">
				<div class="tile">
					<span class="tile-label">Users</span>
					<span class="tile-value">{stats.totalUsers.toLocaleString()}</span>
				</div>
				<div class="tile">
					<span class="tile-label">Admins</span>
					<span class="tile-value">{stats.totalAdmins.toLocaleString()}</span>
				</div>
				<div class="tile">
					<span class="tile-label">Content items</span>
					<span class="tile-value">{stats.totalContent.toLocaleString()}</span>
				</div>
				<div class="tile">
					<span class="tile-label">Contact forms</span>
					<span class="tile-value">{stats.totalContactSubmissions.toLocaleString()}</span>
				</div>
				<div class="tile">
					<span class="tile-label">Chat messages</span>
					<span class="tile-value">{stats.totalChatMessages.toLocaleString()}</span>
				</div>
			</div>
		{:else}
			<p class="empty-note">
				No database bound. Run <code>npm run db:migrate:local</code> and reload.
			</p>
		{/if}
	</section>

	<!-- Growth over time -->
	{#if stats}
		<section class="panel">
			<h2>Growth over time</h2>
			<div class="chart-grid">
				<article class="chart-card">
					<header class="chart-head">
						<span class="chart-title">New users</span>
						<span class="chart-sub">{stats.totalUsers.toLocaleString()} total</span>
					</header>
					<StatBarChart
						series={stats.usersByMonth}
						accent="var(--chart-users)"
						unit="users"
						periodLabel="month"
					/>
				</article>
				<article class="chart-card">
					<header class="chart-head">
						<span class="chart-title">New content</span>
						<span class="chart-sub">{stats.totalContent.toLocaleString()} total</span>
					</header>
					<StatBarChart
						series={stats.contentByMonth}
						accent="var(--chart-content)"
						unit="items"
						periodLabel="month"
					/>
				</article>
			</div>
		</section>
	{/if}

	<!-- Platform usage (Cloudflare plan limits) -->
	{#if data.usage}
		<section class="panel">
			<h2>Platform usage</h2>
			<p class="panel-note">
				Billable Function invocations — a larger set than page views (bots, API calls, 404s and
				non-GET all count). A floor, not a billing-grade figure; the Cloudflare dashboard is
				authoritative.
			</p>
			<div class="tiles">
				<div class="tile">
					<span class="tile-label">Today</span>
					<span class="tile-value">{data.usage.today.toLocaleString()}</span>
					<span class="tile-sub">
						{data.usage.projection.percentUsed.toFixed(1)}% of the free daily allowance
					</span>
				</div>
				<div class="tile">
					<span class="tile-label">Projected today</span>
					<span class="tile-value">{data.usage.projection.projectedToday.toLocaleString()}</span>
					<span class="tile-sub" class:warn={data.usage.projection.willExhaustToday}>
						{#if data.usage.projection.willExhaustToday}
							Free allowance gone in ~{formatHours(data.usage.projection.hoursToLimit)}
						{:else}
							Within the free allowance
						{/if}
					</span>
				</div>
				<div class="tile">
					<span class="tile-label">Month to date</span>
					<span class="tile-value">{data.usage.monthToDate.toLocaleString()}</span>
					<span class="tile-sub">
						{data.usage.projection.monthPercentOfPaidAllowance.toFixed(2)}% of the paid-plan
						allowance
					</span>
				</div>
				<div class="tile">
					<span class="tile-label">Peak day</span>
					<span class="tile-value">{data.usage.peakDay.toLocaleString()}</span>
					<span class="tile-sub">{data.usage.peakDayOn ?? 'no data yet'}</span>
				</div>
				<div class="tile">
					<span class="tile-label">Bots today</span>
					<span class="tile-value">{data.usage.todayBot.toLocaleString()}</span>
					<span class="tile-sub">{data.usage.todayNotFound.toLocaleString()} not-found</span>
				</div>
			</div>
			<article class="chart-card chart-card--wide">
				<header class="chart-head">
					<span class="chart-title">Requests over time</span>
					<span class="chart-sub">last 30 days</span>
				</header>
				<StatBarChart
					series={usageSeries}
					accent="var(--chart-usage)"
					unit="requests"
					periodLabel="day"
				/>
			</article>
		</section>
	{/if}

	<!-- Traffic -->
	<section class="panel">
		<div class="panel-head">
			<h2>Traffic</h2>
			<nav class="window-toggle" aria-label="Traffic window">
				{#each TRAFFIC_WINDOW_OPTIONS as option (option.value)}
					<a
						href={`?window=${option.value}`}
						class="window-link"
						class:active={trafficWindow === option.value}
						data-sveltekit-noscroll
						aria-current={trafficWindow === option.value ? 'true' : undefined}>{option.label}</a
					>
				{/each}
			</nav>
		</div>

		{#if traffic}
			<article class="chart-card chart-card--wide">
				<header class="chart-head">
					<span class="chart-title">Page views</span>
					<span class="chart-sub">
						{totalViews.toLocaleString()} views · {signedInViews.toLocaleString()} signed-in views ·
						{#if hourly}last 24 hours (UTC){:else}last {trafficWindow} days{/if}
					</span>
				</header>
				<StatBarChart
					series={viewsSeries}
					accent="var(--chart-views)"
					unit="views"
					periodLabel={hourly ? 'hour' : 'day'}
				/>
				{#if hourly}
					<p class="chart-note">
						Hourly buckets, UTC. The tables below count whole UTC days, so they also include
						yesterday.
					</p>
				{/if}
			</article>

			<div class="card-grid">
				<article class="card">
					<h3>Views by page</h3>
					{#if traffic.byPath.length === 0}
						<p class="empty-note">No views recorded yet — check back after some traffic.</p>
					{:else}
						<PagedRows items={traffic.byPath} noun="pages" let:shown>
							<table class="stat-table">
								<thead>
									<tr
										><th>Route</th><th class="num">Views</th><th class="num">Signed-in views</th
										></tr
									>
								</thead>
								<tbody>
									{#each shown as row (row.pathKey)}
										<tr>
											<td title={row.pathKey}>
												<span class="cell-label"><code>{row.pathKey}</code></span>
												<span class="meter" style={meterStyle(row.views, byPathMax)}></span>
											</td>
											<td class="num">{row.views.toLocaleString()}</td>
											<td class="num">{row.signedIn.toLocaleString()}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</PagedRows>
					{/if}
				</article>

				<article class="card">
					<h3>Referrers</h3>
					{#if traffic.referrers.length === 0}
						<p class="empty-note">No referrers recorded yet.</p>
					{:else}
						{#if referrerBuckets.length > 0}
							<ul class="chip-row">
								{#each referrerBuckets as b (b.bucket)}
									<li class="chip">{b.bucket} · {b.views.toLocaleString()}</li>
								{/each}
							</ul>
						{/if}
						<PagedRows items={traffic.referrers} noun="referrers" let:shown>
							<table class="stat-table">
								<thead><tr><th>Host</th><th class="num">Views</th></tr></thead>
								<tbody>
									{#each shown as ref (ref.referrerHost)}
										<tr>
											<td title={ref.referrerHost}>
												<span class="cell-label">{ref.referrerHost}</span>
												<span class="meter" style={meterStyle(ref.views, referrersMax)}></span>
											</td>
											<td class="num">{ref.views.toLocaleString()}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</PagedRows>
					{/if}
				</article>

				<article class="card">
					<h3>Views by country</h3>
					{#if traffic.countries.length === 0}
						<p class="empty-note">
							No country data yet. Country comes from the Cloudflare edge, so it stays
							<code>(unknown)</code> in local development.
						</p>
					{:else}
						<PagedRows items={traffic.countries} noun="countries" let:shown>
							<table class="stat-table">
								<thead>
									<tr><th>Country</th><th class="num">Views</th><th class="num">Share</th></tr>
								</thead>
								<tbody>
									{#each shown as row (row.country)}
										<tr>
											<td title={countryLabel(row.country)}>
												<span class="cell-label">
													<span class="glyph" aria-hidden="true">{countryFlag(row.country)}</span>
													{countryLabel(row.country)}
												</span>
												<span class="meter" style={meterStyle(row.views, countriesMax)}></span>
											</td>
											<td class="num">{row.views.toLocaleString()}</td>
											<td class="num">
												{countryTotal > 0 ? ((row.views / countryTotal) * 100).toFixed(1) : '0.0'}%
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</PagedRows>
					{/if}
				</article>
			</div>
		{:else}
			<p class="empty-note">
				Traffic data unavailable — apply migration <code>0007_page_view_stats.sql</code>.
			</p>
		{/if}
	</section>

	<!-- Audience (header buckets + viewport beacon; no PII, buckets only) -->
	{#if audienceCards.length > 0}
		<section class="panel">
			<h2>Audience</h2>
			<p class="panel-note">
				Coarse buckets derived from request headers at request time. The raw User-Agent is never
				stored.
			</p>
			<div class="card-grid">
				{#each audienceCards as card (card.key)}
					<article class="card">
						<h3>{card.title}</h3>
						{#if card.rows.length === 0}
							<p class="empty-note">
								{#if card.key === 'viewports'}
									No samples yet — viewport arrives from the client beacon.
								{:else}
									No data in this window.
								{/if}
							</p>
						{:else}
							<PagedRows items={card.rows} pageSize={6} noun="rows" let:shown>
								<table class="stat-table">
									<thead><tr><th>Value</th><th class="num">Views</th></tr></thead>
									<tbody>
										{#each shown as row (row.value)}
											<tr>
												<td title={audienceLabel(card.key, row.value)}>
													<span class="cell-label">{audienceLabel(card.key, row.value)}</span>
													<span class="meter" style={meterStyle(row.views, card.max)}></span>
												</td>
												<td class="num">{row.views.toLocaleString()}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</PagedRows>
						{/if}
					</article>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Content by status -->
	{#if stats && stats.totalContent > 0}
		<section class="panel">
			<h2>Content by status</h2>
			<table class="stat-table">
				<thead><tr><th>Status</th><th class="num">Items</th></tr></thead>
				<tbody>
					{#each contentStatusRows as row (row.key)}
						<tr>
							<td>
								<span class="cell-label">{row.label}</span>
								<span class="meter" style={meterStyle(row.count, contentStatusMax)}></span>
							</td>
							<td class="num">{row.count.toLocaleString()}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/if}
</div>

<style>
	.stats-page {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
	}

	.page-head h1 {
		margin: 0;
	}

	.lede {
		margin: 0.35rem 0 0;
		color: var(--color-text-secondary);
	}

	.panel {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-lg);
	}

	.panel h2 {
		margin: 0 0 var(--spacing-md);
		font-size: 1.1rem;
	}

	.panel-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--spacing-md);
		flex-wrap: wrap;
	}

	.panel-head h2 {
		margin-bottom: var(--spacing-md);
	}

	.panel-note {
		margin: -0.5rem 0 var(--spacing-md);
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		max-width: 70ch;
	}

	/* Window toggle */
	.window-toggle {
		display: flex;
		gap: 0.25rem;
		flex-wrap: wrap;
	}

	.window-link {
		padding: 0.2rem 0.6rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm, 6px);
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-decoration: none;
	}

	.window-link:hover {
		background: var(--color-surface-hover);
	}

	.window-link.active {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: var(--color-background);
	}

	/* Tiles */
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: var(--spacing-sm);
	}

	.tile {
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-md);
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.tile-label {
		color: var(--color-text-secondary);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.tile-value {
		font-size: 1.5rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.tile-sub {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.tile-sub.warn {
		color: var(--color-error, crimson);
		font-weight: 600;
	}

	/* Charts */
	.chart-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr));
		gap: var(--spacing-md);
	}

	.chart-card {
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-md);
	}

	.chart-card--wide {
		margin-top: var(--spacing-md);
	}

	.chart-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--spacing-sm);
		flex-wrap: wrap;
		margin-bottom: var(--spacing-sm);
	}

	.chart-title {
		font-weight: 600;
	}

	.chart-sub,
	.chart-note {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.chart-note {
		margin: var(--spacing-sm) 0 0;
	}

	/* Cards + tables */
	.card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr));
		gap: var(--spacing-md);
		margin-top: var(--spacing-md);
	}

	.card {
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-md);
		min-width: 0;
	}

	.card h3 {
		margin: 0 0 var(--spacing-sm);
		font-size: 0.9rem;
	}

	.stat-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.82rem;
	}

	.stat-table th {
		text-align: left;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--color-text-secondary);
		font-weight: 600;
		padding-bottom: 0.35rem;
		border-bottom: 1px solid var(--color-border);
	}

	.stat-table td {
		padding: 0.4rem 0.35rem 0.4rem 0;
		vertical-align: middle;
		max-width: 0;
	}

	.stat-table .num {
		text-align: right;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		width: 1%;
		padding-left: var(--spacing-sm);
	}

	/* The label truncates, the meter sits under it — so every table doubles as
	   a bar chart without a second column of chrome. */
	.cell-label {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.cell-label code {
		font-size: 0.78rem;
	}

	.glyph {
		margin-right: 0.3rem;
	}

	.meter {
		display: block;
		height: 3px;
		margin-top: 0.25rem;
		border-radius: 2px;
		background: var(--color-border);
		position: relative;
		overflow: hidden;
	}

	.meter::before {
		content: '';
		position: absolute;
		inset: 0 auto 0 0;
		width: var(--pct, 0%);
		background: var(--chart-views);
		border-radius: 2px;
	}

	.chip-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin: 0 0 var(--spacing-sm);
		padding: 0;
		list-style: none;
	}

	.chip {
		font-size: 0.72rem;
		padding: 0.15rem 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		color: var(--color-text-secondary);
	}

	.empty-note {
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		margin: 0;
	}
</style>
