<!--
	StatusPage — is everything up? An overall banner, each system component with
	a status badge and a 90-day uptime strip, and the incident list.

	Every day in the strip has a text alternative ("Jan 4, 2026: Outage, 42
	minutes"). The strip is one tab stop; arrow keys move along it and the chosen
	day is printed under it, so touch and keyboard get what hover would show. A
	list of only the days with trouble sits in a disclosure for screen readers
	and small screens.
-->
<script lang="ts">
	import Badge from '$lib/ui/Badge.svelte';
	import { uid } from '$lib/ui/logic';
	import {
		COMPONENT_STATUS_LABELS,
		componentTone,
		dayLabel,
		formatCommerceDate,
		overallStatus,
		uptimePercent,
		type ComponentStatus,
		type Incident,
		type SystemComponent,
		type UptimeDay
	} from './logic';

	export let components: SystemComponent[] = [];
	export let incidents: Incident[] = [];
	export let updatedAt: string | undefined = undefined;
	export let locale = 'en-US';
	export let timeZone = 'UTC';
	export let heading = 'System status';
	export let level: 2 | 3 | 4 = 2;
	export let labels: Partial<typeof defaults> = {};
	export let statusLabels: Record<ComponentStatus, string> = COMPONENT_STATUS_LABELS;

	const defaults = {
		allGood: 'All systems operational',
		someIssues: 'Some systems are affected',
		outage: 'Major outage',
		maintenance: 'Scheduled maintenance in progress',
		updated: 'Updated {date}',
		uptime: '{percent}% uptime',
		strip: '{name}: uptime, last {days} days',
		selected: 'Selected day',
		daysWithIssues: 'Days with issues',
		noIssues: 'No incidents in this period.',
		incidents: 'Incidents',
		noIncidents: 'No incidents reported.',
		investigating: 'Investigating',
		identified: 'Identified',
		monitoring: 'Monitoring',
		resolved: 'Resolved',
		ago: 'days ago',
		today: 'Today'
	};

	const id = uid('status');
	let active: Record<string, number> = {};

	$: t = { ...defaults, ...labels };
	$: overall = overallStatus(components.map((c) => c.status));
	$: banner =
		overall === 'operational'
			? t.allGood
			: overall === 'maintenance'
				? t.maintenance
				: overall === 'outage'
					? t.outage
					: t.someIssues;
	$: bannerTone = componentTone(overall);
	$: dayText = (day: UptimeDay) => dayLabel(day, locale);

	function indexOf(c: SystemComponent, picked: Record<string, number>): number {
		return Math.min(picked[c.id] ?? c.days.length - 1, c.days.length - 1);
	}

	function move(c: SystemComponent, to: number) {
		active = { ...active, [c.id]: Math.max(0, Math.min(c.days.length - 1, to)) };
	}

	function onKey(event: KeyboardEvent, c: SystemComponent) {
		const rtl = getComputedStyle(event.currentTarget as HTMLElement).direction === 'rtl';
		const at = indexOf(c, active);
		const step = rtl ? -1 : 1;
		const keys: Record<string, number> = {
			ArrowRight: at + step,
			ArrowLeft: at - step,
			Home: 0,
			End: c.days.length - 1
		};
		if (!(event.key in keys)) return;
		event.preventDefault();
		move(c, keys[event.key]);
	}

	function trouble(c: SystemComponent): UptimeDay[] {
		return c.days.filter((d) => d.status === 'degraded' || d.status === 'down');
	}
</script>

<section class="status" aria-labelledby="{id}-h">
	<header class="status__head">
		<svelte:element this={`h${level}`} class="status__title" id="{id}-h">{heading}</svelte:element>
		{#if updatedAt}<p class="status__updated">
				{t.updated.replace('{date}', formatCommerceDate(updatedAt, locale, timeZone, 'long'))}
			</p>{/if}
	</header>

	<p class="banner banner--{bannerTone}" role="status">
		<span class="banner__icon" aria-hidden="true">{overall === 'operational' ? '✓' : '!'}</span>
		{banner}
	</p>

	<ul class="components">
		{#each components as c (c.id)}
			{@const at = indexOf(c, active)}
			<li class="component">
				<div class="component__head">
					<h3 class="component__name">{c.name}</h3>
					<Badge tone={componentTone(c.status)}>{statusLabels[c.status]}</Badge>
				</div>
				{#if c.description}<p class="component__desc">{c.description}</p>{/if}
				{#if c.days.length}
					<!-- svelte-ignore a11y-no-noninteractive-tabindex a11y-no-noninteractive-element-interactions -->
					<ul
						class="strip"
						tabindex="0"
						aria-label={t.strip.replace('{name}', c.name).replace('{days}', String(c.days.length))}
						on:keydown={(e) => onKey(e, c)}
					>
						{#each c.days as day, i (day.date)}
							<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
							<li
								class="day day--{day.status}"
								class:day--active={i === at}
								title={dayText(day)}
								on:click={() => move(c, i)}
								on:mouseenter={() => move(c, i)}
							>
								<span class="sr-only">{dayText(day)}</span>
							</li>
						{/each}
					</ul>
					<p class="detail" aria-hidden="true">
						<span class="detail__label">{t.selected}:</span>
						{dayText(c.days[at])}
					</p>
					<div class="component__foot">
						<span>{t.uptime.replace('{percent}', uptimePercent(c.days).toFixed(2))}</span>
					</div>
					<details class="issues">
						<summary>{t.daysWithIssues}</summary>
						{#if trouble(c).length}
							<ul>
								{#each trouble(c) as day (day.date)}<li>{dayText(day)}</li>{/each}
							</ul>
						{:else}
							<p>{t.noIssues}</p>
						{/if}
					</details>
				{/if}
			</li>
		{/each}
	</ul>

	<section class="incidents" aria-labelledby="{id}-i">
		<svelte:element this={`h${Math.min(level + 1, 5)}`} class="incidents__title" id="{id}-i"
			>{t.incidents}</svelte:element
		>
		{#if incidents.length === 0}
			<p class="incidents__none">{t.noIncidents}</p>
		{:else}
			<ul class="incident-list">
				{#each incidents as incident (incident.id)}
					<li>
						<article class="incident">
							<header class="incident__head">
								<h4 class="incident__title">{incident.title}</h4>
								<Badge tone={incident.status === 'resolved' ? 'success' : 'warning'}
									>{t[incident.status]}</Badge
								>
							</header>
							<p class="incident__when">
								<time datetime={incident.startedAt}
									>{formatCommerceDate(incident.startedAt, locale, timeZone, 'long')}</time
								>
							</p>
							<ol class="updates">
								{#each incident.updates as u (u.at + u.text)}
									<li>
										<time datetime={u.at}>{formatCommerceDate(u.at, locale, timeZone)}</time>
										{#if u.status}<strong>{u.status}.</strong>{/if}
										{u.text}
									</li>
								{/each}
							</ol>
						</article>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</section>

<style>
	.status {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-lg);
		min-width: 0;
		color: var(--color-text);
	}

	.status__head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--spacing-sm);
	}

	.status__title,
	.incidents__title {
		margin: 0;
		font-size: 1.25rem;
	}

	.status__updated,
	.incidents__none {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.banner {
		--tone: var(--color-success);
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		margin: 0;
		padding: var(--spacing-md);
		border: 1px solid var(--tone);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--tone) 12%, var(--color-background));
		font-weight: 700;
	}

	.banner--warning {
		--tone: var(--color-warning);
	}

	.banner--danger {
		--tone: var(--color-danger);
	}

	.banner--info {
		--tone: var(--color-primary);
	}

	.banner__icon {
		display: inline-grid;
		place-items: center;
		flex-shrink: 0;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		background: var(--tone);
		color: var(--color-background);
		font-size: 0.875rem;
	}

	.components,
	.incident-list {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.component {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		min-width: 0;
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	.component__head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-sm);
	}

	.component__name {
		margin: 0;
		font-size: 1rem;
	}

	.component__desc,
	.component__foot,
	.detail {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
	}

	.strip {
		display: flex;
		gap: 1px;
		height: 2rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.strip:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 3px;
	}

	.day {
		--tone: var(--color-success);
		flex: 1 1 0;
		min-width: 1px;
		border-radius: 1px;
		background: var(--tone);
		cursor: pointer;
	}

	.day--degraded {
		--tone: var(--color-warning);
	}

	.day--down {
		--tone: var(--color-danger);
	}

	.day--none {
		--tone: var(--color-border);
	}

	/* Not colour alone: trouble days are shorter-topped with a stripe. */
	.day--degraded,
	.day--down {
		background-image: repeating-linear-gradient(
			0deg,
			transparent 0 3px,
			color-mix(in srgb, var(--color-background) 40%, transparent) 3px 5px
		);
		background-color: var(--tone);
	}

	.day--active {
		outline: 2px solid var(--color-text);
		outline-offset: 1px;
	}

	.detail__label {
		font-weight: 600;
	}

	.issues summary {
		min-height: 2.75rem;
		padding-block: var(--spacing-sm);
		cursor: pointer;
		font-size: 0.875rem;
	}

	.issues ul {
		margin: 0;
		padding-inline-start: var(--spacing-lg);
		font-size: 0.875rem;
	}

	.issues p {
		margin: 0;
		font-size: 0.875rem;
	}

	.incidents {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
	}

	.incident {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.incident__head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-sm);
	}

	.incident__title {
		margin: 0;
		font-size: 1rem;
	}

	.incident__when {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
	}

	.updates {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		margin: 0;
		padding-inline-start: var(--spacing-lg);
		font-size: 0.9375rem;
	}

	.updates time {
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
	}

	@media (forced-colors: active) {
		.day {
			background: Highlight;
		}

		.day--down {
			background: LinkText;
		}
	}
</style>
