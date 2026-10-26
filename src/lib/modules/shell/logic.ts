/**
 * The decisions the app-shell modules make, apart from the markup that shows
 * them: how notifications group by day, how a search ranks and highlights, how
 * a wizard moves between steps and gates on validation, how far along an
 * onboarding checklist is, and the default copy of the error and empty states.
 *
 * Pure functions only — no DOM, no clock (the caller passes `now`), no network.
 */

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

export type TimeInput = string | number | Date;

/** A valid Date for the input, or null when it cannot be read as a time. */
export function parseTime(at: TimeInput): Date | null {
	const date = at instanceof Date ? at : new Date(at);
	return Number.isNaN(date.getTime()) ? null : date;
}

/** A time as an ISO string for a <time datetime>, or "" when unreadable. */
export function timeAttribute(at: TimeInput): string {
	const date = parseTime(at);
	return date ? date.toISOString() : '';
}

function dayParts(date: Date, timeZone: string): { y: number; m: number; d: number } {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(date);
	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
	return { y: get('year'), m: get('month'), d: get('day') };
}

/** The calendar day of a time in a time zone, as sortable "YYYY-MM-DD"; null if unreadable. */
export function calendarDay(at: TimeInput, timeZone = 'UTC'): string | null {
	const date = parseTime(at);
	if (!date) return null;
	const { y, m, d } = dayParts(date, timeZone);
	return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Whole calendar days from `earlier` to `later` (both "YYYY-MM-DD"). */
export function calendarDayDistance(earlier: string, later: string): number {
	const ms = (key: string) => {
		const [y, m, d] = key.split('-').map(Number);
		return Date.UTC(y, m - 1, d);
	};
	return Math.round((ms(later) - ms(earlier)) / 86_400_000);
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export interface NotificationItem {
	id: string;
	title: string;
	body?: string;
	/** When it happened. */
	at: TimeInput;
	read: boolean;
	href?: string;
}

export interface NotificationGroup {
	/** "YYYY-MM-DD", or "undated" for items whose time cannot be read. */
	key: string;
	label: string;
	items: NotificationItem[];
}

export interface GroupOptions {
	timeZone?: string;
	locale?: string;
	todayLabel?: string;
	yesterdayLabel?: string;
	undatedLabel?: string;
}

/**
 * Notifications grouped by calendar day, newest day first and newest item
 * first within it. "Today" and "Yesterday" are named relative to the injected
 * `now`; older days carry a weekday and date in the given locale. Items whose
 * time is unreadable go last under `undatedLabel`.
 */
export function groupNotificationsByDay(
	items: readonly NotificationItem[],
	now: TimeInput,
	options: GroupOptions = {}
): NotificationGroup[] {
	const {
		timeZone = 'UTC',
		locale = 'en-US',
		todayLabel = 'Today',
		yesterdayLabel = 'Yesterday',
		undatedLabel = 'Earlier'
	} = options;
	const today = calendarDay(now, timeZone);
	const dated = new Map<string, { time: number; item: NotificationItem }[]>();
	const undated: NotificationItem[] = [];

	for (const item of items) {
		const date = parseTime(item.at);
		const key = date ? calendarDay(date, timeZone) : null;
		if (!date || !key) {
			undated.push(item);
			continue;
		}
		const bucket = dated.get(key) ?? [];
		bucket.push({ time: date.getTime(), item });
		dated.set(key, bucket);
	}

	const formatter = new Intl.DateTimeFormat(locale, {
		timeZone,
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	});

	const groups: NotificationGroup[] = [...dated.keys()]
		.sort()
		.reverse()
		.map((key) => {
			const bucket = dated.get(key)!;
			bucket.sort((a, b) => b.time - a.time);
			const distance = today ? calendarDayDistance(key, today) : NaN;
			const label =
				distance === 0
					? todayLabel
					: distance === 1
						? yesterdayLabel
						: formatter.format(new Date(bucket[0].time));
			return { key, label, items: bucket.map((b) => b.item) };
		});

	if (undated.length) groups.push({ key: 'undated', label: undatedLabel, items: undated });
	return groups;
}

/** How many notifications are unread. */
export function unreadCount(items: readonly { read: boolean }[]): number {
	return items.filter((item) => !item.read).length;
}

/** A copy of the list with one item marked read. Unknown ids change nothing. */
export function markNotificationRead<T extends { id: string; read: boolean }>(
	items: readonly T[],
	id: string
): T[] {
	return items.map((item) => (item.id === id && !item.read ? { ...item, read: true } : item));
}

/** A copy of the list with everything marked read. */
export function markAllNotificationsRead<T extends { read: boolean }>(items: readonly T[]): T[] {
	return items.map((item) => (item.read ? item : { ...item, read: true }));
}

/** A count for a badge: "7", or "99+" past the cap. Zero and below is "". */
export function formatCountBadge(count: number, max = 99): string {
	if (!(count > 0)) return '';
	const whole = Math.floor(count);
	return whole > max ? `${max}+` : String(whole);
}

/**
 * The accessible name of the bell button, with the unread count in it:
 * "Notifications, 3 unread". With none unread it is just "Notifications".
 */
export function bellLabel(label: string, unread: number, unreadWord = 'unread'): string {
	return unread > 0 ? `${label}, ${Math.floor(unread)} ${unreadWord}` : label;
}

/** A notification's time of day, "14:05" style in the locale and zone; "" if unreadable. */
export function formatNotificationTime(at: TimeInput, locale = 'en-US', timeZone = 'UTC'): string {
	const date = parseTime(at);
	if (!date) return '';
	return new Intl.DateTimeFormat(locale, { timeZone, hour: 'numeric', minute: '2-digit' }).format(
		date
	);
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

export interface SearchItem {
	id: string;
	label: string;
	description?: string;
	keywords?: string[];
	/** Results are shown under their group's heading. */
	group?: string;
	href?: string;
	disabled?: boolean;
}

export interface SearchGroup {
	label: string;
	items: SearchItem[];
}

export interface Segment {
	text: string;
	match: boolean;
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isSubsequence(needle: string, haystack: string): boolean {
	let i = 0;
	for (const char of haystack) {
		if (char === needle[i]) i += 1;
		if (i === needle.length) return true;
	}
	return false;
}

/**
 * How well a text matches a query, 0 for not at all: exact 100, prefix 80,
 * a word start 60, anywhere 40, every word of the query somewhere 30, the
 * characters in order 10. Case-insensitive. An empty query matches everything
 * equally (1).
 */
export function searchMatchScore(text: string, query: string): number {
	const q = query.trim().toLowerCase();
	if (!q) return 1;
	const t = text.toLowerCase();
	if (t === q) return 100;
	if (t.startsWith(q)) return 80;
	if (new RegExp(`(^|[\\s\\-_/.:])${escapeRegExp(q)}`).test(t)) return 60;
	if (t.includes(q)) return 40;
	const words = q.split(/\s+/);
	if (words.length > 1 && words.every((word) => t.includes(word))) return 30;
	return isSubsequence(q.replace(/\s+/g, ''), t) ? 10 : 0;
}

/** An item's best score: its label, then keywords (half weight) and description (a quarter). */
export function searchItemScore(item: SearchItem, query: string): number {
	if (!query.trim()) return 1;
	const label = searchMatchScore(item.label, query);
	const keywords = Math.max(0, ...(item.keywords ?? []).map((k) => searchMatchScore(k, query))) / 2;
	const description = item.description ? searchMatchScore(item.description, query) / 4 : 0;
	return Math.max(label, keywords, description);
}

/**
 * The items that match, best first (ties keep their given order). An empty
 * query keeps everything in order. Disabled items still rank — they are shown,
 * just not pickable.
 */
export function rankSearchItems(items: readonly SearchItem[], query: string): SearchItem[] {
	return items
		.map((item, index) => ({ item, index, score: searchItemScore(item, query) }))
		.filter((entry) => entry.score > 0)
		.sort((a, b) => b.score - a.score || a.index - b.index)
		.map((entry) => entry.item);
}

/**
 * Group ranked results under their `group`, groups in order of first appearance
 * (so the best match decides which group leads). Ungrouped items fall under
 * `fallback`.
 */
export function groupSearchResults(
	items: readonly SearchItem[],
	fallback = 'Results'
): SearchGroup[] {
	const groups: SearchGroup[] = [];
	for (const item of items) {
		const label = item.group || fallback;
		let group = groups.find((g) => g.label === label);
		if (!group) {
			group = { label, items: [] };
			groups.push(group);
		}
		group.items.push(item);
	}
	return groups;
}

/**
 * Split a text into runs, marking the ones that match a word of the query, so
 * the view can wrap them in <mark>. Overlapping and touching hits merge.
 */
export function searchHighlightSegments(text: string, query: string): Segment[] {
	const words = [...new Set(query.toLowerCase().split(/\s+/).filter(Boolean))];
	const lower = text.toLowerCase();
	if (!words.length || lower.length !== text.length) return text ? [{ text, match: false }] : [];

	const ranges: [number, number][] = [];
	for (const word of words) {
		let from = lower.indexOf(word);
		while (from !== -1) {
			ranges.push([from, from + word.length]);
			from = lower.indexOf(word, from + word.length);
		}
	}
	ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

	const merged: [number, number][] = [];
	for (const range of ranges) {
		const last = merged[merged.length - 1];
		if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
		else merged.push([range[0], range[1]]);
	}

	const segments: Segment[] = [];
	let cursor = 0;
	for (const [start, end] of merged) {
		if (start > cursor) segments.push({ text: text.slice(cursor, start), match: false });
		segments.push({ text: text.slice(start, end), match: true });
		cursor = end;
	}
	if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false });
	return segments;
}

/**
 * The recent-searches list after a search: trimmed, newest first, no
 * case-insensitive duplicates, held to `max`. A blank query changes nothing.
 */
export function addRecentQuery(recent: readonly string[], query: string, max = 5): string[] {
	const q = query.trim();
	if (!q) return [...recent];
	const rest = recent.filter((r) => r.toLowerCase() !== q.toLowerCase());
	return [q, ...rest].slice(0, Math.max(0, max));
}

/** What the live region says about the results. */
export function searchStatus(
	query: string,
	count: number,
	loading: boolean,
	copy: { loading?: string; none?: string; one?: string; many?: string } = {}
): string {
	const { loading: l = 'Searching…', none = 'No results found.', one, many } = copy;
	if (loading) return l;
	if (!query.trim()) return '';
	if (count === 0) return none;
	if (count === 1) return one ?? '1 result';
	return many ? many.replace('{n}', String(count)) : `${count} results`;
}

/* ------------------------------------------------------------------ */
/* Wizard                                                              */
/* ------------------------------------------------------------------ */

export interface WizardState {
	/** The step on show. */
	index: number;
	count: number;
	/** The furthest step reached, so earlier ones can be revisited. */
	furthest: number;
	/** True once Next was tried on this step and refused, so errors may show. */
	attempted: boolean;
	finished: boolean;
}

export type WizardAction =
	| { type: 'next'; valid: boolean }
	| { type: 'back' }
	| { type: 'goto'; index: number; valid: boolean }
	| { type: 'finish'; valid: boolean }
	| { type: 'reset' };

/** A wizard at its first step (or at `start`, held to range). */
export function wizardStart(count: number, start = 0): WizardState {
	const safe = Math.max(0, Math.floor(count));
	const index = safe === 0 ? 0 : Math.min(Math.max(0, Math.floor(start)), safe - 1);
	return { index, count: safe, furthest: index, attempted: false, finished: false };
}

export function wizardIsFirst(state: WizardState): boolean {
	return state.index <= 0;
}

export function wizardIsLast(state: WizardState): boolean {
	return state.index >= state.count - 1;
}

/**
 * The state machine. Moving forward needs the current step valid — otherwise
 * the step stays and `attempted` flips on so its errors show. Going back is
 * always allowed. Jumping forward is allowed only to a step already reached,
 * and only from a valid one. Finishing is allowed on the last step, valid.
 */
export function wizardReduce(state: WizardState, action: WizardAction): WizardState {
	if (action.type === 'reset') return wizardStart(state.count);
	if (state.finished || state.count === 0) return state;

	switch (action.type) {
		case 'next': {
			if (wizardIsLast(state)) return state;
			if (!action.valid) return { ...state, attempted: true };
			const index = state.index + 1;
			return { ...state, index, furthest: Math.max(state.furthest, index), attempted: false };
		}
		case 'back':
			return wizardIsFirst(state) ? state : { ...state, index: state.index - 1, attempted: false };
		case 'goto': {
			const target = Math.floor(action.index);
			if (!(target >= 0 && target < state.count) || target === state.index) return state;
			if (target < state.index) return { ...state, index: target, attempted: false };
			if (target > state.furthest) return state;
			if (!action.valid) return { ...state, attempted: true };
			return { ...state, index: target, attempted: false };
		}
		case 'finish':
			if (!wizardIsLast(state)) return state;
			return action.valid
				? { ...state, finished: true, attempted: false }
				: { ...state, attempted: true };
	}
}

/** "Step 2 of 4: Account" — what the polite live region announces. */
export function wizardProgressText(
	state: Pick<WizardState, 'index' | 'count'>,
	label = '',
	template = 'Step {n} of {total}'
): string {
	const base = template
		.replace('{n}', String(state.index + 1))
		.replace('{total}', String(state.count));
	return label ? `${base}: ${label}` : base;
}

export type StepErrors = Record<string, string>;
export type StepRule = (value: unknown, values: Record<string, unknown>) => string | null;

/** A rule that fails an empty value (null, undefined, blank text, empty list, false). */
export function wizardRequiredRule(message = 'This field is required.'): StepRule {
	return (value) => {
		const empty =
			value === null ||
			value === undefined ||
			value === false ||
			(typeof value === 'string' && value.trim() === '') ||
			(Array.isArray(value) && value.length === 0);
		return empty ? message : null;
	};
}

/** Run each field's rule over the values; the result holds only the failures. */
export function runWizardRules(
	rules: Record<string, StepRule>,
	values: Record<string, unknown>
): StepErrors {
	const errors: StepErrors = {};
	for (const [field, rule] of Object.entries(rules)) {
		const message = rule(values[field], values);
		if (message) errors[field] = message;
	}
	return errors;
}

export interface ErrorSummaryItem {
	field: string;
	message: string;
}

/** The gate for a step: valid when there are no errors; the list is what the summary shows. */
export function gateStep(errors: StepErrors): { valid: boolean; list: ErrorSummaryItem[] } {
	const list = Object.entries(errors)
		.filter(([, message]) => Boolean(message))
		.map(([field, message]) => ({ field, message }));
	return { valid: list.length === 0, list };
}

/** The errors worth showing: none until the visitor has tried to move on. */
export function visibleStepErrors(errors: StepErrors, attempted: boolean): StepErrors {
	return attempted ? errors : {};
}

/** The Stepper's step list, flagging the step on show when it was refused. */
export function wizardStepperSteps<T extends { id: string; label: string }>(
	steps: readonly T[],
	state: Pick<WizardState, 'index' | 'attempted'>,
	hasErrors: boolean
): (T & { error: boolean })[] {
	return steps.map((step, i) => ({
		...step,
		error: i === state.index && state.attempted && hasErrors
	}));
}

/* ------------------------------------------------------------------ */
/* Onboarding checklist                                                */
/* ------------------------------------------------------------------ */

export interface ChecklistProgress {
	done: number;
	total: number;
	percent: number;
	complete: boolean;
}

/** How far along a checklist is. An empty one is not "complete". */
export function checklistProgress(steps: readonly { done: boolean }[]): ChecklistProgress {
	const total = steps.length;
	const done = steps.filter((s) => s.done).length;
	return {
		done,
		total,
		percent: total === 0 ? 0 : Math.round((done / total) * 100),
		complete: total > 0 && done === total
	};
}

/** The first step still to do, or null. */
export function firstOpenStep<T extends { done: boolean }>(steps: readonly T[]): T | null {
	return steps.find((s) => !s.done) ?? null;
}

/** Set one step's done flag, leaving the list unchanged for an unknown id. */
export function setStepDone<T extends { id: string; done: boolean }>(
	steps: readonly T[],
	id: string,
	done: boolean
): T[] {
	return steps.map((s) => (s.id === id && s.done !== done ? { ...s, done } : s));
}

/** The expanded step after a toggle: the same one closes, another one opens. */
export function toggleOpenStep(current: string | null, id: string): string | null {
	return current === id ? null : id;
}

/** "2 of 5 done". */
export function checklistSummary(
	progress: Pick<ChecklistProgress, 'done' | 'total'>,
	template = '{done} of {total} done'
): string {
	return template
		.replace('{done}', String(progress.done))
		.replace('{total}', String(progress.total));
}

/* ------------------------------------------------------------------ */
/* Error and empty states                                              */
/* ------------------------------------------------------------------ */

export type ErrorKind = '404' | '403' | '500' | 'offline' | 'maintenance';

export interface StatePreset {
	icon: string;
	title: string;
	description: string;
	/** A short code shown with the title, e.g. "404". */
	code?: string;
}

export const ERROR_PRESETS: Record<ErrorKind, StatePreset> = {
	'404': {
		icon: '🧭',
		code: '404',
		title: 'Page not found',
		description: 'The page you are looking for does not exist or has moved.'
	},
	'403': {
		icon: '🔒',
		code: '403',
		title: 'Access denied',
		description: 'You do not have permission to see this. Ask an owner for access.'
	},
	'500': {
		icon: '⚠️',
		code: '500',
		title: 'Something went wrong',
		description: 'We hit an error on our side. Try again in a moment.'
	},
	offline: {
		icon: '📡',
		title: 'You are offline',
		description: 'Check your connection. We will keep your place when you are back.'
	},
	maintenance: {
		icon: '🛠️',
		title: 'Down for maintenance',
		description: 'We are making improvements and will be back shortly.'
	}
};

/** Whether retrying makes sense for this kind of error. */
export function canRetryError(kind: ErrorKind): boolean {
	return kind === '500' || kind === 'offline' || kind === 'maintenance';
}

/** The preset for a kind, with any copy the caller overrides. Blank overrides are ignored. */
export function resolveErrorCopy(
	kind: ErrorKind,
	overrides: { title?: string; description?: string } = {}
): StatePreset {
	const preset = ERROR_PRESETS[kind] ?? ERROR_PRESETS['500'];
	return {
		...preset,
		title: overrides.title?.trim() || preset.title,
		description: overrides.description?.trim() || preset.description
	};
}

export type EmptyKind = 'no-data' | 'no-results' | 'first-run';

export const EMPTY_PRESETS: Record<EmptyKind, StatePreset> = {
	'no-data': {
		icon: '📭',
		title: 'Nothing here yet',
		description: 'When there is something to show, it will appear here.'
	},
	'no-results': {
		icon: '🔍',
		title: 'No results',
		description: 'Nothing matches your search or filters. Try changing or clearing them.'
	},
	'first-run': {
		icon: '🚀',
		title: 'Let’s get you started',
		description: 'Create your first item to see it here.'
	}
};

/** The preset for an empty state, with overrides; a `query` is quoted into "no results". */
export function resolveEmptyCopy(
	kind: EmptyKind,
	overrides: { title?: string; description?: string; query?: string } = {}
): StatePreset {
	const preset = EMPTY_PRESETS[kind] ?? EMPTY_PRESETS['no-data'];
	const query = overrides.query?.trim();
	const description =
		overrides.description?.trim() ||
		(kind === 'no-results' && query
			? `Nothing matches “${query}”. Try a different search or clear the filters.`
			: preset.description);
	return { ...preset, title: overrides.title?.trim() || preset.title, description };
}

/* ------------------------------------------------------------------ */
/* Confirmation (promise style)                                        */
/* ------------------------------------------------------------------ */

export interface Confirmation {
	/** Start asking; resolves true on confirm, false on cancel. A pending ask is cancelled first. */
	ask(): Promise<boolean>;
	/** Answer the pending ask. Does nothing when none is pending. */
	answer(value: boolean): void;
	readonly pending: boolean;
}

/** The promise bookkeeping behind a confirm dialog. */
export function createConfirmation(): Confirmation {
	let resolver: ((value: boolean) => void) | null = null;
	return {
		ask() {
			resolver?.(false);
			return new Promise<boolean>((resolve) => {
				resolver = resolve;
			});
		},
		answer(value) {
			const resolve = resolver;
			resolver = null;
			resolve?.(value);
		},
		get pending() {
			return resolver !== null;
		}
	};
}

/* ------------------------------------------------------------------ */
/* Toolbar, nav and shell layout                                       */
/* ------------------------------------------------------------------ */

/**
 * How many of the toolbar items fit in `available` pixels, given each item's
 * width. `reserve` is held back for the overflow button, which is only needed
 * (and only reserved) when something overflows. Unknown space (0 or less) fits
 * everything, as does a row that fits whole.
 */
export function fitToolbarCount(
	widths: readonly number[],
	available: number,
	reserve = 0,
	gap = 0
): number {
	if (!(available > 0) || widths.length === 0) return widths.length;
	const total = widths.reduce((sum, w) => sum + w, 0) + gap * (widths.length - 1);
	if (total <= available) return widths.length;
	let used = reserve;
	let count = 0;
	for (const width of widths) {
		const next = used + width + (count > 0 ? gap : 0);
		if (next > available) break;
		used = next;
		count += 1;
	}
	return count;
}

/** Split items into those shown and those moved into the overflow menu. */
export function splitToolbarOverflow<T>(
	items: readonly T[],
	visible: number
): { shown: T[]; overflow: T[] } {
	const n = Math.max(0, Math.min(items.length, Math.floor(visible)));
	return { shown: items.slice(0, n), overflow: items.slice(n) };
}

/** Whether header actions fold into a menu: narrower than the breakpoint. Unknown width (0) never does. */
export function actionsCollapsed(width: number, breakpoint: number): boolean {
	return width > 0 && width < breakpoint;
}

/**
 * The roving tabindex: exactly one entry is 0 (the active one, or the first
 * when the active is out of range), the rest -1.
 */
export function rovingTabindex(count: number, active: number): number[] {
	const stop = active >= 0 && active < count ? active : 0;
	return Array.from({ length: count }, (_, i) => (i === stop ? 0 : -1));
}

/** The active index after an item is removed or hidden, held to range. */
export function clampToolbarStop(index: number, count: number): number {
	if (count <= 0) return 0;
	return Math.min(Math.max(0, index), count - 1);
}

/** Whether a nav link is the current page: exact match, or a section prefix when `exact` is false. */
export function isNavCurrent(href: string, current: string, exact = true): boolean {
	const clean = (value: string) => {
		const path = value.split(/[?#]/)[0];
		return path.length > 1 ? path.replace(/\/+$/, '') : path;
	};
	const a = clean(href);
	const b = clean(current);
	if (!a || !b) return false;
	if (a === b) return true;
	return !exact && a !== '/' && b.startsWith(`${a}/`);
}

/** The spoken name of a nav item with its badge: "Inbox, 3 new". */
export function navItemName(label: string, badge?: number | string, word = ''): string {
	if (badge === undefined || badge === '' || badge === 0) return label;
	return `${label}, ${badge}${word ? ` ${word}` : ''}`;
}
