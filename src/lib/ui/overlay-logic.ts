/**
 * The decisions the overlay components make: where a floating panel goes and
 * when it flips, where a context menu lands, which command a search ranks
 * first, where typeahead moves a menu's focus, and what a checkbox or radio
 * menu item changes.
 *
 * Pure functions only, so they are tested and counted; the `.svelte` files
 * that use them are not.
 */

export type Side = 'top' | 'bottom' | 'left' | 'right';
export type Align = 'start' | 'center' | 'end';

/** The parts of a DOMRect that placement reads. */
export interface Box {
	top: number;
	left: number;
	width: number;
	height: number;
}

export interface Size {
	width: number;
	height: number;
}

const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

/** Room between the anchor and the viewport edge on one side, after the gap and margin. */
function room(anchor: Box, viewport: Size, side: Side, offset: number, margin: number): number {
	switch (side) {
		case 'top':
			return anchor.top - offset - margin;
		case 'bottom':
			return viewport.height - (anchor.top + anchor.height) - offset - margin;
		case 'left':
			return anchor.left - offset - margin;
		case 'right':
			return viewport.width - (anchor.left + anchor.width) - offset - margin;
	}
}

/** Keep a span of `size` starting at `start` inside [margin, limit - margin]. */
function clampSpan(start: number, size: number, limit: number, margin: number): number {
	const max = limit - margin - size;
	if (max < margin) return margin;
	return Math.min(Math.max(start, margin), max);
}

/**
 * Where a floating panel sits beside its anchor, in viewport coordinates
 * (for `position: fixed`). It goes on `side` when it fits, flips to the
 * opposite side when only that fits, and takes whichever side has more room
 * when neither does. Along the edge it lines up by `align`, then is held
 * inside the viewport so it never pushes the page sideways.
 */
export function placeFloating(
	anchor: Box,
	floating: Size,
	viewport: Size,
	side: Side = 'bottom',
	align: Align = 'center',
	offset = 8,
	margin = 8
): { side: Side; top: number; left: number } {
	const vertical = side === 'top' || side === 'bottom';
	const need = vertical ? floating.height : floating.width;
	let chosen = side;
	const here = room(anchor, viewport, side, offset, margin);
	if (here < need) {
		const there = room(anchor, viewport, OPPOSITE[side], offset, margin);
		if (there >= need || there > here) chosen = OPPOSITE[side];
	}

	const cross = (start: number, length: number, size: number) =>
		align === 'start'
			? start
			: align === 'end'
				? start + length - size
				: start + (length - size) / 2;

	if (vertical) {
		const top =
			chosen === 'top'
				? anchor.top - offset - floating.height
				: anchor.top + anchor.height + offset;
		const left = clampSpan(
			cross(anchor.left, anchor.width, floating.width),
			floating.width,
			viewport.width,
			margin
		);
		return { side: chosen, top, left };
	}
	const left =
		chosen === 'left' ? anchor.left - offset - floating.width : anchor.left + anchor.width + offset;
	const top = clampSpan(
		cross(anchor.top, anchor.height, floating.height),
		floating.height,
		viewport.height,
		margin
	);
	return { side: chosen, top, left };
}

/** One axis of a pointer-anchored box: after the point, else before it, else held in. */
function fitAxis(point: number, size: number, limit: number, margin: number): number {
	if (point + size <= limit - margin) return point;
	if (point - size >= margin) return point - size;
	return Math.max(margin, limit - margin - size);
}

/**
 * Where a context menu opens for a pointer at (x, y): down and right of it
 * when it fits, mirrored up or left when it would run off that edge, and
 * held inside the viewport when neither fits.
 */
export function placeAtPoint(
	x: number,
	y: number,
	size: Size,
	viewport: Size,
	margin = 8
): { top: number; left: number } {
	return {
		left: fitAxis(x, size.width, viewport.width, margin),
		top: fitAxis(y, size.height, viewport.height, margin)
	};
}

/* ------------------------------------------------------------------ menus */

export interface MenuItem {
	id: string;
	label: string;
	/** A hint like "⌘C", shown at the end of the row. Display only. */
	shortcut?: string;
	danger?: boolean;
	disabled?: boolean;
}

