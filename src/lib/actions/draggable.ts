/**
 * Pointer, touch and keyboard dragging as two Svelte actions.
 *
 * `use:draggable` goes on the thing that moves; `use:dropzone` goes on each
 * container it can move between. Neither one owns state: a finished drag is
 * reported as `{ id, fromGroup, toGroup, toIndex }` and the caller decides what
 * that means — normally by handing it straight to `reorder()`
 * (`$lib/utils/reorder`), whose index contract this deliberately matches.
 *
 * Being actions rather than a component is the point. The same behaviour serves
 * a widget board, a sortable list or a nav reorder, and none of them have to
 * adopt someone else's markup.
 *
 * ## Rules this file exists to enforce
 *
 * - **Carry identity, never position.** Zones and items are addressed by the
 *   `data-drag-group` / `data-drag-item` attributes these actions stamp
 *   themselves. The predecessor implementation reported the *DOM index* of a
 *   column as its id; the two agree only in a pristine layout, so after any
 *   column move a drop landed in the wrong column — or on an id with no column,
 *   where the item vanished until reload. The DOM is read for geometry here and
 *   for nothing else.
 * - **Hit-test in the space you mutate.** The dragged element stays in the DOM
 *   during a drag (only a ghost moves), so it is excluded from the sibling list
 *   used to compute the insertion index. See `$lib/utils/drop-position`.
 * - **Keyboard is not optional.** Every pointer path here has a keyboard
 *   equivalent, announced through a live region. A drag-and-drop board that
 *   only works with a mouse is not finished.
 *
 * ## What the markup has to provide
 *
 * ```svelte
 * <div use:dropzone={{ group: column.id }}>
 *   {#each items as item (item.id)}
 *     <article use:draggable={{ id: item.id, group: column.id, label: item.title, onDrop }}>
 *       <button data-drag-handle>Drag</button>
 *     </article>
 *   {/each}
 * </div>
 * ```
 *
 * The `{#each}` must be keyed. Svelte moves keyed nodes instead of rebuilding
 * them, which is what keeps focus on the handle through a keyboard reorder.
 *
 * Styling for the ghost, the drop indicator and the dragged item's own placeholder
 * lives in `src/app.css` (`.drag-ghost`, `.drop-indicator`, `[data-dragging]`).
 */

import { insertionIndex, pickZone, type Orientation, type Rect } from '$lib/utils/drop-position';

/** Where a finished drag wants the item to go. Feed straight to `reorder()`. */
export interface DropDetail {
	id: string;
	fromGroup: string;
	/** Destination group — the same value the target zone was registered with. */
	toGroup: string;
	/** Index within `toGroup`, counted with the dragged item already removed. */
	toIndex: number;
}

export interface DraggableOptions {
	/** Stable item id. Must match the id used in the layout data. */
	id: string;
	/** Group the item currently belongs to. */
	group: string;
	/**
	 * Which board this item belongs to. Drags never cross boards, so two boards
	 * on one page stay independent as long as they use different values.
	 */
	board?: string;
	/** Selector for the grab handle inside the node. Default `[data-drag-handle]`. */
	handle?: string;
	/** Human-readable name, used in screen-reader announcements. */
	label?: string;
	disabled?: boolean;
	onDrop: (detail: DropDetail) => void;
	onDragStart?: (id: string) => void;
	onDragEnd?: () => void;
}

export interface DropzoneOptions {
	/** Group id this zone accepts items into. */
	group: string;
	board?: string;
	/** Which way items stack. Default `vertical`. */
	orientation?: Orientation;
}

/** Announcement strings, exported so a project can translate them in place. */
export const dragMessages = {
	instructions:
		'Press space or enter to pick up. Use the arrow keys to move. Press space or enter to drop, or escape to cancel.',
	grabbed: (label: string, position: number, total: number) =>
		`${label} grabbed. Position ${position} of ${total}.`,
	moved: (label: string, group: string, position: number, total: number) =>
		`${label} moved to position ${position} of ${total} in ${group}.`,
	edge: (label: string) => `${label} is already at the end.`,
	noGroup: (label: string) => `${label} has nowhere further to go in that direction.`,
	dropped: (label: string, group: string, position: number, total: number) =>
		`Dropped ${label} at position ${position} of ${total} in ${group}.`,
	cancelled: (label: string) => `${label} returned to its original position.`
};

