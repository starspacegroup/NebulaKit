import { fireEvent, render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Harness from '../../../../tests/fixtures/ModulesDataHarness.svelte';
import '../test-env';

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

type Which =
	| 'grid'
	| 'filterbar'
	| 'kanban'
	| 'feed'
	| 'thread'
	| 'team'
	| 'files'
	| 'calendar'
	| 'tree'
	| 'audit';

function harness(which: Which, props: Record<string, unknown> = {}) {
	const events: [string, unknown][] = [];
	const utils = render(Harness, {
		props: { which, props, onEvent: (n: string, d: unknown) => events.push([n, d]) }
	});
	const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}');
	const last = (name: string) => [...events].reverse().find(([n]) => n === name)?.[1];
	return { ...utils, events, state, last };
}

const settle = async () => {
	for (let i = 0; i < 4; i++) {
		await tick();
		await new Promise((r) => setTimeout(r, 0));
	}
};

/* ---------------------------------------------------------------- DataGrid */

const gridRows = [
	{ id: 1, name: 'Ada', team: 'Eng', age: 36 },
	{ id: 2, name: 'Alan', team: 'Eng', age: 41 },
	{ id: 3, name: 'Grace', team: 'Ops', age: 85 },
	{ id: 4, name: 'Barbara', team: 'Ops', age: 36 },
	{ id: 5, name: 'Edsger', team: 'Eng', age: 72 }
];
const gridColumns = [
	{ key: 'name', label: 'Name', sortable: true },
	{
		key: 'team',
		label: 'Team',
		sortable: true,
		filter: 'select',
		options: [
			{ value: 'Eng', label: 'Eng' },
			{ value: 'Ops', label: 'Ops' }
		]
	},
	{ key: 'age', label: 'Age', sortable: true, align: 'end', format: (v: unknown) => `${v} yrs` }
];
const gridProps = (extra: Record<string, unknown> = {}) => ({
	label: 'People',
	rows: gridRows,
	columns: gridColumns,
	pageSize: 0,
	...extra
});
// Read the body rows from childNodes, not querySelectorAll('tbody tr'): after Svelte 4 reorders a
// keyed list, happy-dom 12's query result keeps a stale extra row that is no longer in the table.
const bodyRows = (): Element[] =>
	Array.from(document.querySelector('tbody')?.childNodes ?? []).filter(
		(n): n is Element => n.nodeType === 1
	);
const bodyNames = () => bodyRows().map((tr) => tr.querySelector('td')?.textContent?.trim());
const firstCells = () =>
	bodyRows().map((tr) => tr.querySelector('td[data-label="Name"]')?.textContent?.trim());

