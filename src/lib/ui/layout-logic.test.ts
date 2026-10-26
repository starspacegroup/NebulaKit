import { describe, expect, it } from 'vitest';
import {
	clamp,
	containerMaxWidth,
	containsCurrent,
	disclosureKey,
	flexValue,
	isCurrent,
	isOffCanvas,
	itemName,
	parseRatio,
	pointerPercent,
	scrollEdges,
	spaceValue,
	splitLimits,
	splitterKey,
	stepSelectable,
	stepStates
} from './layout-logic';

describe('clamp', () => {
	it('holds a value to its range, and NaN to min', () => {
		expect(clamp(5, 0, 10)).toBe(5);
		expect(clamp(-1, 0, 10)).toBe(0);
		expect(clamp(11, 0, 10)).toBe(10);
		expect(clamp(NaN, 2, 10)).toBe(2);
	});
});

describe('parseRatio', () => {
	it('takes numbers and ratio strings', () => {
		expect(parseRatio(1.5)).toBe(1.5);
		expect(parseRatio('16/9')).toBeCloseTo(16 / 9);
		expect(parseRatio('4:3')).toBeCloseTo(4 / 3);
		expect(parseRatio(' 21 / 9 ')).toBeCloseTo(21 / 9);
		expect(parseRatio('2')).toBe(2);
	});

	it('falls back to a square for anything unusable', () => {
		expect(parseRatio(0)).toBe(1);
		expect(parseRatio(-2)).toBe(1);
		expect(parseRatio(Infinity)).toBe(1);
		expect(parseRatio('16/0')).toBe(1);
		expect(parseRatio('wide')).toBe(1);
		expect(parseRatio('1/2/3')).toBe(1);
		expect(parseRatio('')).toBe(1);
	});
});

describe('splitLimits', () => {
	it('holds limits to 0–100 and puts them in order', () => {
		expect(splitLimits(20, 80)).toEqual({ min: 20, max: 80 });
		expect(splitLimits(90, 10)).toEqual({ min: 10, max: 90 });
		expect(splitLimits(-5, 150)).toEqual({ min: 0, max: 100 });
	});
});

describe('splitterKey', () => {
	const opts = { min: 20, max: 80, step: 5, restore: 50 };

	it('steps with the arrows that match the orientation', () => {
		expect(splitterKey('ArrowLeft', 50, 'horizontal', opts)).toBe(45);
		expect(splitterKey('ArrowRight', 50, 'horizontal', opts)).toBe(55);
		expect(splitterKey('ArrowUp', 50, 'vertical', opts)).toBe(45);
		expect(splitterKey('ArrowDown', 50, 'vertical', opts)).toBe(55);
		expect(splitterKey('ArrowUp', 50, 'horizontal', opts)).toBeNull();
		expect(splitterKey('ArrowLeft', 50, 'vertical', opts)).toBeNull();
	});

	it('clamps steps to the limits', () => {
		expect(splitterKey('ArrowLeft', 22, 'horizontal', opts)).toBe(20);
		expect(splitterKey('ArrowRight', 78, 'horizontal', opts)).toBe(80);
	});

	it('jumps with Home and End', () => {
		expect(splitterKey('Home', 50, 'horizontal', opts)).toBe(20);
		expect(splitterKey('End', 50, 'horizontal', opts)).toBe(80);
	});

	it('collapses with Enter, then restores', () => {
		expect(splitterKey('Enter', 60, 'horizontal', opts)).toBe(20);
		expect(splitterKey('Enter', 20, 'horizontal', opts)).toBe(50);
		// Nothing worth restoring: open fully instead of staying shut.
		expect(splitterKey('Enter', 20, 'horizontal', { ...opts, restore: 10 })).toBe(80);
		// A restore past max is held to it.
		expect(splitterKey('Enter', 20, 'horizontal', { ...opts, restore: 95 })).toBe(80);
	});

	it('ignores other keys', () => {
		expect(splitterKey('a', 50, 'horizontal', opts)).toBeNull();
	});
});

describe('pointerPercent', () => {
	it('places a pointer along a box', () => {
		expect(pointerPercent(150, 100, 200)).toBe(25);
		expect(pointerPercent(0, 100, 200)).toBe(0);
		expect(pointerPercent(400, 100, 200)).toBe(100);
	});

	it('is 0 for a box with no length', () => {
		expect(pointerPercent(10, 0, 0)).toBe(0);
		expect(pointerPercent(10, 0, NaN)).toBe(0);
	});
});

