import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { draggable, dropzone, type DropDetail } from './draggable';

/** Stub a rect on an element — happy-dom has no layout engine. */
function setRect(el: HTMLElement, top: number, left: number, height: number, width: number) {
	el.getBoundingClientRect = () =>
		({
			top,
			left,
			bottom: top + height,
			right: left + width,
			height,
			width,
			x: left,
			y: top,
			toJSON: () => ({})
		}) as DOMRect;
}

interface Board {
	root: HTMLElement;
	zones: Record<string, HTMLElement>;
	items: Record<string, HTMLElement>;
	handles: Record<string, HTMLElement>;
	drops: DropDetail[];
	destroy: () => void;
}

/**
 * Two 100px-wide columns of 40px rows:
 *
 *   left  (x 0..100): A(y 0..40)  B(40..80)  C(80..120)
 *   right (x 100..200): X(0..40)  Y(40..80)
 */
function buildBoard(options: { board?: string; disabled?: boolean } = {}): Board {
	const root = document.createElement('div');
	document.body.appendChild(root);

	const zones: Record<string, HTMLElement> = {};
	const items: Record<string, HTMLElement> = {};
	const handles: Record<string, HTMLElement> = {};
	const drops: DropDetail[] = [];
	const teardown: Array<() => void> = [];

	const layout: Record<string, string[]> = { left: ['A', 'B', 'C'], right: ['X', 'Y'] };
	let column = 0;

	for (const [group, ids] of Object.entries(layout)) {
		const zone = document.createElement('div');
		setRect(zone, 0, column * 100, 400, 100);
		root.appendChild(zone);
		zones[group] = zone;

		const zoneAction = dropzone(zone, { group, board: options.board });
		teardown.push(() => zoneAction.destroy());

		ids.forEach((id, index) => {
			const item = document.createElement('div');
			setRect(item, index * 40, column * 100, 40, 100);
			const handle = document.createElement('button');
			handle.setAttribute('data-drag-handle', '');
			item.appendChild(handle);
			zone.appendChild(item);
			items[id] = item;
			handles[id] = handle;

			const action = draggable(item, {
				id,
				group,
				board: options.board,
				label: id,
				disabled: options.disabled,
				onDrop: (detail) => drops.push(detail)
			});
			teardown.push(() => action.destroy());
		});

		column++;
	}

	return {
		root,
		zones,
		items,
		handles,
		drops,
		destroy: () => {
			teardown.forEach((fn) => fn());
			root.remove();
		}
	};
}

function pointer(type: string, x: number, y: number, init: PointerEventInit = {}) {
	return new PointerEvent(type, {
		clientX: x,
		clientY: y,
		pointerId: 1,
		pointerType: 'mouse',
		button: 0,
		bubbles: true,
		cancelable: true,
		...init
	});
}

/** Press the handle, then move past the 4px activation threshold. */
function startMouseDrag(board: Board, id: string, x: number, y: number) {
	board.handles[id].dispatchEvent(pointer('pointerdown', x, y));
	window.dispatchEvent(pointer('pointermove', x, y + 10));
}

function ghost() {
	return document.querySelector('[data-drag-ghost]');
}

function indicator() {
	return document.querySelector('[data-drop-indicator]');
}

let board: Board;

afterEach(() => {
	board?.destroy();
	document.body.innerHTML = '';
	vi.useRealTimers();
});

describe('identity stamping', () => {
	beforeEach(() => {
		board = buildBoard();
	});

	it('stamps the item id on the node so hit-testing never needs a DOM index', () => {
		expect(board.items.A.getAttribute('data-drag-item')).toBe('A');
	});

	it('stamps the group id on the zone', () => {
		expect(board.zones.left.getAttribute('data-drag-group')).toBe('left');
	});

	it('drops the attributes again when the actions are destroyed', () => {
		board.destroy();

		expect(board.items.A.hasAttribute('data-drag-item')).toBe(false);
		expect(board.zones.left.hasAttribute('data-drag-group')).toBe(false);
	});
});

