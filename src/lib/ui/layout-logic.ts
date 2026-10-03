/**
 * The decisions the layout and navigation components make, apart from the
 * markup that shows them: ratios, splitter sizes, scroll edges, step states,
 * which sidebar item is current, and the CSS values the layout primitives map
 * their props to.
 *
 * `*.svelte` is excluded from coverage; this file is not.
 */

/** Hold a number to [min, max]. A NaN lands on min. */
export function clamp(value: number, min: number, max: number): number {
	if (Number.isNaN(value)) return min;
	return Math.min(max, Math.max(min, value));
}

/**
 * A ratio as width ÷ height: a number as given, or a string like "16/9",
 * "4:3" or "1.5". Anything unusable — zero, negative, not a number — is 1, a
 * square, so the slot still has a shape.
 */
export function parseRatio(ratio: number | string): number {
	let value: number;
	if (typeof ratio === 'number') {
		value = ratio;
	} else {
		const parts = ratio.split(/[/:]/).map((p) => Number(p.trim()));
		value = parts.length === 2 ? parts[0] / parts[1] : parts.length === 1 ? parts[0] : NaN;
	}
	return Number.isFinite(value) && value > 0 ? value : 1;
}

export interface SplitLimits {
	min: number;
	max: number;
}

/**
 * The usable [min, max] of a splitter, in percent: both held to [0, 100] and
 * put in order, so a min above max does not lock the divider.
 */
export function splitLimits(min: number, max: number): SplitLimits {
	const a = clamp(min, 0, 100);
	const b = clamp(max, 0, 100);
	return { min: Math.min(a, b), max: Math.max(a, b) };
}

/**
 * Where a window splitter goes on a key press (the APG window splitter).
 * Side-by-side panes move with Left and Right; stacked panes with Up and Down.
 * Home and End jump to min and max. Enter collapses to min, or, when already
 * there, restores `restore`. Returns null for any other key.
 */
export function splitterKey(
	key: string,
	size: number,
	orientation: 'horizontal' | 'vertical',
	options: { min: number; max: number; step: number; restore: number }
): number | null {
	const { min, max } = splitLimits(options.min, options.max);
	const back = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
	const forward = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
	switch (key) {
		case back:
			return clamp(size - options.step, min, max);
		case forward:
			return clamp(size + options.step, min, max);
		case 'Home':
			return min;
		case 'End':
			return max;
		case 'Enter':
			return size > min ? min : clamp(options.restore > min ? options.restore : max, min, max);
		default:
			return null;
	}
}

/**
 * A pointer position as a percentage along a box that starts at `start` and is
 * `length` long, held to [0, 100]. A box with no length is 0.
 */
export function pointerPercent(position: number, start: number, length: number): number {
	if (!(length > 0)) return 0;
	return clamp(((position - start) / length) * 100, 0, 100);
}

export interface ScrollMetrics {
	scrollTop: number;
	scrollLeft: number;
	scrollHeight: number;
	scrollWidth: number;
	clientHeight: number;
	clientWidth: number;
}

export interface ScrollEdges {
	top: boolean;
	bottom: boolean;
	left: boolean;
	right: boolean;
}

/**
 * Which edges of a scroll region have more content past them, so a fade shows
 * there and nowhere else. `threshold` absorbs sub-pixel rounding at the ends.
 * A negative scrollLeft (right-to-left pages) counts by its distance from 0.
 */
export function scrollEdges(m: ScrollMetrics, threshold = 1): ScrollEdges {
	const x = Math.abs(m.scrollLeft);
	return {
		top: m.scrollTop > threshold,
		bottom: m.scrollHeight - m.clientHeight - m.scrollTop > threshold,
		left: x > threshold,
		right: m.scrollWidth - m.clientWidth - x > threshold
	};
}

export type ContainerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const CONTAINER_WIDTHS: Record<ContainerSize, string> = {
	sm: '40rem',
	md: '48rem',
	lg: '64rem',
	xl: '80rem',
	full: 'none'
};

/** The max-width a container size maps to. An unknown size is `lg`. */
export function containerMaxWidth(size: string): string {
	return CONTAINER_WIDTHS[size as ContainerSize] ?? CONTAINER_WIDTHS.lg;
}

export type SpaceToken = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/** A gap token as a CSS value: `none` is 0, the rest are spacing variables. */
export function spaceValue(token: string): string {
	const known = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
	return known.includes(token) ? `var(--spacing-${token})` : '0';
}

/**
 * A short flex alignment name as its CSS keyword: start → flex-start,
 * between → space-between. Names CSS already knows pass through.
 */
export function flexValue(name: string): string {
	switch (name) {
		case 'start':
		case 'end':
			return `flex-${name}`;
		case 'between':
		case 'around':
		case 'evenly':
			return `space-${name}`;
		default:
			return name;
	}
}

export type StepStatus = 'complete' | 'current' | 'upcoming' | 'error';

/**
 * Each step's state from the current index: before it complete, at it
 * current, after it upcoming. A step that says it has an error keeps that
 * state wherever it sits.
 */
export function stepStates(steps: readonly { error?: boolean }[], current: number): StepStatus[] {
	return steps.map((step, i) => {
		if (step.error) return 'error';
		if (i < current) return 'complete';
		return i === current ? 'current' : 'upcoming';
	});
}

/** Whether a step can be pressed: only completed ones, and only when clickable. */
export function stepSelectable(status: StepStatus, clickable: boolean): boolean {
	return clickable && status === 'complete';
}

export interface NavItem {
	id: string;
	href?: string;
	children?: NavItem[];
}

/**
 * Whether an item is the current page: its id or its href equals `current`.
 * Trailing slashes and query strings are ignored, so "/docs/" and
 * "/docs?tab=1" are both "/docs".
 */
export function isCurrent(item: NavItem, current: string): boolean {
	if (!current) return false;
	if (item.id === current) return true;
	return item.href !== undefined && normalizePath(item.href) === normalizePath(current);
}

/** Whether the current page is one of an item's descendants. */
export function containsCurrent(item: NavItem, current: string): boolean {
	return (item.children ?? []).some((c) => isCurrent(c, current) || containsCurrent(c, current));
}

function normalizePath(href: string): string {
	const path = href.split(/[?#]/)[0];
	return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

/**
 * Whether a sidebar goes off-canvas: when the viewport is narrower than the
 * breakpoint. A width of 0 (no window, on the server) never does, so the
 * server renders the full sidebar.
 */
export function isOffCanvas(width: number, breakpoint: number): boolean {
	return width > 0 && width < breakpoint;
}

/**
 * What a key does on a disclosure navigation trigger: Down opens the panel and
 * moves into it, Escape closes an open one. Enter and Space are left to the
 * button's own click. Null for anything else.
 */
export function disclosureKey(key: string, open: boolean): 'open' | 'close' | null {
	if (key === 'ArrowDown') return 'open';
	if (key === 'Escape' && open) return 'close';
	return null;
}

/**
 * The name an item is read by when only its icon shows: the label, with the
 * badge after it ("Inbox, 3") so the count is not lost with the text.
 */
export function itemName(label: string, badge?: string | number): string {
	return badge === undefined || badge === '' ? label : `${label}, ${badge}`;
}
