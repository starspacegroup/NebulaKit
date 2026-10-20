import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Harness from '../../../tests/fixtures/UiKitHarness.svelte';
import {
	Avatar,
	Badge,
	Breadcrumbs,
	Button,
	Checkbox,
	Kbd,
	Menu,
	Pagination,
	Progress,
	RadioGroup,
	Select,
	Skeleton,
	Slider,
	Spinner,
	Switch,
	Table,
	Textarea,
	TextInput,
	Toaster,
	toast
} from './index';

afterEach(() => toast.clear());

describe('Button', () => {
	it('is a button by default and a link with an href', () => {
		const { container, unmount } = render(Button, { props: { variant: 'danger' } });
		expect(container.querySelector('button.btn--danger')?.getAttribute('type')).toBe('button');
		unmount();
		render(Button, { props: { href: '/go' } });
		expect(document.querySelector('a.btn')?.getAttribute('href')).toBe('/go');
	});

	it('falls back to a disabled button when a link is disabled', () => {
		render(Button, { props: { href: '/go', disabled: true } });
		expect(document.querySelector('a')).toBeNull();
		expect((document.querySelector('button') as HTMLButtonElement).disabled).toBe(true);
	});

	it('swallows clicks while loading, and says it is busy', async () => {
		const onClick = vi.fn();
		const { container } = render(Harness, {
			props: { which: 'button', props: { loading: true }, onEvent: onClick }
		});
		const button = container.querySelector('button')!;
		expect(button.getAttribute('aria-busy')).toBe('true');
		await fireEvent.click(button);
		expect(onClick).not.toHaveBeenCalled();
	});

	it('forwards clicks when idle', async () => {
		const onClick = vi.fn();
		const { container } = render(Harness, { props: { which: 'button', onEvent: onClick } });
		await fireEvent.click(container.querySelector('button')!);
		expect(onClick).toHaveBeenCalledOnce();
	});
});

describe('form controls', () => {
	it('TextInput wires its label, hint and error to the input', async () => {
		render(TextInput, {
			props: { label: 'Email', hint: 'Work address', error: 'Required', type: 'email' }
		});
		const input = screen.getByLabelText('Email') as HTMLInputElement;
		expect(input.type).toBe('email');
		expect(input.getAttribute('aria-invalid')).toBe('true');
		const described = input.getAttribute('aria-describedby')!.split(' ');
		expect(described.map((id) => document.getElementById(id)?.textContent)).toEqual([
			'Work address',
			'Required'
		]);
		await fireEvent.input(input, { target: { value: 'a@b.c' } });
		expect(input.value).toBe('a@b.c');
	});

	it('TextInput with no hint or error describes nothing and is valid', () => {
		render(TextInput, { props: { label: 'Name', id: 'my-name', required: true } });
		const input = screen.getByLabelText(/Name/);
		expect(input.id).toBe('my-name');
		expect(input.getAttribute('aria-describedby')).toBeNull();
		expect(input.getAttribute('aria-invalid')).toBeNull();
	});

	it('Textarea counts against its maxlength', async () => {
		render(Textarea, { props: { label: 'Bio', maxlength: 20, value: 'hi' } });
		expect(screen.getByText('2 / 20')).toBeTruthy();
		await fireEvent.input(screen.getByLabelText('Bio'), { target: { value: 'hello' } });
		expect(screen.getByText('5 / 20')).toBeTruthy();
	});

	it('Select lists its options after a placeholder', () => {
		render(Select, {
			props: {
				label: 'Plan',
				placeholder: 'Choose',
				options: [
					{ value: 'a', label: 'Alpha' },
					{ value: 'b', label: 'Beta', disabled: true }
				]
			}
		});
		const options = [...(screen.getByLabelText('Plan') as HTMLSelectElement).options];
		expect(options.map((o) => o.textContent)).toEqual(['Choose', 'Alpha', 'Beta']);
		expect(options[2].disabled).toBe(true);
	});

	it('Checkbox, Switch and RadioGroup are real, labelled inputs', async () => {
		render(Checkbox, { props: { label: 'Agree', hint: 'Required' } });
		const box = screen.getByLabelText(/Agree/) as HTMLInputElement;
		await fireEvent.click(box);
		expect(box.checked).toBe(true);

		render(Switch, { props: { label: 'Dark mode' } });
		const toggle = screen.getByRole('switch', { name: 'Dark mode' }) as HTMLInputElement;
		await fireEvent.click(toggle);
		expect(toggle.checked).toBe(true);

		render(RadioGroup, {
			props: {
				legend: 'Size',
				value: 'm',
				options: [
					{ value: 's', label: 'Small', hint: 'Fits a phone' },
					{ value: 'm', label: 'Medium' },
					{ value: 'l', label: 'Large', disabled: true }
				]
			}
		});
		expect(screen.getByRole('group', { name: 'Size' })).toBeTruthy();
		expect((screen.getByLabelText('Medium') as HTMLInputElement).checked).toBe(true);
		expect((screen.getByLabelText('Large') as HTMLInputElement).disabled).toBe(true);
	});

	it('Slider shows its value with the unit, to sight and to a screen reader', () => {
		render(Slider, { props: { label: 'Volume', value: 30, unit: '%' } });
		expect(screen.getByLabelText('Volume').getAttribute('aria-valuetext')).toBe('30%');
		expect(document.querySelector('output')?.textContent).toBe('30%');
	});
});