describe('pointer activation', () => {
	beforeEach(() => {
		board = buildBoard();
	});

	it('ignores a press that misses the handle', () => {
		board.items.A.dispatchEvent(pointer('pointerdown', 50, 10));
		window.dispatchEvent(pointer('pointermove', 50, 100));

		expect(ghost()).toBeNull();
	});

	it('ignores a secondary-button press', () => {
		board.handles.A.dispatchEvent(pointer('pointerdown', 50, 10, { button: 2 }));
		window.dispatchEvent(pointer('pointermove', 50, 100));

		expect(ghost()).toBeNull();
	});

	it('does not engage until the pointer clears the slop threshold', () => {
		board.handles.A.dispatchEvent(pointer('pointerdown', 50, 10));
		window.dispatchEvent(pointer('pointermove', 51, 12));

		expect(ghost()).toBeNull();
	});

	it('engages once the pointer clears the threshold', () => {
		startMouseDrag(board, 'A', 50, 10);

		expect(ghost()).not.toBeNull();
		expect(board.items.A.getAttribute('data-dragging')).toBe('pointer');
	});

	it('does nothing at all when disabled', () => {
		board.destroy();
		board = buildBoard({ disabled: true });

		startMouseDrag(board, 'A', 50, 10);

		expect(ghost()).toBeNull();
	});
});

describe('dropping', () => {
	beforeEach(() => {
		board = buildBoard();
	});

	it('reports the index in the space the dragged item was removed from', () => {
		// A is dragged, so left reads as [B(40..80), C(80..120)]. y=110 is past
		// C's midpoint, so A belongs at the end: index 2, not 3.
		startMouseDrag(board, 'A', 50, 10);
		window.dispatchEvent(pointer('pointermove', 50, 110));
		window.dispatchEvent(pointer('pointerup', 50, 110));

		expect(board.drops).toEqual([{ id: 'A', fromGroup: 'left', toGroup: 'left', toIndex: 2 }]);
	});

	it('lands in the column the pointer is actually over', () => {
		startMouseDrag(board, 'A', 50, 10);
		window.dispatchEvent(pointer('pointermove', 150, 10));
		window.dispatchEvent(pointer('pointerup', 150, 10));

		expect(board.drops).toEqual([{ id: 'A', fromGroup: 'left', toGroup: 'right', toIndex: 0 }]);
	});

	it('treats a drop onto its own slot as a no-op', () => {
		startMouseDrag(board, 'B', 50, 50);
		window.dispatchEvent(pointer('pointermove', 50, 50));
		window.dispatchEvent(pointer('pointerup', 50, 50));

		expect(board.drops).toEqual([]);
	});

	it('commits the last position it showed when the pointer strays outside', () => {
		startMouseDrag(board, 'A', 50, 10);
		window.dispatchEvent(pointer('pointermove', 150, 10)); // over right
		window.dispatchEvent(pointer('pointermove', 900, 900)); // off the board
		window.dispatchEvent(pointer('pointerup', 900, 900));

		expect(board.drops).toEqual([{ id: 'A', fromGroup: 'left', toGroup: 'right', toIndex: 0 }]);
	});

	it('claims a drop below the last item in a short column', () => {
		startMouseDrag(board, 'A', 50, 10);
		window.dispatchEvent(pointer('pointermove', 150, 390));
		window.dispatchEvent(pointer('pointerup', 150, 390));

		expect(board.drops).toEqual([{ id: 'A', fromGroup: 'left', toGroup: 'right', toIndex: 2 }]);
	});

	it('shows an indicator while dragging and removes it on drop', () => {
		startMouseDrag(board, 'A', 50, 10);
		window.dispatchEvent(pointer('pointermove', 50, 110));

		expect(indicator()).not.toBeNull();

		window.dispatchEvent(pointer('pointerup', 50, 110));

		expect(indicator()).toBeNull();
		expect(ghost()).toBeNull();
		expect(board.items.A.hasAttribute('data-dragging')).toBe(false);
	});

	it('never drops onto a zone belonging to another board', () => {
		const other = buildBoard({ board: 'other' });

		startMouseDrag(board, 'A', 50, 10);
		window.dispatchEvent(pointer('pointermove', 150, 10));
		window.dispatchEvent(pointer('pointerup', 150, 10));

		expect(other.drops).toEqual([]);
		expect(board.drops[0].toGroup).toBe('right');

		other.destroy();
	});
});

