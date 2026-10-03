import { describe, expect, it } from 'vitest';
import {
	applyChoice,
	flattenGroups,
	groupCommands,
	hoverDelay,
	isChecked,
	isCommandShortcut,
	matchScore,
	menuModel,
	placeAtPoint,
	placeFloating,
	rankCommands,
	typeahead,
	typeaheadBuffer,
	typeaheadKey,
	type DropdownGroup
} from './overlay-logic';

const viewport = { width: 1000, height: 800 };
const panel = { width: 200, height: 100 };
const anchor = { top: 300, left: 400, width: 100, height: 40 };

describe('placeFloating', () => {
	it('sits below and centred by default', () => {
		expect(placeFloating(anchor, panel, viewport)).toEqual({ side: 'bottom', top: 348, left: 350 });
	});

	it('lines up by align on every side', () => {
		expect(placeFloating(anchor, panel, viewport, 'top', 'start')).toEqual({
			side: 'top',
			top: 192,
			left: 400
		});
		expect(placeFloating(anchor, panel, viewport, 'top', 'end').left).toBe(300);
		expect(placeFloating(anchor, panel, viewport, 'right', 'start')).toEqual({
			side: 'right',
			top: 300,
			left: 508
		});
		expect(placeFloating(anchor, panel, viewport, 'left', 'center')).toEqual({
			side: 'left',
			top: 270,
			left: 192
		});
		expect(placeFloating(anchor, panel, viewport, 'left', 'end').top).toBe(240);
	});

	it('flips to the opposite side when only that fits', () => {
		const nearBottom = { ...anchor, top: 700 };
		expect(placeFloating(nearBottom, panel, viewport, 'bottom').side).toBe('top');
		const nearTop = { ...anchor, top: 20 };
		expect(placeFloating(nearTop, panel, viewport, 'top')).toMatchObject({
			side: 'bottom',
			top: 68
		});
		const nearLeft = { ...anchor, left: 50 };
		expect(placeFloating(nearLeft, panel, viewport, 'left')).toMatchObject({
			side: 'right',
			left: 158
		});
		const nearRight = { ...anchor, left: 850 };
		expect(placeFloating(nearRight, panel, viewport, 'right').side).toBe('left');
	});

	it('keeps the side when neither fits and it has more room, else takes the roomier one', () => {
		const tall = { width: 200, height: 500 };
		expect(placeFloating({ ...anchor, top: 450 }, tall, viewport, 'bottom').side).toBe('top');
		expect(placeFloating({ ...anchor, top: 300 }, tall, viewport, 'bottom').side).toBe('bottom');
	});

	it('holds the cross axis inside the viewport, and pins an oversized panel to the margin', () => {
		expect(placeFloating({ ...anchor, left: 0 }, panel, viewport).left).toBe(8);
		expect(placeFloating({ ...anchor, left: 950 }, panel, viewport).left).toBe(792);
		expect(placeFloating(anchor, { width: 2000, height: 50 }, viewport).left).toBe(8);
		expect(placeFloating({ ...anchor, top: 0 }, panel, viewport, 'right').top).toBe(8);
	});
});

describe('placeAtPoint', () => {
	const size = { width: 200, height: 300 };
	it('opens down and right of the pointer when it fits', () => {
		expect(placeAtPoint(100, 100, size, viewport)).toEqual({ left: 100, top: 100 });
	});
	it('mirrors up or left near an edge', () => {
		expect(placeAtPoint(900, 700, size, viewport)).toEqual({ left: 700, top: 400 });
	});
	it('holds it in when neither direction fits', () => {
		expect(placeAtPoint(100, 100, size, { width: 250, height: 350 })).toEqual({
			left: 42,
			top: 42
		});
		expect(placeAtPoint(5, 5, { width: 400, height: 10 }, { width: 300, height: 100 }).left).toBe(
			8
		);
	});
});

