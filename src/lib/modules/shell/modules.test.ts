import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import type { ShellWhich } from '../../../../tests/fixtures/modules-which';
import Harness from '../../../../tests/fixtures/ModulesShellHarness.svelte';

type Which = ShellWhich;
type Spy = ReturnType<typeof vi.fn>;

function mount(which: Which, props: Record<string, unknown> = {}) {
	const onEvent = vi.fn();
	const view = render(Harness, { props: { which, props, onEvent } });
	const state = () => JSON.parse(screen.getByTestId('state').textContent || '{}');
	return { ...view, onEvent, state };
}

/** The last detail reported for an event name. */
function last(spy: Spy, name: string) {
	const calls = spy.mock.calls.filter(([n]) => n === name);
	return calls.length ? calls[calls.length - 1][1] : undefined;
}

function key(el: Element, k: string, init: KeyboardEventInit = {}) {
	return fireEvent.keyDown(el, { key: k, ...init });
}

/** Pretend every element measures as given (for responsive modules); returns the undo. */
function pretendWidth(values: Partial<Record<'clientWidth' | 'offsetWidth', number>>) {
	const saved = Object.keys(values).map(
		(k) => [k, Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)] as const
	);
	for (const [k, v] of Object.entries(values)) {
		// The setter matters: happy-dom 12 assigns these fields in each element's constructor, and
		// assigning to a getter-only accessor throws.
		Object.defineProperty(HTMLElement.prototype, k, {
			configurable: true,
			get: () => v,
			set: () => {}
		});
	}
	return () => {
		for (const [k, d] of saved) {
			// happy-dom 12 has no prototype accessor to put back: drop ours, or it outlives the test.
			if (d) Object.defineProperty(HTMLElement.prototype, k, d);
			else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
		}
	};
}

const NOW = Date.UTC(2026, 9, 13, 15, 0, 0);

describe('AppShell', () => {
	it('lays out the landmarks, with a skip link that moves focus to main', async () => {
		mount('shell');
		const skip = screen.getByRole('link', { name: 'Skip to main content' });
		expect(document.querySelector('a')).toBe(skip);
		expect(screen.getByRole('banner')).toBeTruthy();
		expect(screen.getByRole('main')).toBeTruthy();
		expect(screen.getByRole('contentinfo').textContent).toContain('Foot');
		expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeTruthy();
		await fireEvent.click(skip);
		expect(document.activeElement).toBe(screen.getByRole('main'));
	});

	it('collapses and expands a wide sidebar', async () => {
		const { onEvent, state } = mount('shell');
		const button = screen.getByRole('button', { name: 'Collapse sidebar' });
		expect(button.getAttribute('aria-expanded')).toBe('true');
		await fireEvent.click(button);
		expect(button.getAttribute('aria-label')).toBe('Expand sidebar');
		expect(button.getAttribute('aria-expanded')).toBe('false');
		expect(state().collapsed).toBe(true);
		expect(last(onEvent, 'toggle')).toEqual({ collapsed: true });
		expect(document.querySelector('aside')?.hasAttribute('hidden')).toBe(true);
		await fireEvent.click(button);
		expect(state().collapsed).toBe(false);
	});

	it('goes off-canvas when narrow, as a modal that returns focus', async () => {
		const restore = pretendWidth({ clientWidth: 300 });
		onTestFinished(restore);
		const { state, onEvent } = mount('shell');
		await tick();
		const button = screen.getByRole('button', { name: 'Menu' });
		expect(button.getAttribute('aria-haspopup')).toBe('dialog');
		expect(document.querySelector('dialog')).toBeTruthy();
		button.focus();
		await fireEvent.click(button);
		expect(state().shellOpen).toBe(true);
		expect(document.querySelector('dialog')?.hasAttribute('open')).toBe(true);
		// following a link closes the panel and reports it
		await fireEvent.click(screen.getByRole('link', { name: 'One', hidden: true }));
		expect(last(onEvent, 'navigate')).toBeNull();
		await waitFor(() => expect(state().shellOpen).toBe(false));
		expect(document.activeElement).toBe(button);
		// the close button and the backdrop do the same
		await fireEvent.click(button);
		await fireEvent.click(screen.getByRole('button', { name: 'Close menu', hidden: true }));
		await waitFor(() => expect(state().shellOpen).toBe(false));
		await fireEvent.click(button);
		await fireEvent.click(document.querySelector('dialog') as Element);
		await waitFor(() => expect(state().shellOpen).toBe(false));
		// native close (Escape) mirrors into state
		await fireEvent.click(button);
		document.querySelector('dialog')?.dispatchEvent(new Event('close'));
		await waitFor(() => expect(state().shellOpen).toBe(false));
	});
});

describe('PageHeader', () => {
	const actions = [
		{ id: 'a', label: 'Export' },
		{ id: 'b', label: 'New', variant: 'primary' },
		{ id: 'c', label: 'Remove', variant: 'danger' }
	];

	it('renders the title at the chosen level, breadcrumbs and description', () => {
		mount('header', {
			title: 'Projects',
			level: 2,
			description: 'All of them.',
			breadcrumbs: [{ label: 'Home', href: '/' }, { label: 'Projects' }]
		});
		expect(screen.getByRole('heading', { level: 2, name: 'Projects' })).toBeTruthy();
		expect(screen.getByText('All of them.')).toBeTruthy();
		const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
		expect(within(nav).getByText('Projects').getAttribute('aria-current')).toBe('page');
	});

	it('shows actions as buttons and reports them', async () => {
		const { onEvent } = mount('header', { title: 'T', actions });
		await fireEvent.click(screen.getByRole('button', { name: 'New' }));
		expect(last(onEvent, 'action')).toEqual({ id: 'b' });
		expect(screen.queryByRole('button', { name: 'Actions' })).toBeNull();
	});

	it('folds actions into a menu when narrow', async () => {
		onTestFinished(pretendWidth({ clientWidth: 300 }));
		const { onEvent } = mount('header', { title: 'T', actions });
		await tick();
		expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: /Actions/ }));
		await fireEvent.click(await screen.findByRole('menuitem', { name: 'Remove' }));
		expect(last(onEvent, 'action')).toEqual({ id: 'c' });
	});

	it('renders no actions group without actions', () => {
		mount('header', { title: 'T' });
		expect(screen.queryByRole('group')).toBeNull();
	});
});