describe('cancelling', () => {
	beforeEach(() => {
		board = buildBoard();
	});

	it('abandons the drag on Escape', () => {
		startMouseDrag(board, 'A', 50, 10);
		window.dispatchEvent(pointer('pointermove', 150, 10));
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		window.dispatchEvent(pointer('pointerup', 150, 10));

		expect(board.drops).toEqual([]);
		expect(ghost()).toBeNull();
	});

	it('abandons the drag when the browser takes the pointer away', () => {
		startMouseDrag(board, 'A', 50, 10);
		window.dispatchEvent(pointer('pointermove', 150, 10));
		window.dispatchEvent(pointer('pointercancel', 150, 10));

		expect(board.drops).toEqual([]);
		expect(ghost()).toBeNull();
	});

	it('cleans up if the node is destroyed mid-drag', () => {
		startMouseDrag(board, 'A', 50, 10);
		board.destroy();

		expect(ghost()).toBeNull();
		expect(indicator()).toBeNull();
	});
});

describe('touch', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		board = buildBoard();
	});

	it('waits for a deliberate hold before engaging', () => {
		board.handles.A.dispatchEvent(pointer('pointerdown', 50, 10, { pointerType: 'touch' }));

		expect(ghost()).toBeNull();

		vi.advanceTimersByTime(300);

		expect(ghost()).not.toBeNull();
	});

	it('lets a swipe through instead of hijacking it as a drag', () => {
		board.handles.A.dispatchEvent(pointer('pointerdown', 50, 10, { pointerType: 'touch' }));
		window.dispatchEvent(pointer('pointermove', 50, 60, { pointerType: 'touch' }));
		vi.advanceTimersByTime(300);

		expect(ghost()).toBeNull();
	});

	it('buzzes when the drag engages, where the device supports it', () => {
		const vibrate = vi.fn();
		vi.stubGlobal('navigator', { ...navigator, vibrate });

		board.handles.A.dispatchEvent(pointer('pointerdown', 50, 10, { pointerType: 'touch' }));
		vi.advanceTimersByTime(300);

		expect(vibrate).toHaveBeenCalledWith(50);
	});
});

describe('keyboard', () => {
	beforeEach(() => {
		board = buildBoard();
	});

	function key(id: string, k: string) {
		board.handles[id].dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
	}

	it('makes the handle reachable and self-describing', () => {
		const handle = board.handles.A;

		expect(handle.getAttribute('tabindex')).toBe('0');
		expect(handle.getAttribute('aria-describedby')).toBeTruthy();
		expect(document.getElementById(handle.getAttribute('aria-describedby')!)).not.toBeNull();
	});

	it('grabs on Space and announces the position', () => {
		key('A', ' ');

		expect(board.items.A.getAttribute('data-dragging')).toBe('keyboard');
		expect(document.querySelector('[data-drag-announcer]')?.textContent).toContain('1 of 3');
	});

	it('moves down one slot per press', () => {
		key('A', ' ');
		key('A', 'ArrowDown');

		expect(board.drops).toEqual([{ id: 'A', fromGroup: 'left', toGroup: 'left', toIndex: 1 }]);
	});

	it('refuses to move past the end, and says so', () => {
		key('C', ' ');
		key('C', 'ArrowDown');

		expect(board.drops).toEqual([]);
		expect(document.querySelector('[data-drag-announcer]')?.textContent).toContain('end');
	});

	it('moves to the next column on ArrowRight, keeping its row where it can', () => {
		key('B', ' ');
		key('B', 'ArrowRight');

		expect(board.drops).toEqual([{ id: 'B', fromGroup: 'left', toGroup: 'right', toIndex: 1 }]);
	});

	it('refuses to move past the outermost column', () => {
		key('A', ' ');
		key('A', 'ArrowLeft');

		expect(board.drops).toEqual([]);
	});

	it('returns the item to where it started on Escape', () => {
		key('A', ' ');
		key('A', 'ArrowDown');
		board.drops.length = 0;
		key('A', 'Escape');

		expect(board.drops).toEqual([{ id: 'A', fromGroup: 'left', toGroup: 'left', toIndex: 0 }]);
		expect(board.items.A.hasAttribute('data-dragging')).toBe(false);
	});

	it('drops where it is on Space and announces the result', () => {
		key('A', ' ');
		key('A', 'Enter');

		expect(board.items.A.hasAttribute('data-dragging')).toBe(false);
		expect(document.querySelector('[data-drag-announcer]')?.textContent).toContain('Dropped');
	});

	it('ignores arrow keys when nothing is grabbed', () => {
		key('A', 'ArrowDown');

		expect(board.drops).toEqual([]);
	});

	it('keeps the drag alive when the item remounts in a new column', () => {
		// A cross-column keyboard move destroys the node and rebuilds it inside the
		// other column's {#each}. The grab has to survive that, or every cross-column
		// move would need a fresh grab.
		key('A', ' ');

		const moved = document.createElement('div');
		const handle = document.createElement('button');
		handle.setAttribute('data-drag-handle', '');
		moved.appendChild(handle);
		board.zones.right.appendChild(moved);
		const action = draggable(moved, {
			id: 'A',
			group: 'right',
			label: 'A',
			onDrop: (detail) => board.drops.push(detail)
		});

		expect(moved.getAttribute('data-dragging')).toBe('keyboard');
		expect(document.activeElement).toBe(handle);

		action.destroy();
		moved.remove();
	});
});

