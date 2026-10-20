<!--
	Calendar — one month as a grid of days (the ARIA date grid from the APG
	date picker). One tab stop for the grid; arrow keys move by a day or a
	week, PageUp/PageDown by a month and with Shift by a year, Home/End to the
	start or end of the week, and Enter or Space picks. The month follows
	focus. Bind `value` as a yyyy-mm-dd string; `min`, `max` and `isDisabled`
	rule days out. Month and weekday names come from Intl for `locale`.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import {
		addMonths,
		calendarKeyTarget,
		formatISODate,
		fullDateLabel,
		initialFocusDate,
		isDateDisabled,
		monthGrid,
		monthLabel,
		parseISODate,
		sameDay,
		todayYMD,
		weekdayNames,
		type Weekday,
		type YMD
	} from './form-logic';
	import { uid } from './logic';

	export let value = '';
	export let min = '';
	export let max = '';
	/** Rule out single days: called with the yyyy-mm-dd string and the plain date. */
	export let isDisabled: ((iso: string, date: YMD) => boolean) | null = null;
	export let weekStartsOn: Weekday = 0;
	export let locale = 'en-US';
	/** The grid's accessible name, read before the month. */
	export let label = 'Choose a date';
	/** Today, as yyyy-mm-dd. Defaults to the device's date; pass one for stable output. */
	export let today = formatISODate(todayYMD());

	const dispatch = createEventDispatcher<{ change: { value: string } }>();
	const id = uid('calendar');
	let grid: HTMLTableElement;

	$: selected = parseISODate(value);
	$: minDate = parseISODate(min);
	$: maxDate = parseISODate(max);
	$: todayDate = parseISODate(today) ?? todayYMD();
	let focused: YMD = initialFocusDate(parseISODate(value), parseISODate(today) ?? todayYMD());
	$: weeks = monthGrid(focused.year, focused.month, weekStartsOn);
	$: shortNames = weekdayNames(locale, weekStartsOn, 'short');
	$: longNames = weekdayNames(locale, weekStartsOn, 'long');
	$: heading = monthLabel(focused.year, focused.month, locale);

	// A new value from outside moves the view to it.
	$: if (selected) focused = selected;

	$: disabledDay = (date: YMD) =>
		isDateDisabled(
			date,
			minDate,
			maxDate,
			isDisabled ? (d: YMD) => isDisabled!(formatISODate(d), d) : null
		);

	async function focusOn(date: YMD, moveFocus = true) {
		focused = date;
		if (!moveFocus) return;
		await tick();
		grid?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
	}

	/** Put keyboard focus on the current day, as a popup does when it opens. */
	export function focus() {
		focusOn(initialFocusDate(selected, focused, minDate, maxDate));
	}

	function choose(date: YMD) {
		if (disabledDay(date)) return;
		focused = date;
		value = formatISODate(date);
		dispatch('change', { value });
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			choose(focused);
			return;
		}
		const next = calendarKeyTarget(
			focused,
			event.key,
			event.shiftKey,
			weekStartsOn,
			minDate,
			maxDate
		);
		if (!next) return;
		event.preventDefault();
		focusOn(next);
	}

	function step(months: number) {
		const next = addMonths(focused, months);
		focused = initialFocusDate(next, next, minDate, maxDate);
	}

	// Picks by pointer, delegated from the grid so the cells need no handlers.
	function pointerPick(node: HTMLElement) {
		const onClick = (event: MouseEvent) => {
			const date = parseISODate(
				(event.target as Element).closest('[data-date]')?.getAttribute('data-date')
			);
			if (date) choose(date);
		};
		node.addEventListener('click', onClick);
		return { destroy: () => node.removeEventListener('click', onClick) };
	}
</script>

<div class="calendar">
	<div class="calendar__header">
		<button
			type="button"
			class="calendar__nav"
			aria-label="Previous month"
			on:click={() => step(-1)}
		>
			<span aria-hidden="true">‹</span>
		</button>
		<div id="{id}-heading" class="calendar__heading" aria-live="polite">{heading}</div>
		<button type="button" class="calendar__nav" aria-label="Next month" on:click={() => step(1)}>
			<span aria-hidden="true">›</span>
		</button>
	</div>
	<table
		bind:this={grid}
		class="calendar__grid"
		role="grid"
		tabindex="-1"
		aria-label="{label}, {heading}"
		use:pointerPick
		on:keydown={onKeydown}
	>
		<thead>
			<tr>
				{#each shortNames as name, i}
					<th scope="col" abbr={longNames[i]}>{name}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each weeks as week}
				<tr>
					{#each week as date}
						{#if date.month === focused.month}
							<td
								class="calendar__day"
								class:calendar__day--today={sameDay(date, todayDate)}
								data-date={formatISODate(date)}
								tabindex={sameDay(date, focused) ? 0 : -1}
								aria-selected={sameDay(date, selected)}
								aria-disabled={disabledDay(date) || undefined}
								aria-current={sameDay(date, todayDate) ? 'date' : undefined}
								aria-label={fullDateLabel(date, locale)}
							>
								{date.day}
							</td>
						{:else}
							<td class="calendar__blank"></td>
						{/if}
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.calendar {
		display: inline-grid;
		gap: var(--spacing-sm);
		max-width: 100%;
		padding: var(--spacing-sm);
		color: var(--color-text);
	}

	.calendar__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-sm);
	}

	.calendar__heading {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		text-align: center;
	}

	.calendar__nav {
		width: 2.25rem;
		height: 2.25rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
	}

	.calendar__nav:hover {
		background: var(--color-surface-hover);
	}

	.calendar__grid {
		border-collapse: separate;
		border-spacing: 2px;
	}

	th {
		padding: var(--spacing-xs) 0;
		color: var(--color-text-secondary);
		font-size: 0.75rem;
		font-weight: 600;
	}

	.calendar__day,
	.calendar__blank {
		width: 2.5rem;
		height: 2.5rem;
		padding: 0;
		text-align: center;
	}

	.calendar__day {
		border-radius: var(--radius-md);
		font-variant-numeric: tabular-nums;
		cursor: pointer;
	}

	.calendar__day:hover {
		background: var(--color-surface-hover);
	}

	.calendar__day--today {
		font-weight: 700;
		box-shadow: inset 0 0 0 1px var(--color-border);
	}

	.calendar__day[aria-selected='true'] {
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
	}

	.calendar__day[aria-disabled='true'] {
		color: var(--color-text-secondary);
		text-decoration: line-through;
		opacity: 0.55;
		cursor: not-allowed;
	}

	.calendar__day:focus-visible,
	.calendar__nav:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 1px;
	}

	@media (max-width: 380px) {
		.calendar__day,
		.calendar__blank {
			width: 2.25rem;
			height: 2.25rem;
		}
	}
</style>