describe('NotificationCenter', () => {
	const items = [
		{
			id: 'a',
			title: 'Deploy done',
			body: 'It is live',
			at: Date.UTC(2026, 9, 13, 14, 0),
			read: false
		},
		{ id: 'b', title: 'Old news', at: Date.UTC(2026, 9, 12, 14, 0), read: true, href: '/news' }
	];

	it('names the bell with the unread count and shows a badge', () => {
		mount('notifications', { items, now: NOW });
		const bell = screen.getByRole('button', { name: 'Notifications, 1 unread' });
		expect(bell.textContent).toContain('1');
		expect(bell.getAttribute('aria-expanded')).toBe('false');
	});

	it('has no count in the name when everything is read', () => {
		mount('notifications', { items: [{ ...items[1] }], now: NOW });
		expect(screen.getByRole('button', { name: 'Notifications' })).toBeTruthy();
	});

	it('lists notifications grouped by day, marks one read, then all', async () => {
		const many = [
			...items,
			{ id: 'c', title: 'Another', at: Date.UTC(2026, 9, 13, 10), read: false }
		];
		const { onEvent, state } = mount('notifications', { items: many, now: NOW });
		await fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
		const dialog = await screen.findByRole('dialog', { name: 'Notifications' });
		expect(within(dialog).getByRole('heading', { name: 'Today' })).toBeTruthy();
		expect(within(dialog).getByRole('heading', { name: 'Yesterday' })).toBeTruthy();
		expect(within(dialog).getAllByText(/unread/).length).toBeGreaterThan(0);

		await fireEvent.click(within(dialog).getByRole('button', { name: /Mark as read\s*: Another/ }));
		expect(last(onEvent, 'read')).toEqual({ id: 'c' });
		expect(state().items.find((i: { id: string }) => i.id === 'c').read).toBe(true);
		expect(screen.getByRole('button', { name: 'Notifications, 1 unread' })).toBeTruthy();

		await fireEvent.click(within(dialog).getByRole('button', { name: 'Mark all as read' }));
		expect(onEvent).toHaveBeenCalledWith('readall', null);
		expect(state().items.every((i: { read: boolean }) => i.read)).toBe(true);
		expect(
			within(dialog).getByRole('button', { name: 'Mark all as read' }).hasAttribute('disabled')
		).toBe(true);
	});

	it('opens a notification: marks it read and reports it with its link', async () => {
		const { onEvent } = mount('notifications', { items, now: NOW });
		await fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
		const dialog = await screen.findByRole('dialog');
		await fireEvent.click(within(dialog).getByRole('link', { name: /Old news/ }));
		expect(last(onEvent, 'select')).toEqual({ id: 'b', href: '/news' });
		expect(last(onEvent, 'read')).toBeUndefined();
		await fireEvent.click(dialog.querySelector('button[data-nav]') as Element);
		expect(last(onEvent, 'read')).toEqual({ id: 'a' });
		expect(last(onEvent, 'select')).toEqual({ id: 'a', href: undefined });
	});

	it('moves between rows with the arrow keys', async () => {
		mount('notifications', { items, now: NOW });
		await fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
		const dialog = await screen.findByRole('dialog');
		const rows = [...dialog.querySelectorAll<HTMLElement>('[data-nav]')];
		expect(rows.length).toBe(2);
		const list = rows[0].closest('.center__list') as HTMLElement;
		rows[0].focus();
		await key(rows[0], 'ArrowDown');
		expect(document.activeElement).toBe(rows[1]);
		await key(rows[1], 'ArrowDown');
		expect(document.activeElement).toBe(rows[1]);
		await key(rows[1], 'ArrowUp');
		expect(document.activeElement).toBe(rows[0]);
		await key(rows[0], 'End');
		expect(document.activeElement).toBe(rows[1]);
		await key(rows[1], 'Home');
		expect(document.activeElement).toBe(rows[0]);
		// from outside the rows, Down starts at the first and Up at the last
		(document.activeElement as HTMLElement).blur();
		await key(list, 'ArrowDown');
		expect(document.activeElement).toBe(rows[0]);
		(document.activeElement as HTMLElement).blur();
		await key(list, 'ArrowUp');
		expect(document.activeElement).toBe(rows[1]);
		await key(list, 'x');
	});

	it('shows an empty state', async () => {
		mount('notifications', { items: [], now: NOW });
		await fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
		expect(await screen.findByText('You’re all caught up')).toBeTruthy();
	});
});