describe('auto-scroll', () => {
	beforeEach(() => {
		board = buildBoard();
	});

	it('scrolls the page when the pointer sits in the edge zone', () => {
		const scrollBy = vi.fn();
		vi.stubGlobal('scrollBy', scrollBy);
		const frames: FrameRequestCallback[] = [];
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			frames.push(cb);
			return frames.length;
		});
		vi.stubGlobal('cancelAnimationFrame', () => {});

		startMouseDrag(board, 'A', 50, 10);
		frames.shift()?.(0);

		expect(scrollBy).toHaveBeenCalled();
		expect(scrollBy.mock.calls[0][1]).toBeLessThan(0);
	});

	it('stays still when the pointer is nowhere near an edge', () => {
		const scrollBy = vi.fn();
		vi.stubGlobal('scrollBy', scrollBy);
		vi.stubGlobal('innerHeight', 1000);
		const frames: FrameRequestCallback[] = [];
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			frames.push(cb);
			return frames.length;
		});
		vi.stubGlobal('cancelAnimationFrame', () => {});

		startMouseDrag(board, 'A', 50, 400);
		frames.shift()?.(0);

		expect(scrollBy).not.toHaveBeenCalled();
	});
});

describe('lifecycle callbacks', () => {
	it('brackets the drag with start and end callbacks', () => {
		const onDragStart = vi.fn();
		const onDragEnd = vi.fn();
		const node = document.createElement('div');
		const handle = document.createElement('button');
		handle.setAttribute('data-drag-handle', '');
		node.appendChild(handle);
		const zone = document.createElement('div');
		setRect(zone, 0, 0, 400, 100);
		zone.appendChild(node);
		document.body.appendChild(zone);

		const zoneAction = dropzone(zone, { group: 'only' });
		const action = draggable(node, {
			id: 'solo',
			group: 'only',
			onDrop: () => {},
			onDragStart,
			onDragEnd
		});

		handle.dispatchEvent(pointer('pointerdown', 10, 10));
		window.dispatchEvent(pointer('pointermove', 10, 30));

		expect(onDragStart).toHaveBeenCalledWith('solo');

		window.dispatchEvent(pointer('pointerup', 10, 30));

		expect(onDragEnd).toHaveBeenCalled();

		action.destroy();
		zoneAction.destroy();
		zone.remove();
	});
});