const DEFAULT_BOARD = 'default';
const HANDLE_SELECTOR = '[data-drag-handle]';
const ITEM_ATTR = 'data-drag-item';
const GROUP_ATTR = 'data-drag-group';
const INSTRUCTIONS_ID = 'nk-drag-instructions';

/** Hold this long on a touchscreen before a drag starts, instead of scrolling. */
const TOUCH_HOLD_MS = 300;
/** Moving further than this during the hold means the user meant to scroll. */
const TOUCH_SLOP_PX = 10;
/** A mouse drag starts only after real movement, so a click stays a click. */
const POINTER_SLOP_PX = 4;
/** Distance from a viewport edge at which auto-scroll kicks in. */
const SCROLL_ZONE_PX = 80;
/** Fastest auto-scroll, in pixels per frame, right at the edge. */
const SCROLL_SPEED_MAX = 20;
/** iOS-only, and the one thing that stops a long press raising Copy / Search. */
const TOUCH_CALLOUT = '-webkit-touch-callout';

interface Zone {
	group: string;
	board: string;
	orientation: Orientation;
}

interface LiveZone extends Zone {
	el: HTMLElement;
	rect: Rect;
}

/** Where an item sits right now, as the keyboard path needs to see it. */
interface KeyboardPosition {
	zone: LiveZone;
	index: number;
	total: number;
}

/**
 * Registered drop zones, keyed by element.
 *
 * A registry rather than a `document.querySelectorAll` at drag time: it scopes a
 * drag to its own board, and it cannot pick up a stale or unrelated container
 * that happens to match a class name.
 */
const zones = new Map<HTMLElement, Zone>();

/**
 * The one keyboard drag that can be in flight, held at module scope rather than
 * inside an action instance.
 *
 * A cross-column keyboard move re-renders the item into a different `{#each}`,
 * which destroys the action and builds a new one. Keeping the grab here lets the
 * new instance adopt it and take focus back, so a move across three columns is
 * three key presses rather than three grabs.
 */
let keyboardDrag: {
	id: string;
	board: string;
	label: string;
	origin: { group: string; index: number };
	moved: boolean;
} | null = null;

/**
 * How many live action instances exist per item id.
 *
 * A cross-column move destroys one instance and mounts another, and Svelte does
 * not promise which happens first. Clearing the grab on destroy would therefore
 * end the drag roughly half the time; instead a destroy schedules a check, and
 * the grab only ends if nothing has claimed that id by the time it runs.
 */
const mountedItems = new Map<string, number>();

function retainItem(id: string) {
	mountedItems.set(id, (mountedItems.get(id) ?? 0) + 1);
}

function releaseItem(id: string) {
	const remaining = (mountedItems.get(id) ?? 1) - 1;
	if (remaining > 0) mountedItems.set(id, remaining);
	else mountedItems.delete(id);

	queueMicrotask(() => {
		if (keyboardDrag && !mountedItems.has(keyboardDrag.id)) keyboardDrag = null;
	});
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(value, max));
}

/** Live zones for one board, in visual order (left to right, then top to bottom). */
function boardZones(board: string): LiveZone[] {
	const live: LiveZone[] = [];
	for (const [el, zone] of zones) {
		if (zone.board !== board || !el.isConnected) continue;
		live.push({ ...zone, el, rect: el.getBoundingClientRect() });
	}
	return live.sort((a, b) => a.rect.left - b.rect.left || a.rect.top - b.rect.top);
}

/** Items belonging directly to a zone, in DOM order (which is render order). */
function itemsIn(zone: HTMLElement): HTMLElement[] {
	return Array.from(zone.querySelectorAll<HTMLElement>(`[${ITEM_ATTR}]`)).filter(
		(el) => el.closest(`[${GROUP_ATTR}]`) === zone
	);
}

/**
 * Re-attachable singleton elements.
 *
 * Checked for `isConnected` on every use: a client-side route change can drop
 * them from the document, and a live region that is no longer in the document
 * announces nothing.
 */
function ensureBodyElement(marker: string, build: (el: HTMLElement) => void): HTMLElement {
	let el = document.querySelector<HTMLElement>(`[${marker}]`);
	if (!el) {
		el = document.createElement('div');
		el.setAttribute(marker, '');
		build(el);
	}
	if (!el.isConnected) document.body.appendChild(el);
	return el;
}