describe('GlobalSearch', () => {
	const items = [
		{ id: 'dash', label: 'Dashboard', group: 'Pages', description: 'Your overview' },
		{ id: 'bill', label: 'Billing settings', group: 'Pages' },
		{ id: 'inv', label: 'Invite teammate', group: 'Actions', keywords: ['people'] },
		{ id: 'off', label: 'Billing export', group: 'Actions', disabled: true }
	];

	async function openSearch() {
		const out = mount('search', { items, recent: ['billing', 'team'] });
		await fireEvent.click(screen.getByRole('button', { name: /Search…/ }));
		const input = await screen.findByRole('combobox', { name: 'Search' });
		return { ...out, input };
	}

	it('opens from its trigger with the recent searches listed', async () => {
		const { input, state } = await openSearch();
		expect(state().open).toBe(true);
		expect(document.activeElement).toBe(input);
		expect(screen.getByText('Recent searches')).toBeTruthy();
		expect(screen.getAllByRole('option', { hidden: true }).length).toBe(2);
	});

	it('opens and closes with Ctrl+K and Cmd+K', async () => {
		const { state } = mount('search', { items });
		await fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
		expect(state().open).toBe(true);
		await fireEvent.keyDown(window, { key: 'k', metaKey: true });
		expect(state().open).toBe(false);
		await fireEvent.keyDown(window, { key: 'k' });
		expect(state().open).toBe(false);
	});

	it('ignores the shortcut when the hotkey is off', async () => {
		const { state } = mount('search', { items, hotkey: false });
		await fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
		expect(state().open).toBe(false);
	});

	it('ranks, groups and highlights matches, and announces the count', async () => {
		const { input, onEvent } = await openSearch();
		await fireEvent.input(input, { target: { value: 'bill' } });
		expect(last(onEvent, 'search')).toEqual({ query: 'bill' });
		const options = screen.getAllByRole('option', { hidden: true });
		expect(options.map((o) => o.textContent?.trim())).toEqual([
			'Billing settings',
			'Billing export'
		]);
		expect(options[0].querySelector('mark')?.textContent).toBe('Bill');
		expect(screen.getByText('Pages')).toBeTruthy();
		expect(screen.getByText('2 results')).toBeTruthy();
		expect(input.getAttribute('aria-activedescendant')).toBe(options[0].id);
		expect(options[1].getAttribute('aria-disabled')).toBe('true');
	});

	it('moves the highlight with arrows, skipping disabled, and picks with Enter', async () => {
		const { input, onEvent, state } = await openSearch();
		await fireEvent.input(input, { target: { value: 'bill' } });
		const options = screen.getAllByRole('option', { hidden: true });
		expect(input.getAttribute('aria-activedescendant')).toBe(options[0].id);
		await key(input, 'ArrowDown');
		await key(input, 'ArrowUp');
		expect(input.getAttribute('aria-activedescendant')).toBe(options[0].id);
		await key(input, 'Enter');
		expect(last(onEvent, 'select')).toEqual({ item: expect.objectContaining({ id: 'bill' }) });
		expect(last(onEvent, 'recent')).toEqual({ query: 'bill' });
		expect(state().open).toBe(false);
	});

	it('picks with the mouse and follows the pointer', async () => {
		const { input, onEvent } = await openSearch();
		await fireEvent.input(input, { target: { value: 'in' } });
		const options = screen.getAllByRole('option', { hidden: true });
		// the disabled 'Billing export' sits between the two enabled results
		await key(input, 'ArrowDown');
		expect(input.getAttribute('aria-activedescendant')).toBe(options[2].id);
		await fireEvent.mouseMove(options[1]);
		expect(input.getAttribute('aria-activedescendant')).toBe(options[2].id);
		await fireEvent.mouseMove(options[0]);
		expect(input.getAttribute('aria-activedescendant')).toBe(options[0].id);
		await fireEvent.mouseDown(options[2]);
		await fireEvent.click(options[2]);
		expect(onEvent).toHaveBeenCalledWith('select', expect.anything());
	});

	it('does not pick a disabled option', async () => {
		const { input, onEvent } = await openSearch();
		await fireEvent.input(input, { target: { value: 'export' } });
		const [option] = screen.getAllByRole('option', { hidden: true });
		await fireEvent.mouseMove(option);
		await fireEvent.click(option);
		await key(input, 'Enter');
		expect(onEvent).not.toHaveBeenCalledWith('select', expect.anything());
	});

	it('re-runs a recent search when it is picked', async () => {
		const { input, onEvent } = await openSearch();
		await fireEvent.click(screen.getAllByRole('option', { hidden: true })[0]);
		expect((input as HTMLInputElement).value).toBe('billing');
		expect(last(onEvent, 'search')).toEqual({ query: 'billing' });
	});

	it('clears the text on the first Escape', async () => {
		const { input, onEvent } = await openSearch();
		await fireEvent.input(input, { target: { value: 'bill' } });
		await key(input, 'Escape');
		expect((input as HTMLInputElement).value).toBe('');
		expect(last(onEvent, 'search')).toEqual({ query: '' });
		await key(input, 'Escape');
	});

	it('says when nothing matches, and while loading', async () => {
		const { input } = await openSearch();
		await fireEvent.input(input, { target: { value: 'zzzz' } });
		expect(screen.getAllByText('No results found.').length).toBeGreaterThan(0);
		expect(screen.queryAllByRole('option', { hidden: true })).toEqual([]);
	});

	it('shows a loading state', async () => {
		mount('search', { items: [], loading: true, query: 'ab' });
		await fireEvent.click(screen.getByRole('button', { name: /Search…/ }));
		expect(screen.getAllByText('Searching…').length).toBeGreaterThan(0);
		expect(screen.queryByText('No results found.')).toBeNull();
	});

	it('can skip ranking when results arrive already filtered', async () => {
		mount('search', { items, rank: false });
		await fireEvent.click(screen.getByRole('button', { name: /Search…/ }));
		await fireEvent.input(await screen.findByRole('combobox'), { target: { value: 'zzz' } });
		expect(screen.getAllByRole('option', { hidden: true }).length).toBe(4);
	});

	it('closes on the backdrop and on native close, returning focus', async () => {
		const { state } = mount('search', { items });
		const trigger = screen.getByRole('button', { name: /Search…/ });
		trigger.focus();
		await fireEvent.click(trigger);
		await fireEvent.click(document.querySelector('dialog') as Element);
		await waitFor(() => expect(state().open).toBe(false));
		expect(document.activeElement).toBe(trigger);
		await fireEvent.click(trigger);
		document.querySelector('dialog')?.dispatchEvent(new Event('close'));
		await waitFor(() => expect(state().open).toBe(false));
	});

	it('can hide its trigger', () => {
		mount('search', { items, showTrigger: false });
		expect(screen.queryByRole('button', { name: /Search…/ })).toBeNull();
	});
});

