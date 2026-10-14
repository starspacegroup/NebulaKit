<!--
	NotificationPreferences — a matrix of events by channels. Every row and
	column has a select-all checkbox that shows the mixed (indeterminate) state,
	and channels that support it get their own quiet hours. Bind `value` and
	`quietHours`, or listen to `change`.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Field from '$lib/ui/Field.svelte';
	import Switch from '$lib/ui/Switch.svelte';
	import {
		columnState,
		countEnabled,
		createMatrix,
		describeDuration,
		matrixState,
		nextBulkValue,
		quietDuration,
		rowState,
		setAll,
		setColumn,
		setRow,
		toggleCell,
		validateQuietHours,
		type MatrixCheckState,
		type NotificationMatrix,
		type QuietHours
	} from './logic';

	export let events: { id: string; label: string; description?: string }[] = [];
	export let channels: { id: string; label: string; quietHours?: boolean }[] = [];
	export let value: NotificationMatrix = {};
	/** Quiet hours per channel id. Only channels with `quietHours: true` show the controls. */
	export let quietHours: Record<string, QuietHours> = {};
	export let level: 2 | 3 | 4 = 2;
	export let disabled = false;
	export let copy: Partial<typeof DEFAULT_COPY> = {};

	const DEFAULT_COPY = {
		title: 'Notifications',
		caption: 'Choose how you hear about each event',
		everything: 'Select every notification',
		all: 'All',
		allFor: 'All channels for',
		allOn: 'All events on',
		quietTitle: 'Quiet hours',
		quietIntro: 'Hold notifications on a channel during these hours.',
		quietOn: 'Pause during quiet hours',
		from: 'From',
		to: 'Until',
		summary: 'notifications on',
		quietFrom: 'Quiet from',
		quietTo: 'to'
	};

	const dispatch = createEventDispatcher<{
		change: { value: NotificationMatrix; quietHours: Record<string, QuietHours> };
	}>();

	$: t = { ...DEFAULT_COPY, ...copy };
	$: eventIds = events.map((e) => e.id);
	$: channelIds = channels.map((c) => c.id);
	$: matrix = createMatrix(eventIds, channelIds, value);
	$: quietChannels = channels.filter((c) => c.quietHours);
	$: overall = matrixState(matrix);
	$: total = events.length * channels.length;

	function commit(next: NotificationMatrix) {
		value = next;
		dispatch('change', { value, quietHours });
	}

	function commitQuiet(channel: string, patch: Partial<QuietHours>) {
		const current = quietHours[channel] ?? { enabled: false, start: '22:00', end: '07:00' };
		quietHours = { ...quietHours, [channel]: { ...current, ...patch } };
		dispatch('change', { value: matrix, quietHours });
	}

	function quiet(all: Record<string, QuietHours>, channel: string): QuietHours {
		return all[channel] ?? { enabled: false, start: '22:00', end: '07:00' };
	}

	function onTime(channel: string, key: 'start' | 'end', event: Event) {
		commitQuiet(channel, { [key]: (event.target as HTMLInputElement).value });
	}

	function onQuietSwitch(channel: string, event: Event) {
		commitQuiet(channel, { enabled: (event.target as HTMLInputElement).checked });
	}

	// The native indeterminate flag has no attribute, so it is set from an action.
	function mixed(node: HTMLInputElement, state: MatrixCheckState) {
		node.indeterminate = state === 'mixed';
		return {
			update(next: MatrixCheckState) {
				node.indeterminate = next === 'mixed';
			}
		};
	}
</script>

