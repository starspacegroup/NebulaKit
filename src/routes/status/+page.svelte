<script lang="ts">
	import { site } from '$lib/site.config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const snap = $derived(data.snapshot);

	const LABEL: Record<string, string> = {
		operational: 'Operational',
		degraded: 'Slow',
		down: 'Down'
	};
	const MARK: Record<string, string> = { operational: '✓', degraded: '!', down: '✕' };
	const STAGE: Record<string, string> = {
		investigating: 'Investigating',
		identified: 'Identified',
		monitoring: 'Monitoring',
		resolved: 'Resolved'
	};
	const IMPACT: Record<string, string> = {
		minor: 'Minor',
		major: 'Major',
		critical: 'Critical',
		maintenance: 'Maintenance'
	};

	/** SQL UTC time → "17 Nov, 12:05 UTC". Always UTC, so the server and the browser agree. */
	function when(sql: string | null | undefined): string {
		if (!sql) return '';
		const d = new Date(sql.includes('T') ? sql : sql.replace(' ', 'T') + 'Z');
		if (Number.isNaN(d.getTime())) return '';
		return (
			d.toLocaleString('en-GB', {
				timeZone: 'UTC',
				day: 'numeric',
				month: 'short',
				hour: '2-digit',
				minute: '2-digit',
				hour12: false
			}) + ' UTC'
		);
	}

	function dayText(day: string, level: string): string {
		const what =
			level === 'none'
				? 'no data'
				: level === 'operational'
					? 'no problems'
					: level === 'degraded'
						? 'some problems'
						: 'an outage';
		return `${day}: ${what}`;
	}

	const nameOf = (id: string) => snap?.components.find((c) => c.id === id)?.name ?? id;
	const tone = $derived(snap?.stale ? 'stale' : (snap?.overall ?? 'stale'));
</script>

<svelte:head>
	<title>{site.name} status</title>
	<meta name="description" content="Live status and incident history for {site.name}." />
	<link rel="alternate" type="application/json" href="/api/status" title="Status feed" />
</svelte:head>