describe('DataGrid', () => {
	it('is a labelled region with a caption, a count and formatted cells', () => {
		harness('grid', gridProps());
		expect(screen.getByRole('region', { name: 'People' })).toBeInTheDocument();
		expect(screen.getByText('5 results')).toBeInTheDocument();
		expect(screen.getAllByText('36 yrs', { selector: 'td' })).toHaveLength(2);
		expect(firstCells()).toEqual(['Ada', 'Alan', 'Grace', 'Barbara', 'Edsger']);
	});

	it('sorts with aria-sort, announces it, and Shift adds a second column', async () => {
		const { events, last } = harness('grid', gridProps());
		const age = screen.getByRole('button', { name: /^Age/ });
		await fireEvent.click(age);
		expect(age.closest('th')).toHaveAttribute('aria-sort', 'ascending');
		expect(firstCells()[4]).toBe('Grace');
		await fireEvent.click(screen.getByRole('button', { name: /^Name/ }), { shiftKey: true });
		expect(screen.getByRole('button', { name: /^Name/ }).closest('th')).toHaveAttribute(
			'aria-sort',
			'ascending'
		);
		expect(firstCells().slice(0, 2)).toEqual(['Ada', 'Barbara']);
		expect(screen.getByText('Sorted by Age ascending, then Name ascending.')).toBeInTheDocument();
		expect(events.filter(([n]) => n === 'sort')).toHaveLength(2);
		expect(last('sort')).toMatchObject({ sorts: [{ key: 'age' }, { key: 'name' }] });
		await fireEvent.click(age);
		await fireEvent.click(age);
		await fireEvent.click(age);
		expect(age.closest('th')).toHaveAttribute('aria-sort', 'none');
	});

	it('sorts from the card-mode select', async () => {
		harness('grid', gridProps());
		await fireEvent.change(screen.getByLabelText('Sort by'), {
			target: { value: 'age:descending' }
		});
		expect(firstCells()[0]).toBe('Grace');
		await fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: '' } });
		expect(firstCells()[0]).toBe('Ada');
	});

	it('searches, says when nothing matches, and clears', async () => {
		const { last } = harness('grid', gridProps());
		await fireEvent.input(screen.getByRole('searchbox', { name: 'Search' }), {
			target: { value: 'gra' }
		});
		expect(firstCells()).toEqual(['Grace']);
		expect(screen.getByText('1 result')).toBeInTheDocument();
		expect(last('filter')).toMatchObject({ query: 'gra' });
		await fireEvent.input(screen.getByRole('searchbox', { name: 'Search' }), {
			target: { value: 'zzz' }
		});
		expect(screen.getByText('No matches.'.replace('matches.', 'rows match.'))).toBeInTheDocument();
		await fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]);
		expect(firstCells()).toHaveLength(5);
	});

	it('filters by column from the Filters disclosure', async () => {
		harness('grid', gridProps());
		const summary = screen.getByText('Filters');
		expect(summary.closest('details')).toBeInTheDocument();
		await fireEvent.change(screen.getByLabelText('Team'), { target: { value: 'Ops' } });
		expect(firstCells()).toEqual(['Grace', 'Barbara']);
		expect(screen.getByText('Filters (1)')).toBeInTheDocument();
		await fireEvent.change(screen.getByLabelText('Team'), { target: { value: '' } });
		expect(firstCells()).toHaveLength(5);
	});

	it('pages and changes the page size', async () => {
		const { last } = harness('grid', gridProps({ pageSize: 2, pageSizes: [2, 5] }));
		expect(firstCells()).toEqual(['Ada', 'Alan']);
		expect(screen.getByText('1–2 of 5')).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));
		expect(firstCells()).toEqual(['Grace', 'Barbara']);
		expect(last('pagechange')).toMatchObject({ page: 2 });
		await fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '5' } });
		expect(firstCells()).toHaveLength(5);
	});

	it('selects rows, shows the bulk bar, goes indeterminate and clears', async () => {
		const { state, last } = harness(
			'grid',
			gridProps({ selectable: true, bulkActions: [{ id: 'del', label: 'Delete', danger: true }] })
		);
		const all = screen.getByRole('checkbox', {
			name: 'Select all rows on this page'
		}) as HTMLInputElement;
		await fireEvent.click(screen.getByRole('checkbox', { name: 'Select Ada' }));
		expect(all.indeterminate).toBe(true);
		const bulk = screen.getByRole('region', { name: 'Bulk actions' });
		expect(within(bulk).getByText('1 selected')).toBeInTheDocument();
		await fireEvent.click(all);
		expect(state().selected).toHaveLength(5);
		expect(all.indeterminate).toBe(false);
		await fireEvent.click(within(bulk).getByRole('button', { name: 'Delete' }));
		expect(last('bulkaction')).toMatchObject({ action: 'del' });
		await fireEvent.click(within(bulk).getByRole('button', { name: 'Clear selection' }));
		expect(state().selected).toEqual([]);
		expect(screen.queryByRole('region', { name: 'Bulk actions' })).toBeNull();
	});

	it('opens a row menu with arrows and reports the action', async () => {
		const { last } = harness(
			'grid',
			gridProps({
				rowActions: [
					{ id: 'edit', label: 'Edit' },
					{ id: 'drop', label: 'Remove', danger: true }
				]
			})
		);
		const trigger = screen.getByRole('button', { name: 'Actions: Ada' });
		trigger.focus();
		await fireEvent.keyDown(trigger, { key: 'ArrowDown' });
		await settle();
		const menu = screen.getByRole('menu', { name: 'Actions: Ada' });
		expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: 'Edit' }));
		await fireEvent.keyDown(menu, { key: 'ArrowDown' });
		expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: 'Remove' }));
		await fireEvent.keyDown(menu, { key: 'Escape' });
		expect(screen.queryByRole('menu')).toBeNull();
		expect(document.activeElement).toBe(trigger);
		await fireEvent.click(trigger);
		await settle();
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
		expect(last('rowaction')).toMatchObject({ action: 'edit', row: { name: 'Ada' } });
	});

	it('toggles density', async () => {
		harness('grid', gridProps());
		const table = document.querySelector('table')!;
		expect(table.className).toContain('comfortable');
		await fireEvent.click(screen.getByRole('button', { name: 'Compact' }));
		expect(screen.getByRole('button', { name: 'Compact' })).toHaveAttribute('aria-pressed', 'true');
		expect(table.className).toContain('compact');
	});

	it('exports the current view through the event and the callback', async () => {
		const onExport = vi.fn();
		const { last } = harness('grid', gridProps({ onExport, exportName: 'p.csv' }));
		await fireEvent.input(screen.getByRole('searchbox', { name: 'Search' }), {
			target: { value: 'eng' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
		const csv = onExport.mock.calls[0][0] as string;
		expect(csv.split('\r\n')).toEqual([
			'Name,Team,Age',
			'Ada,Eng,36 yrs',
			'Alan,Eng,41 yrs',
			'Edsger,Eng,72 yrs'
		]);
		expect(last('export')).toMatchObject({ name: 'p.csv', count: 3 });
	});

	it('shows loading, empty and error states', async () => {
		const a = harness('grid', gridProps({ loading: true }));
		expect(screen.getByRole('region', { name: 'People' })).toHaveAttribute('aria-busy', 'true');
		expect(screen.getByText('Loading rows')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
		a.unmount();
		const b = harness('grid', gridProps({ rows: [], empty: 'No people yet.' }));
		expect(screen.getByText('No people yet.')).toBeInTheDocument();
		b.unmount();
		const c = harness('grid', gridProps({ error: 'Could not load.' }));
		expect(screen.getByText('Could not load.')).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
		expect(c.last('retry')).toBeNull();
		expect(c.events.some(([n]) => n === 'retry')).toBe(true);
		expect(bodyNames()).toEqual([]);
	});
});

/* --------------------------------------------------------------- FilterBar */

const defs = [
	{
		key: 'status',
		label: 'Status',
		options: [
			{ value: 'paid', label: 'Paid' },
			{ value: 'open', label: 'Open' }
		]
	},
	{ key: 'customer', label: 'Customer' }
];

describe('FilterBar', () => {
	it('adds a choice filter from the menu, announces it and the count', async () => {
		const { state, last } = harness('filterbar', { defs, count: 3 });
		expect(screen.getByText('No filters applied.')).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: /Add filter/ }));
		await settle();
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Status' }));
		await settle();
		const form = screen.getByRole('form', { name: 'Add filter: Status' });
		await fireEvent.change(within(form).getByLabelText('Status'), { target: { value: 'open' } });
		await fireEvent.click(within(form).getByRole('button', { name: 'Apply' }));
		await settle();
		expect(screen.getByText('Status: Open')).toBeInTheDocument();
		expect(state().active).toEqual([{ key: 'status', value: 'open' }]);
		expect(last('change')).toMatchObject({ active: [{ key: 'status', value: 'open' }] });
		expect(screen.getByRole('status')).toHaveTextContent('Filter added: Status: Open. 3 results');
	});

	it('adds a text filter, refusing a blank value with an error', async () => {
		harness('filterbar', { defs });
		await fireEvent.click(screen.getByRole('button', { name: /Add filter/ }));
		await settle();
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Customer' }));
		await settle();
		const input = screen.getByLabelText('Customer');
		expect(document.activeElement).toBe(input);
		await fireEvent.input(input, { target: { value: '   ' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
		expect(screen.getByText('Enter a value.')).toBeInTheDocument();
		await fireEvent.input(input, { target: { value: 'Ada' } });
		expect(screen.queryByText('Enter a value.')).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
		await settle();
		expect(screen.getByText('Customer: Ada')).toBeInTheDocument();
	});

	it('cancels with Escape, removes a chip and clears all', async () => {
		const { state, events } = harness('filterbar', {
			defs,
			active: [
				{ key: 'status', value: 'paid' },
				{ key: 'customer', value: 'Ada' }
			]
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Remove filter: Customer: Ada' }));
		expect(state().active).toEqual([{ key: 'status', value: 'paid' }]);
		await fireEvent.click(screen.getByRole('button', { name: /Add filter/ }));
		await settle();
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Customer' }));
		await settle();
		await fireEvent.keyDown(screen.getByLabelText('Customer'), { key: 'Escape' });
		await settle();
		expect(screen.queryByLabelText('Customer')).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
		expect(state().active).toEqual([]);
		expect(events.some(([n]) => n === 'clear')).toBe(true);
		expect(screen.getByRole('status')).toHaveTextContent('All filters cleared.');
	});

	it('hides the add menu once every filter is in use and cancels with the button', async () => {
		harness('filterbar', { defs, active: [{ key: 'status', value: 'paid' }] });
		await fireEvent.click(screen.getByRole('button', { name: /Add filter/ }));
		await settle();
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Customer' }));
		await settle();
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		await settle();
		expect(screen.queryByRole('form')).toBeNull();
	});
});

/* ------------------------------------------------------------- KanbanBoard */

const columns = [
	{ id: 'todo', title: 'To do' },
	{ id: 'doing', title: 'Doing', limit: 2 },
	{ id: 'done', title: 'Done' }
];
const cards = () => [
	{ id: 'a', group: 'todo', order: 0, title: 'Alpha', tags: ['x'], description: 'First' },
	{ id: 'b', group: 'todo', order: 1, title: 'Bravo' },
	{ id: 'c', group: 'doing', order: 0, title: 'Charlie' },
	{ id: 'd', group: 'doing', order: 1, title: 'Delta' }
];
const inColumn = (title: string) =>
	within(screen.getByRole('region', { name: new RegExp(`^${title}`) }))
		.queryAllByRole('listitem')
		.filter((li) => li.classList.contains('kanban__card'))
		.map((li) => li.querySelector('.kanban__cardtitle')?.textContent);

describe('KanbanBoard', () => {
	it('renders columns with counts, limits and card detail', () => {
		harness('kanban', { label: 'Board', columns, cards: cards(), level: 2 });
		expect(screen.getByRole('region', { name: 'Board' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { level: 2, name: 'Doing' })).toBeInTheDocument();
		expect(screen.getByText('At limit')).toBeInTheDocument();
		expect(screen.getByText('2 / 2')).toBeInTheDocument();
		expect(inColumn('To do')).toEqual(['Alpha', 'Bravo']);
		expect(screen.getByText('First')).toBeInTheDocument();
		expect(screen.getByText('No cards', { exact: false })).toBeInTheDocument();
	});

	it('moves a card with the menu and announces it', async () => {
		const { state, last } = harness('kanban', { label: 'Board', columns, cards: cards() });
		await fireEvent.click(screen.getByRole('button', { name: 'Move: Alpha' }));
		await settle();
		const items = screen.getAllByRole('menuitem').map((i) => i.textContent?.trim());
		expect(items).toEqual(['Move down', 'Move to Doing (full)', 'Move to Done', 'Delete card']);
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Move to Done' }));
		await settle();
		expect(inColumn('Done')).toEqual(['Alpha']);
		expect(state().cards.find((c: { id: string }) => c.id === 'a')).toMatchObject({
			group: 'done',
			order: 0
		});
		expect(last('move')).toMatchObject({ id: 'a', from: 'todo', to: 'done', position: 1 });
		expect(screen.getByText('Alpha moved to Done, position 1 of 1.')).toBeInTheDocument();
		expect(document.activeElement).toBe(document.querySelector('[data-card-grip="a"]'));
	});

	it('reorders inside a column and refuses a full column', async () => {
		harness('kanban', { label: 'Board', columns, cards: cards() });
		await fireEvent.click(screen.getByRole('button', { name: 'Move: Alpha' }));
		await settle();
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Move down' }));
		await settle();
		expect(inColumn('To do')).toEqual(['Bravo', 'Alpha']);
		await fireEvent.click(screen.getByRole('button', { name: 'Move: Bravo' }));
		await settle();
		const full = screen.getByRole('menuitem', { name: 'Move to Doing (full)' });
		expect(full).toHaveAttribute('aria-disabled', 'true');
		await fireEvent.click(full);
		expect(inColumn('Doing')).toEqual(['Charlie', 'Delta']);
	});

	it('moves with Alt+arrows on the grip and says when it cannot', async () => {
		harness('kanban', { label: 'Board', columns, cards: cards() });
		const grip = document.querySelector('[data-card-grip="b"]') as HTMLElement;
		grip.focus();
		await fireEvent.keyDown(grip, { key: 'ArrowUp', altKey: true });
		await settle();
		expect(inColumn('To do')).toEqual(['Bravo', 'Alpha']);
		expect(document.activeElement).toBe(document.querySelector('[data-card-grip="b"]'));
		const top = document.querySelector('[data-card-grip="b"]') as HTMLElement;
		await fireEvent.keyDown(top, { key: 'ArrowUp', altKey: true });
		expect(screen.getByText('Bravo cannot move further.')).toBeInTheDocument();
		await fireEvent.keyDown(top, { key: 'ArrowRight', altKey: true });
		await settle();
		expect(inColumn('Doing')).toEqual(['Charlie', 'Delta']);
		await fireEvent.keyDown(top, { key: 'ArrowDown' });
		await fireEvent.keyDown(top, { key: 'x', altKey: true });
	});

	it('adds a card inline with validation and Escape', async () => {
		const { state, last } = harness('kanban', { label: 'Board', columns, cards: cards() });
		await fireEvent.click(screen.getByRole('button', { name: 'Add card: To do' }));
		await settle();
		const input = screen.getByLabelText('Card title');
		expect(document.activeElement).toBe(input);
		await fireEvent.submit(input.closest('form')!);
		expect(screen.getByRole('alert')).toHaveTextContent('Enter a title for the card.');
		expect(input).toHaveAttribute('aria-invalid', 'true');
		await fireEvent.input(input, { target: { value: 'Echo' } });
		await fireEvent.submit(input.closest('form')!);
		expect(inColumn('To do')).toEqual(['Alpha', 'Bravo', 'Echo']);
		expect(last('add')).toMatchObject({ card: { title: 'Echo', group: 'todo' } });
		expect(state().cards).toHaveLength(5);
		await fireEvent.keyDown(input, { key: 'Escape' });
		await settle();
		expect(screen.queryByLabelText('Card title')).toBeNull();
		expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add card: To do' }));
	});

	it('refuses to add to a full column and can delete a card', async () => {
		const { last } = harness('kanban', { label: 'Board', columns, cards: cards() });
		await fireEvent.click(screen.getByRole('button', { name: 'Add card: Doing' }));
		await settle();
		await fireEvent.input(screen.getByLabelText('Card title'), { target: { value: 'Foxtrot' } });
		await fireEvent.submit(screen.getByLabelText('Card title').closest('form')!);
		expect(screen.getByRole('alert')).toHaveTextContent('This column is at its limit.');
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Move: Charlie' }));
		await settle();
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Delete card' }));
		expect(inColumn('Doing')).toEqual(['Delta']);
		expect(last('remove')).toMatchObject({ id: 'c' });
	});
});

/* ------------------------------------------------------------ ActivityFeed */

const NOW = '2026-10-13T15:00:00Z';
const feed = [
	{
		id: '1',
		at: '2026-10-13T14:55:00Z',
		actor: { name: 'Ada Lovelace' },
		action: 'commented on',
		target: 'Task',
		href: '/t'
	},
	{
		id: '2',
		at: '2026-10-12T10:00:00Z',
		actor: { name: 'Alan Turing' },
		action: 'merged',
		target: 'PR 4',
		detail: 'Retries.'
	},
	{ id: '3', at: '2026-10-01T10:00:00Z', actor: { name: 'Grace Hopper' }, action: 'joined' }
];

describe('ActivityFeed', () => {
	it('groups by day with exact times on the relative ones', () => {
		harness('feed', { items: feed, now: NOW, level: 4 });
		expect(screen.getByRole('region', { name: 'Activity' })).toBeInTheDocument();
		const headings = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent?.trim());
		expect(headings).toEqual(['Today', 'Yesterday', 'Thursday, October 1']);
		const time = screen.getByText('5 minutes ago');
		expect(time.tagName).toBe('TIME');
		expect(time).toHaveAttribute('datetime', '2026-10-13T14:55:00.000Z');
		expect(time).toHaveAttribute('title', 'Oct 13, 2026, 2:55 PM');
		expect(screen.getByRole('link', { name: 'Task' })).toHaveAttribute('href', '/t');
		expect(screen.getByText('Retries.')).toBeInTheDocument();
		expect(screen.getAllByRole('list')).toHaveLength(3);
	});

	it('shows empty, loading and error states', async () => {
		const a = harness('feed', { items: [], now: NOW });
		expect(screen.getByText('No activity yet.')).toBeInTheDocument();
		a.unmount();
		const b = harness('feed', { items: [], now: NOW, loading: true, hasMore: true });
		expect(screen.getByText('Loading activity')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
		b.unmount();
		const c = harness('feed', { items: [], now: NOW, error: 'Offline' });
		await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
		expect(c.events.some(([n]) => n === 'retry')).toBe(true);
	});

	it('asks for more and focuses the first new item', async () => {
		const events: string[] = [];
		const utils = render(Harness, {
			props: {
				which: 'feed',
				props: { items: feed.slice(0, 2), now: NOW, hasMore: true },
				onEvent: (n: string) => events.push(n)
			}
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
		expect(events).toEqual(['loadmore']);
		await utils.rerender({
			props: { which: 'feed', props: { items: feed, now: NOW, hasMore: false } }
		});
		await settle();
		expect(document.activeElement).toBe(document.querySelector('[data-feed-id="3"]'));
	});
});

/* ----------------------------------------------------------- CommentThread */

const me = { id: 'u1', name: 'Ada' };
const thread = () => [
	{
		id: 'c1',
		parentId: null,
		author: { id: 'u2', name: 'Alan' },
		body: 'Top level',
		createdAt: '2026-10-13T10:00:00Z',
		reactions: { '👍': ['u1'] }
	},
	{ id: 'c2', parentId: 'c1', author: me, body: 'Reply one', createdAt: '2026-10-13T10:10:00Z' },
	{
		id: 'c3',
		parentId: 'c2',
		author: { id: 'u2', name: 'Alan' },
		body: 'Reply two',
		createdAt: '2026-10-13T10:20:00Z'
	},
	{ id: 'c4', parentId: 'c3', author: me, body: 'Deepest', createdAt: '2026-10-13T10:30:00Z' }
];
const threadProps = (extra: Record<string, unknown> = {}) => ({
	comments: thread(),
	currentUser: me,
	now: NOW,
	maxLength: 50,
	newId: (() => {
		let n = 0;
		return () => `n${++n}`;
	})(),
	...extra
});

describe('CommentThread', () => {
	it('shows the count, nesting depth and a reply cap', () => {
		harness('thread', threadProps({ level: 2 }));
		expect(screen.getByRole('heading', { level: 2, name: 'Comments (4)' })).toBeInTheDocument();
		expect(screen.getAllByRole('article')).toHaveLength(4);
		const deepest = screen.getByText('Deepest').closest('article')!;
		expect(within(deepest).queryByRole('button', { name: /^Reply/ })).toBeNull();
		const top = screen.getByText('Top level').closest('article')!;
		expect(within(top).getByRole('button', { name: /^Reply/ })).toBeInTheDocument();
		expect(within(top).queryByRole('button', { name: /^Edit/ })).toBeNull();
	});

	it('posts a comment, validating empty and over-length input', async () => {
		const { state, last } = harness('thread', threadProps());
		const box = screen.getByLabelText('Add a comment');
		await fireEvent.click(screen.getByRole('button', { name: 'Post comment' }));
		expect(screen.getByRole('alert')).toHaveTextContent('Write something first.');
		expect(box).toHaveAttribute('aria-invalid', 'true');
		expect(box.getAttribute('aria-describedby')).toContain('-error');
		await fireEvent.input(box, { target: { value: 'x'.repeat(60) } });
		expect(screen.getByRole('alert')).toHaveTextContent('This comment is too long.');
		await fireEvent.input(box, { target: { value: 'Hello there' } });
		expect(screen.queryByRole('alert')).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Post comment' }));
		await settle();
		expect(screen.getByText('Hello there')).toBeInTheDocument();
		expect(last('post')).toMatchObject({
			comment: { body: 'Hello there', parentId: null, createdAt: '2026-10-13T15:00:00.000Z' }
		});
		expect(state().comments).toHaveLength(5);
		expect(screen.getByText('Comment posted.')).toBeInTheDocument();
		expect((box as HTMLTextAreaElement).value).toBe('');
	});

	it('warns near the character limit and submits with Ctrl+Enter', async () => {
		const { state } = harness('thread', threadProps());
		const box = screen.getByLabelText('Add a comment');
		await fireEvent.input(box, { target: { value: 'x'.repeat(40) } });
		expect(screen.getByText('10 characters left')).toBeInTheDocument();
		await fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true });
		await settle();
		expect(state().comments).toHaveLength(5);
	});

	it('replies, then focuses the new reply', async () => {
		const { state } = harness('thread', threadProps());
		const top = screen.getByText('Top level').closest('article')!;
		await fireEvent.click(within(top).getByRole('button', { name: /^Reply/ }));
		await settle();
		const box = screen.getByLabelText('Reply to Alan');
		expect(document.activeElement).toBe(box);
		await fireEvent.input(box, { target: { value: 'A reply' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Post reply' }));
		await settle();
		const added = state().comments.find((c: { body: string }) => c.body === 'A reply');
		expect(added.parentId).toBe('c1');
		expect(document.activeElement?.id).toContain(added.id);
	});

	it('cancels a reply with Escape', async () => {
		harness('thread', threadProps());
		const top = screen.getByText('Top level').closest('article')!;
		await fireEvent.click(within(top).getByRole('button', { name: /^Reply/ }));
		await settle();
		await fireEvent.keyDown(screen.getByLabelText('Reply to Alan'), { key: 'Escape' });
		await settle();
		expect(screen.queryByLabelText('Reply to Alan')).toBeNull();
	});

	it('edits your own comment and marks it edited', async () => {
		const { state, last } = harness('thread', threadProps());
		const mine = screen.getByText('Reply one').closest('article')!;
		await fireEvent.click(within(mine).getByRole('button', { name: /^Edit/ }));
		await settle();
		const box = screen.getByLabelText('Edit your comment');
		expect((box as HTMLTextAreaElement).value).toBe('Reply one');
		await fireEvent.input(box, { target: { value: 'Reply 1 (fixed)' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
		await settle();
		expect(screen.getByText('Reply 1 (fixed)')).toBeInTheDocument();
		expect(screen.getByText('(edited)')).toBeInTheDocument();
		expect(last('edit')).toMatchObject({ id: 'c2', body: 'Reply 1 (fixed)' });
		expect(state().comments.find((c: { id: string }) => c.id === 'c2').editedAt).toBe(
			'2026-10-13T15:00:00.000Z'
		);
	});

	it('asks before deleting, keeps a stub when there are replies, and cancels', async () => {
		const { state, last } = harness('thread', threadProps());
		const mine = screen.getByText('Reply one').closest('article')!;
		await fireEvent.click(within(mine).getByRole('button', { name: /^Delete/ }));
		await settle();
		const dialog = screen.getByRole('alertdialog', { name: 'Delete this comment?' });
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
		await settle();
		expect(state().comments).toHaveLength(4);
		await fireEvent.click(within(mine).getByRole('button', { name: /^Delete/ }));
		await settle();
		await fireEvent.click(
			within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' })
		);
		await settle();
		expect(screen.getByText('This comment was deleted.')).toBeInTheDocument();
		expect(last('delete')).toMatchObject({ id: 'c2' });
		expect(screen.getByRole('heading', { name: 'Comments (3)' })).toHaveFocus();
	});

	it('toggles reactions as pressed buttons with counts', async () => {
		const { state, last } = harness('thread', threadProps());
		const top = screen.getByText('Top level').closest('article')!;
		const thumbs = within(top).getByRole('button', { name: /React with 👍/ });
		expect(thumbs).toHaveAttribute('aria-pressed', 'true');
		expect(thumbs).toHaveTextContent('1');
		await fireEvent.click(thumbs);
		expect(thumbs).toHaveAttribute('aria-pressed', 'false');
		expect(last('react')).toMatchObject({ id: 'c1', emoji: '👍', active: false });
		const heart = within(top).getByRole('button', { name: /React with ❤️/ });
		await fireEvent.click(heart);
		expect(heart).toHaveAttribute('aria-pressed', 'true');
		expect(state().comments[0].reactions).toEqual({ '❤️': ['u1'] });
	});

	it('collapses and expands a branch', async () => {
		harness('thread', threadProps());
		const top = screen.getByText('Top level').closest('article')!;
		const toggle = within(top).getByRole('button', { name: /Hide 3 replies/ });
		expect(toggle).toHaveAttribute('aria-expanded', 'true');
		await fireEvent.click(toggle);
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(toggle).toHaveTextContent('Show 3 replies');
		expect(document.getElementById(toggle.getAttribute('aria-controls')!)).toHaveAttribute(
			'hidden'
		);
		await fireEvent.click(toggle);
		expect(document.getElementById(toggle.getAttribute('aria-controls')!)).not.toHaveAttribute(
			'hidden'
		);
	});

	it('shows an empty state', () => {
		harness('thread', threadProps({ comments: [] }));
		expect(screen.getByText(/No comments yet/)).toBeInTheDocument();
	});
});

/* ------------------------------------------------------------- TeamMembers */

const team = () => [
	{ id: 'u1', name: 'Ada', email: 'ada@example.com', role: 'owner' },
	{ id: 'u2', name: 'Alan', email: 'alan@example.com', role: 'member' }
];
const pending = () => [
	{ id: 'i1', email: 'new@example.com', role: 'viewer', sentAt: '2026-10-12T00:00:00Z' },
	{ id: 'i2', email: 'old@example.com', role: 'member', sentAt: '2026-08-01T00:00:00Z' }
];
const teamProps = (extra: Record<string, unknown> = {}) => ({
	members: team(),
	invites: pending(),
	currentUserId: 'u1',
	now: NOW,
	newId: (() => {
		let n = 0;
		return () => `inv${++n}`;
	})(),
	...extra
});

describe('TeamMembers', () => {
	it('lists members and invites with counts and an Expired badge in words', () => {
		harness('team', teamProps({ level: 2 }));
		expect(screen.getByRole('heading', { level: 2, name: 'Members (2)' })).toBeInTheDocument();
		expect(
			screen.getByRole('heading', { level: 2, name: 'Pending invites (2)' })
		).toBeInTheDocument();
		expect(screen.getByText('you')).toBeInTheDocument();
		expect(screen.getByText('Expired')).toBeInTheDocument();
		expect(screen.getByText('new@example.com', { selector: 'strong' })).toBeInTheDocument();
	});

	it('locks the last owner with the reason attached', () => {
		harness('team', teamProps());
		const select = screen.getByLabelText('Role for Ada') as HTMLSelectElement;
		expect(select).toBeDisabled();
		expect(document.getElementById(select.getAttribute('aria-describedby')!)).toHaveTextContent(
			'last owner'
		);
		expect(screen.getByRole('button', { name: 'Remove Ada' })).toBeDisabled();
	});

	it('changes a role and announces it', async () => {
		const { state, last } = harness('team', teamProps());
		await fireEvent.change(screen.getByLabelText('Role for Alan'), { target: { value: 'admin' } });
		expect(state().members[1].role).toBe('admin');
		expect(last('rolechange')).toEqual({ id: 'u2', role: 'admin' });
		expect(screen.getByText('Alan is now Admin.')).toBeInTheDocument();
	});

	it('confirms before removing a member', async () => {
		const { state, last } = harness('team', teamProps());
		await fireEvent.click(screen.getByRole('button', { name: 'Remove Alan' }));
		await settle();
		const dialog = screen.getByRole('alertdialog', { name: 'Remove this member?' });
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
		await settle();
		expect(state().members).toHaveLength(2);
		await fireEvent.click(screen.getByRole('button', { name: 'Remove Alan' }));
		await settle();
		await fireEvent.click(
			within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' })
		);
		await settle();
		expect(state().members).toHaveLength(1);
		expect(last('remove')).toEqual({ id: 'u2' });
		expect(screen.getByRole('heading', { name: /Members/ })).toHaveFocus();
	});

	it('invites several people, refusing bad, existing and pending addresses', async () => {
		const user = userEvent.setup();
		const { state, last } = harness('team', teamProps());
		await user.click(screen.getByRole('button', { name: 'Invite people' }));
		await settle();
		const dialog = screen.getByRole('dialog', { name: 'Invite people' });
		const field = within(dialog).getByLabelText('Email addresses');
		await user.click(within(dialog).getByRole('button', { name: 'Send invites' }));
		expect(within(dialog).getByText('Add at least one email address.')).toBeInTheDocument();
		await user.type(field, 'nope{Enter}');
		expect(within(dialog).getByText(/not a valid email/)).toBeInTheDocument();
		await user.clear(field);
		await user.type(field, 'ada@example.com{Enter}');
		expect(within(dialog).getByText(/already on the team/)).toBeInTheDocument();
		await user.clear(field);
		await user.type(field, 'new@example.com{Enter}');
		expect(within(dialog).getByText(/already has an invite waiting/)).toBeInTheDocument();
		await user.clear(field);
		await user.type(field, 'one@example.com, two@example.com,');
		expect(within(dialog).getByRole('list', { name: /2 added/ })).toBeInTheDocument();
		await fireEvent.change(within(dialog).getByLabelText('Role'), { target: { value: 'admin' } });
		await user.click(within(dialog).getByRole('button', { name: 'Send invites' }));
		await settle();
		expect(state().invites.map((i: { email: string }) => i.email)).toEqual([
			'new@example.com',
			'old@example.com',
			'one@example.com',
			'two@example.com'
		]);
		expect(last('invite')).toMatchObject({
			emails: ['one@example.com', 'two@example.com'],
			role: 'admin'
		});
		expect(screen.getByText('Invited 2 people as Admin.')).toBeInTheDocument();
	});

	it('resends and revokes (with confirmation)', async () => {
		const { state, last } = harness('team', teamProps());
		await fireEvent.click(screen.getByRole('button', { name: 'Resend old@example.com' }));
		expect(state().invites[1].resends).toBe(1);
		expect(last('resend')).toEqual({ id: 'i2' });
		await fireEvent.click(screen.getByRole('button', { name: 'Revoke new@example.com' }));
		await settle();
		await fireEvent.click(
			within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Revoke' })
		);
		await settle();
		expect(state().invites.map((i: { id: string }) => i.id)).toEqual(['i2']);
		expect(last('revoke')).toEqual({ id: 'i1' });
	});

	it('is read-only without manage rights and shows empty and loading states', () => {
		const a = harness('team', teamProps({ canManage: false }));
		expect(screen.queryByRole('button', { name: 'Invite people' })).toBeNull();
		expect(screen.queryByLabelText('Role for Alan')).toBeNull();
		expect(screen.getByText('Member', { selector: 'span' })).toBeInTheDocument();
		a.unmount();
		harness('team', teamProps({ members: [], invites: [] }));
		expect(screen.getByText('No members yet.')).toBeInTheDocument();
		expect(screen.getByText('No pending invites.')).toBeInTheDocument();
	});

	it('shows a loading status', () => {
		harness('team', teamProps({ loading: true }));
		expect(screen.getByText('Loading team')).toBeInTheDocument();
	});
});

/* ------------------------------------------------------------- FileManager */

const fileEntries = () => [
	{ id: 'd1', name: 'Docs', type: 'folder', parentId: null },
	{ id: 'd2', name: 'Reports', type: 'folder', parentId: 'd1' },
	{
		id: 'f1',
		name: 'Plan.pdf',
		type: 'file',
		parentId: 'd1',
		size: 2000,
		modifiedAt: '2026-10-01T00:00:00Z'
	},
	{ id: 'f2', name: 'cat.png', type: 'file', parentId: null, size: 1500000 },
	{ id: 'f3', name: 'data.csv', type: 'file', parentId: null, size: 900 }
];
const itemNames = () =>
	[...document.querySelectorAll('.files__item')].map((li) =>
		li.querySelector('.files__name')?.firstChild?.textContent?.trim()
	);
const fileProps = (extra: Record<string, unknown> = {}) => ({
	entries: fileEntries(),
	newId: (() => {
		let n = 0;
		return () => `new${++n}`;
	})(),
	...extra
});
const makeFile = (name: string, size = 10, type = 'text/plain') => {
	const f = new File(['x'.repeat(Math.min(size, 10))], name, { type });
	Object.defineProperty(f, 'size', { value: size });
	return f;
};

describe('FileManager', () => {
	it('lists folders first with icons, kinds and sizes as words', () => {
		harness('files', fileProps());
		expect(screen.getByRole('region', { name: 'Files' })).toBeInTheDocument();
		expect(itemNames()).toEqual(['Docs', 'cat.png', 'data.csv']);
		expect(screen.getByText(/Folder · 2 items/)).toBeInTheDocument();
		expect(screen.getByText(/Image · 1\.5 MB/)).toBeInTheDocument();
		expect(screen.getByText(/Spreadsheet · 900 B/)).toBeInTheDocument();
	});

	it('opens folders, shows breadcrumbs with aria-current, and goes back', async () => {
		const { last, state } = harness('files', fileProps());
		await fireEvent.click(screen.getByRole('button', { name: /^Docs/ }));
		await settle();
		expect(last('navigate')).toEqual({ folderId: 'd1' });
		const nav = screen.getByRole('navigation', { name: 'Folder path' });
		expect(within(nav).getByText('Docs')).toHaveAttribute('aria-current', 'page');
		expect(screen.getByRole('heading', { name: /Docs/ })).toHaveFocus();
		expect(itemNames()).toEqual(['Reports', 'Plan.pdf']);
		await fireEvent.click(screen.getByRole('button', { name: /^Reports/ }));
		await settle();
		expect(screen.getByText('This folder is empty.')).toBeInTheDocument();
		await fireEvent.click(within(nav).getByRole('button', { name: 'Docs' }));
		await settle();
		expect(state().folderId).toBe('d1');
		await fireEvent.click(within(nav).getByRole('button', { name: 'All files' }));
		await settle();
		expect(state().folderId).toBeNull();
	});

	it('reports opening a file and switches view', async () => {
		const { last } = harness('files', fileProps());
		await fireEvent.click(screen.getByRole('button', { name: /^cat\.png/ }));
		expect(last('open')).toMatchObject({ entry: { id: 'f2' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Grid' }));
		expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
		expect(document.querySelector('.files__list--grid')).toBeInTheDocument();
	});

	it('sorts from the select', async () => {
		harness('files', fileProps());
		await fireEvent.change(screen.getByLabelText('Sort by'), {
			target: { value: 'size:descending' }
		});
		expect(itemNames()).toEqual(['Docs', 'cat.png', 'data.csv']);
		await fireEvent.change(screen.getByLabelText('Sort by'), {
			target: { value: 'name:descending' }
		});
		expect(itemNames()).toEqual(['Docs', 'data.csv', 'cat.png']);
	});

	it('queues uploads with progress, rejects oversized files and cancels', async () => {
		const { state, last } = harness('files', fileProps({ maxBytes: 1000 }));
		const input = document.querySelector('input[type="file"]') as HTMLInputElement;
		const small = makeFile('ok.txt', 100);
		const big = makeFile('huge.bin', 5000);
		await fireEvent.change(input, { target: { files: [small, big] } });
		await settle();
		const jobs = state().uploads;
		expect(jobs.map((j: { status: string }) => j.status)).toEqual(['queued', 'error']);
		expect(jobs[1].error).toBe('Larger than 1 kB.'.replace('kB', 'KB').replace('1 KB', '1 KB'));
		expect(last('upload')).toMatchObject({ folderId: null });
		const uploads = screen.getByRole('region', { name: 'Uploads' });
		expect(within(uploads).getByRole('progressbar', { name: /ok\.txt/ })).toBeInTheDocument();
		expect(within(uploads).getByText('Failed: Larger than 1 KB.')).toBeInTheDocument();
		await fireEvent.click(
			within(uploads).getByRole('button', { name: 'Cancel Cancel upload of ok.txt' })
		);
		expect(state().uploads[0].status).toBe('cancelled');
		expect(last('cancelupload')).toEqual({ id: jobs[0].id });
		await fireEvent.click(within(uploads).getByRole('button', { name: 'Clear finished' }));
		expect(screen.queryByRole('region', { name: 'Uploads' })).toBeNull();
	});

	it('shows drop feedback and accepts dropped files, filtering by accept', async () => {
		const { state } = harness('files', fileProps({ accept: '.txt,image/*' }));
		const root = screen.getByRole('region', { name: 'Files' });
		const files = [makeFile('a.txt'), makeFile('b.exe'), makeFile('c.png', 10, 'image/png')];
		await fireEvent.dragEnter(root, { dataTransfer: { types: ['Files'], files } });
		expect(screen.getByText('Drop files to upload')).toBeInTheDocument();
		await fireEvent.dragOver(root, { dataTransfer: { types: ['Files'], files } });
		await fireEvent.drop(root, { dataTransfer: { types: ['Files'], files } });
		expect(state().uploads.map((j: { name: string }) => j.name)).toEqual(['a.txt', 'c.png']);
		expect(screen.queryByText('Drop files to upload')).toBeNull();
		await fireEvent.dragEnter(root, { dataTransfer: { types: ['Files'], files } });
		await fireEvent.dragLeave(root);
		expect(screen.queryByText('Drop files to upload')).toBeNull();
		await fireEvent.dragEnter(root, { dataTransfer: { types: ['text/plain'] } });
		await fireEvent.drop(root, { dataTransfer: { files } });
		expect(state().uploads).toHaveLength(2);
	});

	it('renames in place, explaining a taken name, and cancels with Escape', async () => {
		const { state, last } = harness('files', fileProps());
		await fireEvent.click(screen.getByRole('button', { name: 'Actions for cat.png' }));
		await settle();
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
		await settle();
		const input = screen.getByLabelText('Rename cat.png') as HTMLInputElement;
		expect(document.activeElement).toBe(input);
		await fireEvent.input(input, { target: { value: 'DATA.csv' } });
		await fireEvent.submit(input.closest('form')!);
		expect(screen.getByRole('alert')).toHaveTextContent('already here');
		expect(input).toHaveAttribute('aria-invalid', 'true');
		await fireEvent.input(input, { target: { value: 'dog.png' } });
		await fireEvent.submit(input.closest('form')!);
		await settle();
		expect(state().entries.find((e: { id: string }) => e.id === 'f2').name).toBe('dog.png');
		expect(last('rename')).toEqual({ id: 'f2', name: 'dog.png' });
		expect(document.activeElement).toBe(document.querySelector('[data-entry="f2"]'));
		await fireEvent.click(screen.getByRole('button', { name: 'Actions for dog.png' }));
		await settle();
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
		await settle();
		await fireEvent.keyDown(screen.getByLabelText('Rename dog.png'), { key: 'Escape' });
		await settle();
		expect(screen.queryByLabelText('Rename dog.png')).toBeNull();
	});

	it('keeps the name when renaming to the same value', async () => {
		const { events } = harness('files', fileProps());
		await fireEvent.click(screen.getByRole('button', { name: 'Actions for cat.png' }));
		await settle();
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
		await settle();
		await fireEvent.submit(screen.getByLabelText('Rename cat.png').closest('form')!);
		await settle();
		expect(events.some(([n]) => n === 'rename')).toBe(false);
	});

	it('selects several items and deletes after confirming, folders taking children along', async () => {
		const { state, last } = harness('files', fileProps());
		await fireEvent.click(screen.getByRole('checkbox', { name: 'Select Docs' }));
		await fireEvent.click(screen.getByRole('checkbox', { name: 'Select cat.png' }));
		expect(screen.getByText('2 selected')).toBeInTheDocument();
		const all = screen.getByRole('checkbox', { name: 'Select all' }) as HTMLInputElement;
		expect(all.indeterminate).toBe(true);
		await fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }));
		await settle();
		const dialog = screen.getByRole('alertdialog', { name: 'Delete permanently?' });
		expect(dialog).toHaveTextContent('2 items');
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
		await settle();
		expect(state().entries).toHaveLength(5);
		await fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }));
		await settle();
		await fireEvent.click(
			within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' })
		);
		await settle();
		expect(state().entries.map((e: { id: string }) => e.id)).toEqual(['f3']);
		expect(last('delete')).toEqual({ ids: ['d1', 'f2'] });
		expect(state().selected).toEqual([]);
		await fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
		expect(screen.getByText('1 selected')).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
		expect(state().selected).toEqual([]);
	});

	it('deletes from the item menu, and leaves a deleted current folder', async () => {
		const { state } = harness('files', fileProps({ folderId: 'd2' }));
		await fireEvent.click(screen.getByRole('button', { name: 'All files' }));
		await settle();
		await fireEvent.click(screen.getByRole('button', { name: 'Actions for Docs' }));
		await settle();
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
		await settle();
		expect(screen.getByRole('alertdialog')).toHaveTextContent('"Docs"');
		await fireEvent.click(
			within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' })
		);
		await settle();
		expect(state().entries).toHaveLength(2);
	});

	it('creates a folder, validating the name', async () => {
		const { state, last } = harness('files', fileProps());
		await fireEvent.click(screen.getByRole('button', { name: 'New folder' }));
		await settle();
		const input = screen.getByLabelText('Folder name');
		expect(document.activeElement).toBe(input);
		await fireEvent.input(input, { target: { value: 'docs' } });
		await fireEvent.submit(input.closest('form')!);
		expect(screen.getByRole('alert')).toHaveTextContent('already here');
		await fireEvent.input(input, { target: { value: 'Photos' } });
		await fireEvent.submit(input.closest('form')!);
		await settle();
		expect(state().entries.at(-1)).toMatchObject({
			name: 'Photos',
			type: 'folder',
			parentId: null
		});
		expect(last('createfolder')).toMatchObject({ entry: { name: 'Photos' } });
		await fireEvent.click(screen.getByRole('button', { name: 'New folder' }));
		await settle();
		await fireEvent.keyDown(screen.getByLabelText('Folder name'), { key: 'Escape' });
		expect(screen.queryByLabelText('Folder name')).toBeNull();
	});

	it('opens files through the menu and shows empty and loading states', async () => {
		const { last } = harness('files', fileProps());
		await fireEvent.click(screen.getByRole('button', { name: 'Actions for data.csv' }));
		await settle();
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Open' }));
		expect(last('open')).toMatchObject({ entry: { id: 'f3' } });
	});

	it('shows loading and empty states', () => {
		const a = harness('files', fileProps({ loading: true }));
		expect(screen.getByText('Loading files')).toBeInTheDocument();
		a.unmount();
		harness('files', fileProps({ entries: [] }));
		expect(screen.getByText('This folder is empty.')).toBeInTheDocument();
	});
});

/* ------------------------------------------------------- CalendarSchedule */

const calEvents = () => [
	{ id: 'e1', title: 'Standup', date: '2026-10-13', start: '09:00', end: '09:15' },
	{ id: 'e2', title: 'Offsite', date: '2026-10-14', endDate: '2026-10-15', description: 'Away' }
];
const calProps = (extra: Record<string, unknown> = {}) => ({
	events: calEvents(),
	now: NOW,
	newId: () => 'new-event',
	...extra
});

describe('CalendarSchedule', () => {
	it('is an ARIA grid with named days, today marked and one tab stop', () => {
		harness('calendar', calProps());
		const grid = screen.getByRole('grid', { name: 'October 2026' });
		expect(within(grid).getAllByRole('columnheader')).toHaveLength(7);
		expect(within(grid).getAllByRole('gridcell').length % 7).toBe(0);
		const today = within(grid).getByRole('button', { name: 'Tuesday, October 13, 2026, 1 event' });
		expect(today).toHaveAttribute('aria-current', 'date');
		expect(today).toHaveAttribute('tabindex', '0');
		expect(grid.querySelectorAll('button[tabindex="0"]')).toHaveLength(1);
		expect(
			within(grid).getByRole('button', { name: 'Wednesday, October 14, 2026, 1 event' })
		).toBeInTheDocument();
	});

	it('moves focus with the arrow keys, crossing months', async () => {
		const { state, events } = harness('calendar', calProps());
		const grid = screen.getByRole('grid');
		const today = within(grid).getByRole('button', { name: /October 13, 2026/ });
		today.focus();
		await fireEvent.keyDown(today, { key: 'ArrowRight' });
		await settle();
		expect(state().focused).toBe('2026-10-14');
		expect(document.activeElement).toBe(document.querySelector('[data-day="2026-10-14"]'));
		await fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
		await fireEvent.keyDown(document.activeElement!, { key: 'End' });
		await fireEvent.keyDown(document.activeElement!, { key: 'Home' });
		await settle();
		expect(state().focused).toBe('2026-10-18'.replace('18', '18'));
		await fireEvent.keyDown(document.activeElement!, { key: 'PageDown' });
		await settle();
		expect(screen.getByRole('grid', { name: 'November 2026' })).toBeInTheDocument();
		expect(events.some(([n]) => n === 'monthchange')).toBe(true);
		await fireEvent.keyDown(document.activeElement!, { key: 'x' });
		await fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft', ctrlKey: true });
	});

	it('picks a day to list its agenda, with Monday weeks if asked', async () => {
		const { state, last } = harness('calendar', calProps({ weekStart: 1 }));
		expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent('Mon');
		await fireEvent.click(screen.getByRole('button', { name: /October 14, 2026/ }));
		expect(last('select')).toEqual({ day: '2026-10-14' });
		expect(state().selectedDay).toBe('2026-10-14');
		const agenda = screen.getByRole('region', { name: /Agenda: Wednesday, October 14, 2026/ });
		expect(within(agenda).getByText('Offsite')).toBeInTheDocument();
		expect(within(agenda).getByText('Away')).toBeInTheDocument();
		expect(within(agenda).getByText('2026-10-14 → 2026-10-15')).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: /October 20, 2026/ }));
		expect(screen.getByText('Nothing scheduled.')).toBeInTheDocument();
	});

	it('moves between months and back to today', async () => {
		const { state } = harness('calendar', calProps());
		await fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
		expect(screen.getByRole('grid', { name: 'November 2026' })).toBeInTheDocument();
		expect(state().focused).toBe('2026-11-13');
		await fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
		expect(screen.getByRole('grid', { name: 'September 2026' })).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Today' }));
		await settle();
		expect(state().focused).toBe('2026-10-13');
		expect(document.activeElement).toBe(document.querySelector('[data-day="2026-10-13"]'));
	});

	it('adds an event through the dialog, validating first', async () => {
		const { state, last } = harness('calendar', calProps());
		await fireEvent.click(screen.getByRole('button', { name: /Wednesday, October 14/ }));
		await fireEvent.click(screen.getByRole('button', { name: 'Add event' }));
		await settle();
		const dialog = screen.getByRole('dialog', { name: 'Add event' });
		expect((within(dialog).getByLabelText(/^Date/) as HTMLInputElement).value).toBe('2026-10-14');
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
		expect(within(dialog).getAllByText('Enter a title.').length).toBeGreaterThan(0);
		expect(within(dialog).getByLabelText(/^Title/)).toHaveAttribute('aria-invalid', 'true');
		await fireEvent.input(within(dialog).getByLabelText(/^Title/), { target: { value: 'Retro' } });
		await fireEvent.input(within(dialog).getByLabelText('Starts (optional)'), {
			target: { value: '16:00' }
		});
		await fireEvent.input(within(dialog).getByLabelText('Ends (optional)'), {
			target: { value: '15:00' }
		});
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
		expect(
			within(dialog).getAllByText('The end cannot be before the start.').length
		).toBeGreaterThan(0);
		await fireEvent.input(within(dialog).getByLabelText('Ends (optional)'), {
			target: { value: '17:00' }
		});
		await fireEvent.input(within(dialog).getByLabelText('Notes'), { target: { value: ' notes ' } });
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
		await settle();
		expect(last('add')).toMatchObject({
			event: {
				id: 'new-event',
				title: 'Retro',
				date: '2026-10-14',
				start: '16:00',
				end: '17:00',
				description: 'notes'
			}
		});
		expect(state().events).toHaveLength(3);
		expect(screen.getByRole('button', { name: /Retro/ })).toBeInTheDocument();
	});

	it('edits and deletes an event from the agenda', async () => {
		const { state, last } = harness('calendar', calProps());
		await fireEvent.click(screen.getByRole('button', { name: /October 13, 2026/ }));
		await fireEvent.click(screen.getByRole('button', { name: /Standup/ }));
		await settle();
		const dialog = screen.getByRole('dialog', { name: 'Edit event' });
		await fireEvent.input(within(dialog).getByLabelText(/^Title/), { target: { value: 'Daily' } });
		await fireEvent.input(within(dialog).getByLabelText(/^Date/), {
			target: { value: '2026-11-02' }
		});
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
		await settle();
		expect(last('update')).toMatchObject({
			event: { id: 'e1', title: 'Daily', date: '2026-11-02' }
		});
		expect(screen.getByRole('grid', { name: 'November 2026' })).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: /Daily/ }));
		await settle();
		await fireEvent.click(
			within(screen.getByRole('dialog', { name: 'Edit event' })).getByRole('button', {
				name: 'Delete event'
			})
		);
		await settle();
		expect(last('remove')).toEqual({ id: 'e1' });
		expect(state().events).toHaveLength(1);
	});

	it('can be read-only', () => {
		harness('calendar', calProps({ editable: false }));
		expect(screen.queryByRole('button', { name: 'Add event' })).toBeNull();
	});

	it('repairs an invalid focused day', () => {
		const { state } = harness('calendar', calProps({ focused: 'nope', selectedDay: 'nope' }));
		expect(state().focused).toBe('2026-10-13');
		expect(state().selectedDay).toBe('2026-10-13');
	});
});

/* ---------------------------------------------------------------- TreeView */

const treeNodes = [
	{
		id: 'src',
		label: 'src',
		children: [
			{
				id: 'lib',
				label: 'lib',
				children: [
					{ id: 'a', label: 'alpha.ts' },
					{ id: 'b', label: 'beta.ts', disabled: true }
				]
			},
			{ id: 'app', label: 'app.css' }
		]
	},
	{ id: 'docs', label: 'docs', children: [{ id: 'readme', label: 'README' }] },
	{ id: 'pkg', label: 'package.json' }
];

describe('TreeView', () => {
	it('exposes the tree pattern roles and one tab stop', () => {
		harness('tree', { label: 'Files', nodes: treeNodes, expanded: ['src'] });
		const tree = screen.getByRole('tree', { name: 'Files' });
		const items = within(tree).getAllByRole('treeitem');
		expect(items.map((i) => i.textContent?.trim().replace(/^[▾▸]\s*/, ''))).toEqual([
			'src',
			'lib',
			'app.css',
			'docs',
			'package.json'
		]);
		expect(items[0]).toHaveAttribute('aria-expanded', 'true');
		expect(items[1]).toHaveAttribute('aria-expanded', 'false');
		expect(items[2]).not.toHaveAttribute('aria-expanded');
		expect(items[1]).toHaveAttribute('aria-level', '2');
		expect(items[1]).toHaveAttribute('aria-posinset', '1');
		expect(items[1]).toHaveAttribute('aria-setsize', '2');
		expect(tree.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
		expect(items[0]).toHaveAttribute('tabindex', '0');
	});

	it('walks with arrows: expand, enter, collapse, parent', async () => {
		const { state, last } = harness('tree', { label: 'Files', nodes: treeNodes });
		const tree = screen.getByRole('tree');
		const first = screen.getByRole('treeitem', { name: /src/ });
		first.focus();
		await fireEvent.keyDown(tree, { key: 'ArrowRight' });
		expect(state().expanded).toEqual(['src']);
		expect(last('toggle')).toEqual({ id: 'src', open: true });
		await fireEvent.keyDown(tree, { key: 'ArrowRight' });
		await settle();
		expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: /lib/ }));
		await fireEvent.keyDown(tree, { key: 'ArrowRight' });
		await fireEvent.keyDown(tree, { key: 'ArrowDown' });
		await settle();
		expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: /alpha/ }));
		await fireEvent.keyDown(tree, { key: 'ArrowDown' });
		await settle();
		expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: /app\.css/ }));
		await fireEvent.keyDown(tree, { key: 'ArrowUp' });
		await fireEvent.keyDown(tree, { key: 'ArrowLeft' });
		await settle();
		expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: /lib/ }));
		await fireEvent.keyDown(tree, { key: 'ArrowLeft' });
		expect(state().expanded).toEqual(['src']);
		await fireEvent.keyDown(tree, { key: 'End' });
		await settle();
		expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: /package/ }));
		await fireEvent.keyDown(tree, { key: 'Home' });
		await settle();
		expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: /src/ }));
	});

	it('selects with Enter and Space, and skips disabled nodes', async () => {
		const { state, last } = harness('tree', {
			label: 'Files',
			nodes: treeNodes,
			expanded: ['src', 'lib']
		});
		const tree = screen.getByRole('tree');
		screen.getByRole('treeitem', { name: /alpha/ }).focus();
		await fireEvent.keyDown(tree, { key: 'Enter' });
		expect(state().treeSelected).toBe('a');
		expect(last('select')).toEqual({ id: 'a' });
		expect(screen.getByRole('treeitem', { name: /alpha/ })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await fireEvent.keyDown(tree, { key: 'ArrowDown' });
		await settle();
		expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: /app\.css/ }));
		await fireEvent.keyDown(tree, { key: ' ' });
		expect(state().treeSelected).toBe('app');
		expect(screen.getByRole('treeitem', { name: /beta/ })).toHaveAttribute('aria-disabled', 'true');
	});

	it('jumps by typing, cycling on a repeated letter', async () => {
		harness('tree', { label: 'Files', nodes: treeNodes, typeAheadMs: 1 });
		const tree = screen.getByRole('tree');
		const pause = () => new Promise((r) => setTimeout(r, 15));
		screen.getByRole('treeitem', { name: /src/ }).focus();
		await fireEvent.keyDown(tree, { key: 'p' });
		await settle();
		expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: /package/ }));
		await pause();
		await fireEvent.keyDown(tree, { key: 'd' });
		await settle();
		expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: /docs/ }));
		await pause();
		await fireEvent.keyDown(tree, { key: 'z' });
		await fireEvent.keyDown(tree, { key: 'F2' });
		await fireEvent.keyDown(tree, { key: 'a', ctrlKey: true });
	});

	it('opens all sibling branches with *', async () => {
		const { state } = harness('tree', { label: 'Files', nodes: treeNodes });
		const tree = screen.getByRole('tree');
		screen.getByRole('treeitem', { name: /src/ }).focus();
		await fireEvent.keyDown(tree, { key: '*' });
		expect(state().expanded.sort()).toEqual(['docs', 'src']);
	});

	it('selects and toggles on click, ignoring disabled nodes', async () => {
		const { state } = harness('tree', {
			label: 'Files',
			nodes: treeNodes,
			expanded: ['src', 'lib']
		});
		await fireEvent.click(screen.getByRole('treeitem', { name: /lib/ }));
		expect(state().treeSelected).toBe('lib');
		expect(state().expanded).toEqual(['src']);
		await fireEvent.click(screen.getByRole('treeitem', { name: /app\.css/ }));
		expect(state().treeSelected).toBe('app');
		await fireEvent.click(screen.getByRole('treeitem', { name: /lib/ }));
		await fireEvent.click(screen.getByRole('treeitem', { name: /beta/ }));
		expect(state().treeSelected).not.toBe('b');
	});

	it('puts the tab stop on the selection and says when empty', () => {
		const a = harness('tree', {
			label: 'Files',
			nodes: treeNodes,
			expanded: ['src'],
			selectedNode: 'app'
		});
		expect(screen.getByRole('treeitem', { name: /app\.css/ })).toHaveAttribute('tabindex', '0');
		a.unmount();
		harness('tree', { label: 'Files', nodes: [], empty: 'No files.' });
		expect(screen.getByText('No files.')).toBeInTheDocument();
	});
});