describe('handle resolution', () => {
	function mount(html: string, handle?: string) {
		const zone = document.createElement('div');
		setRect(zone, 0, 0, 400, 100);
		document.body.appendChild(zone);
		const node = document.createElement('div');
		node.innerHTML = html;
		setRect(node, 0, 0, 40, 100);
		zone.appendChild(node);
		const zoneAction = dropzone(zone, { group: 'only' });
		const drops: DropDetail[] = [];
		const action = draggable(node, {
			id: 'solo',
			group: 'only',
			handle,
			onDrop: (detail) => drops.push(detail)
		});
		return {
			node,
			drops,
			action,
			destroy: () => {
				action.destroy();
				zoneAction.destroy();
				zone.remove();
			}
		};
	}

	it('accepts the node itself as the handle', () => {
		const mounted = mount('', '.grip');
		mounted.node.classList.add('grip');
		mounted.action.update({ id: 'solo', group: 'only', handle: '.grip', onDrop: () => {} });

		expect(mounted.node.getAttribute('aria-roledescription')).toBe('drag handle');

		mounted.node.dispatchEvent(pointer('pointerdown', 10, 10));
		window.dispatchEvent(pointer('pointermove', 10, 40));

		expect(ghost()).not.toBeNull();

		window.dispatchEvent(pointer('pointerup', 10, 40));
		mounted.destroy();
	});

	it('stays inert when the markup has no handle at all', () => {
		const mounted = mount('<span>no grip</span>');

		mounted.node.dispatchEvent(pointer('pointerdown', 10, 10));
		window.dispatchEvent(pointer('pointermove', 10, 40));

		expect(ghost()).toBeNull();
		mounted.destroy();
	});

	it('makes a non-button handle operable', () => {
		const mounted = mount('<div data-drag-handle>grip</div>');
		const handle = mounted.node.firstElementChild!;

		expect(handle.getAttribute('tabindex')).toBe('0');
		expect(handle.getAttribute('role')).toBe('button');

		mounted.destroy();
	});

	it('leaves an explicit tabindex and role alone', () => {
		const mounted = mount('<div data-drag-handle tabindex="-1" role="menuitem">grip</div>');
		const handle = mounted.node.firstElementChild!;

		expect(handle.getAttribute('tabindex')).toBe('-1');
		expect(handle.getAttribute('role')).toBe('menuitem');

		mounted.destroy();
	});

	it('re-stamps identity when the options change', () => {
		const mounted = mount('<button data-drag-handle></button>');

		mounted.action.update({ id: 'renamed', group: 'only', onDrop: () => {} });

		expect(mounted.node.getAttribute('data-drag-item')).toBe('renamed');
		mounted.destroy();
	});
});

describe('stray input', () => {
	beforeEach(() => {
		board = buildBoard();
	});

	it('ignores events from a second pointer', () => {
		board.handles.A.dispatchEvent(pointer('pointerdown', 50, 10));
		window.dispatchEvent(pointer('pointermove', 50, 200, { pointerId: 7 }));

		expect(ghost()).toBeNull();

		window.dispatchEvent(pointer('pointermove', 50, 200));

		expect(ghost()).not.toBeNull();

		window.dispatchEvent(pointer('pointerup', 50, 200, { pointerId: 7 }));

		expect(ghost()).not.toBeNull();
	});

	it('ignores keys other than Escape during a drag', () => {
		startMouseDrag(board, 'A', 50, 10);
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

		expect(ghost()).not.toBeNull();
	});

	it('ignores keys pressed outside the handle', () => {
		board.items.A.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

		expect(board.items.A.hasAttribute('data-dragging')).toBe(false);
	});

	it('ignores the keyboard entirely when disabled', () => {
		board.destroy();
		board = buildBoard({ disabled: true });

		board.handles.A.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

		expect(board.items.A.hasAttribute('data-dragging')).toBe(false);
	});

	it('refuses to grab an item that is not inside a zone', () => {
		const node = document.createElement('div');
		const handle = document.createElement('button');
		handle.setAttribute('data-drag-handle', '');
		node.appendChild(handle);
		document.body.appendChild(node);
		const action = draggable(node, { id: 'loose', group: 'nowhere', onDrop: () => {} });

		handle.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

		expect(node.hasAttribute('data-dragging')).toBe(false);

		action.destroy();
		node.remove();
	});
});

describe('touch that turns out not to be a drag', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		board = buildBoard();
	});

	it('drops the pending hold when the finger lifts first', () => {
		board.handles.A.dispatchEvent(pointer('pointerdown', 50, 10, { pointerType: 'touch' }));
		window.dispatchEvent(pointer('pointerup', 50, 10, { pointerType: 'touch' }));
		vi.advanceTimersByTime(300);

		expect(ghost()).toBeNull();
		expect(board.drops).toEqual([]);
	});
});