/** A row in a context menu or menubar menu: an action, or a separator line. */
export type MenuEntry = MenuItem | { separator: true };

export type MenuRow = { kind: 'separator' } | { kind: 'item'; item: MenuItem; index: number };

/**
 * A menu's entries as rows to draw, plus the actionable items alone (the ones
 * focus moves through) and which of those are disabled. Each item row carries
 * its index among the actionable items.
 */
export function menuModel(entries: readonly MenuEntry[]): {
	rows: MenuRow[];
	items: MenuItem[];
	disabled: number[];
} {
	const rows: MenuRow[] = [];
	const items: MenuItem[] = [];
	const disabled: number[] = [];
	for (const entry of entries) {
		if ('separator' in entry) {
			rows.push({ kind: 'separator' });
			continue;
		}
		if (entry.disabled) disabled.push(items.length);
		rows.push({ kind: 'item', item: entry, index: items.length });
		items.push(entry);
	}
	return { rows, items, disabled };
}

export interface TypeaheadState {
	text: string;
	at: number;
}

/**
 * The printable character a key press adds to a typeahead search, or null for
 * anything else: named keys, a space with nothing typed yet (Space activates
 * the item), and chords with Ctrl, Alt or Meta, which belong to shortcuts.
 */
export function typeaheadKey(
	event: { key: string; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean },
	typing = false
): string | null {
	if (event.ctrlKey || event.altKey || event.metaKey) return null;
	if ([...event.key].length !== 1) return null;
	if (event.key === ' ' && !typing) return null;
	return event.key;
}

/**
 * The typeahead buffer after a character: appended while typing quickly,
 * started fresh after a pause of `timeout` ms.
 */
export function typeaheadBuffer(
	state: TypeaheadState,
	char: string,
	now: number,
	timeout = 500
): TypeaheadState {
	const fresh = now - state.at > timeout;
	return { text: (fresh ? '' : state.text) + char, at: now };
}

/**
 * Where typeahead moves focus: the next item whose label starts with the
 * search. A single character (or the same one repeated) cycles from the item
 * after the current one; a longer string first checks the current item, so
 * "ex" stays on "Export" once "e" got there. Null when nothing matches.
 */
export function typeahead(
	labels: readonly string[],
	current: number,
	search: string,
	disabled: readonly number[] = []
): number | null {
	const query = search.toLowerCase();
	if (!query) return null;
	const repeated = [...query].every((c) => c === query[0]);
	const needle = repeated ? query[0] : query;
	const start = repeated ? current + 1 : Math.max(current, 0);
	const count = labels.length;
	for (let n = 0; n < count; n++) {
		const i = (start + n) % count;
		if (!disabled.includes(i) && labels[i].trim().toLowerCase().startsWith(needle)) return i;
	}
	return null;
}

/* --------------------------------------------------------- dropdown menu */

export interface DropdownItem extends MenuItem {
	/** A menuitemcheckbox: toggles `state[id]` instead of firing select. */
	checkbox?: boolean;
}

export interface DropdownGroup {
	/** A visible heading, which also names the group for a screen reader. */
	label?: string;
	/** Makes every item a menuitemradio; `state[radio]` holds the chosen id. */
	radio?: string;
	items: DropdownItem[];
}

export type DropdownKind = 'item' | 'checkbox' | 'radio';

export interface DropdownEntry {
	item: DropdownItem;
	kind: DropdownKind;
	group: number;
	/** The radio group's state key, for radio entries. */
	radio?: string;
}

export type MenuState = Record<string, boolean | string>;

/** Every item across a dropdown's groups, in order, with what kind of item it is. */
export function flattenGroups(groups: readonly DropdownGroup[]): DropdownEntry[] {
	return groups.flatMap((group, g) =>
		group.items.map((item): DropdownEntry => {
			if (group.radio) return { item, kind: 'radio', group: g, radio: group.radio };
			return { item, kind: item.checkbox ? 'checkbox' : 'item', group: g };
		})
	);
}

/** The aria-checked value for an entry: a boolean for checkbox and radio items, else undefined. */
export function isChecked(state: MenuState, entry: DropdownEntry): boolean | undefined {
	if (entry.kind === 'checkbox') return state[entry.item.id] === true;
	if (entry.kind === 'radio') return state[entry.radio as string] === entry.item.id;
	return undefined;
}

