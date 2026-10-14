<!--
	CalendarSchedule — a month you can move around with the keyboard, and the
	agenda for the day you pick. The month is an ARIA grid: one day is in the tab
	order, arrows move a day or a week, Home/End the start and end of the week,
	PageUp/PageDown a month, Enter picks the day. Events show on the grid and in
	the agenda list underneath (which is also what narrow screens read), and
	"Add event" or an event opens a dialog with labelled, validated fields.

	Days are plain `YYYY-MM-DD` keys, so the grid is identical in every time
	zone; "today" comes from the `now` and `timeZone` you pass. Bind `events`.

	<CalendarSchedule label="Team calendar" bind:events {now} />
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import Dialog from '$lib/ui/Dialog.svelte';
	import Field from '$lib/ui/Field.svelte';
	import TextInput from '$lib/ui/TextInput.svelte';
	import { uid } from '$lib/ui/logic';
	import {
		addCalendarEvent,
		addMonthKey,
		dayCellLabel,
		dayLabelLong,
		eventsOn,
		monthGrid,
		monthLabel,
		moveDayFocus,
		parseDayKey,
		removeCalendarEvent,
		sameMonthKey,
		timeRange,
		updateCalendarEvent,
		validateEvent,
		weekdayNames,
		type CalendarEvent
	} from './calendar-logic';
	import { dayKey, type DateInput } from './time-logic';

	export let label = 'Calendar';
	export let events: CalendarEvent[] = [];
	/** The day with keyboard focus; its month is the month shown. `YYYY-MM-DD`. */
	export let focused = '';
	/** The day whose agenda is listed. */
	export let selected = '';
	export let now: DateInput = new Date();
	export let timeZone = 'UTC';
	export let locale = 'en-US';
	/** 0 = Sunday … 6 = Saturday. */
	export let weekStart = 0;
	export let editable = true;
	/** Heading level of the month title. */
	export let level: 2 | 3 | 4 | 5 | 6 = 3;
	export let newId: () => string = () => uid('event');
	export let copy = {
		previous: 'Previous month',
		next: 'Next month',
		today: 'Today',
		agenda: 'Agenda',
		noEvents: 'Nothing scheduled.',
		add: 'Add event',
		edit: 'Edit event',
		title: 'Title',
		date: 'Date',
		endDate: 'End date (optional)',
		start: 'Starts (optional)',
		end: 'Ends (optional)',
		description: 'Notes',
		save: 'Save',
		cancel: 'Cancel',
		delete: 'Delete event',
		allDay: 'All day',
		more: 'more'
	};

	const dispatch = createEventDispatcher<{
		select: { day: string };
		monthchange: { month: string };
		add: { event: CalendarEvent };
		update: { event: CalendarEvent };
		remove: { id: string };
	}>();

	const prefix = uid('cal');
	let root: HTMLElement;
	let dialogOpen = false;
	let editingId: string | null = null;
	let errors: Record<string, string> = {};
	let draft = blank('');
	let returnTo = '';

	$: today = dayKey(now, timeZone);
	$: if (!parseDayKey(focused)) focused = today;
	$: if (!parseDayKey(selected)) selected = focused;
	$: heading = `h${level}`;
	$: agendaHeading = `h${Math.min(level + 1, 6)}`;
	$: grid = monthGrid(focused, weekStart);
	$: names = weekdayNames(weekStart, locale, 'short');
	$: longNames = weekdayNames(weekStart, locale, 'long');
	$: title = monthLabel(focused, locale);
	$: agenda = eventsOn(events, selected);

	function blank(date: string) {
		return { title: '', date, endDate: '', start: '', end: '', description: '' };
	}

	async function focusDay(key: string) {
		await tick();
		root?.querySelector<HTMLElement>(`[data-day="${key}"]`)?.focus();
	}

	function go(key: string, pick = false) {
		const monthChanged = !sameMonthKey(key, focused);
		focused = key;
		if (pick) {
			selected = key;
			dispatch('select', { day: key });
		}
		if (monthChanged) dispatch('monthchange', { month: key.slice(0, 7) });
	}

	function shift(months: number) {
		const key = addMonthKey(focused, months);
		go(key, true);
	}

	function toToday() {
		go(today, true);
		focusDay(today);
	}

	function onGridKey(event: KeyboardEvent) {
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		const next = moveDayFocus(focused, event.key, weekStart);
		if (!next) return;
		event.preventDefault();
		go(next);
		focusDay(next);
	}

	function pick(key: string) {
		go(key, true);
	}

	async function openDialog(event: CalendarEvent | null, trigger: HTMLElement | null = null) {
		returnTo = trigger?.id ?? '';
		errors = {};
		editingId = event?.id ?? null;
		draft = event
			? {
					title: event.title,
					date: event.date,
					endDate: event.endDate ?? '',
					start: event.start ?? '',
					end: event.end ?? '',
					description: event.description ?? ''
				}
			: blank(selected);
		dialogOpen = true;
		await tick();
		root?.querySelector<HTMLElement>('dialog[open] input')?.focus();
	}

	function save() {
		const candidate: CalendarEvent = {
			id: editingId ?? newId(),
			title: draft.title.trim(),
			date: draft.date,
			...(draft.endDate ? { endDate: draft.endDate } : {}),
			...(draft.start ? { start: draft.start } : {}),
			...(draft.end ? { end: draft.end } : {}),
			...(draft.description.trim() ? { description: draft.description.trim() } : {})
		};
		errors = validateEvent(candidate);
		if (Object.keys(errors).length > 0) return;
		if (editingId) {
			events = updateCalendarEvent(events, candidate);
			dispatch('update', { event: candidate });
		} else {
			events = addCalendarEvent(events, candidate);
			dispatch('add', { event: candidate });
		}
		dialogOpen = false;
		selected = candidate.date;
		if (!sameMonthKey(candidate.date, focused)) go(candidate.date);
		restoreFocus();
	}

	function remove() {
		if (!editingId) return;
		const id = editingId;
		events = removeCalendarEvent(events, id);
		dispatch('remove', { id });
		dialogOpen = false;
		restoreFocus();
	}

	async function restoreFocus() {
		await tick();
		const target = returnTo ? document.getElementById(returnTo) : null;
		(target ?? root?.querySelector<HTMLElement>(`[data-day="${selected}"]`))?.focus();
	}

	function chips(key: string) {
		return eventsOn(events, key);
	}
