/**
 * The decisions the kit's richer form controls make, apart from their markup:
 * filtering a combobox, the calendar's date maths, one-time-code cells,
 * number clamping, toggle groups, tags and file checks.
 *
 * Dates are plain { year, month, day } records (month 1–12) with integer
 * arithmetic, never a `Date` in local time, so no timezone or DST change can
 * move a day. `Date` appears only inside the Intl helpers, pinned to UTC.
 */

// ── Combobox ────────────────────────────────────────────────────────────────

export interface ComboOption {
	value: string;
	label: string;
	disabled?: boolean;
}

/** Lower case with accents removed, so "Zürich" is found by "zur". */
export function fold(text: string): string {
	return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * The options that match what was typed, case- and accent-insensitive.
 * Labels that start with the query come first, then those that contain it,
 * each group in its original order. An empty query matches everything.
 */
export function filterOptions<T extends ComboOption>(options: readonly T[], query: string): T[] {
	const q = fold(query);
	if (!q) return [...options];
	const starts: T[] = [];
	const contains: T[] = [];
	for (const option of options) {
		const label = fold(option.label);
		if (label.startsWith(q)) starts.push(option);
		else if (label.includes(q)) contains.push(option);
	}
	return [...starts, ...contains];
}

/** True when `query` is worth offering as a new option: non-empty and not already a label. */
export function canCreate(options: readonly ComboOption[], query: string): boolean {
	const q = fold(query);
	return q !== '' && !options.some((option) => fold(option.label) === q);
}

// ── Dates ───────────────────────────────────────────────────────────────────

export interface YMD {
	year: number;
	/** 1–12 */
	month: number;
	day: number;
}

/** 0 = Sunday … 6 = Saturday, as `Date#getDay`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
	if (month === 2) return isLeapYear(year) ? 29 : 28;
	return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Days since 1970-01-01 for a proleptic Gregorian date (Hinnant's days_from_civil). */
export function toDayNumber({ year, month, day }: YMD): number {
	const y = month <= 2 ? year - 1 : year;
	const era = Math.floor(y / 400);
	const yoe = y - era * 400;
	const mp = (month + 9) % 12;
	const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
	const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
	return era * 146097 + doe - 719468;
}

/** The inverse of `toDayNumber`. */
export function fromDayNumber(days: number): YMD {
	const z = days + 719468;
	const era = Math.floor(z / 146097);
	const doe = z - era * 146097;
	const yoe = Math.floor(
		(doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365
	);
	const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
	const mp = Math.floor((5 * doy + 2) / 153);
	const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
	const month = mp < 10 ? mp + 3 : mp - 9;
	return { year: yoe + era * 400 + (month <= 2 ? 1 : 0), month, day };
}

export function addDays(date: YMD, days: number): YMD {
	return fromDayNumber(toDayNumber(date) + days);
}

/** Move by whole months, holding the day to the end of a shorter month (Jan 31 + 1 → Feb 28/29). */
export function addMonths(date: YMD, months: number): YMD {
	const index = date.year * 12 + (date.month - 1) + months;
	const year = Math.floor(index / 12);
	const month = index - year * 12 + 1;
	return { year, month, day: Math.min(date.day, daysInMonth(year, month)) };
}

export function addYears(date: YMD, years: number): YMD {
	return addMonths(date, years * 12);
}

export function dayOfWeek(date: YMD): Weekday {
	// 1970-01-01 was a Thursday (4).
	return ((((toDayNumber(date) + 4) % 7) + 7) % 7) as Weekday;
}

export function startOfWeek(date: YMD, weekStartsOn: Weekday = 0): YMD {
	return addDays(date, -((dayOfWeek(date) - weekStartsOn + 7) % 7));
}

export function endOfWeek(date: YMD, weekStartsOn: Weekday = 0): YMD {
	return addDays(startOfWeek(date, weekStartsOn), 6);
}

/** Negative, zero or positive, like a sort comparator. */
export function compareDates(a: YMD, b: YMD): number {
	return toDayNumber(a) - toDayNumber(b);
}

export function sameDay(a: YMD | null, b: YMD | null): boolean {
	return !!a && !!b && compareDates(a, b) === 0;
}

const pad = (n: number, width: number) => String(n).padStart(width, '0');

/** yyyy-mm-dd */
export function formatISODate({ year, month, day }: YMD): string {
	return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** A yyyy-mm-dd string as a date, or null when it is malformed or not a real day (2023-02-29). */
export function parseISODate(text: string | null | undefined): YMD | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((text ?? '').trim());
	if (!match) return null;
	const [year, month, day] = match.slice(1).map(Number);
	if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
	return { year, month, day };
}

/** The date held to [min, max]; either bound may be missing. */
export function clampDate(date: YMD, min?: YMD | null, max?: YMD | null): YMD {
	if (min && compareDates(date, min) < 0) return min;
	if (max && compareDates(date, max) > 0) return max;
	return date;
}

/** Outside [min, max], or ruled out by the predicate. */
export function isDateDisabled(
	date: YMD,
	min?: YMD | null,
	max?: YMD | null,
	predicate?: ((date: YMD) => boolean) | null
): boolean {
	if (min && compareDates(date, min) < 0) return true;
	if (max && compareDates(date, max) > 0) return true;
	return predicate ? predicate(date) : false;
}

/**
 * The weeks shown for a month: whole weeks from the one holding the 1st to
 * the one holding the last day, so 4 to 6 rows of 7 dates. Days from the
 * neighbouring months fill the first and last rows.
 */
export function monthGrid(year: number, month: number, weekStartsOn: Weekday = 0): YMD[][] {
	const first = startOfWeek({ year, month, day: 1 }, weekStartsOn);
	const last = endOfWeek({ year, month, day: daysInMonth(year, month) }, weekStartsOn);
	const weeks: YMD[][] = [];
	for (let d = toDayNumber(first); d <= toDayNumber(last); d += 7) {
		weeks.push(Array.from({ length: 7 }, (_, i) => fromDayNumber(d + i)));
	}
	return weeks;
}

/** The weekday numbers in column order for a week that starts on `weekStartsOn`. */
export function weekdayOrder(weekStartsOn: Weekday = 0): Weekday[] {
	return Array.from({ length: 7 }, (_, i) => ((weekStartsOn + i) % 7) as Weekday);
}

/**
 * Where the focused date goes on a key press in the date grid (the APG date
 * picker): arrows by a day or a week, PageUp/PageDown by a month (a year with
 * Shift), Home/End to the start/end of the week. The result is held to
 * [min, max]. Null for any other key.
 */
export function calendarKeyTarget(
	date: YMD,
	key: string,
	shiftKey: boolean,
	weekStartsOn: Weekday = 0,
	min?: YMD | null,
	max?: YMD | null
): YMD | null {
	let next: YMD;
	switch (key) {
		case 'ArrowLeft':
			next = addDays(date, -1);
			break;
		case 'ArrowRight':
			next = addDays(date, 1);
			break;
		case 'ArrowUp':
			next = addDays(date, -7);
			break;
		case 'ArrowDown':
			next = addDays(date, 7);
			break;
		case 'PageUp':
			next = shiftKey ? addYears(date, -1) : addMonths(date, -1);
			break;
		case 'PageDown':
			next = shiftKey ? addYears(date, 1) : addMonths(date, 1);
			break;
		case 'Home':
			next = startOfWeek(date, weekStartsOn);
			break;
		case 'End':
			next = endOfWeek(date, weekStartsOn);
			break;
		default:
			return null;
	}
	return clampDate(next, min, max);
}

/** Where focus starts when the calendar opens: the selection, else today, held to [min, max]. */
export function initialFocusDate(
	selected: YMD | null,
	today: YMD,
	min?: YMD | null,
	max?: YMD | null
): YMD {
	return clampDate(selected ?? today, min, max);
}

/** Today's date in the runtime's local zone, as a plain date. */
export function todayYMD(now: Date = new Date()): YMD {
	return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

const utc = ({ year, month, day }: YMD) => {
	const date = new Date(Date.UTC(2000, month - 1, day));
	date.setUTCFullYear(year);
	return date;
};

/** "March 2026", localized. */
export function monthLabel(year: number, month: number, locale = 'en-US'): string {
	return new Intl.DateTimeFormat(locale, {
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(utc({ year, month, day: 1 }));
}

/** Weekday names in column order, e.g. short ["Mo", …] or long ["Monday", …]. */
export function weekdayNames(
	locale = 'en-US',
	weekStartsOn: Weekday = 0,
	width: 'short' | 'long' = 'short'
): string[] {
	const format = new Intl.DateTimeFormat(locale, { weekday: width, timeZone: 'UTC' });
	// 2023-01-01 was a Sunday, so day 1 + n is weekday n.
	return weekdayOrder(weekStartsOn).map((n) =>
		format.format(utc({ year: 2023, month: 1, day: 1 + n }))
	);
}

/** "Tuesday, March 3, 2026", localized: the accessible name of a day cell. */
export function fullDateLabel(date: YMD, locale = 'en-US'): string {
	return new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' }).format(utc(date));
}

// ── One-time code ───────────────────────────────────────────────────────────

export type OtpMode = 'numeric' | 'alphanumeric';

/** The characters of `text` a cell may hold: digits, or letters and digits (upper-cased). */
export function sanitizeOtp(text: string, mode: OtpMode = 'numeric'): string {
	return mode === 'numeric'
		? text.replace(/\D/g, '')
		: text.replace(/[^a-z0-9]/gi, '').toUpperCase();
}

/** A code as exactly `length` cells, blank where nothing has been typed. */
export function otpCells(value: string, length: number): string[] {
	return Array.from({ length }, (_, i) => value[i] ?? '');
}

/**
 * Type or paste `text` into the cells starting at `index`. Each usable
 * character fills one cell and moves on; anything else is dropped. Returns
 * the new cells and the index focus should go to (the cell after the last
 * filled, or the last cell).
 */
export function fillOtp(
	cells: readonly string[],
	index: number,
	text: string,
	mode: OtpMode = 'numeric'
): { cells: string[]; focus: number } {
	const next = [...cells];
	const chars = sanitizeOtp(text, mode);
	let at = index;
	for (const char of chars) {
		if (at >= next.length) break;
		next[at] = char;
		at += 1;
	}
	return { cells: next, focus: Math.min(at, next.length - 1) };
}

/**
 * What was just typed into a cell that held `previous`: the browser leaves
 * the old character beside the new one when the caret was not over it, so
 * strip the old one from whichever end it is on.
 */
export function otpTyped(previous: string, current: string): string {
	if (!previous || current.length <= previous.length) return current;
	if (current.startsWith(previous)) return current.slice(previous.length);
	if (current.endsWith(previous)) return current.slice(0, -previous.length);
	return current;
}

/** Where a paste starts filling: the first cell when it carries a whole code, else the focused one. */
export function otpPasteStart(
	index: number,
	text: string,
	length: number,
	mode: OtpMode = 'numeric'
): number {
	return sanitizeOtp(text, mode).length >= length ? 0 : index;
}

/** The cells joined, up to the first blank, so the bound value never has holes. */
export function otpValue(cells: readonly string[]): string {
	const blank = cells.indexOf('');
	return (blank === -1 ? cells : cells.slice(0, blank)).join('');
}

// ── Numbers ─────────────────────────────────────────────────────────────────

/** Decimal places in a number as written: 0.25 → 2, 1e-3 → 3. */
export function decimalPlaces(n: number): number {
	if (!Number.isFinite(n)) return 0;
	const [mantissa, exponent] = String(n).split('e');
	const fraction = (mantissa.split('.')[1] ?? '').length;
	return Math.max(0, fraction - Number(exponent ?? 0));
}

export function clampNumber(value: number, min = -Infinity, max = Infinity): number {
	return Math.min(max, Math.max(min, value));
}

/**
 * Snap to the nearest step counted from `min` (or 0), rounded to the step's
 * precision so 0.1 + 0.2 shows as 0.3, then held to [min, max].
 */
export function snapToStep(value: number, step = 1, min = -Infinity, max = Infinity): number {
	if (!(step > 0)) return clampNumber(value, min, max);
	const base = Number.isFinite(min) ? min : 0;
	const places = Math.max(decimalPlaces(step), decimalPlaces(base));
	const snapped = base + Math.round((value - base) / step) * step;
	return clampNumber(Number(snapped.toFixed(places)), min, max);
}

/** One press of a stepper: `steps` steps (negative for down) from `value`, snapped and clamped. */
export function stepNumber(
	value: number | null,
	steps: number,
	step = 1,
	min = -Infinity,
	max = Infinity
): number {
	const start = value ?? (Number.isFinite(min) ? min : 0);
	return snapToStep(start + steps * step, step, min, max);
}

/** Typed text as a number, or null when it is empty or not a number. */
export function parseNumber(text: string): number | null {
	const trimmed = text.trim();
	if (trimmed === '') return null;
	const n = Number(trimmed);
	return Number.isFinite(n) ? n : null;
}

// ── Toggle group ────────────────────────────────────────────────────────────

/**
 * The group's value after `item` is pressed. Single: that item (pressing the
 * selected one again keeps it, as a radio does, unless `allowEmpty`).
 * Multiple: the item is added or removed, keeping the items' order.
 */
export function toggleGroupValue(
	type: 'single' | 'multiple',
	current: string | string[],
	item: string,
	order: readonly string[] = [],
	allowEmpty = false
): string | string[] {
	if (type === 'single') {
		return current === item && allowEmpty ? '' : item;
	}
	const list = Array.isArray(current) ? current : current ? [current] : [];
	const next = list.includes(item) ? list.filter((v) => v !== item) : [...list, item];
	const rank = (v: string) => {
		const i = order.indexOf(v);
		return i === -1 ? order.length : i;
	};
	return next.sort((a, b) => rank(a) - rank(b));
}

/** Whether `item` is on in a group value of either shape. */
export function isToggled(value: string | string[], item: string): boolean {
	return Array.isArray(value) ? value.includes(item) : value === item;
}

// ── Tags ────────────────────────────────────────────────────────────────────

export interface TagRules {
	max?: number;
	/** Return an error message to refuse a tag, or nothing to accept it. */
	validate?: (tag: string) => string | void | null | undefined;
	/** Compare case-insensitively when deduplicating. Default true. */
	ignoreCase?: boolean;
}

/**
 * Add whatever was typed (split on commas) to the tags. Blank pieces are
 * skipped silently; duplicates, failures of `validate` and anything past
 * `max` are refused, and the first refusal is reported as `error`.
 */
export function addTags(
	tags: readonly string[],
	input: string,
	rules: TagRules = {}
): { tags: string[]; error: string } {
	const { max = Infinity, validate, ignoreCase = true } = rules;
	const key = (t: string) => (ignoreCase ? t.toLowerCase() : t);
	const next = [...tags];
	let error = '';
	for (const piece of input.split(',')) {
		const tag = piece.trim();
		if (!tag) continue;
		let problem = '';
		if (next.some((t) => key(t) === key(tag))) problem = `“${tag}” is already added.`;
		else if (next.length >= max) problem = `No more than ${max} allowed.`;
		else problem = validate?.(tag) || '';
		if (problem) error ||= problem;
		else next.push(tag);
	}
	return { tags: next, error };
}

// ── Files ───────────────────────────────────────────────────────────────────

/** Bytes as people read them: 0 B, 512 B, 1.5 KB, 20 MB. Powers of 1024. */
export function formatBytes(bytes: number): string {
	if (!(bytes > 0) || !Number.isFinite(bytes)) return '0 B';
	if (bytes < 1024) return `${Math.round(bytes)} B`;
	const units = ['KB', 'MB', 'GB', 'TB'];
	let size = bytes / 1024;
	let unit = 0;
	while (size >= 1024 && unit < units.length - 1) {
		size /= 1024;
		unit += 1;
	}
	return `${Number(size.toFixed(size < 10 ? 1 : 0))} ${units[unit]}`;
}

/** The parts of an `accept` string: ".pdf, image/*" → [".pdf", "image/*"]. */
export function parseAccept(accept: string): string[] {
	return accept
		.split(',')
		.map((part) => part.trim().toLowerCase())
		.filter(Boolean);
}

/** Whether a file passes an `accept` list: an extension, an exact type, or a `type/*` family. */
export function matchesAccept(file: { name: string; type: string }, accept: string): boolean {
	const patterns = parseAccept(accept);
	if (patterns.length === 0) return true;
	const name = file.name.toLowerCase();
	const type = file.type.toLowerCase();
	return patterns.some((pattern) => {
		if (pattern.startsWith('.')) return name.endsWith(pattern);
		if (pattern.endsWith('/*')) return type.startsWith(pattern.slice(0, -1));
		return type === pattern;
	});
}

export interface FileRules {
	accept?: string;
	maxSize?: number;
	multiple?: boolean;
	/** Files already chosen, so a single-file drop replaces and a duplicate is noticed. */
	existing?: readonly { name: string; size: number }[];
}

export interface FileRejection<F> {
	file: F;
	reason: string;
}

/**
 * Sort chosen files into accepted and rejected, with a reason for each
 * refusal. Without `multiple`, only the first acceptable file is kept.
 */
export function validateFiles<F extends { name: string; type: string; size: number }>(
	files: readonly F[],
	rules: FileRules = {}
): { accepted: F[]; rejected: FileRejection<F>[] } {
	const { accept = '', maxSize = Infinity, multiple = false, existing = [] } = rules;
	const accepted: F[] = [];
	const rejected: FileRejection<F>[] = [];
	const seen = (f: { name: string; size: number }) =>
		[...existing, ...accepted].some((e) => e.name === f.name && e.size === f.size);
	for (const file of files) {
		let reason = '';
		if (!matchesAccept(file, accept)) reason = `${file.name} is not an accepted file type.`;
		else if (file.size > maxSize)
			reason = `${file.name} is ${formatBytes(file.size)}; the limit is ${formatBytes(maxSize)}.`;
		else if (!multiple && accepted.length > 0) reason = `Only one file can be added.`;
		else if (multiple && seen(file)) reason = `${file.name} is already added.`;
		if (reason) rejected.push({ file, reason });
		else accepted.push(file);
	}
	return { accepted, rejected };
}
