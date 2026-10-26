import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Harness from '../../../tests/fixtures/UiKitOverlayHarness.svelte';
import AlertDialog from './AlertDialog.svelte';
import Command from './Command.svelte';
import DropdownMenu from './DropdownMenu.svelte';
import HoverCard from './HoverCard.svelte';
import Popover from './Popover.svelte';
import Sheet from './Sheet.svelte';

afterEach(() => {
	vi.useRealTimers();
});

/** Let a component's `await tick()` and the work after it run. */
const settle = async () => {
	await tick();
	await tick();
	await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('Popover', () => {
	it('wires its trigger, opens into the panel, and Escape returns focus', async () => {
		const onEvent = vi.fn();
		render(Harness, { props: { which: 'popover', onEvent } });
		const trigger = screen.getByRole('button', { name: 'Share' });
		expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		await fireEvent.click(trigger);
		await settle();
		const panel = screen.getByRole('dialog', { name: 'Share' });
		expect(trigger.getAttribute('aria-expanded')).toBe('true');
		expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
		expect(document.activeElement).toBe(screen.getByLabelText('Link'));
		expect(onEvent).toHaveBeenCalledWith('open', null);
		await fireEvent.keyDown(panel, { key: 'a' });
		expect(screen.getByRole('dialog')).toBeTruthy();
		await fireEvent.keyDown(panel, { key: 'Escape' });
		await settle();
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(document.activeElement).toBe(trigger);
		expect(onEvent).toHaveBeenCalledWith('close', null);
	});

	it('closes on a click outside, and when focus leaves it', async () => {
		render(Harness, { props: { which: 'popover' } });
		const trigger = screen.getByRole('button', { name: 'Share' });
		await fireEvent.click(trigger);
		await settle();
		await fireEvent.pointerDown(screen.getByRole('dialog'));
		expect(screen.getByRole('dialog')).toBeTruthy();
		await fireEvent.pointerDown(document.body);
		expect(screen.queryByRole('dialog')).toBeNull();

		await fireEvent.click(trigger);
		await settle();
		const panel = screen.getByRole('dialog');
		await fireEvent.focusOut(panel, { relatedTarget: null });
		await fireEvent.focusOut(panel, {
			relatedTarget: screen.getByRole('button', { name: 'Copy' })
		});
		expect(screen.getByRole('dialog')).toBeTruthy();
		await fireEvent.focusOut(panel, {
			relatedTarget: screen.getByRole('button', { name: 'Elsewhere' })
		});
		expect(screen.queryByRole('dialog')).toBeNull();
		window.dispatchEvent(new Event('resize'));
	});

	it('is named by its label without a title, and focuses itself when empty', async () => {
		render(Popover, { props: { open: true, label: 'Details', placement: 'left', align: 'end' } });
		await settle();
		const panel = screen.getByRole('dialog', { name: 'Details' });
		expect(document.activeElement).toBe(panel);
		expect(panel.className).toContain('popover__panel--left');
		window.dispatchEvent(new Event('scroll'));
	});
});

describe('HoverCard', () => {
	it('opens on focus at once, and closes when focus leaves', async () => {
		render(Harness, { props: { which: 'hover-card' } });
		const link = screen.getByRole('link', { name: '@ada' });
		expect(link.getAttribute('aria-expanded')).toBe('false');
		await fireEvent.focusIn(link);
		await settle();
		expect(screen.getByText('Ada Lovelace')).toBeTruthy();
		expect(link.getAttribute('aria-expanded')).toBe('true');
		expect(link.getAttribute('aria-controls')).toBe(
			screen.getByText('Ada Lovelace').parentElement?.id
		);
		await fireEvent.focusIn(link);
		await fireEvent.focusOut(link, { relatedTarget: screen.getByRole('link', { name: 'Posts' }) });
		expect(screen.getByText('Ada Lovelace')).toBeTruthy();
		await fireEvent.focusOut(link, { relatedTarget: null });
		await new Promise((resolve) => setTimeout(resolve, 250));
		await tick();
		expect(screen.queryByText('Ada Lovelace')).toBeNull();
	});

	it('waits on hover, stays while the pointer is over it, and Escape hides it', async () => {
		vi.useFakeTimers();
		const { container } = render(HoverCard, { props: { openDelay: 300, closeDelay: 100 } });
		const wrap = container.querySelector('.hover-card')!;
		await fireEvent.pointerEnter(wrap, { pointerType: 'touch' });
		await vi.advanceTimersByTimeAsync(400);
		expect(container.querySelector('.hover-card__card')).toBeNull();
		await fireEvent.pointerEnter(wrap);
		await vi.advanceTimersByTimeAsync(200);
		expect(container.querySelector('.hover-card__card')).toBeNull();
		await vi.advanceTimersByTimeAsync(150);
		expect(container.querySelector('.hover-card__card')).toBeTruthy();
		await fireEvent.pointerLeave(wrap);
		await fireEvent.pointerEnter(wrap);
		await vi.advanceTimersByTimeAsync(200);
		expect(container.querySelector('.hover-card__card')).toBeTruthy();
		await fireEvent.keyDown(wrap, { key: 'a' });
		await fireEvent.keyDown(wrap, { key: 'Escape' });
		expect(container.querySelector('.hover-card__card')).toBeNull();
		await fireEvent.keyDown(wrap, { key: 'Escape' });
		window.dispatchEvent(new Event('resize'));
	});
});

describe('Sheet', () => {
	it('opens from its side, labelled and described, and closes from its button or backdrop', async () => {
		const onEvent = vi.fn();
		render(Harness, { props: { which: 'sheet', props: { side: 'bottom' }, onEvent } });
		const dialog = document.querySelector('dialog')!;
		expect(dialog.classList.contains('sheet--bottom')).toBe(true);
		expect(dialog.open).toBe(false);
		await fireEvent.click(screen.getByRole('button', { name: 'Open' }));
		await tick();
		expect(dialog.open).toBe(true);
		expect(screen.getByRole('heading', { name: 'Settings' }).id).toBe(
			dialog.getAttribute('aria-labelledby')
		);
		expect(document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent).toBe(
			'Changes save as you go.'
		);
		await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		await tick();
		dialog.dispatchEvent(new Event('close'));
		await tick();
		expect(screen.getByTestId('state').textContent).toBe('false');
		expect(onEvent).toHaveBeenCalledWith('close', null);
		await fireEvent.click(screen.getByRole('button', { name: 'Open' }));
		await tick();
		await fireEvent.click(dialog.querySelector('.sheet__body')!);
		expect(screen.getByTestId('state').textContent).toBe('true');
		await fireEvent.click(dialog);
		await tick();
		expect(screen.getByTestId('state').textContent).toBe('false');
	});

	it('falls back to the open attribute without showModal, and has no description by default', async () => {
		const proto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
		const showModal = proto.showModal;
		const close = proto.close;
		proto.showModal = undefined;
		proto.close = undefined;
		try {
			render(Sheet, { props: { title: 'Plain', open: true } });
			const dialog = document.querySelector('dialog')!;
			expect(dialog.hasAttribute('open')).toBe(true);
			expect(dialog.getAttribute('aria-describedby')).toBeNull();
			expect(dialog.classList.contains('sheet--right')).toBe(true);
			await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
			await tick();
			expect(dialog.hasAttribute('open')).toBe(false);
		} finally {
			proto.showModal = showModal;
			proto.close = close;
		}
	});
});

describe('AlertDialog', () => {
	it('is an alertdialog that focuses Cancel and reports the choice', async () => {
		const onEvent = vi.fn();
		render(Harness, { props: { which: 'alert-dialog', open: true, onEvent } });
		await settle();
		const dialog = screen.getByRole('alertdialog', { name: 'Delete project?' });
		expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
		const cancel = screen.getByRole('button', { name: 'Cancel' });
		expect(document.activeElement).toBe(cancel);
		expect(screen.getByRole('button', { name: 'Delete' }).className).toContain(
			'alert-dialog__button--danger'
		);
		await fireEvent.click(dialog);
		expect(screen.getByTestId('state').textContent).toBe('true');
		await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
		await tick();
		dialog.dispatchEvent(new Event('close'));
		expect(onEvent).toHaveBeenCalledWith('confirm', null);
		expect(onEvent).not.toHaveBeenCalledWith('cancel', null);
		expect(screen.getByTestId('state').textContent).toBe('false');
	});

	it('reports Cancel as cancel, once', async () => {
		const onEvent = vi.fn();
		render(Harness, { props: { which: 'alert-dialog', open: true, onEvent } });
		await settle();
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(onEvent).toHaveBeenLastCalledWith('cancel', null);
		expect(onEvent).toHaveBeenCalledTimes(1);

		onEvent.mockClear();
		await fireEvent.click(document.body);
		expect(onEvent).not.toHaveBeenCalled();
	});

	it('reports an unanswered close (Escape) as cancel, and needs no description', async () => {
		const onEvent = vi.fn();
		render(Harness, { props: { which: 'alert-dialog', open: true, onEvent } });
		await settle();
		const dialog = document.querySelector('dialog')!;
		dialog.dispatchEvent(new Event('close'));
		await tick();
		expect(onEvent).toHaveBeenCalledWith('cancel', null);
		expect(screen.getByTestId('state').textContent).toBe('false');

		render(AlertDialog, { props: { open: true, title: 'Leave?', confirmLabel: 'Leave' } });
		await settle();
		const dialogs = document.querySelectorAll('dialog');
		const plain = dialogs[dialogs.length - 1];
		expect(plain.getAttribute('aria-describedby')).toBeNull();
		expect(plain.querySelector('.alert-dialog__button--default')?.textContent).toBe('Leave');
	});
});

const fileMenu = [
	{ id: 'open', label: 'Open', shortcut: '⌘O' },
	{ id: 'copy', label: 'Copy' },
	{ separator: true as const },
	{ id: 'cut', label: 'Cut', disabled: true },
	{ id: 'delete', label: 'Delete', danger: true }
];

describe('ContextMenu', () => {
	it('opens at the pointer on right-click, moves, picks and returns focus', async () => {
		const onSelect = vi.fn();
		render(Harness, {
			props: {
				which: 'context-menu',
				props: { items: fileMenu, label: 'File actions' },
				onEvent: (_: string, detail: { id: string }) => onSelect(detail.id)
			}
		});
		const target = screen.getByTestId('target');
		target.focus();
		await fireEvent.contextMenu(target, { clientX: 40, clientY: 50 });
		await settle();
		const menu = screen.getByRole('menu', { name: 'File actions' });
		expect(menu.style.left).toBe('40px');
		expect(screen.getAllByRole('separator')).toHaveLength(1);
		const items = screen.getAllByRole('menuitem');
		expect(items).toHaveLength(4);
		expect(items[0].textContent).toContain('⌘O');
		expect(document.activeElement).toBe(items[0]);
		await fireEvent.contextMenu(target, { clientX: 1, clientY: 1 });
		await fireEvent.contextMenu(menu);
		await fireEvent.keyDown(menu, { key: 'ArrowUp' });
		expect(document.activeElement).toBe(items[3]);
		await fireEvent.keyDown(menu, { key: 'ArrowDown' });
		expect(document.activeElement).toBe(items[0]);
		await fireEvent.keyDown(menu, { key: 'c' });
		expect(document.activeElement).toBe(items[1]);
		await fireEvent.keyDown(menu, { key: 'z' });
		await fireEvent.keyDown(menu, { key: 'Shift' });
		await fireEvent.click(items[2]);
		expect(onSelect).not.toHaveBeenCalled();
		await fireEvent.click(items[3]);
		expect(onSelect).toHaveBeenCalledWith('delete');
		expect(screen.queryByRole('menu')).toBeNull();
		expect(document.activeElement).toBe(target);
	});

	it('opens from the keyboard and closes on Escape, Tab, outside clicks and resize', async () => {
		render(Harness, { props: { which: 'context-menu', props: { items: fileMenu } } });
		const target = screen.getByTestId('target');
		target.focus();
		await fireEvent.keyDown(target, { key: 'F10', shiftKey: true });
		await settle();
		const menu = screen.getByRole('menu', { name: 'Actions' });
		await fireEvent.keyDown(menu, { key: 'Escape' });
		expect(screen.queryByRole('menu')).toBeNull();
		expect(document.activeElement).toBe(target);

		await fireEvent.keyDown(target, { key: 'F10' });
		expect(screen.queryByRole('menu')).toBeNull();
		await fireEvent.keyDown(target, { key: 'ContextMenu' });
		await settle();
		await fireEvent.keyDown(screen.getByRole('menu'), { key: 'Tab' });
		expect(screen.queryByRole('menu')).toBeNull();

		await fireEvent.keyDown(target, { key: 'ContextMenu' });
		await settle();
		await fireEvent.pointerDown(screen.getAllByRole('menuitem')[0]);
		expect(screen.getByRole('menu')).toBeTruthy();
		await fireEvent.pointerDown(document.body);
		expect(screen.queryByRole('menu')).toBeNull();

		await fireEvent.keyDown(target, { key: 'ContextMenu' });
		await settle();
		window.dispatchEvent(new Event('resize'));
		await tick();
		expect(screen.queryByRole('menu')).toBeNull();
		window.dispatchEvent(new Event('resize'));
	});
});

describe('DropdownMenu', () => {
	const groups = [
		{ items: [{ id: 'refresh', label: 'Refresh', shortcut: '⌘R' }] },
		{
			label: 'Show',
			items: [
				{ id: 'hidden', label: 'Hidden files', checkbox: true },
				{ id: 'ext', label: 'Extensions', checkbox: true, disabled: true }
			]
		},
		{
			label: 'Sort by',
			radio: 'sort',
			items: [
				{ id: 'name', label: 'Name' },
				{ id: 'size', label: 'Size', danger: true }
			]
		}
	];

	it('groups items with labels and separators, and reports checks and radios', async () => {
		const onEvent = vi.fn();
		render(Harness, {
			props: { which: 'dropdown-menu', props: { groups, state: { sort: 'name' } }, onEvent }
		});
		const trigger = screen.getByRole('button', { name: /View/ });
		await fireEvent.click(trigger);
		await settle();
		expect(screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual([
			null,
			'Show',
			'Sort by'
		]);
		expect(screen.getAllByRole('separator')).toHaveLength(2);
		const box = screen.getByRole('menuitemcheckbox', { name: /Hidden files/ });
		expect(box.getAttribute('aria-checked')).toBe('false');
		await fireEvent.click(box);
		expect(box.getAttribute('aria-checked')).toBe('true');
		expect(onEvent).toHaveBeenLastCalledWith('change', { id: 'hidden', value: true });
		expect(screen.getByRole('menu')).toBeTruthy();
		await fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /Extensions/ }));
		expect(onEvent).toHaveBeenCalledTimes(1);

		const [byName, bySize] = screen.getAllByRole('menuitemradio');
		expect(byName.getAttribute('aria-checked')).toBe('true');
		await fireEvent.click(byName);
		expect(onEvent).toHaveBeenCalledTimes(1);
		await fireEvent.click(bySize);
		expect(bySize.getAttribute('aria-checked')).toBe('true');
		expect(byName.getAttribute('aria-checked')).toBe('false');
		expect(onEvent).toHaveBeenLastCalledWith('change', { id: 'sort', value: 'size' });

		await fireEvent.click(screen.getByRole('menuitem', { name: /Refresh/ }));
		expect(onEvent).toHaveBeenLastCalledWith('select', { id: 'refresh' });
		expect(screen.queryByRole('menu')).toBeNull();
		expect(document.activeElement).toBe(trigger);
	});

	it('moves with arrows and typeahead, skipping disabled items, and closes', async () => {
		render(DropdownMenu, { props: { label: 'View', groups, align: 'end' } });
		const trigger = screen.getByRole('button', { name: /View/ });
		await fireEvent.keyDown(trigger, { key: 'ArrowUp' });
		await settle();
		const menu = screen.getByRole('menu');
		expect(menu.className).toContain('dropdown-menu__list--end');
		const all = () => [...screen.getByRole('menu').querySelectorAll('button')];
		expect(document.activeElement).toBe(all()[4]);
		await fireEvent.keyDown(menu, { key: 'ArrowDown' });
		expect(document.activeElement).toBe(all()[0]);
		await fireEvent.keyDown(menu, { key: 'ArrowDown' });
		await fireEvent.keyDown(menu, { key: 'ArrowDown' });
		expect(document.activeElement).toBe(all()[3]);
		await fireEvent.keyDown(menu, { key: 'h' });
		expect(document.activeElement).toBe(all()[1]);
		await fireEvent.keyDown(menu, { key: 'q' });
		await fireEvent.keyDown(menu, { key: 'Enter' });
		await fireEvent.keyDown(menu, { key: 'Escape' });
		expect(screen.queryByRole('menu')).toBeNull();
		expect(document.activeElement).toBe(trigger);

		await fireEvent.keyDown(trigger, { key: 'ArrowDown' });
		await settle();
		expect(document.activeElement).toBe(all()[0]);
		await fireEvent.keyDown(screen.getByRole('menu'), { key: 'Tab' });
		expect(screen.queryByRole('menu')).toBeNull();
		await fireEvent.keyDown(trigger, { key: 'Enter' });

		await fireEvent.click(trigger);
		await settle();
		await fireEvent.pointerDown(screen.getByRole('menu'));
		expect(screen.getByRole('menu')).toBeTruthy();
		await fireEvent.click(trigger);
		expect(screen.queryByRole('menu')).toBeNull();
		await fireEvent.click(trigger);
		await settle();
		await fireEvent.pointerDown(document.body);
		expect(screen.queryByRole('menu')).toBeNull();
	});

	it('draws no check column when nothing is checkable', async () => {
		const { container } = render(DropdownMenu, {
			props: { label: 'Do', groups: [{ items: [{ id: 'a', label: 'A' }] }] }
		});
		await fireEvent.click(screen.getByRole('button', { name: /Do/ }));
		await settle();
		expect(container.querySelector('.dropdown-menu__check')).toBeNull();
	});
});