describe('UserMenu', () => {
	const props = {
		user: { name: 'Ada Lovelace', email: 'ada@example.com' },
		items: [
			{ id: 'profile', label: 'Profile', href: '/me' },
			{ id: 'billing', label: 'Billing', disabled: true },
			{ id: 'delete', label: 'Delete account', danger: true }
		]
	};

	it('names the button after the person and opens an identity header and menu', async () => {
		mount('user', props);
		const trigger = screen.getByRole('button', { name: 'Account menu for Ada Lovelace' });
		expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		await fireEvent.click(trigger);
		expect(trigger.getAttribute('aria-expanded')).toBe('true');
		expect(screen.getByText('ada@example.com')).toBeTruthy();
		const menu = screen.getByRole('menu');
		const items = within(menu).getAllByRole('menuitem');
		expect(items.map((i) => i.textContent?.trim())).toEqual([
			'Profile',
			'Billing',
			'⚠ Delete account',
			'⚠ Sign out'
		]);
		expect(document.activeElement).toBe(items[0]);
		expect(items[0].tagName).toBe('A');
		expect(within(menu).getByRole('separator')).toBeTruthy();
	});

	it('moves with arrows, skipping disabled items, and wraps', async () => {
		mount('user', props);
		await fireEvent.click(screen.getByRole('button', { name: /Account menu/ }));
		const menu = screen.getByRole('menu');
		const items = within(menu).getAllByRole('menuitem');
		await key(menu, 'ArrowDown');
		expect(document.activeElement).toBe(items[2]);
		await key(menu, 'End');
		expect(document.activeElement).toBe(items[3]);
		await key(menu, 'ArrowDown');
		expect(document.activeElement).toBe(items[0]);
		await key(menu, 'ArrowUp');
		expect(document.activeElement).toBe(items[3]);
		await key(menu, 'q');
	});

	it('opens from the keyboard on the first or last item', async () => {
		mount('user', props);
		const trigger = screen.getByRole('button', { name: /Account menu/ });
		await key(trigger, 'ArrowUp');
		await waitFor(() => expect(screen.getByRole('menu')).toBeTruthy());
		const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
		expect(document.activeElement).toBe(items[3]);
		await key(screen.getByRole('menu'), 'Escape');
		expect(screen.queryByRole('menu')).toBeNull();
		expect(document.activeElement).toBe(trigger);
		await key(trigger, 'ArrowDown');
		await waitFor(() => expect(screen.getByRole('menu')).toBeTruthy());
		expect(document.activeElement).toBe(
			within(screen.getByRole('menu')).getAllByRole('menuitem')[0]
		);
		await key(trigger, 'a');
	});

	it('reports a pick and sign out, closing the menu and returning focus', async () => {
		const { onEvent } = mount('user', props);
		const trigger = screen.getByRole('button', { name: /Account menu/ });
		await fireEvent.click(trigger);
		await fireEvent.click(screen.getByRole('menuitem', { name: /Delete account/ }));
		expect(last(onEvent, 'select')).toEqual({ id: 'delete' });
		expect(screen.queryByRole('menu')).toBeNull();
		expect(document.activeElement).toBe(trigger);
		await fireEvent.click(trigger);
		await fireEvent.click(screen.getByRole('menuitem', { name: /Sign out/ }));
		expect(onEvent).toHaveBeenCalledWith('signout', null);
	});

	it('ignores a disabled item', async () => {
		const { onEvent } = mount('user', props);
		await fireEvent.click(screen.getByRole('button', { name: /Account menu/ }));
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Billing' }));
		expect(onEvent).not.toHaveBeenCalled();
		expect(screen.getByRole('menu')).toBeTruthy();
	});

	it('closes on Tab, on an outside click and on a second click of the button', async () => {
		mount('user', props);
		const trigger = screen.getByRole('button', { name: /Account menu/ });
		await fireEvent.click(trigger);
		await key(screen.getByRole('menu'), 'Tab');
		expect(screen.queryByRole('menu')).toBeNull();
		await fireEvent.click(trigger);
		await fireEvent.pointerDown(screen.getByRole('button', { name: 'outside' }));
		expect(screen.queryByRole('menu')).toBeNull();
		await fireEvent.pointerDown(document.body);
		await fireEvent.click(trigger);
		await fireEvent.click(trigger);
		expect(screen.queryByRole('menu')).toBeNull();
	});

	it('works with only an avatar name', async () => {
		mount('user', { user: { name: 'Solo' }, align: 'start' });
		await fireEvent.click(screen.getByRole('button', { name: /Account menu/ }));
		expect(screen.getAllByRole('menuitem').length).toBe(1);
	});
});

