<!--
	AuditLog — a filterable record of who did what. Search across every field,
	tick severities, pick an actor and a date range; the count of matching
	events is announced as you filter. Severity is a word as well as a colour
	("Critical"). Each row can expand to show its details as formatted JSON, and
	"Export CSV" hands the filtered events (ISO timestamps, flat details) to your
	callback. The table scrolls sideways inside its own region on narrow screens.

	<AuditLog label="Security events" {events} timeZone="UTC" on:export={…} />
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Alert from '$lib/ui/Alert.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import Field from '$lib/ui/Field.svelte';
	import Pagination from '$lib/ui/Pagination.svelte';
	import Select from '$lib/ui/Select.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import TextInput from '$lib/ui/TextInput.svelte';
	import { uid } from '$lib/ui/logic';
	import {
		AUDIT_SEVERITIES,
		distinctActors,
		eventsToCsv,
		filterEvents,
		prettyJson,
		SEVERITY_LABELS,
		severityTone,
		type AuditEvent,
		type AuditSeverity
	} from './audit-logic';
	import { paginate, rangeText, resultCount } from './logic';
	import { absoluteTimeText, isoString } from './time-logic';

	export let label = 'Audit log';
	export let events: AuditEvent[] = [];
	export let locale = 'en-US';
	export let timeZone = 'UTC';
	export let pageSize = 10;
	export let query = '';
	export let severities: AuditSeverity[] = [];
	export let actor = '';
	export let from = '';
	export let to = '';
	export let page = 1;
	export let loading = false;
	export let error = '';
	export let exportable = true;
	export let exportName = 'audit-log.csv';
	export let onExport: ((csv: string, name: string) => void) | undefined = undefined;
	export let copy = {
		search: 'Search events',
		severity: 'Severity',
		actor: 'Actor',
		anyone: 'Anyone',
		from: 'From',
		to: 'To',
		clear: 'Clear filters',
		exportCsv: 'Export CSV',
		time: 'Time',
		action: 'Action',
		target: 'Target',
		details: 'Details',
		show: 'Show details',
		hide: 'Hide details',
		newest: 'Newest first',
		oldest: 'Oldest first',
		empty: 'No events recorded.',
		noMatch: 'No events match these filters.',
		retry: 'Try again',
		loading: 'Loading events',
		filters: 'Filters'
	};

	const dispatch = createEventDispatcher<{
		filter: { query: string; severities: AuditSeverity[]; actor: string; from: string; to: string };
		export: { csv: string; name: string; count: number };
		retry: void;
		toggle: { id: string; open: boolean };
	}>();

	const prefix = uid('audit');
	let open: string[] = [];
	let newestFirst = true;

	$: actors = distinctActors(events);
	$: matches = filterEvents(events, { query, severities, actor, from, to, timeZone });
	$: ordered = newestFirst ? matches : matches.slice().reverse();
	$: slice = paginate(ordered.length, page, pageSize);
	$: rows = ordered.slice(slice.start, slice.end);
	$: filtering = Boolean(query.trim() || severities.length || actor || from || to);

	function changed() {
		page = 1;
		dispatch('filter', { query, severities, actor, from, to });
	}

	function onActor(event: Event) {
		actor = (event.currentTarget as HTMLSelectElement).value;
		changed();
	}

	function clear() {
		query = '';
		severities = [];
		actor = '';
		from = '';
		to = '';
		changed();
	}

	function toggle(id: string) {
		const isOpen = open.includes(id);
		open = isOpen ? open.filter((o) => o !== id) : [...open, id];
		dispatch('toggle', { id, open: !isOpen });
	}

	function flip() {
		newestFirst = !newestFirst;
		page = 1;
	}

	function exportCsv() {
		const csv = eventsToCsv(ordered);
		dispatch('export', { csv, name: exportName, count: ordered.length });
		onExport?.(csv, exportName);
	}
</script>

