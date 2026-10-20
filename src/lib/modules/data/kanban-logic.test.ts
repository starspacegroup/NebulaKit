import { describe, expect, it } from 'vitest';
import {
	addCard,
	columnCards,
	moveAnnouncement,
	moveCard,
	moveMenuItems,
	removeCard,
	stepCard,
	stepTarget,
	wipStatus,
	wipText,
	type KanbanCard,
	type KanbanColumn
} from './kanban-logic';

const columns: KanbanColumn[] = [
	{ id: 'todo', title: 'To do' },
	{ id: 'doing', title: 'Doing', limit: 2 },
	{ id: 'done', title: 'Done' }
];
const card = (id: string, group: string, order: number): KanbanCard => ({
	id,
	group,
	order,
	title: id.toUpperCase()
});
const base = (): KanbanCard[] => [
	card('a', 'todo', 0),
	card('b', 'todo', 1),
	card('c', 'todo', 2),
	card('d', 'doing', 0),
	card('e', 'doing', 1)
];
const ids = (cards: KanbanCard[], col: string) => columnCards(cards, col).map((c) => c.id);

describe('wip', () => {
	it('classifies against the limit', () => {
		expect(wipStatus(3, undefined)).toBe('none');
		expect(wipStatus(3, 0)).toBe('none');
		expect(wipStatus(1, 2)).toBe('ok');
		expect(wipStatus(2, 2)).toBe('at');
		expect(wipStatus(3, 2)).toBe('over');
	});
	it('words the count', () => {
		expect(wipText(2, 5)).toBe('2 / 5');
		expect(wipText(2, undefined)).toBe('2');
		expect(wipText(2, 0)).toBe('2');
	});
});

describe('moveCard', () => {
	it('reorders inside a column', () => {
		const r = moveCard(base(), columns, 'a', 'todo', 2);
		expect(r.moved).toBe(true);
		expect(ids(r.cards, 'todo')).toEqual(['b', 'c', 'a']);
		expect(r.position).toBe(3);
		expect(r.total).toBe(3);
	});
	it('moves across columns and renumbers both', () => {
		const r = moveCard(base(), columns, 'a', 'done', 0);
		expect(ids(r.cards, 'done')).toEqual(['a']);
		expect(ids(r.cards, 'todo')).toEqual(['b', 'c']);
		expect(r.column?.title).toBe('Done');
	});
	it('refuses a move into a full column but allows reordering within it', () => {
		const full = moveCard(base(), columns, 'a', 'doing', 0);
		expect(full).toMatchObject({ moved: false, reason: 'wip-limit' });
		const inside = moveCard(base(), columns, 'd', 'doing', 1);
		expect(inside.moved).toBe(true);
		expect(ids(inside.cards, 'doing')).toEqual(['e', 'd']);
	});
	it('reports unknowns and no-ops', () => {
		expect(moveCard(base(), columns, 'zz', 'todo', 0).reason).toBe('unknown-card');
		expect(moveCard(base(), columns, 'a', 'nope', 0).reason).toBe('unknown-column');
		const same = moveCard(base(), columns, 'a', 'todo', 0);
		expect(same).toMatchObject({ moved: false, reason: 'no-change' });
	});
});

describe('stepping', () => {
	it('finds up/down targets and edges', () => {
		const c = base();
		expect(stepTarget(c, columns, 'b', 'up')).toEqual({ column: 'todo', index: 0 });
		expect(stepTarget(c, columns, 'b', 'down')).toEqual({ column: 'todo', index: 2 });
		expect(stepTarget(c, columns, 'a', 'up')).toBeNull();
		expect(stepTarget(c, columns, 'c', 'down')).toBeNull();
	});
	it('finds left/right targets at the same height, clamped to the column size', () => {
		const c = base();
		expect(stepTarget(c, columns, 'c', 'right')).toEqual({ column: 'doing', index: 2 });
		expect(stepTarget(c, columns, 'a', 'right')).toEqual({ column: 'doing', index: 0 });
		expect(stepTarget(c, columns, 'd', 'left')).toEqual({ column: 'todo', index: 0 });
		expect(stepTarget(c, columns, 'a', 'left')).toBeNull();
		expect(stepTarget(c, columns, 'zz', 'left')).toBeNull();
	});
	it('stepCard moves, or says nothing moved', () => {
		const r = stepCard(base(), columns, 'a', 'down');
		expect(ids(r.cards, 'todo')).toEqual(['b', 'a', 'c']);
		expect(stepCard(base(), columns, 'a', 'up')).toMatchObject({
			moved: false,
			reason: 'no-change'
		});
		expect(stepCard(base(), columns, 'a', 'right').reason).toBe('wip-limit');
	});
});

describe('addCard / removeCard', () => {
	it('adds to the bottom with a trimmed title', () => {
		const r = addCard(base(), columns, 'todo', '  New  ', 'n');
		expect(r.error).toBe('');
		expect(r.card?.title).toBe('New');
		expect(ids(r.cards, 'todo')).toEqual(['a', 'b', 'c', 'n']);
	});
	it('refuses a blank title, a full column and an unknown column', () => {
		expect(addCard(base(), columns, 'todo', '  ', 'n').error).toBe('Enter a title for the card.');
		expect(addCard(base(), columns, 'doing', 'x', 'n').error).toBe('This column is at its limit.');
		expect(addCard(base(), columns, 'nope', 'x', 'n').error).not.toBe('');
		expect(addCard(base(), columns, 'doing', 'x', 'n', { blank: 'b', full: 'F' }).error).toBe('F');
	});
	it('removes and renumbers', () => {
		const r = removeCard(base(), 'b');
		expect(columnCards(r, 'todo').map((c) => c.order)).toEqual([0, 1]);
		expect(r).toHaveLength(4);
	});
});

describe('announcements and menu', () => {
	it('words a move, a block and a dead end', () => {
		const ok = moveCard(base(), columns, 'a', 'done', 0);
		expect(moveAnnouncement('A', ok)).toBe('A moved to Done, position 1 of 1.');
		const blocked = moveCard(base(), columns, 'a', 'doing', 0);
		expect(moveAnnouncement('A', blocked)).toContain('at its limit of 2');
		expect(moveAnnouncement('A', { moved: false, reason: 'no-change' })).toBe(
			'A cannot move further.'
		);
	});
	it('lists the menu entries', () => {
		const items = moveMenuItems(base(), columns, 'b');
		expect(items.map((i) => i.id)).toEqual(['up', 'down', 'to:doing', 'to:done']);
		expect(items.find((i) => i.id === 'to:doing')).toMatchObject({ disabled: true });
		expect(items.find((i) => i.id === 'to:doing')?.label).toContain('(full)');
		expect(moveMenuItems(base(), columns, 'a').map((i) => i.id)).not.toContain('up');
		expect(moveMenuItems(base(), columns, 'c').map((i) => i.id)).not.toContain('down');
		expect(moveMenuItems(base(), columns, 'zz')).toEqual([]);
	});
});