<section class="notify" aria-labelledby="notify-title">
	<svelte:element this={`h${level}`} id="notify-title" class="notify__title"
		>{t.title}</svelte:element
	>

	<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
	<div class="notify__scroll" role="region" aria-label={t.caption} tabindex="0">
		<table class="notify__table">
			<caption class="sr-only">{t.caption}</caption>
			<thead>
				<tr>
					<th scope="col" class="notify__corner">
						<label class="notify__check">
							<input
								type="checkbox"
								{disabled}
								checked={overall === 'all'}
								use:mixed={overall}
								on:change={() => commit(setAll(matrix, nextBulkValue(overall)))}
							/>
							<span>{t.everything}</span>
						</label>
					</th>
					{#each channels as channel (channel.id)}
						{@const state = columnState(matrix, channel.id)}
						<th scope="col" class="notify__col">
							<label class="notify__check notify__check--stack">
								<input
									type="checkbox"
									{disabled}
									checked={state === 'all'}
									use:mixed={state}
									aria-label="{t.allOn} {channel.label}"
									on:change={() => commit(setColumn(matrix, channel.id, nextBulkValue(state)))}
								/>
								<span>{channel.label}</span>
							</label>
						</th>
					{/each}
					<th scope="col" class="notify__col"><span>{t.all}</span></th>
				</tr>
			</thead>
			<tbody>
				{#each events as event (event.id)}
					{@const state = rowState(matrix, event.id)}
					<tr>
						<th scope="row" class="notify__row">
							<span class="notify__event">{event.label}</span>
							{#if event.description}<span class="notify__desc">{event.description}</span>{/if}
						</th>
						{#each channels as channel (channel.id)}
							<td class="notify__cell">
								<label class="notify__check notify__check--cell">
									<input
										type="checkbox"
										{disabled}
										checked={matrix[event.id][channel.id]}
										aria-label="{event.label}: {channel.label}"
										on:change={() => commit(toggleCell(matrix, event.id, channel.id))}
									/>
								</label>
							</td>
						{/each}
						<td class="notify__cell">
							<label class="notify__check notify__check--cell">
								<input
									type="checkbox"
									{disabled}
									checked={state === 'all'}
									use:mixed={state}
									aria-label="{t.allFor} {event.label}"
									on:change={() => commit(setRow(matrix, event.id, nextBulkValue(state)))}
								/>
							</label>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="notify__summary" role="status">{countEnabled(matrix)} / {total} {t.summary}</p>

	{#if quietChannels.length}
		<div class="quiet">
			<svelte:element this={`h${level + 1}`} class="quiet__title">{t.quietTitle}</svelte:element>
			<p class="quiet__intro">{t.quietIntro}</p>
			<div class="quiet__list">
				{#each quietChannels as channel (channel.id)}
					{@const q = quiet(quietHours, channel.id)}
					{@const error = validateQuietHours(q)}
					{@const minutes = quietDuration(q)}
					<fieldset class="quiet__channel" {disabled}>
						<legend>{channel.label}</legend>
						<Switch
							label="{t.quietOn} ({channel.label})"
							checked={q.enabled}
							on:change={(e) => onQuietSwitch(channel.id, e)}
						/>
						{#if q.enabled}
							<div class="quiet__times">
								<Field
									label="{t.from} ({channel.label})"
									{error}
									let:id
									let:describedBy
									let:invalid
								>
									<input
										{id}
										type="time"
										value={q.start}
										aria-describedby={describedBy}
										aria-invalid={invalid}
										on:input={(e) => onTime(channel.id, 'start', e)}
									/>
								</Field>
								<Field label="{t.to} ({channel.label})" let:id let:describedBy>
									<input
										{id}
										type="time"
										value={q.end}
										aria-describedby={describedBy}
										aria-invalid={Boolean(error)}
										on:input={(e) => onTime(channel.id, 'end', e)}
									/>
								</Field>
							</div>
							{#if !error && minutes}
								<p class="quiet__note">
									{t.quietFrom}
									{q.start}
									{t.quietTo}
									{q.end} ({describeDuration(minutes)})
								</p>
							{/if}
						{/if}
					</fieldset>
				{/each}
			</div>
		</div>
	{/if}
</section>

<style>
	.notify {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
	}

	.notify__title,
	.quiet__title {
		margin: 0;
	}

	.notify__scroll {
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
	}

	.notify__scroll:focus-visible,
	input:focus-visible {
		outline: 3px solid var(--color-primary);
		outline-offset: 2px;
	}

	.notify__table {
		inline-size: 100%;
		border-collapse: collapse;
	}

	.notify__table th,
	.notify__table td {
		padding: var(--spacing-sm);
		border-block-end: 1px solid var(--color-border);
		text-align: start;
		vertical-align: middle;
	}

	.notify__table tbody tr:last-child > * {
		border-block-end: 0;
	}

	.notify__corner,
	.notify__row {
		min-inline-size: 9rem;
	}

	.notify__col {
		min-inline-size: 4.5rem;
		text-align: center !important;
		font-size: 0.85rem;
	}

	.notify__cell {
		text-align: center !important;
	}

	.notify__row {
		font-weight: 400;
	}

	.notify__event {
		display: block;
		font-weight: 600;
	}

	.notify__desc {
		display: block;
		color: var(--color-text-secondary);
		font-size: 0.8rem;
	}

	.notify__check {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-sm);
		min-block-size: 2.75rem;
		cursor: pointer;
	}

	.notify__check--stack {
		flex-direction: column;
		justify-content: center;
		gap: var(--spacing-xs);
	}

	.notify__check--cell {
		justify-content: center;
		min-inline-size: 2.75rem;
	}

	.notify__check input {
		inline-size: 1.25rem;
		block-size: 1.25rem;
		margin: 0;
		accent-color: var(--color-primary-solid);
		cursor: pointer;
	}

	.notify__summary,
	.quiet__intro,
	.quiet__note {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.quiet {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
	}

	.quiet__list {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
		gap: var(--spacing-md);
	}

	.quiet__channel {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		min-width: 0;
		margin: 0;
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.quiet__channel legend {
		padding-inline: var(--spacing-xs);
		font-weight: 600;
	}

	.quiet__times {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
		gap: var(--spacing-sm);
	}

	.quiet__times input {
		inline-size: 100%;
		min-block-size: 2.75rem;
		padding: 0 var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
	}
</style>