<section class="audit" aria-label={label} aria-busy={loading || undefined}>
	<form class="audit__filters" on:submit|preventDefault role="search" aria-label={copy.filters}>
		<div class="audit__search">
			<TextInput
				type="search"
				label={copy.search}
				bind:value={query}
				autocomplete="off"
				on:input={changed}
			/>
		</div>
		<fieldset class="audit__sev" on:change={changed}>
			<legend>{copy.severity}</legend>
			{#each AUDIT_SEVERITIES as level (level)}
				<label class="audit__check">
					<input type="checkbox" bind:group={severities} value={level} />
					{SEVERITY_LABELS[level]}
				</label>
			{/each}
		</fieldset>
		<Select
			label={copy.actor}
			value={actor}
			options={[{ value: '', label: copy.anyone }, ...actors.map((a) => ({ value: a, label: a }))]}
			on:change={onActor}
		/>
		<Field label={copy.from} let:id>
			<input {id} type="date" bind:value={from} max={to || undefined} on:change={changed} />
		</Field>
		<Field label={copy.to} let:id>
			<input {id} type="date" bind:value={to} min={from || undefined} on:change={changed} />
		</Field>
		<div class="audit__buttons">
			{#if filtering}
				<button type="button" class="audit__btn" on:click={clear}>{copy.clear}</button>
			{/if}
			{#if exportable}
				<button
					type="button"
					class="audit__btn"
					disabled={ordered.length === 0 || loading}
					on:click={exportCsv}>{copy.exportCsv}</button
				>
			{/if}
		</div>
	</form>

	<p class="audit__count" role="status">
		{#if loading}{copy.loading}{:else if !error}{resultCount(
				ordered.length,
				'event',
				'events'
			)}{/if}
	</p>

	{#if error}
		<Alert tone="danger" title={error}>
			<button type="button" class="audit__btn" on:click={() => dispatch('retry')}
				>{copy.retry}</button
			>
		</Alert>
	{:else if loading}
		<Skeleton lines={4} />
	{:else if ordered.length === 0}
		<EmptyState title={filtering ? copy.noMatch : copy.empty}>
			{#if filtering}<button type="button" class="audit__btn" on:click={clear}>{copy.clear}</button
				>{/if}
		</EmptyState>
	{:else}
		<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
		<div class="audit__scroll" role="region" aria-label="{label} table" tabindex="0">
			<table class="audit__table">
				<caption class="sr-only">{label}</caption>
				<thead>
					<tr>
						<th scope="col" aria-sort={newestFirst ? 'descending' : 'ascending'}>
							<button type="button" class="audit__sort" on:click={flip}>
								{copy.time}
								<span aria-hidden="true">{newestFirst ? '▼' : '▲'}</span>
								<span class="sr-only">{newestFirst ? copy.newest : copy.oldest}</span>
							</button>
						</th>
						<th scope="col">{copy.severity}</th>
						<th scope="col">{copy.actor}</th>
						<th scope="col">{copy.action}</th>
						<th scope="col">{copy.target}</th>
						<th scope="col"><span class="sr-only">{copy.details}</span></th>
					</tr>
				</thead>
				<tbody>
					{#each rows as event (event.id)}
						{@const isOpen = open.includes(event.id)}
						<tr class:audit__row--open={isOpen}>
							<td class="audit__time">
								<time datetime={isoString(event.at)} title={isoString(event.at)}
									>{absoluteTimeText(event.at, { locale, timeZone })}</time
								>
							</td>
							<td
								><Badge tone={severityTone(event.severity)}>{SEVERITY_LABELS[event.severity]}</Badge
								></td
							>
							<td>{event.actor}</td>
							<td><code>{event.action}</code></td>
							<td>{event.target ?? '—'}</td>
							<td>
								{#if event.details !== undefined || event.ip}
									<button
										type="button"
										class="audit__btn audit__toggle"
										aria-expanded={isOpen}
										aria-controls="{prefix}-{event.id}"
										on:click={() => toggle(event.id)}
									>
										{isOpen ? copy.hide : copy.show}<span class="sr-only"> — {event.action}</span>
									</button>
								{/if}
							</td>
						</tr>
						{#if isOpen}
							<tr class="audit__detailrow">
								<td colspan="6" id="{prefix}-{event.id}">
									{#if event.ip}<p class="audit__ip">IP: <code>{event.ip}</code></p>{/if}
									{#if event.details !== undefined}
										<pre
											class="audit__json"
											tabindex="0"
											aria-label="{copy.details}: {event.action}"><code
												>{prettyJson(event.details)}</code
											></pre>
									{/if}
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
		<div class="audit__foot">
			<p class="audit__range">{rangeText(slice.start, slice.end, ordered.length)}</p>
			{#if slice.pageCount > 1}
				<Pagination
					page={slice.page}
					total={slice.pageCount}
					label="{label} pages"
					on:change={(e) => (page = e.detail.page)}
				/>
			{/if}
		</div>
	{/if}
</section>

<style>
	.audit {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
	}

	.audit__filters {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
		align-items: end;
		gap: var(--spacing-md);
	}

	.audit__search {
		grid-column: 1 / -1;
	}

	.audit__sev {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs) var(--spacing-md);
		margin: 0;
		padding: var(--spacing-xs) var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.audit__sev legend {
		padding-inline: var(--spacing-xs);
		font-size: 0.9375rem;
		font-weight: 600;
	}

	.audit__check {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
		min-height: 2.75rem;
		cursor: pointer;
	}

	.audit__check input {
		width: 1.5rem;
		height: 1.5rem;
		accent-color: var(--color-primary-solid);
	}

	.audit__buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.audit__btn {
		min-height: 2.75rem;
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.audit__btn:hover:not(:disabled) {
		background: var(--color-surface-hover);
	}

	.audit__btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.audit__count,
	.audit__range {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.audit__scroll {
		position: relative;
		min-width: 0;
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.audit__table {
		width: 100%;
		min-width: 40rem;
		border-collapse: collapse;
	}

	.audit__table th,
	.audit__table td {
		padding: var(--spacing-sm) var(--spacing-md);
		border-bottom: 1px solid var(--color-border);
		text-align: start;
		vertical-align: middle;
	}

	.audit__table th {
		background: var(--color-surface);
		font-size: 0.875rem;
		white-space: nowrap;
	}

	.audit__time {
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.audit__sort {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
		min-height: 2.75rem;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.audit__toggle {
		white-space: nowrap;
	}

	.audit__detailrow td {
		background: var(--color-surface);
	}

	.audit__ip {
		margin: 0 0 var(--spacing-xs);
	}

	.audit__json {
		overflow-x: auto;
		margin: 0;
		padding: var(--spacing-sm) var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-background);
		font-size: 0.8125rem;
	}

	.audit__foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-md);
	}

	.audit__btn:focus-visible,
	.audit__sort:focus-visible,
	.audit__scroll:focus-visible,
	.audit__json:focus-visible,
	.audit__check input:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
</style>