<section class="status">
	<header class="intro">
		<h1>{site.name} status</h1>
		<p class="lede">Live checks of the website and the database, about once a minute.</p>
	</header>

	{#if !snap}
		<div class="banner tone-stale" role="status">
			<span class="mark" aria-hidden="true">?</span>
			<div>
				<h2>Status is not available right now</h2>
				<p>We could not read the status data. This is not an all-clear. Try again in a minute.</p>
			</div>
		</div>
	{:else}
		<div class="banner tone-{tone}" role="status">
			<span class="mark" aria-hidden="true">{snap.stale ? '?' : MARK[snap.overall]}</span>
			<div>
				<h2>{snap.headline}</h2>
				{#if snap.stale}
					<p>
						The newest check is
						{#if snap.lastChecked}from {when(snap.lastChecked)}{:else}missing{/if}. We will not say
						all is well until checks resume.
					</p>
				{:else}
					<p>Last checked {when(snap.lastChecked)}.</p>
				{/if}
			</div>
		</div>

		{#if snap.openIncidents.length}
			<section class="block" aria-labelledby="open-h">
				<h2 id="open-h">Open incidents</h2>
				{#each snap.openIncidents as incident (incident.id)}
					<article class="incident impact-{incident.impact}">
						<header>
							<h3>{incident.title}</h3>
							<span class="pill">{IMPACT[incident.impact]}</span>
							<span class="pill">{STAGE[incident.status]}</span>
						</header>
						<p class="meta">
							Started {when(incident.startedAt)}
							{#if incident.components.length}· Affects {incident.components
									.map(nameOf)
									.join(', ')}{/if}
						</p>
						<ol class="updates">
							{#each incident.updates as update (update.id)}
								<li>
									<span class="u-head">
										<strong>{STAGE[update.status]}</strong> · {when(update.createdAt)}
									</span>
									<p>{update.body}</p>
								</li>
							{/each}
						</ol>
					</article>
				{/each}
			</section>
		{/if}

		<section class="block" aria-labelledby="systems-h">
			<h2 id="systems-h">Systems</h2>
			<ul class="components">
				{#each snap.components as component (component.id)}
					<li class="component">
						<div class="c-top">
							<div>
								<h3>{component.name}</h3>
								<p class="desc">{component.description}</p>
							</div>
							<div class="c-state state-{component.status}">
								<span class="mark" aria-hidden="true">{MARK[component.status]}</span>
								<span>{LABEL[component.status]}</span>
							</div>
						</div>
						{#if component.status !== 'operational' && component.detail}
							<p class="why">{component.detail}</p>
						{/if}
						<div
							class="bars"
							role="img"
							aria-label="Last 90 days. {component.uptimePercent === null
								? 'No history yet.'
								: `${component.uptimePercent}% uptime.`}"
						>
							{#each component.days as d (d.day)}
								<span class="bar lvl-{d.level}" title={dayText(d.day, d.level)}></span>
							{/each}
						</div>
						<div class="bar-legend">
							<span>90 days ago</span>
							<span>
								{#if component.uptimePercent === null}No history yet{:else}{component.uptimePercent}%
									uptime{/if}
							</span>
							<span>Today</span>
						</div>
					</li>
				{/each}
			</ul>
		</section>

		<section class="block" aria-labelledby="past-h">
			<h2 id="past-h">Past incidents</h2>
			{#if snap.recentIncidents.length === 0}
				<p class="quiet">Nothing in the last 30 days.</p>
			{:else}
				{#each snap.recentIncidents as incident (incident.id)}
					<article class="incident past">
						<header>
							<h3>{incident.title}</h3>
							<span class="pill">{IMPACT[incident.impact]}</span>
						</header>
						<p class="meta">
							{when(incident.startedAt)}{incident.resolvedAt
								? ` to ${when(incident.resolvedAt)}`
								: ''}
						</p>
						<ol class="updates">
							{#each incident.updates as update (update.id)}
								<li>
									<span class="u-head">
										<strong>{STAGE[update.status]}</strong> · {when(update.createdAt)}
									</span>
									<p>{update.body}</p>
								</li>
							{/each}
						</ol>
					</article>
				{/each}
			{/if}
		</section>
	{/if}

	<p class="foot">
		The same data as JSON: <a href="/api/status">/api/status</a>.
	</p>
</section>

<style>
	.status {
		max-width: 48rem;
		margin: 0 auto;
		padding: 1.5rem 1rem 3rem;
		color: var(--color-text);
	}
	h1 {
		margin: 0 0 0.25rem;
		overflow-wrap: anywhere;
	}
	.lede,
	.desc,
	.meta,
	.quiet,
	.foot,
	.bar-legend {
		color: var(--color-text-secondary);
	}
	.lede {
		margin: 0 0 1.25rem;
	}
	h2 {
		margin: 0 0 0.5rem;
		font-size: 1.15rem;
	}
	h3 {
		margin: 0;
		font-size: 1rem;
	}
	.banner {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
		padding: 1rem;
		margin-bottom: 1.5rem;
		border: 1px solid var(--color-border);
		border-left-width: 0.4rem;
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}
	.banner p {
		margin: 0.25rem 0 0;
		color: var(--color-text-secondary);
	}
	.banner h2 {
		margin: 0;
	}
	.tone-operational {
		border-left-color: var(--color-success);
	}
	.tone-degraded,
	.tone-stale {
		border-left-color: var(--color-warning);
	}
	.tone-down {
		border-left-color: var(--color-error);
	}
	.mark {
		flex: none;
		display: inline-grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		font-weight: 700;
	}
	.block {
		margin-bottom: 2rem;
	}
	.components {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.component,
	.incident {
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}
	.incident {
		margin-bottom: 0.75rem;
	}
	.impact-major,
	.impact-critical {
		border-left: 0.4rem solid var(--color-error);
	}
	.impact-minor,
	.impact-maintenance {
		border-left: 0.4rem solid var(--color-warning);
	}
	.c-top,
	.incident header {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.desc {
		margin: 0.125rem 0 0;
		font-size: 0.875rem;
	}
	.c-state {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-weight: 600;
	}
	.why {
		margin: 0.5rem 0 0;
	}
	.bars {
		display: flex;
		gap: 2px;
		height: 2rem;
		margin-top: 0.75rem;
	}
	.bar {
		flex: 1 1 0;
		min-width: 0;
		border-radius: 2px;
		background: var(--color-border);
	}
	.lvl-operational {
		background: var(--color-success);
	}
	.lvl-degraded {
		background: var(--color-warning);
	}
	.lvl-down {
		background: var(--color-error);
	}
	.bar-legend {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		margin-top: 0.25rem;
		font-size: 0.8rem;
	}
	.pill {
		padding: 0.1rem 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		color: var(--color-text-secondary);
		font-size: 0.75rem;
	}
	.meta {
		margin: 0.25rem 0 0.5rem;
		font-size: 0.875rem;
	}
	.updates {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.updates p {
		margin: 0.125rem 0 0;
		overflow-wrap: anywhere;
	}
	.u-head {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}
	.foot {
		font-size: 0.875rem;
	}
</style>
