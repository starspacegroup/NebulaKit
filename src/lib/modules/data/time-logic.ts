/**
 * Dates for feeds, threads and logs: which calendar day something happened on
 * (in a named time zone), how to word "how long ago", and the absolute time a
 * tooltip or `<time title>` shows. Nothing here reads the clock: `now` is always
 * passed in.
 */

export type DateInput = Date | string | number;

export function toDateValue(value: DateInput): Date {
	return value instanceof Date ? value : new Date(value);
}

export function isValidDateInput(value: DateInput): boolean {
	return !Number.isNaN(toDateValue(value).getTime());
}

/** `YYYY-MM-DD` for the day an instant falls on in `timeZone`. */
export function dayKey(value: DateInput, timeZone = 'UTC'): string {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(toDateValue(value));
	const get = Object.fromEntries(parts.map((p) => [p.type, p.value]));
	return `${get.year}-${get.month}-${get.day}`;
}

/** Whole calendar days from `a` to `b` (positive when b is later). */
export function dayDiff(a: string, b: string): number {
	return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export interface DayLabels {
	today: string;
	yesterday: string;
}

export const DEFAULT_DAY_LABELS: DayLabels = { today: 'Today', yesterday: 'Yesterday' };

/** "Today", "Yesterday", or "Tuesday, 6 October" for a `YYYY-MM-DD` key. */
export function dayHeading(
	key: string,
	now: DateInput,
	options: { timeZone?: string; locale?: string; labels?: DayLabels } = {}
): string {
	const { timeZone = 'UTC', locale = 'en-US', labels = DEFAULT_DAY_LABELS } = options;
	const diff = dayDiff(dayKey(now, timeZone), key);
	if (diff === 0) return labels.today;
	if (diff === -1) return labels.yesterday;
	const sameYear = key.slice(0, 4) === dayKey(now, timeZone).slice(0, 4);
	return new Intl.DateTimeFormat(locale, {
		timeZone: 'UTC',
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		year: sameYear ? undefined : 'numeric'
	}).format(new Date(`${key}T12:00:00Z`));
}

export interface DayGroup<T> {
	key: string;
	label: string;
	items: T[];
}

/** Items grouped by the day they fall on, newest day first, newest item first within it. */
export function groupByDay<T>(
	items: readonly T[],
	at: (item: T) => DateInput,
	now: DateInput,
	options: { timeZone?: string; locale?: string; labels?: DayLabels } = {}
): DayGroup<T>[] {
	const zone = options.timeZone ?? 'UTC';
	const valid = items.filter((item) => isValidDateInput(at(item)));
	const sorted = valid
		.map((item, index) => ({ item, index, time: toDateValue(at(item)).getTime() }))
		.sort((a, b) => b.time - a.time || a.index - b.index);
	const groups: DayGroup<T>[] = [];
	for (const { item } of sorted) {
		const key = dayKey(at(item), zone);
		const last = groups[groups.length - 1];
		if (last && last.key === key) last.items.push(item);
		else groups.push({ key, label: dayHeading(key, now, options), items: [item] });
	}
	return groups;
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 31_536_000],
	['month', 2_592_000],
	['week', 604_800],
	['day', 86_400],
	['hour', 3600],
	['minute', 60]
];

/** "just now", "5 minutes ago", "yesterday", "in 2 hours". Under 45 seconds either way is "just now". */
export function relativeTimeText(
	value: DateInput,
	now: DateInput,
	options: { locale?: string; justNow?: string } = {}
): string {
	const { locale = 'en-US', justNow = 'just now' } = options;
	const seconds = Math.round((toDateValue(value).getTime() - toDateValue(now).getTime()) / 1000);
	if (Math.abs(seconds) < 45) return justNow;
	const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
	for (const [unit, size] of UNITS) {
		if (Math.abs(seconds) >= size) return formatter.format(Math.trunc(seconds / size), unit);
	}
	return formatter.format(seconds < 0 ? -1 : 1, 'minute');
}

/** The full date and time, for a tooltip: "Oct 13, 2026, 2:05 PM". */
export function absoluteTimeText(
	value: DateInput,
	options: { locale?: string; timeZone?: string } = {}
): string {
	const { locale = 'en-US', timeZone = 'UTC' } = options;
	return new Intl.DateTimeFormat(locale, {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone
	}).format(toDateValue(value));
}

/** Just the clock time: "2:05 PM". */
export function clockTimeText(
	value: DateInput,
	options: { locale?: string; timeZone?: string } = {}
): string {
	const { locale = 'en-US', timeZone = 'UTC' } = options;
	return new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone }).format(
		toDateValue(value)
	);
}

/** ISO string for a `<time datetime>` attribute. */
export function isoString(value: DateInput): string {
	return toDateValue(value).toISOString();
}