/**
 * What activating a checkbox or radio entry does: the new state, and the
 * change to report — `{ id, value }`, where `id` is the checkbox's id or the
 * radio group's key. Null for a plain item, a disabled one, or a radio that
 * is already chosen.
 */
export function applyChoice(
	state: MenuState,
	entry: DropdownEntry
): { state: MenuState; change: { id: string; value: boolean | string } } | null {
	if (entry.item.disabled || entry.kind === 'item') return null;
	if (entry.kind === 'checkbox') {
		const value = state[entry.item.id] !== true;
		return { state: { ...state, [entry.item.id]: value }, change: { id: entry.item.id, value } };
	}
	const key = entry.radio as string;
	if (state[key] === entry.item.id) return null;
	return {
		state: { ...state, [key]: entry.item.id },
		change: { id: key, value: entry.item.id }
	};
}

/* --------------------------------------------------------------- command */

export interface CommandItem {
	id: string;
	label: string;
	/** The heading the item is listed under. Items without one come first, unheaded. */
	group?: string;
	/** Other words that find it: "settings" might also answer to "preferences". */
	keywords?: string[];
	shortcut?: string;
	disabled?: boolean;
}

/**
 * How well `text` matches `query`, case-insensitively: 3 when it starts with
 * it, 2 when a word inside starts with it, 1 for anywhere else, 0 for no
 * match. An empty query matches everything at 1.
 */
export function matchScore(text: string, query: string): number {
	const q = query.trim().toLowerCase();
	if (!q) return 1;
	const t = text.toLowerCase();
	if (t.startsWith(q)) return 3;
	let i = t.indexOf(q);
	if (i === -1) return 0;
	while (i !== -1) {
		if (/[^\p{L}\p{N}]/u.test(t[i - 1])) return 2;
		i = t.indexOf(q, i + 1);
	}
	return 1;
}

/**
 * The items that match a search, best first. A label match outranks a
 * keyword match of the same kind, and every kind ranks prefix, then word
 * start, then substring. Ties keep their original order. An empty query
 * returns every item as given.
 */
export function rankCommands<T extends CommandItem>(items: readonly T[], query: string): T[] {
	if (!query.trim()) return [...items];
	return items
		.map((item, index) => {
			const label = matchScore(item.label, query) * 2;
			const keyword = Math.max(
				0,
				...(item.keywords ?? []).map((k) => matchScore(k, query) * 2 - 1)
			);
			return { item, index, score: Math.max(label, keyword) };
		})
		.filter((r) => r.score > 0)
		.sort((a, b) => b.score - a.score || a.index - b.index)
		.map((r) => r.item);
}

/**
 * Items under their group headings, groups in the order their first item
 * appears — so after ranking, the group holding the best match comes first.
 */
export function groupCommands<T extends CommandItem>(
	items: readonly T[]
): { group: string; items: T[] }[] {
	const groups = new Map<string, T[]>();
	for (const item of items) {
		const key = item.group ?? '';
		const list = groups.get(key);
		if (list) list.push(item);
		else groups.set(key, [item]);
	}
	return [...groups].map(([group, list]) => ({ group, items: list }));
}

/** Whether a key press is the command palette shortcut: ⌘K on a Mac, Ctrl+K elsewhere. */
export function isCommandShortcut(event: {
	key: string;
	ctrlKey?: boolean;
	metaKey?: boolean;
	altKey?: boolean;
	shiftKey?: boolean;
}): boolean {
	return (
		event.key.toLowerCase() === 'k' &&
		Boolean(event.ctrlKey || event.metaKey) &&
		!event.altKey &&
		!event.shiftKey
	);
}

/* -------------------------------------------------------------- hover card */

/**
 * The delay before a hover card changes state. Keyboard focus opens it at
 * once, since someone tabbing has already said where they are; a pointer
 * waits `openDelay` so passing over a link does not flash a card.
 */
export function hoverDelay(
	action: 'open' | 'close',
	source: 'pointer' | 'focus',
	openDelay: number,
	closeDelay: number
): number {
	if (action === 'close') return Math.max(0, closeDelay);
	return source === 'focus' ? 0 : Math.max(0, openDelay);
}