describe('display', () => {
	it('Badge, Kbd, Spinner, Skeleton', () => {
		render(Badge, { props: { tone: 'success' } });
		expect(document.querySelector('.badge--success')).toBeTruthy();
		render(Kbd, { props: { keys: ['Ctrl', 'K'] } });
		expect([...document.querySelectorAll('kbd')].map((k) => k.textContent)).toEqual(['Ctrl', 'K']);
		render(Spinner, { props: { label: 'Saving' } });
		expect(screen.getByRole('status').textContent).toContain('Saving');
		const { container } = render(Skeleton, { props: { lines: 3 } });
		const bars = container.querySelectorAll('.skeleton');
		expect(bars).toHaveLength(3);
		expect((bars[2] as HTMLElement).style.width).toBe('60%');
	});

	it('Avatar falls back to initials when the image fails', async () => {
		const { container } = render(Avatar, { props: { name: 'Ada Lovelace', src: '/x.png' } });
		expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toBeTruthy();
		await fireEvent.error(container.querySelector('img')!);
		expect(container.textContent).toContain('AL');
	});

	it('Progress reports its value, or none when indeterminate', () => {
		render(Progress, { props: { value: 3, max: 4, label: 'Upload' } });
		const bar = screen.getByRole('progressbar', { name: 'Upload' });
		expect(bar.getAttribute('aria-valuenow')).toBe('3');
		expect(screen.getByText('75%')).toBeTruthy();
		render(Progress, { props: { label: 'Working' } });
		const busy = screen.getByRole('progressbar', { name: 'Working' });
		expect(busy.getAttribute('aria-valuenow')).toBeNull();
		expect(busy.querySelector('.progress__bar--indeterminate')).toBeTruthy();
	});

	it('Card renders a title at its level, a footer, and a whole-card link', () => {
		render(Harness, { props: { which: 'card' } });
		expect(screen.getByRole('heading', { level: 2, name: 'Plan' })).toBeTruthy();
		expect(document.querySelector('.card__footer button')).toBeTruthy();
		expect(screen.getByRole('link').getAttribute('href')).toBe('/somewhere');
	});

	it('EmptyState shows its title, description and actions', () => {
		render(Harness, { props: { which: 'empty' } });
		expect(screen.getByText('No projects')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'New project' })).toBeTruthy();
	});
});