describe('Menubar', () => {
	const menus = [
		{ id: 'file', label: 'File', items: fileMenu },
		{ id: 'edit', label: 'Edit', items: [{ id: 'undo', label: 'Undo' }] },
		{ id: 'view', label: 'View', items: [{ id: 'zoom', label: 'Zoom' }] }
	];

	it('is one tab stop, moves along the bar, and opens menus from the keyboard', async () => {
		const onEvent = vi.fn();
		render(Harness, {
			props: { which: 'menubar', props: { menus, label: 'Editor' }, onEvent }
		});
		const bar = screen.getByRole('menubar', { name: 'Editor' });
		const tops = [...bar.querySelectorAll<HTMLButtonElement>('.menubar__top')];
		expect(tops.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
		await fireEvent.keyDown(tops[0], { key: 'ArrowRight' });
		expect(document.activeElement).toBe(tops[1]);
		expect(tops.map((t) => t.tabIndex)).toEqual([-1, 0, -1]);
		await fireEvent.keyDown(tops[1], { key: 'End' });
		expect(document.activeElement).toBe(tops[2]);
		await fireEvent.keyDown(tops[2], { key: 'f' });
		expect(document.activeElement).toBe(tops[0]);
		await fireEvent.keyDown(tops[0], { key: 'x' });
		await fireEvent.keyDown(tops[0], { key: 'Shift' });
		await fireEvent.keyDown(tops[0], { key: 'Escape' });

		await fireEvent.keyDown(tops[0], { key: 'ArrowDown' });
		await settle();
		const menu = screen.getByRole('menu', { name: 'File' });
		expect(tops[0].getAttribute('aria-expanded')).toBe('true');
		const items = screen.getAllByRole('menuitem').filter((el) => menu.contains(el));
		expect(document.activeElement).toBe(items[0]);
		await fireEvent.keyDown(menu, { key: 'ArrowUp' });
		expect(document.activeElement).toBe(items[3]);
		await fireEvent.keyDown(menu, { key: 'c' });
		expect(document.activeElement).toBe(items[1]);
		await fireEvent.keyDown(menu, { key: 'z' });
		await fireEvent.keyDown(menu, { key: 'Shift' });
		await fireEvent.keyDown(menu, { key: 'ArrowRight' });
		await settle();
		expect(screen.getByRole('menu', { name: 'Edit' })).toBeTruthy();
		expect(document.activeElement?.textContent).toContain('Undo');
		await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowLeft' });
		await settle();
		expect(screen.getByRole('menu', { name: 'File' })).toBeTruthy();
		await fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
		expect(screen.queryByRole('menu')).toBeNull();
		expect(document.activeElement).toBe(tops[0]);

		await fireEvent.keyDown(tops[0], { key: 'ArrowUp' });
		await settle();
		expect(document.activeElement?.textContent).toContain('Delete');
		await fireEvent.click(document.activeElement!);
		expect(onEvent).toHaveBeenCalledWith('select', { menu: 'file', id: 'delete' });
		expect(document.activeElement).toBe(tops[0]);
	});

	it('opens on click, follows the pointer along the bar, and closes', async () => {
		const onEvent = vi.fn();
		render(Harness, { props: { which: 'menubar', props: { menus }, onEvent } });
		const tops = [...document.querySelectorAll<HTMLButtonElement>('.menubar__top')];
		await fireEvent.mouseEnter(tops[1]);
		expect(screen.queryByRole('menu')).toBeNull();
		await fireEvent.click(tops[0]);
		await settle();
		await fireEvent.mouseEnter(tops[0]);
		await fireEvent.mouseEnter(tops[1]);
		await settle();
		expect(screen.getByRole('menu', { name: 'Edit' })).toBeTruthy();
		await fireEvent.keyDown(tops[1], { key: 'Escape' });
		expect(screen.queryByRole('menu')).toBeNull();

		await fireEvent.click(tops[0]);
		await settle();
		const disabled = screen.getByRole('menuitem', { name: 'Cut' });
		await fireEvent.click(disabled);
		expect(onEvent).not.toHaveBeenCalled();
		await fireEvent.pointerDown(disabled);
		await fireEvent.click(tops[0]);
		expect(screen.queryByRole('menu')).toBeNull();

		await fireEvent.click(tops[2]);
		await settle();
		await fireEvent.keyDown(screen.getByRole('menu'), { key: 'Tab' });
		expect(screen.queryByRole('menu')).toBeNull();
		await fireEvent.click(tops[2]);
		await settle();
		await fireEvent.pointerDown(document.body);
		expect(screen.queryByRole('menu')).toBeNull();
		await fireEvent.pointerDown(document.body);
	});
});

describe('Command', () => {
	const items = [
		{ id: 'profile', label: 'Profile', group: 'Account', shortcut: '⌘P' },
		{ id: 'billing', label: 'Billing', group: 'Account', disabled: true },
		{ id: 'settings', label: 'Settings', group: 'General', keywords: ['preferences'] },
		{ id: 'theme', label: 'Toggle theme' }
	];

	it('is a combobox over grouped options, filtered and ranked as you type', async () => {
		const onEvent = vi.fn();
		render(Harness, {
			props: { which: 'command', props: { items, shortcut: '⌘K' }, onEvent }
		});
		const input = screen.getByRole('combobox', { name: 'Search commands' });
		const listbox = screen.getByRole('listbox');
		expect(input.getAttribute('aria-controls')).toBe(listbox.id);
		expect(screen.getAllByRole('group').map((g) => g.textContent?.trim().split(/\s/)[0])).toEqual([
			'Account',
			'General'
		]);
		expect(screen.getByText('⌘K')).toBeTruthy();
		const options = () => screen.getAllByRole('option');
		expect(options()).toHaveLength(4);
		expect(input.getAttribute('aria-activedescendant')).toBe(options()[0].id);
		expect(options()[0].getAttribute('aria-selected')).toBe('true');

		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		expect(input.getAttribute('aria-activedescendant')).toBe(options()[2].id);
		await fireEvent.keyDown(input, { key: 'ArrowUp' });
		expect(input.getAttribute('aria-activedescendant')).toBe(options()[0].id);
		await fireEvent.keyDown(input, { key: 'Home' });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(onEvent).toHaveBeenLastCalledWith('select', { id: 'profile' });

		await fireEvent.input(input, { target: { value: 'pref' } });
		expect(options().map((o) => o.textContent?.trim())).toEqual(['Settings']);
		expect(screen.getByRole('status').textContent?.trim()).toBe('1 result');
		await fireEvent.input(input, { target: { value: 't' } });
		expect(options().map((o) => o.textContent?.trim())).toEqual(['Toggle theme', 'Settings']);
		expect(screen.getByRole('status').textContent?.trim()).toBe('2 results');

		await fireEvent.input(input, { target: { value: 'zzz' } });
		expect(screen.queryAllByRole('option')).toHaveLength(0);
		expect(input.getAttribute('aria-activedescendant')).toBeNull();
		expect(screen.getByRole('status').textContent?.trim()).toBe('No results found.');
		await fireEvent.keyDown(input, { key: 'Enter' });
		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		expect(onEvent).toHaveBeenCalledTimes(1);
		await fireEvent.keyDown(input, { key: 'Escape' });
		expect((input as HTMLInputElement).value).toBe('');
		await fireEvent.keyDown(input, { key: 'Escape' });
		expect(options()).toHaveLength(4);
	});

	it('picks with the pointer, highlighting on hover and ignoring disabled options', async () => {
		const onEvent = vi.fn();
		render(Harness, { props: { which: 'command', props: { items }, onEvent } });
		const input = screen.getByRole('combobox');
		const [profile, billing, settings] = screen.getAllByRole('option');
		await fireEvent.mouseMove(settings.querySelector('span')!);
		expect(input.getAttribute('aria-activedescendant')).toBe(settings.id);
		await fireEvent.mouseMove(settings);
		await fireEvent.mouseMove(billing);
		expect(input.getAttribute('aria-activedescendant')).toBe(settings.id);
		await fireEvent.mouseMove(screen.getByRole('listbox'));
		await fireEvent.mouseDown(profile);
		await fireEvent.click(billing);
		expect(onEvent).not.toHaveBeenCalled();
		await fireEvent.click(screen.getByRole('listbox'));
		await fireEvent.click(profile);
		expect(onEvent).toHaveBeenCalledWith('select', { id: 'profile' });
	});

	it('renders in a modal when asked, focused on open and closed by a pick', async () => {
		const onEvent = vi.fn();
		render(Harness, {
			props: { which: 'command', open: false, props: { items, dialog: true }, onEvent }
		});
		const dialog = document.querySelector('dialog')!;
		expect(dialog.getAttribute('aria-label')).toBe('Search commands');
		expect(dialog.open).toBe(false);
		render(Command, { props: { items, dialog: true, open: true, query: 'set' } });
		await settle();
		const modal = document.querySelectorAll('dialog')[1];
		expect(modal.open).toBe(true);
		const input = modal.querySelector('input')!;
		expect(document.activeElement).toBe(input);
		expect(input.value).toBe('');
		expect(modal.querySelector('.command__hints')).toBeTruthy();
		await fireEvent.keyDown(input, { key: 'Enter' });
		await tick();
		expect(modal.open).toBe(false);
	});

	it('closes from the backdrop and from a native close, but not from a click inside', async () => {
		render(Harness, {
			props: { which: 'command', open: true, props: { items, dialog: true } }
		});
		await settle();
		const dialog = document.querySelector('dialog')!;
		await fireEvent.click(dialog.querySelector('.command__search')!);
		expect(screen.getByTestId('state').textContent).toBe('true');
		await fireEvent.click(dialog);
		await tick();
		expect(screen.getByTestId('state').textContent).toBe('false');
		expect(dialog.open).toBe(false);
	});

	it('mirrors a native close, and the backdrop rule does nothing inline', async () => {
		render(Harness, {
			props: { which: 'command', open: true, props: { items, dialog: true } }
		});
		await settle();
		const dialog = document.querySelector('dialog')!;
		dialog.dispatchEvent(new Event('close'));
		await tick();
		expect(screen.getByTestId('state').textContent).toBe('false');
		const { container } = render(Command, { props: { items } });
		const host = container.querySelector('.command')!;
		await fireEvent.click(host);
		expect(host.tagName).toBe('DIV');
	});
});