describe('auto-scroll at the bottom edge', () => {
	beforeEach(() => {
		board = buildBoard();
	});

	it('scrolls down and stops once the drag ends', () => {
		const scrollBy = vi.fn();
		vi.stubGlobal('scrollBy', scrollBy);
		vi.stubGlobal('innerHeight', 500);
		const frames: FrameRequestCallback[] = [];
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			frames.push(cb);
			return frames.length;
		});
		vi.stubGlobal('cancelAnimationFrame', () => {});

		board.handles.A.dispatchEvent(pointer('pointerdown', 50, 480));
		window.dispatchEvent(pointer('pointermove', 50, 490));
		frames.shift()?.(0);

		expect(scrollBy.mock.calls[0][1]).toBeGreaterThan(0);

		window.dispatchEvent(pointer('pointerup', 50, 490));
		scrollBy.mockClear();
		frames.shift()?.(0);

		expect(scrollBy).not.toHaveBeenCalled();
	});
});

describe('columns stacked vertically', () => {
	it('treats the column below as the next one across', () => {
		const drops: DropDetail[] = [];
		const teardown: Array<() => void> = [];
		const handles: Record<string, HTMLElement> = {};

		['top', 'bottom'].forEach((group, column) => {
			const zone = document.createElement('div');
			setRect(zone, column * 400, 0, 400, 100);
			document.body.appendChild(zone);
			const zoneAction = dropzone(zone, { group });
			teardown.push(() => zoneAction.destroy());

			const item = document.createElement('div');
			setRect(item, column * 400, 0, 40, 100);
			const handle = document.createElement('button');
			handle.setAttribute('data-drag-handle', '');
			item.appendChild(handle);
			zone.appendChild(item);
			handles[group] = handle;

			const action = draggable(item, {
				id: group,
				group,
				onDrop: (detail) => drops.push(detail)
			});
			teardown.push(() => action.destroy());
		});

		handles.top.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		handles.top.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

		expect(drops).toEqual([{ id: 'top', fromGroup: 'top', toGroup: 'bottom', toIndex: 0 }]);

		teardown.forEach((fn) => fn());
	});
});

describe('a horizontal zone', () => {
	it('draws its indicator across the other axis', () => {
		const zone = document.createElement('div');
		setRect(zone, 0, 0, 100, 400);
		document.body.appendChild(zone);
		const zoneAction = dropzone(zone, { group: 'row', orientation: 'horizontal' });

		const ids = ['one', 'two'];
		const nodes = ids.map((id, index) => {
			const item = document.createElement('div');
			setRect(item, 0, index * 100, 100, 100);
			const handle = document.createElement('button');
			handle.setAttribute('data-drag-handle', '');
			item.appendChild(handle);
			zone.appendChild(item);
			return { id, item, handle, action: draggable(item, { id, group: 'row', onDrop: () => {} }) };
		});

		nodes[0].handle.dispatchEvent(pointer('pointerdown', 10, 50));
		window.dispatchEvent(pointer('pointermove', 60, 50));

		expect(indicator()?.className).toContain('drop-indicator--horizontal');

		window.dispatchEvent(pointer('pointerup', 60, 50));
		nodes.forEach((n) => n.action.destroy());
		zoneAction.destroy();
		zone.remove();
	});
});

describe('announcements', () => {
	beforeEach(() => {
		board = buildBoard();
	});

	it('falls back to the item id when no label is given', () => {
		const zone = board.zones.left;
		const item = document.createElement('div');
		setRect(item, 120, 0, 40, 100);
		const handle = document.createElement('button');
		handle.setAttribute('data-drag-handle', '');
		item.appendChild(handle);
		zone.appendChild(item);
		const action = draggable(item, { id: 'unlabelled', group: 'left', onDrop: () => {} });

		handle.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

		expect(document.querySelector('[data-drag-announcer]')?.textContent).toContain('unlabelled');

		action.destroy();
		item.remove();
	});
});