function announcer(): HTMLElement {
	return ensureBodyElement('data-drag-announcer', (el) => {
		el.setAttribute('aria-live', 'polite');
		el.setAttribute('aria-atomic', 'true');
		el.className = 'sr-only';
	});
}

function instructions(): HTMLElement {
	return ensureBodyElement('data-drag-instructions', (el) => {
		el.id = INSTRUCTIONS_ID;
		el.className = 'sr-only';
		el.textContent = dragMessages.instructions;
	});
}

function announce(message: string) {
	announcer().textContent = message;
}

/**
 * Register a container as a drop target.
 *
 * Give the zone a `min-height` so it stays hit-testable when empty — an empty
 * column you cannot drop into is the most common way this feels broken.
 */
export function dropzone(node: HTMLElement, options: DropzoneOptions) {
	function apply(next: DropzoneOptions) {
		node.setAttribute(GROUP_ATTR, next.group);
		zones.set(node, {
			group: next.group,
			board: next.board ?? DEFAULT_BOARD,
			orientation: next.orientation ?? 'vertical'
		});
	}

	apply(options);

	return {
		update: apply,
		destroy() {
			zones.delete(node);
			node.removeAttribute(GROUP_ATTR);
		}
	};
}

/** Make a node draggable between `dropzone`s. */
export function draggable(node: HTMLElement, options: DraggableOptions) {
	let current = options;

	let pointerId: number | null = null;
	let holdTimer: ReturnType<typeof setTimeout> | null = null;
	let start = { x: 0, y: 0 };
	let last = { x: 0, y: 0 };
	let offset = { x: 0, y: 0 };
	let dragging = false;
	let ghost: HTMLElement | null = null;
	let indicator: HTMLElement | null = null;
	let scrollFrame: number | null = null;
	/** Last position the user was actually shown, and so the one we honour. */
	let pending: { group: string; index: number } | null = null;
	/** Own index in "self removed" space; dropping there means nothing moved. */
	let selfIndex = -1;
	let mounted = false;
	/** Restored on release, so a page that sets its own values keeps them. */
	let previousUserSelect = '';
	let previousWebkitUserSelect = '';
	let previousTouchCallout = '';

	const board = () => current.board ?? DEFAULT_BOARD;
	const label = () => current.label ?? current.id;
	const handleSelector = () => current.handle ?? HANDLE_SELECTOR;

	function ownZone(): HTMLElement | null {
		return node.closest<HTMLElement>(`[${GROUP_ATTR}]`);
	}

	function handleElement(): HTMLElement | null {
		return node.matches(handleSelector())
			? node
			: node.querySelector<HTMLElement>(handleSelector());
	}

	/**
	 * A handle is usually a `<button>`, but it does not have to be — so the
	 * action supplies whatever is missing rather than trusting the markup.
	 */
	function wireHandle() {
		const handle = handleElement();
		if (!handle) return;
		if (!handle.hasAttribute('tabindex') && handle.tagName !== 'BUTTON') {
			handle.setAttribute('tabindex', '0');
		}
		if (handle.tagName !== 'BUTTON' && !handle.hasAttribute('role')) {
			handle.setAttribute('role', 'button');
		}
		if (handle.tagName === 'BUTTON' && !handle.hasAttribute('tabindex')) {
			handle.setAttribute('tabindex', '0');
		}
		instructions();
		handle.setAttribute('aria-describedby', INSTRUCTIONS_ID);
		handle.setAttribute('aria-roledescription', 'drag handle');
	}

	// ---------------------------------------------------------------- pointer

	function createGhost() {
		const rect = node.getBoundingClientRect();
		const clone = node.cloneNode(true) as HTMLElement;
		// The clone must not look like a real item, or it would be hit-tested.
		clone.removeAttribute(ITEM_ATTR);
		clone.removeAttribute('id');
		clone.setAttribute('data-drag-ghost', '');
		clone.setAttribute('aria-hidden', 'true');
		clone.classList.add('drag-ghost');
		clone.style.width = `${rect.right - rect.left}px`;
		clone.style.height = `${rect.bottom - rect.top}px`;
		document.body.appendChild(clone);
		ghost = clone;
		moveGhost();
	}

	function moveGhost() {
		if (!ghost) return;
		ghost.style.left = `${last.x - offset.x}px`;
		ghost.style.top = `${last.y - offset.y}px`;
	}

	function removeGhost() {
		ghost?.remove();
		ghost = null;
	}

	function showIndicator(zone: LiveZone, index: number, siblings: HTMLElement[]) {
		if (!indicator) {
			indicator = document.createElement('div');
			indicator.setAttribute('data-drop-indicator', '');
			indicator.setAttribute('aria-hidden', 'true');
		}
		indicator.className =
			zone.orientation === 'horizontal'
				? 'drop-indicator drop-indicator--horizontal'
				: 'drop-indicator';
		const before = siblings[index] ?? null;
		if (before) zone.el.insertBefore(indicator, before);
		else zone.el.appendChild(indicator);
	}

	function removeIndicator() {
		indicator?.remove();
		indicator = null;
	}

	/**
	 * Scroll the page when the pointer holds near an edge, quadratically faster
	 * the closer it gets — linear falloff feels like a lurch at the boundary.
	 */
	function autoScroll() {
		if (scrollFrame !== null) return;
		const step = () => {
			if (!dragging) {
				scrollFrame = null;
				return;
			}
			const fromTop = last.y;
			const fromBottom = window.innerHeight - last.y;
			let amount = 0;
			if (fromTop < SCROLL_ZONE_PX) {
				const intensity = 1 - fromTop / SCROLL_ZONE_PX;
				amount = -SCROLL_SPEED_MAX * intensity * intensity;
			} else if (fromBottom < SCROLL_ZONE_PX) {
				const intensity = 1 - fromBottom / SCROLL_ZONE_PX;
				amount = SCROLL_SPEED_MAX * intensity * intensity;
			}
			if (amount !== 0) window.scrollBy(0, amount);
			scrollFrame = requestAnimationFrame(step);
		};
		scrollFrame = requestAnimationFrame(step);
	}

	function stopAutoScroll() {
		if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
		scrollFrame = null;
	}

	function beginDrag() {
		dragging = true;

		const rect = node.getBoundingClientRect();
		offset = { x: start.x - rect.left, y: start.y - rect.top };

		const zone = ownZone();
		selfIndex = zone ? itemsIn(zone).indexOf(node) : -1;

		node.setAttribute('data-dragging', 'pointer');
		// A press that began before the threshold may already have started a
		// selection; drop it, and stop the page collecting more while dragging.
		window.getSelection?.()?.removeAllRanges?.();
		// Both spellings, plus the callout: Safari only dropped the -webkit- prefix
		// recently, and iOS raises a Copy / Search bubble off a long press that no
		// amount of `user-select` alone suppresses.
		previousUserSelect = document.body.style.userSelect;
		previousWebkitUserSelect = document.body.style.webkitUserSelect;
		// Via setProperty because `-webkit-touch-callout` is iOS-only and absent
		// from CSSStyleDeclaration's typings — the property is real, the type is not.
		previousTouchCallout = document.body.style.getPropertyValue(TOUCH_CALLOUT);
		document.body.style.userSelect = 'none';
		document.body.style.webkitUserSelect = 'none';
		document.body.style.setProperty(TOUCH_CALLOUT, 'none');
		createGhost();
		autoScroll();
		window.addEventListener('keydown', onKeyDownWhileDragging, true);
		current.onDragStart?.(current.id);
		updateDrag();
	}

	function updateDrag() {
		moveGhost();

		const zone = pickZone(boardZones(board()), last);
		if (!zone) return; // Keep showing the last honest position.

		const siblings = itemsIn(zone.el).filter((el) => el !== node);
		const index = insertionIndex(
			siblings.map((el) => el.getBoundingClientRect()),
			last,
			zone.orientation
		);

		pending = { group: zone.group, index };
		showIndicator(zone, index, siblings);
	}

	function finishDrag(commit: boolean) {
		const wasDragging = dragging;
		dragging = false;
		pointerId = null;
		if (holdTimer) {
			clearTimeout(holdTimer);
			holdTimer = null;
		}
		stopAutoScroll();
		removeGhost();
		removeIndicator();
		if (wasDragging) {
			document.body.style.userSelect = previousUserSelect;
			document.body.style.webkitUserSelect = previousWebkitUserSelect;
			if (previousTouchCallout) {
				document.body.style.setProperty(TOUCH_CALLOUT, previousTouchCallout);
			} else {
				document.body.style.removeProperty(TOUCH_CALLOUT);
			}
		}
		node.removeAttribute('data-dragging');
		window.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('pointerup', onPointerUp);
		window.removeEventListener('pointercancel', onPointerCancel);
		window.removeEventListener('keydown', onKeyDownWhileDragging, true);

		const target = pending;
		pending = null;

		if (!wasDragging) return;
		// Nothing to report when the item lands back in the slot it left.
		if (commit && target && !(target.group === current.group && target.index === selfIndex)) {
			current.onDrop({
				id: current.id,
				fromGroup: current.group,
				toGroup: target.group,
				toIndex: target.index
			});
		}
		current.onDragEnd?.();
	}

	function onPointerDown(event: PointerEvent) {
		if (current.disabled || dragging || keyboardDrag) return;
		if (event.button !== 0) return;
		const target = event.target as HTMLElement | null;
		const handle = target?.closest<HTMLElement>(handleSelector());
		if (!handle) return;

		if (event.pointerType !== 'touch') {
			// Without this the browser reads the press-and-move as a text
			// selection, and the drag never starts — it just highlights the page.
			// Touch is left alone: the handle's `touch-action: none` already owns
			// the gesture, and cancelling the default there would also cancel the
			// click on a handle that doubles as a button.
			event.preventDefault();
			// preventDefault suppresses the focus a press normally gives the
			// handle, and the keyboard path needs it, so give it back deliberately.
			handle.focus?.();
		}

		pointerId = event.pointerId;
		start = { x: event.clientX, y: event.clientY };
		last = { ...start };

		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onPointerUp);
		window.addEventListener('pointercancel', onPointerCancel);

		if (event.pointerType === 'touch') {
			// A touch is a scroll until proven otherwise, so wait it out.
			holdTimer = setTimeout(() => {
				holdTimer = null;
				beginDrag();
				navigator.vibrate?.(50);
			}, TOUCH_HOLD_MS);
		}
	}

	function onPointerMove(event: PointerEvent) {
		if (pointerId !== null && event.pointerId !== pointerId) return;
		last = { x: event.clientX, y: event.clientY };

		if (dragging) {
			// Only meaningful on a mouse; touch scrolling is suppressed by the
			// handle's `touch-action`, and there is nothing left to cancel.
			event.preventDefault();
			updateDrag();
			return;
		}

		const travelled = Math.hypot(last.x - start.x, last.y - start.y);
		if (event.pointerType === 'touch') {
			// Moving during the hold means the user is scrolling. Let them.
			if (holdTimer && travelled > TOUCH_SLOP_PX) {
				clearTimeout(holdTimer);
				holdTimer = null;
				finishDrag(false);
			}
			return;
		}
		if (travelled > POINTER_SLOP_PX) beginDrag();
	}

	function onPointerUp(event: PointerEvent) {
		if (pointerId !== null && event.pointerId !== pointerId) return;
		last = { x: event.clientX, y: event.clientY };
		finishDrag(true);
	}

	function onPointerCancel() {
		finishDrag(false);
	}

	function onKeyDownWhileDragging(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		finishDrag(false);
	}

	// --------------------------------------------------------------- keyboard

	function adoptKeyboardDrag() {
		if (keyboardDrag?.id !== current.id) return;
		node.setAttribute('data-dragging', 'keyboard');
		handleElement()?.focus();
	}

	function keyboardPosition(): KeyboardPosition | null {
		const zoneEl = ownZone();
		if (!zoneEl) return null;
		const zone = boardZones(board()).find((candidate) => candidate.el === zoneEl);
		if (!zone) return null;
		const items = itemsIn(zoneEl);
		return { zone, index: items.indexOf(node), total: items.length };
	}

	function grab(position: KeyboardPosition) {
		keyboardDrag = {
			id: current.id,
			board: board(),
			label: label(),
			origin: { group: current.group, index: position.index },
			moved: false
		};
		node.setAttribute('data-dragging', 'keyboard');
		announce(dragMessages.grabbed(label(), position.index + 1, position.total));
	}

	function release(message?: string) {
		keyboardDrag = null;
		node.removeAttribute('data-dragging');
		if (message) announce(message);
	}

	function commitKeyboardMove(toGroup: string, toIndex: number) {
		if (keyboardDrag) keyboardDrag.moved = true;
		current.onDrop({ id: current.id, fromGroup: current.group, toGroup, toIndex });
	}

	function moveWithinGroup(position: KeyboardPosition, delta: number) {
		// One index past the last sibling is a real position: the end of the list.
		const limit = position.total - 1;
		const next = clamp(position.index + delta, 0, limit);
		if (next === position.index) {
			announce(dragMessages.edge(label()));
			return;
		}
		commitKeyboardMove(current.group, next);
		announce(dragMessages.moved(label(), current.group, next + 1, position.total));
	}

	function moveToAdjacentGroup(position: KeyboardPosition, delta: number) {
		const all = boardZones(board());
		const from = all.findIndex((zone) => zone.el === position.zone.el);
		const target = all[from + delta];
		if (!target) {
			announce(dragMessages.noGroup(label()));
			return;
		}
		const siblings = itemsIn(target.el).filter((el) => el !== node).length;
		const index = clamp(position.index, 0, siblings);
		commitKeyboardMove(target.group, index);
		announce(dragMessages.moved(label(), target.group, index + 1, siblings + 1));
	}

	function onKeyDown(event: KeyboardEvent) {
		if (current.disabled || dragging) return;
		const target = event.target as HTMLElement | null;
		if (!target?.closest(handleSelector())) return;

		const grab_ = keyboardDrag;
		const grabbed = grab_?.id === current.id;
		const keys = [' ', 'Enter', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
		if (!keys.includes(event.key)) return;
		if (!grabbed && event.key !== ' ' && event.key !== 'Enter') return;

		// An item outside any registered zone has no position to reason about —
		// there is nothing to reorder it against.
		const position = keyboardPosition();
		if (!position) return;
		event.preventDefault();

		if (event.key === ' ' || event.key === 'Enter') {
			if (!grabbed) grab(position);
			else
				release(dragMessages.dropped(label(), current.group, position.index + 1, position.total));
			return;
		}

		switch (event.key) {
			case 'Escape': {
				const { origin, moved } = grab_!;
				release(dragMessages.cancelled(label()));
				// Only worth a move if one was actually committed on the way here.
				if (moved) {
					current.onDrop({
						id: current.id,
						fromGroup: current.group,
						toGroup: origin.group,
						toIndex: origin.index
					});
				}
				break;
			}
			case 'ArrowUp':
				moveWithinGroup(position, -1);
				break;
			case 'ArrowDown':
				moveWithinGroup(position, 1);
				break;
			case 'ArrowLeft':
				moveToAdjacentGroup(position, -1);
				break;
			case 'ArrowRight':
				moveToAdjacentGroup(position, 1);
				break;
		}
	}

	/** Tabbing away commits wherever the item currently sits — it is what the user sees. */
	function onFocusOut(event: FocusEvent) {
		if (keyboardDrag?.id !== current.id) return;
		const next = event.relatedTarget as Node | null;
		if (next && node.contains(next)) return;

		// Not necessarily a user tabbing away: a keyboard move to another column
		// removes this node and mounts a replacement, and losing the focused
		// element fires focusout with no relatedTarget — indistinguishable at this
		// instant. Deciding on the next microtask is what tells them apart, once
		// the DOM update has finished and the replacement has taken focus back.
		queueMicrotask(() => {
			if (keyboardDrag?.id !== current.id) return;
			if (!node.isConnected) return;
			if (node.contains(document.activeElement)) return;
			release();
		});
	}

	function mount(next: DraggableOptions) {
		if (mounted && next.id !== current.id) {
			releaseItem(current.id);
			retainItem(next.id);
		}
		current = next;
		mounted = true;
		node.setAttribute(ITEM_ATTR, next.id);
		wireHandle();
		adoptKeyboardDrag();
	}

	node.addEventListener('pointerdown', onPointerDown);
	node.addEventListener('keydown', onKeyDown);
	node.addEventListener('focusout', onFocusOut);
	retainItem(options.id);
	mount(options);

	return {
		update: mount,
		destroy() {
			if (dragging || pointerId !== null) finishDrag(false);
			releaseItem(current.id);
			node.removeEventListener('pointerdown', onPointerDown);
			node.removeEventListener('keydown', onKeyDown);
			node.removeEventListener('focusout', onFocusOut);
			node.removeAttribute(ITEM_ATTR);
		}
	};
}
