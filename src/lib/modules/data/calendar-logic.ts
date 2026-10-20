/**
 * Calendar maths on plain `YYYY-MM-DD` day keys. No time zones are involved
 * (a day is a day), so a grid is the same on every machine; everything is
 * computed in UTC.
 */

export interface CalendarEvent {
	id: string;
	title: string;
	/** First day, `YYYY-MM-DD`. */
	date: string;
	/** Last day for a multi-day event; defaults to `date`. */
	endDate?: string;
	/** `HH:MM`, 24-hour. Omit for all-day. */
	start?: string;
	end?: string;
	description?: string;
	tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}

export interface DayParts {
	y: number;
	m: number;
	d: number;
}

export function parseDayKey(key: string): DayParts | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
	if (!match) return null;
	const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
	const probe = new Date(Date.UTC(y, m - 1, d));
	if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
		return null;
	}
	return { y, m, d };
}

export function formatDayKey(y: number, m: number, d: number): string {
	const pad = (n: number, w: number) => String(n).padStart(w, '0');
	return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
}

function fromDate(date: Date): string {
	return formatDayKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function toUtc(key: string): Date {
	const p = parseDayKey(key) ?? { y: 1970, m: 1, d: 1 };
	return new Date(Date.UTC(p.y, p.m - 1, p.d));
}

export function addDayKey(key: string, n: number): string {
	const date = toUtc(key);
	date.setUTCDate(date.getUTCDate() + n);
	return fromDate(date);
}

/** Add months, keeping the day of month where possible (31 Jan + 1 month = 28/29 Feb). */
export function addMonthKey(key: string, n: number): string {
	const p = parseDayKey(key) ?? { y: 1970, m: 1, d: 1 };
	const index = p.y * 12 + (p.m - 1) + n;
	const y = Math.floor(index / 12);
	const m = (((index % 12) + 12) % 12) + 1;
	const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
	return formatDayKey(y, m, Math.min(p.d, last));
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOfKey(key: string): number {
	return toUtc(key).getUTCDay();
}

export function startOfMonthKey(key: string): string {
	const p = parseDayKey(key) ?? { y: 1970, m: 1, d: 1 };
	return formatDayKey(p.y, p.m, 1);
}

export function sameMonthKey(a: string, b: string): boolean {
	return a.slice(0, 7) === b.slice(0, 7);
}

export interface CalendarDay {
	key: string;
	day: number;
	inMonth: boolean;
	weekday: number;
}

/**
 * The weeks to draw for the month containing `key`: complete weeks, with the
 * neighbouring months' days filling the ends. `weekStart` is 0 (Sunday) – 6.
 */
export function monthGrid(key: string, weekStart = 0): CalendarDay[][] {
	const first = startOfMonthKey(key);
	const lead = (weekdayOfKey(first) - weekStart + 7) % 7;
	const start = addDayKey(first, -lead);
	const daysInMonth = new Date(
		Date.UTC((parseDayKey(first) as DayParts).y, (parseDayKey(first) as DayParts).m, 0)
	).getUTCDate();
	const weeks = Math.ceil((lead + daysInMonth) / 7);
	const grid: CalendarDay[][] = [];
	for (let w = 0; w < weeks; w++) {
		const row: CalendarDay[] = [];
		for (let i = 0; i < 7; i++) {
			const day = addDayKey(start, w * 7 + i);
			row.push({
				key: day,
				day: (parseDayKey(day) as DayParts).d,
				inMonth: sameMonthKey(day, first),
				weekday: weekdayOfKey(day)
			});
		}
		grid.push(row);
	}
	return grid;
}

/** Weekday names starting from `weekStart`. */
export function weekdayNames(
	weekStart = 0,
	locale = 'en-US',
	width: 'long' | 'short' | 'narrow' = 'short'
): string[] {
	const format = new Intl.DateTimeFormat(locale, { weekday: width, timeZone: 'UTC' });
	// 2023-01-01 was a Sunday.
	return Array.from({ length: 7 }, (_, i) =>
		format.format(new Date(Date.UTC(2023, 0, 1 + ((weekStart + i) % 7))))
	);
}

export function monthLabel(key: string, locale = 'en-US'): string {
	return new Intl.DateTimeFormat(locale, {
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(toUtc(key));
}

export function dayLabelLong(key: string, locale = 'en-US'): string {
	return new Intl.DateTimeFormat(locale, {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(toUtc(key));
}

/** Where an arrow-style key moves the focused day, or null for any other key. */
export function moveDayFocus(key: string, press: string, weekStart = 0): string | null {
	switch (press) {
		case 'ArrowLeft':
			return addDayKey(key, -1);
		case 'ArrowRight':
			return addDayKey(key, 1);
		case 'ArrowUp':
			return addDayKey(key, -7);
		case 'ArrowDown':
			return addDayKey(key, 7);
		case 'PageUp':
			return addMonthKey(key, -1);
		case 'PageDown':
			return addMonthKey(key, 1);
		case 'Home':
			return addDayKey(key, -((weekdayOfKey(key) - weekStart + 7) % 7));
		case 'End':
			return addDayKey(key, 6 - ((weekdayOfKey(key) - weekStart + 7) % 7));
		default:
			return null;
	}
}

/** Events on a day (multi-day events included), all-day first, then by start time. */
export function eventsOn(events: readonly CalendarEvent[], key: string): CalendarEvent[] {
	return events
		.filter((e) => e.date <= key && key <= (e.endDate ?? e.date))
		.sort((a, b) => (a.start ?? '').localeCompare(b.start ?? '') || a.title.localeCompare(b.title));
}

export function eventsInMonth(events: readonly CalendarEvent[], key: string): CalendarEvent[] {
	const first = startOfMonthKey(key);
	const last = addDayKey(addMonthKey(first, 1), -1);
	return events
		.filter((e) => e.date <= last && first <= (e.endDate ?? e.date))
		.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''));
}

/** "09:30 – 10:15", "From 09:30", or "All day". */
export function timeRange(event: Pick<CalendarEvent, 'start' | 'end'>, allDay = 'All day'): string {
	if (!event.start) return allDay;
	return event.end ? `${event.start} – ${event.end}` : event.start;
}

/** Accessible name for a day cell: "Tuesday, October 13, 2026, 2 events". */
export function dayCellLabel(key: string, count: number, locale = 'en-US'): string {
	const base = dayLabelLong(key, locale);
	if (count === 0) return base;
	return `${base}, ${count} ${count === 1 ? 'event' : 'events'}`;
}

/** Validate an event being created: title, date, and that it does not end before it starts. */
export function validateEvent(
	input: Pick<CalendarEvent, 'title' | 'date' | 'endDate' | 'start' | 'end'>,
	messages = {
		title: 'Enter a title.',
		date: 'Choose a valid date.',
		range: 'The end cannot be before the start.'
	}
): Record<string, string> {
	const errors: Record<string, string> = {};
	if (!input.title.trim()) errors.title = messages.title;
	if (!parseDayKey(input.date)) errors.date = messages.date;
	else if (input.endDate && (!parseDayKey(input.endDate) || input.endDate < input.date)) {
		errors.endDate = messages.range;
	} else if (!input.endDate || input.endDate === input.date) {
		if (input.start && input.end && input.end < input.start) errors.end = messages.range;
	}
	return errors;
}

export function addCalendarEvent(
	events: readonly CalendarEvent[],
	event: CalendarEvent
): CalendarEvent[] {
	return [...events, event];
}

export function updateCalendarEvent(
	events: readonly CalendarEvent[],
	event: CalendarEvent
): CalendarEvent[] {
	return events.map((e) => (e.id === event.id ? event : e));
}

export function removeCalendarEvent(events: readonly CalendarEvent[], id: string): CalendarEvent[] {
	return events.filter((e) => e.id !== id);
}