describe('OnboardingChecklist', () => {
	const steps = [
		{
			id: 'a',
			title: 'Profile',
			description: 'Add a photo',
			done: true,
			actionLabel: 'Open',
			href: '/p'
		},
		{ id: 'b', title: 'Invite', description: 'Add a mate', done: false, actionLabel: 'Invite' }
	];

	it('shows progress and step states in words', () => {
		mount('checklist', { steps });
		expect(screen.getByRole('heading', { level: 2, name: 'Get started' })).toBeTruthy();
		const bar = screen.getByRole('progressbar', { name: 'Setup progress' });
		expect(bar.getAttribute('aria-valuenow')).toBe('1');
		expect(bar.getAttribute('aria-valuemax')).toBe('2');
		expect(screen.getByText('1 of 2 done')).toBeTruthy();
		expect(screen.getByText('Done')).toBeTruthy();
		expect(screen.getByText('To do')).toBeTruthy();
	});

	it('expands one step at a time with aria-expanded', async () => {
		mount('checklist', { steps });
		const [a, b] = screen.getAllByRole('button', { expanded: false });
		expect(a.getAttribute('aria-controls')).toBeTruthy();
		await fireEvent.click(a);
		expect(a.getAttribute('aria-expanded')).toBe('true');
		expect(screen.getByText('Add a photo')).toBeTruthy();
		await fireEvent.click(b);
		expect(a.getAttribute('aria-expanded')).toBe('false');
		await fireEvent.click(b);
		expect(b.getAttribute('aria-expanded')).toBe('false');
	});

	it('marks a step done and celebrates once everything is', async () => {
		const { onEvent, state } = mount('checklist', { steps });
		await fireEvent.click(screen.getByRole('button', { name: /Invite/ }));
		expect(screen.getByRole('button', { name: 'Invite' })).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: /Mark as done/ }));
		expect(last(onEvent, 'step')).toEqual({ id: 'b', done: true });
		expect(state().steps[1].done).toBe(true);
		expect(screen.getByText('You’re all set!')).toBeTruthy();
		expect(onEvent.mock.calls.filter(([n]) => n === 'complete').length).toBe(1);
		// undoing it takes the celebration away and it can fire again
		await fireEvent.click(screen.getByRole('button', { name: /Mark as not done/ }));
		expect(screen.queryByText('You’re all set!')).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: /Mark as done/ }));
		expect(onEvent.mock.calls.filter(([n]) => n === 'complete').length).toBe(2);
	});

	it('hides the action on a finished step', async () => {
		mount('checklist', { steps });
		await fireEvent.click(screen.getByRole('button', { name: /Profile/ }));
		expect(screen.queryByRole('link', { name: 'Open' })).toBeNull();
		expect(screen.getByRole('button', { name: /Mark as not done/ })).toBeTruthy();
	});

	it('dismisses', async () => {
		const { onEvent, state } = mount('checklist', { steps });
		await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
		expect(onEvent).toHaveBeenCalledWith('dismiss', null);
		expect(state().dismissed).toBe(true);
		expect(screen.queryByRole('heading', { name: 'Get started' })).toBeNull();
	});

	it('copes with an empty list', () => {
		mount('checklist', { steps: [] });
		expect(screen.getByText('0 of 0 done')).toBeTruthy();
		expect(screen.queryByText('You’re all set!')).toBeNull();
	});
});