describe('focus', () => {
	beforeEach(() => {
		board = buildBoard();
	});

	it('commits the grab when focus leaves the item', async () => {
		board.handles.A.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		board.handles.A.dispatchEvent(
			new FocusEvent('focusout', { relatedTarget: document.body, bubbles: true })
		);
		await Promise.resolve();

		expect(board.items.A.hasAttribute('data-dragging')).toBe(false);
	});

	it('survives the focusout caused by its own node being replaced', async () => {
		// A cross-column move destroys this node and builds a new one. Losing the
		// focused element fires focusout with no relatedTarget — which must not be
		// read as the user tabbing away, or every cross-column move ends the grab.
		board.handles.A.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		board.items.A.remove();
		board.handles.A.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
		await Promise.resolve();

		const moved = document.createElement('div');
		const handle = document.createElement('button');
		handle.setAttribute('data-drag-handle', '');
		moved.appendChild(handle);
		board.zones.right.appendChild(moved);
		const action = draggable(moved, { id: 'A', group: 'right', onDrop: () => {} });

		expect(moved.getAttribute('data-dragging')).toBe('keyboard');

		action.destroy();
		moved.remove();
	});

	it('keeps the grab when focus moves within the item', () => {
		const inner = document.createElement('button');
		board.items.A.appendChild(inner);

		board.handles.A.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		board.handles.A.dispatchEvent(
			new FocusEvent('focusout', { relatedTarget: inner, bubbles: true })
		);

		expect(board.items.A.getAttribute('data-dragging')).toBe('keyboard');
	});
});

describe('keyboard, upward', () => {
	beforeEach(() => {
		board = buildBoard();
	});

	it('moves up one slot per press', () => {
		board.handles.C.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		board.handles.C.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

		expect(board.drops).toEqual([{ id: 'C', fromGroup: 'left', toGroup: 'left', toIndex: 1 }]);
	});
});

describe('keys and focus the action has no business acting on', () => {
	beforeEach(() => {
		board = buildBoard();
	});

	it('lets an unrelated key through the handle untouched', () => {
		const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
		board.handles.A.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(false);
		expect(board.items.A.hasAttribute('data-dragging')).toBe(false);
	});

	it('ignores focus leaving an item that was never grabbed', () => {
		board.handles.A.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		board.handles.B.dispatchEvent(
			new FocusEvent('focusout', { relatedTarget: document.body, bubbles: true })
		);

		expect(board.items.A.getAttribute('data-dragging')).toBe('keyboard');
	});
});

describe('not turning a drag into a text selection', () => {
	beforeEach(() => {
		board = buildBoard();
	});

	it('cancels the browser default on a mouse press, and focuses the handle itself', () => {
		const event = pointer('pointerdown', 50, 10);
		board.handles.A.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(board.handles.A);
	});

	it('leaves a touch press alone, so a handle can still be tapped', () => {
		const event = pointer('pointerdown', 50, 10, { pointerType: 'touch' });
		board.handles.A.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(false);
	});

	it('suppresses selection for the duration of the drag only', () => {
		document.body.style.userSelect = 'auto';

		startMouseDrag(board, 'A', 50, 10);

		expect(document.body.style.userSelect).toBe('none');

		window.dispatchEvent(pointer('pointerup', 50, 110));

		expect(document.body.style.userSelect).toBe('auto');
		document.body.style.userSelect = '';
	});

	it('suppresses the iOS long-press callout while dragging, and restores it', () => {
		const callout = () => document.body.style.getPropertyValue('-webkit-touch-callout');
		document.body.style.setProperty('-webkit-touch-callout', 'default');

		startMouseDrag(board, 'A', 50, 10);

		expect(callout()).toBe('none');
		expect(document.body.style.webkitUserSelect).toBe('none');

		window.dispatchEvent(pointer('pointerup', 50, 110));

		expect(callout()).toBe('default');
		document.body.style.removeProperty('-webkit-touch-callout');
		document.body.style.webkitUserSelect = '';
	});

	it('leaves the callout unset when the page never set one', () => {
		startMouseDrag(board, 'A', 50, 10);
		window.dispatchEvent(pointer('pointerup', 50, 110));

		expect(document.body.style.getPropertyValue('-webkit-touch-callout')).toBe('');
	});
});