describe('scrollEdges', () => {
	const base = {
		scrollTop: 0,
		scrollLeft: 0,
		scrollHeight: 100,
		scrollWidth: 100,
		clientHeight: 100,
		clientWidth: 100
	};

	it('shows nothing when everything fits', () => {
		expect(scrollEdges(base)).toEqual({ top: false, bottom: false, left: false, right: false });
	});

	it('shows the edges with more content past them', () => {
		expect(scrollEdges({ ...base, scrollHeight: 300, scrollTop: 100 })).toEqual({
			top: true,
			bottom: true,
			left: false,
			right: false
		});
		expect(scrollEdges({ ...base, scrollHeight: 300, scrollTop: 200 }).bottom).toBe(false);
		expect(scrollEdges({ ...base, scrollWidth: 300 })).toMatchObject({ left: false, right: true });
	});

	it('reads a right-to-left scroll offset by its size', () => {
		expect(scrollEdges({ ...base, scrollWidth: 300, scrollLeft: -200 })).toMatchObject({
			left: true,
			right: false
		});
	});

	it('ignores sub-pixel leftovers', () => {
		expect(scrollEdges({ ...base, scrollHeight: 100.5 }).bottom).toBe(false);
		expect(scrollEdges({ ...base, scrollHeight: 100.5 }, 0).bottom).toBe(true);
	});
});

describe('layout values', () => {
	it('maps container sizes, defaulting to lg', () => {
		expect(containerMaxWidth('sm')).toBe('40rem');
		expect(containerMaxWidth('full')).toBe('none');
		expect(containerMaxWidth('huge')).toBe('64rem');
	});

	it('maps gap tokens to spacing variables', () => {
		expect(spaceValue('md')).toBe('var(--spacing-md)');
		expect(spaceValue('2xl')).toBe('var(--spacing-2xl)');
		expect(spaceValue('none')).toBe('0');
		expect(spaceValue('bogus')).toBe('0');
	});

	it('maps short flex names to CSS keywords', () => {
		expect(flexValue('start')).toBe('flex-start');
		expect(flexValue('end')).toBe('flex-end');
		expect(flexValue('between')).toBe('space-between');
		expect(flexValue('around')).toBe('space-around');
		expect(flexValue('evenly')).toBe('space-evenly');
		expect(flexValue('center')).toBe('center');
		expect(flexValue('stretch')).toBe('stretch');
	});
});

describe('steps', () => {
	it('derives each state from the current index, keeping errors', () => {
		expect(stepStates([{}, { error: true }, {}, {}], 2)).toEqual([
			'complete',
			'error',
			'current',
			'upcoming'
		]);
		expect(stepStates([], 0)).toEqual([]);
	});

	it('lets only completed steps be pressed, and only when clickable', () => {
		expect(stepSelectable('complete', true)).toBe(true);
		expect(stepSelectable('complete', false)).toBe(false);
		expect(stepSelectable('current', true)).toBe(false);
		expect(stepSelectable('error', true)).toBe(false);
	});
});

describe('current item', () => {
	const tree = {
		id: 'settings',
		children: [
			{ id: 'profile', href: '/settings/profile' },
			{ id: 'team', children: [{ id: 'members', href: '/settings/team/members' }] }
		]
	};

	it('matches by id or by href, ignoring trailing slashes and queries', () => {
		expect(isCurrent({ id: 'home', href: '/' }, '/')).toBe(true);
		expect(isCurrent({ id: 'home', href: '/' }, 'home')).toBe(true);
		expect(isCurrent({ id: 'd', href: '/docs/' }, '/docs?tab=1')).toBe(true);
		expect(isCurrent({ id: 'd', href: '/docs#top' }, '/docs')).toBe(true);
		expect(isCurrent({ id: 'd', href: '/docs' }, '/doc')).toBe(false);
		expect(isCurrent({ id: 'd' }, '/docs')).toBe(false);
		expect(isCurrent({ id: 'd', href: '/docs' }, '')).toBe(false);
	});

	it('finds the current page among descendants', () => {
		expect(containsCurrent(tree, '/settings/profile')).toBe(true);
		expect(containsCurrent(tree, '/settings/team/members')).toBe(true);
		expect(containsCurrent(tree, 'settings')).toBe(false);
		expect(containsCurrent({ id: 'leaf' }, 'leaf')).toBe(false);
	});
});

describe('isOffCanvas', () => {
	it('is off-canvas below the breakpoint, never with no width', () => {
		expect(isOffCanvas(500, 768)).toBe(true);
		expect(isOffCanvas(768, 768)).toBe(false);
		expect(isOffCanvas(0, 768)).toBe(false);
	});
});

describe('disclosureKey', () => {
	it('opens on Down, closes an open panel on Escape', () => {
		expect(disclosureKey('ArrowDown', false)).toBe('open');
		expect(disclosureKey('ArrowDown', true)).toBe('open');
		expect(disclosureKey('Escape', true)).toBe('close');
		expect(disclosureKey('Escape', false)).toBeNull();
		expect(disclosureKey('Enter', false)).toBeNull();
	});
});

describe('itemName', () => {
	it('adds a badge after the label', () => {
		expect(itemName('Inbox', 3)).toBe('Inbox, 3');
		expect(itemName('Inbox', 0)).toBe('Inbox, 0');
		expect(itemName('Inbox')).toBe('Inbox');
		expect(itemName('Inbox', '')).toBe('Inbox');
	});
});