describe('Wizard', () => {
	const steps = [
		{ id: 'account', label: 'Account', description: 'Who are you?' },
		{ id: 'plan', label: 'Plan' },
		{ id: 'review', label: 'Review' }
	];

	it('starts on the first step with Back disabled and a Stepper', () => {
		mount('wizard', { steps });
		expect(screen.getByRole('heading', { level: 2, name: 'Account' })).toBeTruthy();
		expect(screen.getAllByText('Who are you?').length).toBeGreaterThan(0);
		expect(screen.getByRole('button', { name: 'Back' }).hasAttribute('disabled')).toBe(true);
		expect(screen.getByRole('list', { name: 'Setup steps' })).toBeTruthy();
		expect(document.querySelector('[aria-current="step"]')).toBeTruthy();
	});

	it('refuses to advance an invalid step, with a linked error summary', async () => {
		const { onEvent } = mount('wizard', { steps });
		await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
		const alert = screen.getByRole('alert');
		expect(alert.textContent).toContain('Enter your name.');
		expect(screen.getByRole('heading', { name: 'Account' })).toBeTruthy();
		expect(onEvent).not.toHaveBeenCalledWith('step', expect.anything());
		expect(document.activeElement).toBe(alert);
		expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('true');
		expect(document.body.textContent).toContain('Has an error');

		await fireEvent.click(within(alert).getByRole('link', { name: 'Enter your name.' }));
		expect(document.activeElement).toBe(screen.getByRole('textbox'));
	});

	it('does not show errors before the first attempt', () => {
		mount('wizard', { steps });
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('advances once valid, moves focus to the new heading and announces progress', async () => {
		const { onEvent } = mount('wizard', { steps });
		await fireEvent.input(screen.getByRole('textbox'), { target: { value: 'Ada' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
		const heading = await screen.findByRole('heading', { name: 'Plan' });
		await waitFor(() => expect(document.activeElement).toBe(heading));
		expect(last(onEvent, 'step')).toEqual({ index: 1, id: 'plan' });
		expect(screen.getByText('Step 2 of 3: Plan')).toBeTruthy();
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('goes back, and jumps back via the Stepper', async () => {
		mount('wizard', { steps });
		await fireEvent.input(screen.getByRole('textbox'), { target: { value: 'Ada' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
		expect(await screen.findByRole('heading', { name: 'Review' })).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: /Account/ }));
		expect(await screen.findByRole('heading', { name: 'Account' })).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Back' }));
		expect(await screen.findByRole('heading', { name: 'Account' })).toBeTruthy();
	});

	it('shows the summary and finishes on the last step', async () => {
		const { onEvent } = mount('wizard', {
			steps,
			summary: [{ label: 'Name', value: 'Ada' }]
		});
		await fireEvent.input(screen.getByRole('textbox'), { target: { value: 'Ada' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
		expect(screen.getByText('Review your answers')).toBeTruthy();
		expect(screen.getByText('Ada', { selector: 'dd' })).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
		expect(last(onEvent, 'finish')).toEqual({ values: { name: 'Ada', email: '' } });
		const done = await screen.findByRole('heading', { name: 'All done' });
		expect(done).toBeTruthy();
		expect(screen.getByText('Your answers were submitted.')).toBeTruthy();
	});

	it('shows a busy Finish button', async () => {
		mount('wizard', { steps: [steps[1]], busy: true });
		expect(screen.getByRole('button', { name: 'Finish' }).getAttribute('aria-busy')).toBe('true');
		expect(screen.getByRole('button', { name: 'Back' }).hasAttribute('disabled')).toBe(true);
	});

	it('does not show a summary mid-way and copes with no steps', () => {
		mount('wizard', { steps, summary: [{ label: 'Name', value: 'Ada' }] });
		expect(screen.queryByText('Review your answers')).toBeNull();
	});

	it('renders nothing for an empty step list', () => {
		mount('wizard', { steps: [] });
		expect(screen.queryByRole('form')).toBeNull();
		expect(document.querySelector('form')).toBeNull();
	});
});

describe('ErrorState', () => {
	it('renders each preset with its title and a home link', () => {
		const { unmount } = mount('error', { kind: '404' });
		expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeTruthy();
		expect(screen.getByText('404')).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Go home' }).getAttribute('href')).toBe('/');
		expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
		unmount();
		mount('error', { kind: 'offline', level: 3 });
		expect(screen.getByRole('heading', { level: 3, name: 'You are offline' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
	});

	it('retries, with a spinner while retrying', async () => {
		const { onEvent } = mount('error', { kind: '500' });
		await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
		expect(onEvent).toHaveBeenCalledWith('retry', null);
	});

	it('shows the busy state and can force or hide retry', () => {
		const { unmount } = mount('error', { kind: '500', retrying: true });
		expect(screen.getByRole('button', { name: 'Try again' }).getAttribute('aria-busy')).toBe(
			'true'
		);
		unmount();
		mount('error', { kind: '404', showRetry: true });
		expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
	});

	it('has a Go home button when there is no link', async () => {
		const { onEvent } = mount('error', { kind: '403', homeHref: '' });
		await fireEvent.click(screen.getByRole('button', { name: 'Go home' }));
		expect(onEvent).toHaveBeenCalledWith('home', null);
	});

	it('takes custom copy and announces on request', () => {
		mount('error', { kind: '500', title: 'Oops', description: 'Custom text.', announce: true });
		expect(screen.getByRole('alert')).toBeTruthy();
		expect(screen.getByRole('heading', { name: 'Oops' })).toBeTruthy();
		expect(screen.getByText('Custom text.')).toBeTruthy();
	});

	it('copies the request id and confirms it', async () => {
		vi.useFakeTimers();
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
		const { onEvent } = mount('error', { kind: '500', requestId: 'req_123' });
		expect(screen.getByText('req_123')).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: /Copy/ }));
		await vi.advanceTimersByTimeAsync(0);
		expect(writeText).toHaveBeenCalledWith('req_123');
		expect(last(onEvent, 'copy')).toEqual({ requestId: 'req_123' });
		expect(screen.getByText('Copied')).toBeTruthy();
		await vi.advanceTimersByTimeAsync(3000);
		expect(screen.queryByText('Copied')).toBeNull();
		vi.useRealTimers();
	});

	it('falls back to selecting the id when the clipboard is refused', async () => {
		const writeText = vi.fn().mockRejectedValue(new Error('denied'));
		Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
		const { onEvent } = mount('error', { kind: '500', requestId: 'req_9' });
		await fireEvent.click(screen.getByRole('button', { name: /Copy/ }));
		await waitFor(() => expect(onEvent).toHaveBeenCalledWith('copy', { requestId: 'req_9' }));
		expect(window.getSelection()?.toString()).toContain('req_9');
	});
});

describe('EmptyStateCard', () => {
	it('renders the three presets', () => {
		const { unmount } = mount('empty', { kind: 'no-data' });
		expect(screen.getByRole('heading', { level: 2, name: 'Nothing here yet' })).toBeTruthy();
		unmount();
		const second = mount('empty', { kind: 'no-results', query: 'tax' });
		expect(screen.getByText(/“tax”/)).toBeTruthy();
		second.unmount();
		mount('empty', { kind: 'first-run', level: 3, icon: '🎈' });
		expect(screen.getByRole('heading', { level: 3, name: 'Let’s get you started' })).toBeTruthy();
	});

	it('offers actions: a link, and a button that reports', async () => {
		const { onEvent } = mount('empty', {
			action: { label: 'Create', href: '/new' },
			secondaryAction: { id: 'learn', label: 'Learn more' }
		});
		expect(screen.getByRole('link', { name: 'Create' }).getAttribute('href')).toBe('/new');
		await fireEvent.click(screen.getByRole('button', { name: 'Learn more' }));
		expect(last(onEvent, 'action')).toEqual({ id: 'learn' });
		await fireEvent.click(screen.getByRole('link', { name: 'Create' }));
		expect(last(onEvent, 'action')).toEqual({ id: 'primary' });
	});

	it('names default action ids', async () => {
		const { onEvent } = mount('empty', {
			action: { label: 'One' },
			secondaryAction: { label: 'Two' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'One' }));
		expect(last(onEvent, 'action')).toEqual({ id: 'primary' });
		await fireEvent.click(screen.getByRole('button', { name: 'Two' }));
		expect(last(onEvent, 'action')).toEqual({ id: 'secondary' });
	});

	it('has no actions row without actions', () => {
		mount('empty', {});
		expect(screen.queryByRole('button')).toBeNull();
	});
});

describe('ConfirmDialog', () => {
	it('resolves true on confirm and returns focus', async () => {
		const { state } = mount('confirm');
		const opener = screen.getByRole('button', { name: 'Delete' });
		opener.focus();
		await fireEvent.click(opener);
		const dialog = await screen.findByRole('alertdialog', { name: 'Delete it?' });
		const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
		await waitFor(() => expect(document.activeElement).toBe(cancel));
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
		await waitFor(() => expect(state().answer).toBe('yes'));
		await waitFor(() => expect(document.activeElement).toBe(opener));
	});

	it('resolves false on cancel', async () => {
		const { state } = mount('confirm');
		await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
		const dialog = await screen.findByRole('alertdialog');
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
		await waitFor(() => expect(state().answer).toBe('no'));
	});

	it('resolves false when the dialog is closed with Escape', async () => {
		const { state } = mount('confirm');
		await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
		await screen.findByRole('alertdialog');
		document.querySelector('dialog')?.dispatchEvent(new Event('close'));
		await waitFor(() => expect(state().answer).toBe('no'));
	});

	it('takes defaults from props', async () => {
		mount('confirm', { title: 'Sure?', confirmLabel: 'Yes' });
		await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
		expect(await screen.findByRole('alertdialog', { name: 'Delete it?' })).toBeTruthy();
	});
});

describe('TabsPageNav', () => {
	const items = [
		{ id: 'a', label: 'General', href: '/s/general' },
		{ id: 'b', label: 'Billing', href: '/s/billing', badge: 3 },
		{ id: 'c', label: 'Team', href: '/s/team', badge: '' }
	];

	it('marks the current page and labels the nav', () => {
		mount('tabs', { items, current: '/s/billing', badgeWord: 'alerts' });
		const nav = screen.getByRole('navigation', { name: 'Page sections' });
		const links = within(nav).getAllByRole('link');
		expect(links.map((l) => l.getAttribute('aria-current'))).toEqual([null, 'page', null]);
		expect(screen.getByRole('link', { name: 'Billing, 3 alerts' })).toBeTruthy();
	});

	it('keeps a section current on its sub-pages unless exact', () => {
		const { unmount } = mount('tabs', { items, current: '/s/billing/invoices' });
		expect(screen.getByRole('link', { name: /Billing/ }).getAttribute('aria-current')).toBe('page');
		unmount();
		mount('tabs', { items, current: '/s/billing/invoices', exact: true });
		expect(screen.getByRole('link', { name: /Billing/ }).getAttribute('aria-current')).toBeNull();
	});

	it('shows edge arrows when there is more to scroll', async () => {
		const metrics = { scrollWidth: 800, clientWidth: 200, scrollLeft: 0 };
		for (const k of Object.keys(metrics) as (keyof typeof metrics)[]) {
			Object.defineProperty(HTMLElement.prototype, k, {
				configurable: true,
				get: () => metrics[k],
				set: (n: number) => {
					metrics.scrollLeft = n;
				}
			});
		}
		try {
			mount('tabs', { items, current: '/s/general' });
			await waitFor(() => expect(screen.getByText('›')).toBeTruthy());
			expect(screen.queryByText('‹')).toBeNull();
			metrics.scrollLeft = 300;
			await fireEvent.scroll(document.querySelector('.tabs-nav__scroller') as Element);
			await waitFor(() => expect(screen.getByText('‹')).toBeTruthy());
		} finally {
			for (const k of Object.keys(metrics))
				delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
		}
	});

	it('shows no arrows when everything fits', async () => {
		mount('tabs', { items });
		await tick();
		expect(screen.queryByText('›')).toBeNull();
		expect(screen.queryByText('‹')).toBeNull();
	});
});

describe('Toolbar', () => {
	const groups = () => [
		{
			id: 'text',
			label: 'Text',
			items: [
				{ id: 'bold', label: 'Bold', icon: 'B', iconOnly: true, pressed: false },
				{ id: 'italic', label: 'Italic', pressed: true }
			]
		},
		{
			id: 'misc',
			items: [
				{ id: 'link', label: 'Link', icon: '🔗' },
				{ id: 'off', label: 'Disabled', disabled: true },
				{ id: 'code', label: 'Code' }
			]
		}
	];

	it('is a labelled toolbar with grouped buttons and one tab stop', () => {
		mount('toolbar', { groups: groups() });
		const bar = screen.getByRole('toolbar', { name: 'Toolbar' });
		expect(bar.getAttribute('aria-orientation')).toBe('horizontal');
		expect(within(bar).getAllByRole('group').length).toBe(2);
		expect(within(bar).getByRole('separator')).toBeTruthy();
		const buttons = within(bar).getAllByRole('button');
		expect(buttons.filter((b) => b.getAttribute('tabindex') === '0').length).toBe(1);
		expect(buttons[0].getAttribute('tabindex')).toBe('0');
		expect(screen.getByRole('button', { name: 'Bold' }).getAttribute('aria-pressed')).toBe('false');
		expect(screen.getByRole('button', { name: 'Italic' }).getAttribute('aria-pressed')).toBe(
			'true'
		);
	});

	it('roves with arrows, Home and End, skipping disabled', async () => {
		mount('toolbar', { groups: groups() });
		const bar = screen.getByRole('toolbar');
		const bold = screen.getByRole('button', { name: 'Bold' });
		bold.focus();
		await key(bold, 'ArrowRight');
		expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Italic' }));
		expect(screen.getByRole('button', { name: 'Italic' }).getAttribute('tabindex')).toBe('0');
		expect(bold.getAttribute('tabindex')).toBe('-1');
		await key(document.activeElement as Element, 'End');
		expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Code' }));
		await key(document.activeElement as Element, 'ArrowLeft');
		expect(document.activeElement).toBe(screen.getByRole('button', { name: /Link/ }));
		await key(document.activeElement as Element, 'ArrowRight');
		expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Code' }));
		await key(document.activeElement as Element, 'Home');
		expect(document.activeElement).toBe(bold);
		await key(bar, 'ArrowRight');
		await key(bold, 'x');
	});

	it('flips a toggle and reports it; a plain button reports its id', async () => {
		const { onEvent, state } = mount('toolbar', { groups: groups() });
		await fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
		expect(last(onEvent, 'action')).toEqual({ id: 'bold', pressed: true });
		expect(screen.getByRole('button', { name: 'Bold' }).getAttribute('aria-pressed')).toBe('true');
		expect(state().groups[0].items[0].pressed).toBe(true);
		await fireEvent.click(screen.getByRole('button', { name: /Link/ }));
		expect(last(onEvent, 'action')).toEqual({ id: 'link' });
		onEvent.mockClear();
		await fireEvent.click(screen.getByRole('button', { name: 'Disabled' }));
		expect(onEvent).not.toHaveBeenCalled();
	});

	it('is vertical on request', () => {
		mount('toolbar', { groups: groups(), orientation: 'vertical' });
		const bar = screen.getByRole('toolbar');
		expect(bar.getAttribute('aria-orientation')).toBe('vertical');
		expect(within(bar).getByRole('separator').getAttribute('aria-orientation')).toBe('horizontal');
	});

	describe('overflow', () => {
		function narrow() {
			// A 250px bar of 100px buttons: one fits beside the More button.
			onTestFinished(pretendWidth({ clientWidth: 250, offsetWidth: 100 }));
		}

		it('moves trailing items into a More menu that is the last tab stop', async () => {
			narrow();
			const out = mount('toolbar', { groups: groups() });
			await tick();
			await tick();
			const more = await screen.findByRole('button', { name: /More/ });
			expect(more.getAttribute('aria-haspopup')).toBe('menu');
			expect(more.getAttribute('aria-expanded')).toBe('false');
			expect(screen.queryByRole('button', { name: 'Code' })).toBeNull();

			// reach it with the arrow keys from the last shown button
			const bold = screen.getByRole('button', { name: 'Bold' });
			bold.focus();
			await key(bold, 'End');
			expect(document.activeElement).toBe(more);
			expect(more.getAttribute('tabindex')).toBe('0');

			await key(more, 'ArrowDown');
			const menu = await screen.findByRole('menu', { name: 'More' });
			const items = [...menu.querySelectorAll('button')];
			expect(within(menu).getByRole('menuitemcheckbox', { name: 'Italic' })).toBeTruthy();
			await waitFor(() => expect(document.activeElement).toBe(items[0]));
			await key(menu, 'ArrowDown');
			await key(menu, 'q');
			await key(menu, 'Escape');
			expect(screen.queryByRole('menu')).toBeNull();
			expect(document.activeElement).toBe(more);

			await fireEvent.click(more);
			await key(screen.getByRole('menu'), 'Tab');
			expect(screen.queryByRole('menu')).toBeNull();

			await fireEvent.click(more);
			const picked = screen.getByRole('menuitemcheckbox', { name: 'Italic' });
			await fireEvent.click(picked);
			expect(screen.queryByRole('menu')).toBeNull();
			expect(out.onEvent).toHaveBeenCalledWith(
				'action',
				expect.objectContaining({ id: expect.any(String) })
			);

			await fireEvent.click(more);
			await fireEvent.pointerDown(document.body);
			expect(screen.queryByRole('menu')).toBeNull();
			await fireEvent.click(more);
			await fireEvent.click(more);
			expect(screen.queryByRole('menu')).toBeNull();
		});
	});
});

describe('BottomNav', () => {
	const items = [
		{ id: 'home', label: 'Home', href: '/home', icon: '🏠' },
		{ id: 'inbox', label: 'Inbox', href: '/inbox', icon: '📥', badge: 120 },
		{ id: 'new', label: 'News', href: '/news', icon: '📰', badge: 'new' },
		{ id: 'me', label: 'Me', href: '/me', icon: '👤', badge: '' }
	];

	it('is a labelled nav with the current page marked and badges in the names', () => {
		mount('bottom', { items, current: '/inbox' });
		const nav = screen.getByRole('navigation', { name: 'Primary' });
		const links = within(nav).getAllByRole('link');
		expect(links.map((l) => l.getAttribute('aria-current'))).toEqual([null, 'page', null, null]);
		expect(screen.getByRole('link', { name: 'Inbox, 99+ new' })).toBeTruthy();
		expect(screen.getByRole('link', { name: 'News, new new' })).toBeTruthy();
		expect(screen.getByRole('link', { name: /Home/ }).textContent).toContain('Home');
	});

	it('is hidden on desktop unless told otherwise, and can be fixed', () => {
		const { unmount } = mount('bottom', { items });
		const nav = () => document.querySelector('nav') as HTMLElement;
		expect(nav().classList.contains('bottom-nav--hide-md')).toBe(true);
		expect(nav().classList.contains('bottom-nav--fixed')).toBe(false);
		unmount();
		mount('bottom', { items, hideAbove: 'never', fixed: true });
		expect(nav().classList.contains('bottom-nav--hide-md')).toBe(false);
		expect(nav().classList.contains('bottom-nav--fixed')).toBe(true);
	});
});