</script>

<section class="cal" aria-label={label} bind:this={root}>
	<div class="cal__bar">
		<svelte:element this={heading} class="cal__title" id="{prefix}-title" aria-live="polite">
			{title}
		</svelte:element>
		<div class="cal__nav">
			<button type="button" class="cal__btn" aria-label={copy.previous} on:click={() => shift(-1)}
				><span aria-hidden="true">‹</span></button
			>
			<button type="button" class="cal__btn" on:click={toToday}>{copy.today}</button>
			<button type="button" class="cal__btn" aria-label={copy.next} on:click={() => shift(1)}
				><span aria-hidden="true">›</span></button
			>
		</div>
	</div>

	<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
	<table class="cal__grid" role="grid" aria-labelledby="{prefix}-title" on:keydown={onGridKey}>
		<thead>
			<tr>
				{#each names as name, i (i)}
					<th scope="col" abbr={longNames[i]}>{name}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each grid as week (week[0].key)}
				<tr>
					{#each week as day (day.key)}
						{@const list = chips(day.key)}
						<td
							role="gridcell"
							class="cal__cell"
							class:cal__cell--out={!day.inMonth}
							aria-selected={day.key === selected}
						>
							<button
								type="button"
								class="cal__day"
								class:cal__day--today={day.key === today}
								class:cal__day--selected={day.key === selected}
								data-day={day.key}
								tabindex={day.key === focused ? 0 : -1}
								aria-current={day.key === today ? 'date' : undefined}
								on:click={() => pick(day.key)}
							>
								<span class="sr-only">{dayCellLabel(day.key, list.length, locale)}</span>
								<span class="cal__num" aria-hidden="true">{day.day}</span>
								{#if list.length > 0}
									<span class="cal__chips" aria-hidden="true">
										<span class="cal__count">{list.length}</span>
										{#each list.slice(0, 2) as e (e.id)}
											<span class="cal__chip cal__chip--{e.tone ?? 'neutral'}">{e.title}</span>
										{/each}
										{#if list.length > 2}<span class="cal__more"
												>+{list.length - 2} {copy.more}</span
											>{/if}
									</span>
								{/if}
							</button>
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>

	<section class="cal__agenda" aria-labelledby="{prefix}-agenda">
		<div class="cal__agendabar">
			<svelte:element this={agendaHeading} id="{prefix}-agenda" class="cal__agendatitle">
				{copy.agenda}: {dayLabelLong(selected, locale)}
			</svelte:element>
			{#if editable}
				<button
					type="button"
					class="cal__btn cal__btn--primary"
					id="{prefix}-add"
					on:click={(e) => openDialog(null, e.currentTarget)}>{copy.add}</button
				>
			{/if}
		</div>
		{#if agenda.length === 0}
			<p class="cal__none">{copy.noEvents}</p>
		{:else}
			<ul class="cal__list">
				{#each agenda as e (e.id)}
					<li>
						<button
							type="button"
							class="cal__event"
							id="{prefix}-event-{e.id}"
							disabled={!editable}
							on:click={(ev) => openDialog(e, ev.currentTarget)}
						>
							<span class="cal__time">{timeRange(e, copy.allDay)}</span>
							<span class="cal__etitle">{e.title}</span>
							{#if e.endDate && e.endDate !== e.date}
								<Badge tone="info">{e.date} → {e.endDate}</Badge>
							{/if}
						</button>
						{#if e.description}<p class="cal__desc">{e.description}</p>{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<Dialog bind:open={dialogOpen} title={editingId ? copy.edit : copy.add}>
		<form class="cal__form" on:submit|preventDefault={save} novalidate>
			<TextInput
				label={copy.title}
				bind:value={draft.title}
				error={errors.title ?? ''}
				required
				autocomplete="off"
			/>
			<Field
				label={copy.date}
				error={errors.date ?? ''}
				required
				let:id
				let:describedBy
				let:invalid
			>
				<input
					{id}
					type="date"
					bind:value={draft.date}
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
				/>
			</Field>
			<Field label={copy.endDate} error={errors.endDate ?? ''} let:id let:describedBy let:invalid>
				<input
					{id}
					type="date"
					bind:value={draft.endDate}
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
				/>
			</Field>
			<div class="cal__times">
				<Field label={copy.start} let:id>
					<input {id} type="time" bind:value={draft.start} />
				</Field>
				<Field label={copy.end} error={errors.end ?? ''} let:id let:describedBy let:invalid>
					<input
						{id}
						type="time"
						bind:value={draft.end}
						aria-describedby={describedBy}
						aria-invalid={invalid || undefined}
					/>
				</Field>
			</div>
			<Field label={copy.description} let:id>
				<textarea {id} rows="3" bind:value={draft.description}></textarea>
			</Field>
			{#if Object.keys(errors).length > 0}
				<p class="cal__errors" role="alert">{Object.values(errors).join(' ')}</p>
			{/if}
			<div class="cal__formbuttons">
				<button type="submit" class="cal__btn cal__btn--primary">{copy.save}</button>
				<button type="button" class="cal__btn" on:click={() => (dialogOpen = false)}
					>{copy.cancel}</button
				>
				{#if editingId}
					<button type="button" class="cal__btn cal__btn--danger" on:click={remove}
						>{copy.delete}</button
					>
				{/if}
			</div>
		</form>
	</Dialog>
</section>

<style>
	.cal {
		container-type: inline-size;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
	}

	.cal__bar,
	.cal__agendabar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-sm);
	}

	.cal__title,
	.cal__agendatitle {
		margin: 0;
		font-size: 1.125rem;
	}

	.cal__agendatitle {
		font-size: 1rem;
	}

	.cal__nav {
		display: flex;
		gap: var(--spacing-xs);
	}

	.cal__btn {
		min-width: 2.75rem;
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

	.cal__btn--primary {
		border-color: var(--color-primary-solid);
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
	}

	.cal__btn--danger {
		color: var(--color-danger);
	}

	.cal__btn:hover {
		background: var(--color-surface-hover);
	}

	.cal__btn--primary:hover {
		background: var(--color-primary-solid);
	}

	.cal__grid {
		width: 100%;
		table-layout: fixed;
		border-collapse: collapse;
	}

	.cal__grid th {
		padding: var(--spacing-xs);
		color: var(--color-text-secondary);
		font-size: 0.75rem;
		font-weight: 700;
		text-align: center;
	}

	.cal__cell {
		padding: 0;
		border: 1px solid var(--color-border);
		vertical-align: top;
	}

	.cal__cell--out .cal__day {
		color: var(--color-text-secondary);
		background: var(--color-surface);
	}

	.cal__day {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		justify-items: center;
		gap: 0.125rem;
		width: 100%;
		min-height: 2.75rem;
		padding: 0.125rem;
		border: 0;
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
		cursor: pointer;
	}

	.cal__day:hover {
		background: var(--color-surface-hover);
	}

	.cal__day--selected {
		box-shadow: inset 0 0 0 2px var(--color-primary);
	}

	.cal__num {
		display: inline-grid;
		place-items: center;
		min-width: 1.75rem;
		height: 1.75rem;
		border-radius: 50%;
		font-weight: 600;
	}

	.cal__day--today .cal__num {
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
	}

	.cal__chips {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		justify-items: center;
		gap: 0.125rem;
		width: 100%;
		min-width: 0;
	}

	.cal__count {
		min-width: 1.25rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: var(--color-surface);
		font-size: 0.6875rem;
		font-weight: 700;
		line-height: 1.25rem;
		text-align: center;
	}

	.cal__chip,
	.cal__more {
		display: none;
	}

	.cal__day:focus-visible,
	.cal__btn:focus-visible,
	.cal__event:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.cal__none,
	.cal__desc {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.cal__list {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.cal__event {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-sm);
		width: 100%;
		min-height: 2.75rem;
		padding: var(--spacing-xs) var(--spacing-md);
		border: 1px solid var(--color-border);
		border-inline-start-width: 4px;
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
		text-align: start;
		cursor: pointer;
	}

	.cal__event:disabled {
		cursor: default;
	}

	.cal__time {
		min-width: 6.5rem;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		font-variant-numeric: tabular-nums;
	}

	.cal__etitle {
		flex: 1;
		min-width: 0;
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.cal__form {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
	}

	.cal__times {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: var(--spacing-md);
	}

	.cal__form input,
	.cal__form textarea {
		width: 100%;
		min-height: 2.75rem;
		box-sizing: border-box;
	}

	.cal__formbuttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.cal__errors {
		margin: 0;
		color: var(--color-error);
		font-size: 0.875rem;
	}

	@container (min-width: 40rem) {
		.cal__day {
			min-height: 6rem;
			justify-items: stretch;
			padding: var(--spacing-xs);
		}

		.cal__num {
			justify-self: start;
		}

		.cal__chips {
			justify-items: stretch;
		}

		.cal__count {
			display: none;
		}

		.cal__chip,
		.cal__more {
			display: block;
			overflow: hidden;
			padding: 0 var(--spacing-xs);
			border-inline-start: 3px solid var(--color-primary);
			border-radius: var(--radius-sm);
			background: color-mix(in srgb, var(--color-primary) 12%, var(--color-background));
			font-size: 0.75rem;
			text-align: start;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.cal__more {
			border-inline-start-color: var(--color-border);
			background: transparent;
			color: var(--color-text-secondary);
		}

		.cal__chip--success {
			border-inline-start-color: var(--color-success);
		}

		.cal__chip--warning {
			border-inline-start-color: var(--color-warning);
		}

		.cal__chip--danger {
			border-inline-start-color: var(--color-danger);
		}
	}
</style>