describe('feedback', () => {
	it('Alert picks alert or status by tone, and can be dismissed', async () => {
		render(Harness, { props: { which: 'alert' } });
		expect(screen.getByRole('alert').textContent).toContain('Could not save.');
		expect(screen.getByRole('status').textContent).toContain('Saved.');
		await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('Toaster shows raised toasts and dismisses them', async () => {
		render(Toaster);
		toast.success('Saved', 0);
		await tick();
		expect(screen.getByText('Saved')).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
		// Svelte 4 keeps the element through its exit transition.
		await waitFor(() => expect(screen.queryByText('Saved')).toBeNull());
	});
});

describe('navigation', () => {
	it('Tabs select on click and move with arrows, skipping disabled tabs', async () => {
		render(Harness, { props: { which: 'tabs' } });
		const tabs = screen.getAllByRole('tab');
		expect(tabs[0].getAttribute('aria-selected')).toBe('true');
		expect(tabs[0].tabIndex).toBe(0);
		expect(tabs[2].tabIndex).toBe(-1);
		await fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
		expect(screen.getByTestId('panel').textContent).toBe('Panel three');
		expect(document.activeElement).toBe(tabs[2]);
		await fireEvent.keyDown(tabs[2], { key: 'Enter' });
		await fireEvent.click(tabs[0]);
		expect(screen.getByTestId('panel').textContent).toBe('Panel one');
		const panel = screen.getByRole('tabpanel');
		expect(panel.getAttribute('aria-labelledby')).toBe(tabs[0].id);
	});

	it('Accordion is details/summary, grouped when exclusive', () => {
		const { container } = render(Harness, { props: { which: 'accordion' } });
		const details = container.querySelectorAll('details');
		expect(details).toHaveLength(2);
		expect(details[0].open).toBe(true);
		expect(details[0].getAttribute('name')).toBe(details[1].getAttribute('name'));
		expect(details[0].getAttribute('name')).toBeTruthy();
	});

	it('Breadcrumbs link every step but the current page', () => {
		render(Breadcrumbs, {
			props: {
				items: [{ label: 'Home', href: '/' }, { label: 'Docs', href: '/docs' }, { label: 'Tabs' }]
			}
		});
		expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(['Home', 'Docs']);
		expect(screen.getByText('Tabs').getAttribute('aria-current')).toBe('page');
	});

	it('Pagination marks the current page, moves, and stops at the ends', async () => {
		const onChange = vi.fn();
		render(Harness, {
			props: {
				which: 'pagination',
				onEvent: (_: string, detail: { page: number }) => onChange(detail.page)
			}
		});
		expect(screen.getByRole('button', { name: 'Page 1' }).getAttribute('aria-current')).toBe(
			'page'
		);
		await fireEvent.click(screen.getByRole('button', { name: /Previous/ }));
		expect(onChange).not.toHaveBeenCalled();
		await fireEvent.click(screen.getByRole('button', { name: /Next/ }));
		expect(onChange).toHaveBeenLastCalledWith(2);
		await fireEvent.keyDown(screen.getByRole('button', { name: 'Page 20' }), { key: 'Enter' });
		expect(onChange).toHaveBeenLastCalledWith(20);
		await fireEvent.keyDown(screen.getByRole('button', { name: /Previous/ }), { key: 'Enter' });
		expect(onChange).toHaveBeenLastCalledWith(19);
		await fireEvent.keyDown(screen.getByRole('button', { name: /Next/ }), { key: 'Enter' });
		expect(onChange).toHaveBeenLastCalledWith(20);
	});

	it('Pagination renders real links when given an href builder, and nothing for one page', () => {
		const { unmount } = render(Pagination, {
			props: { page: 2, total: 3, href: (p: number) => `?page=${p}` }
		});
		expect(screen.getByRole('link', { name: 'Page 3' }).getAttribute('href')).toBe('?page=3');
		expect(screen.getByRole('link', { name: /Previous/ }).getAttribute('href')).toBe('?page=1');
		unmount();
		const { container } = render(Pagination, { props: { page: 1, total: 1 } });
		expect(container.querySelector('nav')).toBeNull();
	});

	it('Menu opens to its first item, moves with arrows, picks, and closes on Escape', async () => {
		const onSelect = vi.fn();
		render(Harness, {
			props: {
				which: 'menu',
				props: {
					items: [
						{ id: 'edit', label: 'Edit' },
						{ id: 'archive', label: 'Archive', disabled: true },
						{ id: 'delete', label: 'Delete', danger: true }
					]
				},
				onEvent: (_: string, detail: { id: string }) => onSelect(detail.id)
			}
		});
		const trigger = screen.getByRole('button', { name: /Actions/ });
		await fireEvent.click(trigger);
		await tick();
		const items = screen.getAllByRole('menuitem');
		expect(trigger.getAttribute('aria-expanded')).toBe('true');
		expect(document.activeElement).toBe(items[0]);
		await fireEvent.keyDown(items[0], { key: 'ArrowDown' });
		expect(document.activeElement).toBe(items[2]);
		await fireEvent.keyDown(items[2], { key: 'x' });
		await fireEvent.click(items[1]);
		expect(onSelect).not.toHaveBeenCalled();
		await fireEvent.click(items[2]);
		expect(onSelect).toHaveBeenCalledWith('delete');
		expect(screen.queryByRole('menu')).toBeNull();
		expect(document.activeElement).toBe(trigger);

		await fireEvent.keyDown(trigger, { key: 'ArrowUp' });
		await tick();
		expect(document.activeElement).toBe(screen.getAllByRole('menuitem')[2]);
		await fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
		expect(screen.queryByRole('menu')).toBeNull();

		await fireEvent.keyDown(trigger, { key: 'ArrowDown' });
		await tick();
		await fireEvent.keyDown(screen.getByRole('menu'), { key: 'Tab' });
		expect(screen.queryByRole('menu')).toBeNull();

		await fireEvent.click(trigger);
		await tick();
		await fireEvent.pointerDown(document.body);
		expect(screen.queryByRole('menu')).toBeNull();
		await fireEvent.keyDown(trigger, { key: 'Enter' });
	});
});

describe('overlays', () => {
	it('Dialog opens and closes with its bound state', async () => {
		render(Harness, { props: { which: 'dialog' } });
		const dialog = document.querySelector('dialog')!;
		expect(dialog.open).toBe(false);
		await fireEvent.click(screen.getByRole('button', { name: 'Open' }));
		await tick();
		expect(dialog.open).toBe(true);
		expect(screen.getByRole('heading', { name: 'Delete file?' }).id).toBe(
			dialog.getAttribute('aria-labelledby')
		);
		await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		await tick();
		dialog.dispatchEvent(new Event('close'));
		await tick();
		expect(screen.getByTestId('state').textContent).toBe('false');
		await fireEvent.click(screen.getByRole('button', { name: 'Open' }));
		await tick();
		await fireEvent.click(dialog);
		await tick();
		expect(screen.getByTestId('state').textContent).toBe('false');
	});

	it('Tooltip describes the control it wraps, and Escape hides it', async () => {
		const { container } = render(Harness, { props: { which: 'tooltip' } });
		const button = screen.getByRole('button', { name: 'Copy' });
		const tip = screen.getByRole('tooltip');
		expect(button.getAttribute('aria-describedby')).toBe(tip.id);
		const wrap = container.querySelector('.tooltip')!;
		await fireEvent.keyDown(button, { key: 'Escape' });
		expect(wrap.classList.contains('tooltip--hidden')).toBe(true);
		await fireEvent.mouseLeave(wrap);
		expect(wrap.classList.contains('tooltip--hidden')).toBe(false);
		await fireEvent.keyDown(button, { key: 'a' });
		expect(wrap.classList.contains('tooltip--hidden')).toBe(false);
	});
});

describe('Table', () => {
	const columns = [
		{ key: 'name', label: 'Name', sortable: true },
		{ key: 'size', label: 'Size', sortable: true, align: 'end' as const },
		{ key: 'kind', label: 'Kind' }
	];
	const rows = [
		{ name: 'b', size: 2, kind: 'x' },
		{ name: 'a', size: 10, kind: 'y' }
	];

	it('sorts by a header and announces the order', async () => {
		render(Table, { props: { columns, rows, caption: 'Files' } });
		const names = () =>
			[...document.querySelectorAll('tbody tr td:first-child')].map((td) => td.textContent);
		expect(names()).toEqual(['b', 'a']);
		await fireEvent.click(screen.getByRole('button', { name: /Name/ }));
		expect(names()).toEqual(['a', 'b']);
		expect(screen.getByRole('columnheader', { name: /Name/ }).getAttribute('aria-sort')).toBe(
			'ascending'
		);
		await fireEvent.click(screen.getByRole('button', { name: /Name/ }));
		expect(names()).toEqual(['b', 'a']);
		expect(screen.getByRole('region', { name: 'Files' })).toBeTruthy();
	});

	it('says so when there are no rows', () => {
		render(Table, { props: { columns, rows: [], empty: 'No files' } });
		expect(screen.getByText('No files')).toBeTruthy();
	});
});