describe('menuModel', () => {
	it('splits rows from actionable items, indexing past separators', () => {
		const model = menuModel([
			{ id: 'a', label: 'A' },
			{ separator: true },
			{ id: 'b', label: 'B', disabled: true },
			{ id: 'c', label: 'C' }
		]);
		expect(model.items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
		expect(model.disabled).toEqual([1]);
		expect(model.rows.map((r) => (r.kind === 'item' ? r.index : '-'))).toEqual([0, '-', 1, 2]);
	});
});

describe('typeahead', () => {
	const labels = ['Copy', 'Cut', 'Paste', 'Print', 'Delete'];

	it('takes printable characters, not named keys, chords, or a leading space', () => {
		expect(typeaheadKey({ key: 'c' })).toBe('c');
		expect(typeaheadKey({ key: 'ArrowDown' })).toBeNull();
		expect(typeaheadKey({ key: 'c', ctrlKey: true })).toBeNull();
		expect(typeaheadKey({ key: 'c', altKey: true })).toBeNull();
		expect(typeaheadKey({ key: 'c', metaKey: true })).toBeNull();
		expect(typeaheadKey({ key: ' ' })).toBeNull();
		expect(typeaheadKey({ key: ' ' }, true)).toBe(' ');
	});

	it('builds a buffer while typing quickly and starts over after a pause', () => {
		const one = typeaheadBuffer({ text: '', at: 0 }, 'p', 1000);
		const two = typeaheadBuffer(one, 'r', 1200);
		expect(two).toEqual({ text: 'pr', at: 1200 });
		expect(typeaheadBuffer(two, 'c', 1800).text).toBe('c');
	});

	it('cycles on one repeated character, from after the current item', () => {
		expect(typeahead(labels, 0, 'c')).toBe(1);
		expect(typeahead(labels, 1, 'cc')).toBe(0);
		expect(typeahead(labels, -1, 'p')).toBe(2);
	});

	it('keeps the current item for a longer match, and skips disabled ones', () => {
		expect(typeahead(labels, 3, 'pr')).toBe(3);
		expect(typeahead(labels, -1, 'pr')).toBe(3);
		expect(typeahead(labels, 0, 'p', [2])).toBe(3);
	});

	it('returns null for no match or an empty search', () => {
		expect(typeahead(labels, 0, 'z')).toBeNull();
		expect(typeahead(labels, 0, '')).toBeNull();
		expect(typeahead([], 0, 'a')).toBeNull();
	});
});

describe('dropdown choices', () => {
	const groups: DropdownGroup[] = [
		{ items: [{ id: 'new', label: 'New' }] },
		{ label: 'View', items: [{ id: 'grid', label: 'Grid', checkbox: true }] },
		{
			label: 'Sort',
			radio: 'sort',
			items: [
				{ id: 'name', label: 'Name' },
				{ id: 'date', label: 'Date', disabled: true },
				{ id: 'size', label: 'Size' }
			]
		}
	];
	const flat = flattenGroups(groups);

	it('flattens groups and marks each kind', () => {
		expect(flat.map((e) => [e.kind, e.group])).toEqual([
			['item', 0],
			['checkbox', 1],
			['radio', 2],
			['radio', 2],
			['radio', 2]
		]);
		expect(flat[2].radio).toBe('sort');
	});

	it('reads checked state for checkbox and radio items only', () => {
		const state = { grid: true, sort: 'name' };
		expect(isChecked(state, flat[0])).toBeUndefined();
		expect(isChecked(state, flat[1])).toBe(true);
		expect(isChecked({}, flat[1])).toBe(false);
		expect(isChecked(state, flat[2])).toBe(true);
		expect(isChecked(state, flat[4])).toBe(false);
	});

	it('toggles a checkbox and picks a radio, reporting the change', () => {
		expect(applyChoice({}, flat[1])).toEqual({
			state: { grid: true },
			change: { id: 'grid', value: true }
		});
		expect(applyChoice({ grid: true }, flat[1])?.change.value).toBe(false);
		expect(applyChoice({ sort: 'name' }, flat[4])).toEqual({
			state: { sort: 'size' },
			change: { id: 'sort', value: 'size' }
		});
	});

	it('changes nothing for plain, disabled or already-chosen items', () => {
		expect(applyChoice({}, flat[0])).toBeNull();
		expect(applyChoice({}, flat[3])).toBeNull();
		expect(applyChoice({ sort: 'name' }, flat[2])).toBeNull();
	});
});

describe('command search', () => {
	it('scores prefix over word start over substring', () => {
		expect(matchScore('Settings', 'set')).toBe(3);
		expect(matchScore('Open settings', 'SET')).toBe(2);
		expect(matchScore('Reset password', 'set')).toBe(1);
		expect(matchScore('Reset re-set', 'set')).toBe(2);
		expect(matchScore('Profile', 'xyz')).toBe(0);
		expect(matchScore('Profile', '  ')).toBe(1);
	});

	const items = [
		{ id: 'reset', label: 'Reset password', group: 'Account' },
		{ id: 'open', label: 'Open settings', group: 'General' },
		{ id: 'prefs', label: 'Preferences', group: 'General', keywords: ['setup', 'config'] },
		{ id: 'settings', label: 'Settings', group: 'Account' },
		{ id: 'theme', label: 'Theme' }
	];

	it('ranks label matches by kind, keyword matches just below, ties in order', () => {
		expect(rankCommands(items, 'set').map((i) => i.id)).toEqual([
			'settings',
			'prefs',
			'open',
			'reset'
		]);
		expect(rankCommands(items, 'zzz')).toEqual([]);
		expect(rankCommands(items, 'the').map((i) => i.id)).toEqual(['theme']);
		const ties = [
			{ id: 'b', label: 'Pb' },
			{ id: 'a', label: 'Pa' }
		];
		expect(rankCommands(ties, 'p').map((i) => i.id)).toEqual(['b', 'a']);
		expect(rankCommands(items, ' ').map((i) => i.id)).toEqual(items.map((i) => i.id));
	});

	it('groups in order of first appearance', () => {
		const grouped = groupCommands(rankCommands(items, 'set'));
		expect(grouped.map((g) => [g.group, g.items.map((i) => i.id)])).toEqual([
			['Account', ['settings', 'reset']],
			['General', ['prefs', 'open']]
		]);
		expect(groupCommands([items[4]])).toEqual([{ group: '', items: [items[4]] }]);
	});

	it('knows the ⌘K / Ctrl+K shortcut', () => {
		expect(isCommandShortcut({ key: 'k', metaKey: true })).toBe(true);
		expect(isCommandShortcut({ key: 'K', ctrlKey: true })).toBe(true);
		expect(isCommandShortcut({ key: 'k' })).toBe(false);
		expect(isCommandShortcut({ key: 'k', ctrlKey: true, shiftKey: true })).toBe(false);
		expect(isCommandShortcut({ key: 'k', ctrlKey: true, altKey: true })).toBe(false);
		expect(isCommandShortcut({ key: 'j', ctrlKey: true })).toBe(false);
	});
});

describe('hoverDelay', () => {
	it('opens at once on focus, after the delay on hover, and never negative', () => {
		expect(hoverDelay('open', 'focus', 700, 300)).toBe(0);
		expect(hoverDelay('open', 'pointer', 700, 300)).toBe(700);
		expect(hoverDelay('open', 'pointer', -5, 300)).toBe(0);
		expect(hoverDelay('close', 'pointer', 700, 300)).toBe(300);
		expect(hoverDelay('close', 'focus', 700, -1)).toBe(0);
	});
});