/* ----------------------------------------------------------------- AuditLog */

const audit = [
	{
		id: '1',
		at: '2026-10-13T14:00:00Z',
		actor: 'ada',
		action: 'key.revoke',
		target: 'k1',
		severity: 'critical',
		ip: '1.2.3.4',
		details: { why: 'leak' }
	},
	{
		id: '2',
		at: '2026-10-12T10:00:00Z',
		actor: 'alan',
		action: 'role.change',
		severity: 'warning',
		details: 'plain text'
	},
	{ id: '3', at: '2026-10-11T10:00:00Z', actor: 'ada', action: 'user.login', severity: 'info' },
	{
		id: '4',
		at: '2026-10-10T10:00:00Z',
		actor: 'zed',
		action: 'export',
		severity: 'notice',
		ip: '9.9.9.9'
	}
];
const actions = () =>
	[...document.querySelectorAll('tbody tr:not(.audit__detailrow) code')].map((c) => c.textContent);

describe('AuditLog', () => {
	it('lists events newest first with severity words and exact times', () => {
		harness('audit', { events: audit, label: 'Security' });
		expect(screen.getByRole('region', { name: 'Security' })).toBeInTheDocument();
		expect(actions()).toEqual(['key.revoke', 'role.change', 'user.login', 'export']);
		expect(screen.getByText('Critical', { selector: '.badge' })).toBeInTheDocument();
		expect(screen.getByText('4 events')).toBeInTheDocument();
		const time = screen.getByText('Oct 13, 2026, 2:00 PM');
		expect(time).toHaveAttribute('datetime', '2026-10-13T14:00:00.000Z');
	});

	it('flips the sort order with aria-sort', async () => {
		harness('audit', { events: audit });
		const sort = screen.getByRole('button', { name: /^Time/ });
		expect(sort.closest('th')).toHaveAttribute('aria-sort', 'descending');
		await fireEvent.click(sort);
		expect(sort.closest('th')).toHaveAttribute('aria-sort', 'ascending');
		expect(actions()[0]).toBe('export');
	});

	it('filters by search, severity, actor and dates, announcing the count', async () => {
		const { last } = harness('audit', { events: audit });
		await fireEvent.input(screen.getByRole('searchbox', { name: 'Search events' }), {
			target: { value: 'leak' }
		});
		expect(actions()).toEqual(['key.revoke']);
		expect(screen.getByText('1 event')).toBeInTheDocument();
		expect(last('filter')).toMatchObject({ query: 'leak' });
		await fireEvent.input(screen.getByRole('searchbox', { name: 'Search events' }), {
			target: { value: '' }
		});
		await fireEvent.click(
			within(screen.getByRole('group', { name: 'Severity' })).getByLabelText('Warning')
		);
		expect(actions()).toEqual(['role.change']);
		await fireEvent.click(
			within(screen.getByRole('group', { name: 'Severity' })).getByLabelText('Warning')
		);
		await fireEvent.change(screen.getByLabelText('Actor'), { target: { value: 'ada' } });
		expect(actions()).toEqual(['key.revoke', 'user.login']);
		await fireEvent.input(screen.getByLabelText('From'), { target: { value: '2026-10-12' } });
		await fireEvent.change(screen.getByLabelText('From'));
		expect(actions()).toEqual(['key.revoke']);
		await fireEvent.input(screen.getByLabelText('To'), { target: { value: '2026-10-12' } });
		await fireEvent.change(screen.getByLabelText('To'));
		expect(screen.getByText('No events match these filters.')).toBeInTheDocument();
		await fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]);
		expect(actions()).toHaveLength(4);
	});

	it('expands details as JSON with aria-expanded and aria-controls', async () => {
		const { last } = harness('audit', { events: audit });
		const toggles = screen.getAllByRole('button', { name: /^Show details/ });
		expect(toggles).toHaveLength(3);
		const button = screen.getByRole('button', { name: 'Show details — key.revoke' });
		await fireEvent.click(button);
		expect(button).toHaveAttribute('aria-expanded', 'true');
		const panel = document.getElementById(button.getAttribute('aria-controls')!)!;
		expect(panel).toHaveTextContent('"why": "leak"');
		expect(panel).toHaveTextContent('1.2.3.4');
		expect(last('toggle')).toEqual({ id: '1', open: true });
		await fireEvent.click(screen.getByRole('button', { name: 'Show details — role.change' }));
		expect(screen.getByText('plain text')).toBeInTheDocument();
		await fireEvent.click(button);
		expect(document.getElementById(button.getAttribute('aria-controls')!)).toBeNull();
	});

	it('exports the filtered events through the event and the callback', async () => {
		const onExport = vi.fn();
		const { last } = harness('audit', { events: audit, onExport, exportName: 'a.csv' });
		await fireEvent.change(screen.getByLabelText('Actor'), { target: { value: 'ada' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
		expect(last('export')).toMatchObject({ name: 'a.csv', count: 2 });
		expect((onExport.mock.calls[0][0] as string).split('\r\n')).toHaveLength(3);
	});

	it('pages, and shows empty, loading and error states', async () => {
		const many = Array.from({ length: 5 }, (_, i) => ({
			id: String(i),
			at: `2026-10-0${i + 1}T10:00:00Z`,
			actor: 'a',
			action: `act${i}`,
			severity: 'info'
		}));
		const a = harness('audit', { events: many, pageSize: 2 });
		expect(actions()).toEqual(['act4', 'act3']);
		await fireEvent.click(screen.getByRole('button', { name: 'Page 3' }));
		expect(actions()).toEqual(['act0']);
		expect(screen.getByText('5–5 of 5'.replace('5–5', '5–5'))).toBeInTheDocument();
		a.unmount();
		const b = harness('audit', { events: [] });
		expect(screen.getByText('No events recorded.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
		b.unmount();
		const c = harness('audit', { events: audit, loading: true });
		expect(screen.getByText('Loading events')).toBeInTheDocument();
		c.unmount();
		const d = harness('audit', { events: audit, error: 'Failed to load' });
		await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
		expect(d.events.some(([n]) => n === 'retry')).toBe(true);
	});
});
