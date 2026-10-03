import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import Harness from '../../../tests/fixtures/UiKitFormHarness.svelte';
import InputOTP from './InputOTP.svelte';

type Which =
	| 'combobox'
	| 'calendar'
	| 'datepicker'
	| 'otp'
	| 'group'
	| 'number'
	| 'toggle'
	| 'toggle-group'
	| 'tags'
	| 'files';

function mount(which: Which, extra: Record<string, unknown> = {}) {
	const onEvent = vi.fn();
	const result = render(Harness, { props: { which, onEvent, ...extra } });
	const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}');
	return { ...result, onEvent, state };
}

const key = (el: Element, k: string, init: KeyboardEventInit = {}) =>
	fireEvent.keyDown(el, { key: k, ...init });

describe('Combobox', () => {
	it('filters as you type and picks with the keyboard', async () => {
		const { onEvent, state } = mount('combobox');
		const input = screen.getByRole('combobox', { name: 'City' }) as HTMLInputElement;
		expect(input.getAttribute('aria-expanded')).toBe('false');
		expect(input.getAttribute('aria-autocomplete')).toBe('list');

		await fireEvent.input(input, { target: { value: 'b' } });
		expect(input.getAttribute('aria-expanded')).toBe('true');
		const listbox = screen.getByRole('listbox');
		expect(input.getAttribute('aria-controls')).toBe(listbox.id);
		expect(screen.getAllByRole('option').map((o) => o.textContent?.trim())).toEqual([
			'Berlin',
			'Lisbon'
		]);
		expect(screen.getByRole('status').textContent).toBe('2 results');

		await key(input, 'ArrowDown');
		const first = screen.getAllByRole('option')[0];
		expect(input.getAttribute('aria-activedescendant')).toBe(first.id);
		await key(input, 'Enter');
		expect(state().value).toBe('ber');
		expect(onEvent).toHaveBeenCalledWith('change', { value: 'ber' });
		expect(input.value).toBe('Berlin');
		expect(input.getAttribute('aria-expanded')).toBe('false');
	});

	it('skips disabled options and wraps', async () => {
		mount('combobox');
		const input = screen.getByRole('combobox');
		await fireEvent.input(input, { target: { value: 'l' } });
		// By id, not DOM order: happy-dom 12 mis-lists nodes a keyed each has moved.
		const ids = [0, 1, 2].map((i) => `${input.getAttribute('aria-controls')}-${i}`);
		const london = document.getElementById(ids[1])!;
		expect(london.textContent).toContain('London');
		expect(london.getAttribute('aria-disabled')).toBe('true');
		await key(input, 'ArrowUp');
		expect(input.getAttribute('aria-activedescendant')).toBe(ids[2]);
		await key(input, 'ArrowDown');
		expect(input.getAttribute('aria-activedescendant')).toBe(ids[0]);
		await key(input, 'ArrowDown');
		expect(input.getAttribute('aria-activedescendant')).toBe(ids[2]);
	});

	it('says when nothing matches, and Escape closes then clears', async () => {
		const { state } = mount('combobox', { value: 'lis' });
		const input = screen.getByRole('combobox') as HTMLInputElement;
		expect(input.value).toBe('Lisbon');
		await fireEvent.input(input, { target: { value: 'xyz' } });
		expect(screen.getByText('No results', { selector: 'p' })).toBeTruthy();
		await key(input, 'Enter');
		expect(state().value).toBe('lis');
		await key(input, 'Escape');
		expect(input.getAttribute('aria-expanded')).toBe('false');
		expect(input.value).toBe('Lisbon');
		await key(input, 'Escape');
		expect(input.value).toBe('');
		expect(state().value).toBe('');
	});

	it('opens with Alt+ArrowDown without highlighting, picks by click, and the only match on Enter', async () => {
		const { state } = mount('combobox');
		const input = screen.getByRole('combobox') as HTMLInputElement;
		await key(input, 'Enter');
		await key(input, 'ArrowDown', { altKey: true });
		expect(input.getAttribute('aria-expanded')).toBe('true');
		expect(input.getAttribute('aria-activedescendant')).toBeNull();
		await fireEvent.click(screen.getByRole('option', { name: /Zürich/ }));
		expect(state().value).toBe('zur');
		await fireEvent.click(screen.getByRole('button', { name: 'Show options' }));
		expect(input.getAttribute('aria-expanded')).toBe('true');
		await fireEvent.click(screen.getByRole('option', { name: /London/ }));
		expect(state().value).toBe('zur');
		await fireEvent.click(screen.getByRole('button', { name: 'Show options' }));
		expect(input.getAttribute('aria-expanded')).toBe('false');
		await fireEvent.input(input, { target: { value: 'ber' } });
		await key(input, 'Enter');
		expect(state().value).toBe('ber');
		await key(input, 'ArrowDown');
		expect(input.getAttribute('aria-expanded')).toBe('true');
		await key(input, 'Tab');
		expect(input.getAttribute('aria-expanded')).toBe('false');
	});

	it('restores the chosen label on blur', async () => {
		mount('combobox', { value: 'ber' });
		const input = screen.getByRole('combobox') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: 'Lis' } });
		await fireEvent.blur(input, {
			relatedTarget: screen.getByRole('button', { name: 'Elsewhere' })
		});
		expect(input.value).toBe('Berlin');
		expect(input.getAttribute('aria-expanded')).toBe('false');
	});

	it('creates a new value when creatable', async () => {
		const { onEvent, state } = mount('combobox', { props: { creatable: true } });
		const input = screen.getByRole('combobox');
		await fireEvent.input(input, { target: { value: 'Paris ' } });
		expect(screen.getByRole('option', { name: /Create “Paris”/ })).toBeTruthy();
		await key(input, 'Enter');
		expect(onEvent).toHaveBeenCalledWith('create', { value: 'Paris' });
		expect(state().value).toBe('Paris');

		await fireEvent.input(input, { target: { value: 'Oslo' } });
		await fireEvent.click(screen.getByRole('option', { name: /Create “Oslo”/ }));
		expect(state().value).toBe('Oslo');
	});

	it('wires hint and error like TextInput', () => {
		mount('combobox', { props: { hint: 'Where you live', error: 'Pick one', required: true } });
		const input = screen.getByRole('combobox');
		expect(input.getAttribute('aria-invalid')).toBe('true');
		const described = input.getAttribute('aria-describedby')!.split(' ');
		expect(described.map((id) => document.getElementById(id)?.textContent)).toEqual([
			'Where you live',
			'Pick one'
		]);
	});
});

describe('Calendar', () => {
	const focusedDate = () => (document.activeElement as HTMLElement).getAttribute('data-date');
	const cell = (date: string) => document.querySelector(`[data-date="${date}"]`) as HTMLElement;

	it('is a labelled grid with today as the tab stop', () => {
		mount('calendar');
		const grid = screen.getByRole('grid', { name: 'Choose a date, January 2024' });
		expect(grid.querySelectorAll('th')[0].textContent).toBe('Sun');
		expect(grid.querySelectorAll('th')[0].getAttribute('abbr')).toBe('Sunday');
		const today = cell('2024-01-15');
		expect(today.getAttribute('tabindex')).toBe('0');
		expect(today.getAttribute('aria-current')).toBe('date');
		expect(today.getAttribute('aria-label')).toBe('Monday, January 15, 2024');
		expect(grid.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
	});

	it('moves by day, week, month and year from the keyboard', async () => {
		mount('calendar');
		const grid = screen.getByRole('grid');
		await key(cell('2024-01-15'), 'ArrowRight');
		await tick();
		expect(focusedDate()).toBe('2024-01-16');
		await key(grid, 'ArrowDown');
		await tick();
		expect(focusedDate()).toBe('2024-01-23');
		await key(grid, 'PageDown');
		await tick();
		expect(focusedDate()).toBe('2024-02-23');
		expect(screen.getByRole('grid').getAttribute('aria-label')).toBe(
			'Choose a date, February 2024'
		);
		await key(grid, 'PageDown', { shiftKey: true });
		await tick();
		expect(focusedDate()).toBe('2025-02-23');
		await key(grid, 'Home');
		await tick();
		expect(focusedDate()).toBe('2025-02-23');
		await key(grid, 'End');
		await tick();
		expect(focusedDate()).toBe('2025-03-01');
		await key(grid, 'x');
		expect(focusedDate()).toBe('2025-03-01');
	});

	it('picks with Enter, Space or a click', async () => {
		const { onEvent, state } = mount('calendar');
		await key(cell('2024-01-15'), 'Enter');
		expect(state().value).toBe('2024-01-15');
		expect(onEvent).toHaveBeenCalledWith('change', { value: '2024-01-15' });
		expect(cell('2024-01-15').getAttribute('aria-selected')).toBe('true');
		await fireEvent.click(cell('2024-01-20'));
		expect(state().value).toBe('2024-01-20');
		await key(cell('2024-01-20'), 'ArrowLeft');
		await key(screen.getByRole('grid'), ' ');
		expect(state().value).toBe('2024-01-19');
		await fireEvent.click(screen.getByRole('grid').querySelector('thead')!);
		expect(state().value).toBe('2024-01-19');
	});

	it('honours min, max and isDisabled', async () => {
		const weekends = (_iso: string, d: { day: number }) => d.day === 20 || d.day === 21;
		const { state } = mount('calendar', {
			props: { min: '2024-01-14', max: '2024-01-25', isDisabled: weekends }
		});
		expect(cell('2024-01-13').getAttribute('aria-disabled')).toBe('true');
		expect(cell('2024-01-26').getAttribute('aria-disabled')).toBe('true');
		expect(cell('2024-01-20').getAttribute('aria-disabled')).toBe('true');
		expect(cell('2024-01-22').getAttribute('aria-disabled')).toBeNull();
		await key(cell('2024-01-15'), 'PageUp');
		await tick();
		expect(focusedDate()).toBe('2024-01-14');
		await fireEvent.click(cell('2024-01-20'));
		expect(state().value).toBe('');
	});

	it('follows the week start and locale, and steps months with its buttons', async () => {
		mount('calendar', { props: { weekStartsOn: 1, locale: 'de-DE' } });
		expect(document.querySelectorAll('th')[0].textContent).toMatch(/^Mo/);
		await fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
		expect(screen.getByRole('grid').getAttribute('aria-label')).toBe('Choose a date, Februar 2024');
		await fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
		expect(screen.getByRole('grid').getAttribute('aria-label')).toContain('Dezember 2023');
	});

	it('opens on its value, follows a new one, and exposes focus()', async () => {
		mount('calendar', { value: '2023-07-04' });
		expect(cell('2023-07-04').getAttribute('tabindex')).toBe('0');
		await fireEvent.click(screen.getByRole('button', { name: 'Set September' }));
		expect(cell('2023-09-01').getAttribute('aria-selected')).toBe('true');
		await fireEvent.click(screen.getByRole('button', { name: 'Focus calendar' }));
		await waitFor(() => expect(focusedDate()).toBe('2023-09-01'));
	});
});

describe('DatePicker', () => {
	it('opens a calendar on the day, picks, closes and returns focus', async () => {
		const { onEvent, state } = mount('datepicker');
		const button = screen.getByRole('button', { name: 'Choose date' });
		expect(button.getAttribute('aria-haspopup')).toBe('dialog');
		expect(button.getAttribute('aria-expanded')).toBe('false');
		await fireEvent.click(button);
		const dialog = screen.getByRole('dialog', { name: 'Start date' });
		expect(button.getAttribute('aria-controls')).toBe(dialog.id);
		await waitFor(() =>
			expect((document.activeElement as HTMLElement).getAttribute('data-date')).toBe('2024-01-15')
		);
		await key(document.activeElement!, 'ArrowRight');
		await tick();
		await key(document.activeElement!, 'Enter');
		expect(state().value).toBe('2024-01-16');
		expect(onEvent).toHaveBeenCalledWith('change', { value: '2024-01-16' });
		expect(screen.queryByRole('dialog')).toBeNull();
		const changed = screen.getByRole('button', { name: 'Change date, Tuesday, January 16, 2024' });
		expect(document.activeElement).toBe(changed);
		expect((screen.getByLabelText('Start date') as HTMLInputElement).value).toBe('2024-01-16');
	});

	it('closes on Escape with focus back on the button, and on a click outside', async () => {
		mount('datepicker');
		const button = screen.getByRole('button', { name: 'Choose date' });
		await fireEvent.click(button);
		await key(screen.getByRole('grid'), 'Escape');
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(document.activeElement).toBe(button);
		await fireEvent.click(button);
		await fireEvent.click(button);
		expect(screen.queryByRole('dialog')).toBeNull();
		await fireEvent.click(button);
		await key(screen.getByRole('dialog'), 'a');
		expect(screen.getByRole('dialog')).toBeTruthy();
		await fireEvent.pointerDown(screen.getByRole('dialog'));
		expect(screen.getByRole('dialog')).toBeTruthy();
		await fireEvent.pointerDown(document.body);
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('closes when focus leaves it', async () => {
		mount('datepicker');
		await fireEvent.click(screen.getByRole('button', { name: 'Choose date' }));
		const grid = screen.getByRole('grid');
		await fireEvent.focusOut(grid, { relatedTarget: null });
		expect(screen.getByRole('dialog')).toBeTruthy();
		await fireEvent.focusOut(grid, {
			relatedTarget: screen.getByRole('button', { name: 'Elsewhere' })
		});
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('parses typed dates and refuses bad or disallowed ones', async () => {
		const { state } = mount('datepicker', { props: { max: '2024-12-31' } });
		const input = screen.getByLabelText('Start date') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: '2024-02-30' } });
		await fireEvent.change(input);
		expect(input.getAttribute('aria-invalid')).toBe('true');
		expect(screen.getByText('Enter a date as yyyy-mm-dd.')).toBeTruthy();
		expect(state().value).toBe('');
		await fireEvent.input(input, { target: { value: '2025-01-01' } });
		await fireEvent.change(input);
		expect(state().value).toBe('');
		await fireEvent.input(input, { target: { value: ' 2024-03-05 ' } });
		await fireEvent.change(input);
		expect(state().value).toBe('2024-03-05');
		expect(input.getAttribute('aria-invalid')).toBeNull();
		await fireEvent.input(input, { target: { value: '' } });
		await fireEvent.change(input);
		expect(state().value).toBe('');
	});

	it('runs isDisabled on typed dates', async () => {
		const { state } = mount('datepicker', {
			props: { isDisabled: (iso: string) => iso.endsWith('-13') }
		});
		const input = screen.getByLabelText('Start date');
		await fireEvent.input(input, { target: { value: '2024-03-13' } });
		await fireEvent.change(input);
		expect(state().value).toBe('');
		await fireEvent.input(input, { target: { value: '2024-03-14' } });
		await fireEvent.change(input);
		expect(state().value).toBe('2024-03-14');
	});
});

describe('InputOTP', () => {
	const cells = () => screen.getAllByRole('textbox') as HTMLInputElement[];

	it('is a labelled group of cells, the first offering the one-time code', () => {
		mount('otp');
		expect(screen.getByRole('group', { name: 'One-time code' })).toBeTruthy();
		expect(cells()).toHaveLength(6);
		expect(cells()[0].getAttribute('autocomplete')).toBe('one-time-code');
		expect(cells()[1].getAttribute('autocomplete')).toBe('off');
		expect(cells()[0].getAttribute('inputmode')).toBe('numeric');
		expect(cells()[2].getAttribute('aria-label')).toBe('Digit 3 of 6');
	});

	it('advances as you type and rejects what does not fit', async () => {
		const { state } = mount('otp');
		await fireEvent.input(cells()[0], { target: { value: '4' } });
		await tick();
		expect(state().value).toBe('4');
		expect(document.activeElement).toBe(cells()[1]);
		await fireEvent.input(cells()[1], { target: { value: 'x' } });
		await tick();
		expect(state().value).toBe('4');
		expect(cells()[1].value).toBe('');
		await fireEvent.input(cells()[3], { target: { value: '7' } });
		await tick();
		expect(state().value).toBe('47');
		await fireEvent.input(cells()[1], { target: { value: '79' } });
		await tick();
		expect(state().value).toBe('49');
		await fireEvent.input(cells()[1], { target: { value: '' } });
		await tick();
		expect(state().value).toBe('4');
	});

	it('fills every cell on paste and reports the code once', async () => {
		const { onEvent, state } = mount('otp');
		await fireEvent.paste(cells()[2], { clipboardData: { getData: () => '123 456' } });
		await tick();
		expect(state().value).toBe('123456');
		expect(onEvent).toHaveBeenCalledWith('complete', { value: '123456' });
		await fireEvent.paste(cells()[5], { clipboardData: { getData: () => 'x' } });
		await tick();
		expect(onEvent).toHaveBeenCalledTimes(1);
		await fireEvent.paste(cells()[5], {});
		expect(state().value).toBe('123456');
	});

	it('steps back on Backspace and moves with arrows, Home and End', async () => {
		const { state } = mount('otp', { value: '123' });
		await key(cells()[2], 'Backspace');
		await tick();
		expect(state().value).toBe('12');
		expect(document.activeElement).toBe(cells()[2]);
		await key(cells()[2], 'Backspace');
		await tick();
		expect(state().value).toBe('1');
		expect(document.activeElement).toBe(cells()[1]);
		await key(cells()[0], 'ArrowRight');
		expect(document.activeElement).toBe(cells()[1]);
		await key(cells()[1], 'ArrowRight');
		expect(document.activeElement).toBe(cells()[1]);
		await key(cells()[1], 'ArrowLeft');
		expect(document.activeElement).toBe(cells()[0]);
		await key(cells()[0], 'End');
		expect(document.activeElement).toBe(cells()[1]);
		await key(cells()[1], 'Home');
		expect(document.activeElement).toBe(cells()[0]);
		await key(cells()[0], 'Delete');
		await tick();
		expect(state().value).toBe('');
		await key(cells()[0], 'Backspace');
		expect(state().value).toBe('');
		await key(cells()[0], 'a');
		await fireEvent.focus(cells()[4]);
		expect(document.activeElement).toBe(cells()[0]);
		await fireEvent.focus(cells()[0]);
	});

	it('takes letters in alphanumeric mode, with a hint and an error', () => {
		render(InputOTP, {
			props: { mode: 'alphanumeric', length: 4, hint: 'Check your email', error: 'Expired' }
		});
		const group = screen.getByRole('group');
		expect(group.getAttribute('aria-describedby')!.split(' ')).toHaveLength(2);
		expect(cells()).toHaveLength(4);
		expect(cells()[0].getAttribute('aria-label')).toBe('Character 1 of 4');
		expect(cells()[0].getAttribute('aria-invalid')).toBe('true');
	});

	it('upper-cases letters as they are typed', async () => {
		const { state } = mount('otp', { props: { mode: 'alphanumeric' } });
		await fireEvent.input(cells()[0], { target: { value: 'k' } });
		await tick();
		expect(state().value).toBe('K');
	});
});

describe('InputGroup', () => {
	it('joins addons to a labelled input and reads the text addons with it', async () => {
		const { state } = mount('group', { props: { hint: 'Your site' } });
		const input = screen.getByLabelText('Website') as HTMLInputElement;
		const described = input.getAttribute('aria-describedby')!.split(' ');
		expect(described.map((id) => document.getElementById(id)?.textContent)).toEqual([
			'https://',
			'.com',
			'Your site'
		]);
		expect(screen.getByTestId('icon')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Check' })).toBeTruthy();
		await fireEvent.input(input, { target: { value: 'example' } });
		expect(state().value).toBe('example');
	});

	it('marks an error and goes without text addons', () => {
		mount('group', { props: { prefix: '', suffix: '', error: 'Taken' } });
		const input = screen.getByLabelText('Website');
		expect(input.getAttribute('aria-invalid')).toBe('true');
		expect(input.getAttribute('aria-describedby')!.split(' ')).toHaveLength(1);
	});
});

describe('NumberInput', () => {
	it('is a spinbutton that steps with keys and clamps', async () => {
		const { onEvent, state } = mount('number', {
			value: 2,
			props: { min: 0, max: 30, unit: 'people' }
		});
		const spin = screen.getByRole('spinbutton', { name: 'Guests' });
		expect(spin.getAttribute('aria-valuenow')).toBe('2');
		expect(spin.getAttribute('aria-valuemin')).toBe('0');
		expect(spin.getAttribute('aria-valuemax')).toBe('30');
		expect(spin.getAttribute('aria-valuetext')).toBe('2 people');
		await key(spin, 'ArrowUp');
		expect(state().value).toBe(3);
		expect(onEvent).toHaveBeenCalledWith('change', { value: 3 });
		await key(spin, 'PageUp');
		expect(state().value).toBe(13);
		await key(spin, 'PageUp');
		await key(spin, 'PageUp');
		expect(state().value).toBe(30);
		expect(
			(screen.getByRole('button', { name: 'Increase Guests' }) as HTMLButtonElement).disabled
		).toBe(true);
		await key(spin, 'PageDown');
		expect(state().value).toBe(20);
		await key(spin, 'ArrowDown');
		expect(state().value).toBe(19);
		await key(spin, 'Home');
		expect(state().value).toBe(0);
		await key(spin, 'End');
		expect(state().value).toBe(30);
		await key(spin, 'x');
		expect(state().value).toBe(30);
	});

	it('snaps typed numbers on blur or Enter, and empties to null', async () => {
		const { state } = mount('number', { value: 1, props: { step: 0.5, max: 10 } });
		const spin = screen.getByRole('spinbutton') as HTMLInputElement;
		await fireEvent.input(spin, { target: { value: '2.3' } });
		await fireEvent.blur(spin);
		expect(state().value).toBe(2.5);
		expect(spin.value).toBe('2.5');
		await fireEvent.input(spin, { target: { value: '99' } });
		await key(spin, 'Enter');
		expect(state().value).toBe(10);
		await fireEvent.input(spin, { target: { value: '4' } });
		await key(spin, 'ArrowUp');
		expect(state().value).toBe(4.5);
		await fireEvent.input(spin, { target: { value: '' } });
		await fireEvent.blur(spin);
		expect(state().value).toBeNull();
		expect(spin.getAttribute('aria-valuenow')).toBeNull();
		await key(spin, 'Home');
		await key(spin, 'End');
		expect(state().value).toBe(10);
	});

	it('steps with its buttons, and not when disabled', async () => {
		const { state } = mount('number', { value: null, props: { step: 0.1 } });
		await fireEvent.click(screen.getByRole('button', { name: 'Increase Guests' }));
		expect(state().value).toBe(0.1);
		await fireEvent.click(screen.getByRole('button', { name: 'Increase Guests' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Increase Guests' }));
		expect(state().value).toBe(0.3);
		await fireEvent.click(screen.getByRole('button', { name: 'Decrease Guests' }));
		expect(state().value).toBe(0.2);
		const spin = screen.getByRole('spinbutton');
		await fireEvent.input(spin, { target: { value: 'abc' } });
		await key(spin, 'ArrowUp');
		expect(state().value).toBe(0.3);
	});

	it('ignores keys while disabled', async () => {
		const { state } = mount('number', { value: 5, props: { disabled: true, bigStep: 2 } });
		await key(screen.getByRole('spinbutton'), 'ArrowUp');
		expect(state().value).toBe(5);
	});
});

describe('Toggle', () => {
	it('flips aria-pressed and reports it', async () => {
		const { onEvent, state } = mount('toggle', { props: { size: 'sm', variant: 'outline' } });
		const button = screen.getByRole('button', { name: 'Bold' });
		expect(button.getAttribute('aria-pressed')).toBe('false');
		expect(button.classList.contains('toggle--sm')).toBe(true);
		await fireEvent.click(button);
		expect(button.getAttribute('aria-pressed')).toBe('true');
		expect(state().pressed).toBe(true);
		expect(onEvent).toHaveBeenCalledWith('change', { pressed: true });
	});

	it('takes an accessible name for icon-only use', () => {
		mount('toggle', { props: { label: 'Pin' } });
		expect(screen.getByRole('button', { name: 'Pin' })).toBeTruthy();
	});
});

describe('ToggleGroup', () => {
	it('single is a radio group: arrows move and choose, skipping disabled', async () => {
		const { onEvent, state } = mount('toggle-group', { value: 'b' });
		expect(screen.getByRole('radiogroup', { name: 'Text style' })).toBeTruthy();
		const radios = screen.getAllByRole('radio');
		expect(radios[0].getAttribute('aria-checked')).toBe('true');
		expect(radios.map((r) => r.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1']);
		await key(radios[0], 'ArrowRight');
		await tick();
		expect(state().value).toBe('u');
		expect(document.activeElement).toBe(radios[2]);
		expect(onEvent).toHaveBeenCalledWith('change', { value: 'u' });
		await key(radios[2], 'ArrowDown');
		await tick();
		expect(state().value).toBe('s');
		await key(radios[3], 'Home');
		await tick();
		expect(state().value).toBe('b');
		await key(radios[0], 'ArrowUp');
		await tick();
		expect(state().value).toBe('s');
		await key(radios[3], 'a');
		await fireEvent.click(radios[3]);
		expect(onEvent).toHaveBeenCalledTimes(4);
		await fireEvent.click(radios[1]);
		expect(state().value).toBe('s');
	});

	it('single with nothing chosen tabs to the first usable item', () => {
		mount('toggle-group', { value: '' });
		expect(screen.getAllByRole('radio')[0].getAttribute('tabindex')).toBe('0');
	});

	it('multiple uses aria-pressed, arrows only move', async () => {
		const { state } = mount('toggle-group', {
			value: [],
			props: { type: 'multiple', iconOnly: true, size: 'sm', variant: 'default' }
		});
		expect(screen.getByRole('group', { name: 'Text style' })).toBeTruthy();
		const bold = screen.getByRole('button', { name: 'Bold' });
		const underline = screen.getByRole('button', { name: 'Underline' });
		expect(bold.getAttribute('aria-pressed')).toBe('false');
		await fireEvent.click(underline);
		await fireEvent.click(bold);
		expect(state().value).toEqual(['b', 'u']);
		await key(bold, 'ArrowRight');
		await tick();
		expect(document.activeElement).toBe(underline);
		expect(underline.getAttribute('tabindex')).toBe('0');
		expect(state().value).toEqual(['b', 'u']);
		await fireEvent.click(underline);
		expect(state().value).toEqual(['b']);
	});
});

describe('TagInput', () => {
	const field = () => screen.getByLabelText('Topics') as HTMLInputElement;

	it('adds on Enter and comma, removes with Backspace and the chip button', async () => {
		const { onEvent, state } = mount('tags');
		await fireEvent.input(field(), { target: { value: 'svelte' } });
		await key(field(), 'Enter');
		expect(state().tags).toEqual(['svelte']);
		expect(field().value).toBe('');
		expect(onEvent).toHaveBeenCalledWith('change', { tags: ['svelte'] });
		expect(screen.getByRole('status').textContent).toBe('Added svelte.');
		await fireEvent.input(field(), { target: { value: 'css' } });
		await key(field(), ',');
		await key(field(), 'Enter');
		expect(state().tags).toEqual(['svelte', 'css']);
		expect(screen.getByRole('list', { name: 'Topics, 2 added' })).toBeTruthy();

		await key(field(), 'Backspace');
		expect(state().tags).toEqual(['svelte']);
		expect(screen.getByRole('status').textContent).toBe('Removed css.');
		await fireEvent.input(field(), { target: { value: 'a' } });
		await key(field(), 'Backspace');
		expect(state().tags).toEqual(['svelte']);

		await fireEvent.click(screen.getByRole('button', { name: 'Remove svelte' }));
		expect(state().tags).toEqual([]);
		expect(document.activeElement).toBe(field());
		await key(field(), 'x');
	});

	it('refuses duplicates, invalid tags and too many, with a message', async () => {
		const { state } = mount('tags', {
			tags: ['svelte'],
			props: { max: 2, validate: (t: string) => (t.includes(' ') ? 'No spaces' : '') }
		});
		await fireEvent.input(field(), { target: { value: 'Svelte' } });
		await key(field(), 'Enter');
		expect(field().getAttribute('aria-invalid')).toBe('true');
		expect(screen.getByText('“Svelte” is already added.')).toBeTruthy();
		expect(field().value).toBe('Svelte');
		await fireEvent.input(field(), { target: { value: 'two words' } });
		expect(field().getAttribute('aria-invalid')).toBeNull();
		await key(field(), 'Enter');
		expect(screen.getByText('No spaces')).toBeTruthy();
		await fireEvent.input(field(), { target: { value: 'css' } });
		await fireEvent.blur(field());
		expect(state().tags).toEqual(['svelte', 'css']);
		expect(field().placeholder).toBe('');
		await fireEvent.input(field(), { target: { value: 'more' } });
		await key(field(), 'Enter');
		expect(screen.getByText('No more than 2 allowed.')).toBeTruthy();
		await fireEvent.blur(field());
	});

	it('splits pasted text on commas', async () => {
		const { state } = mount('tags');
		await fireEvent.input(field(), { target: { value: 'a, b, c' } });
		expect(state().tags).toEqual(['a', 'b']);
		expect(field().value).toBe(' c');
		await fireEvent.blur(field());
		expect(state().tags).toEqual(['a', 'b', 'c']);
		await fireEvent.blur(field());
		await fireEvent.input(field(), { target: { value: ',' } });
		expect(state().tags).toEqual(['a', 'b', 'c']);
	});
});

describe('FileDrop', () => {
	const png = () => new File(['x'.repeat(10)], 'photo.png', { type: 'image/png' });
	const pdf = () => new File(['x'], 'doc.pdf', { type: 'application/pdf' });
	const big = () => new File(['x'.repeat(3000)], 'huge.png', { type: 'image/png' });

	it('is a button that opens the file chooser and describes its limits', async () => {
		mount('files', { props: { accept: 'image/*', maxSize: 2048, hint: 'PNG or JPG' } });
		const zone = screen.getByRole('button', {
			name: 'Attachments Drop a file here or choose a file'
		});
		const described = zone.getAttribute('aria-describedby')!.split(' ');
		expect(described.map((id) => document.getElementById(id)?.textContent)).toEqual([
			'Accepts image/*, up to 2 KB',
			'PNG or JPG'
		]);
		const picker = document.querySelector('input[type="file"]') as HTMLInputElement;
		expect(picker.accept).toBe('image/*');
		const click = vi.spyOn(picker, 'click').mockImplementation(() => {});
		await fireEvent.click(zone);
		expect(click).toHaveBeenCalledOnce();
	});

	it('accepts and rejects dropped files, with reasons', async () => {
		const { onEvent, state } = mount('files', {
			props: { accept: 'image/*', maxSize: 2048, multiple: true }
		});
		const zone = screen.getByRole('button', { name: /Drop files here/ });
		await fireEvent.dragEnter(zone);
		expect(zone.classList.contains('filedrop__zone--dragging')).toBe(true);
		// Entering a child and leaving the zone is still a drag over the zone.
		await fireEvent.dragEnter(zone.querySelector('span')!);
		await fireEvent.dragLeave(zone);
		expect(zone.classList.contains('filedrop__zone--dragging')).toBe(true);
		await fireEvent.dragLeave(zone);
		await fireEvent.dragLeave(zone);
		expect(zone.classList.contains('filedrop__zone--dragging')).toBe(false);
		await fireEvent.dragOver(zone);
		await fireEvent.drop(zone, { dataTransfer: { files: [png(), pdf(), big()] } });
		expect(zone.classList.contains('filedrop__zone--dragging')).toBe(false);
		expect(state().files).toEqual(['photo.png']);
		expect(onEvent).toHaveBeenCalledWith('change', { files: [expect.any(File)] });
		const reject = onEvent.mock.calls.find(([name]) => name === 'reject')![1];
		expect(reject.rejections.map((r: { reason: string }) => r.reason)).toEqual([
			'doc.pdf is not an accepted file type.',
			'huge.png is 2.9 KB; the limit is 2 KB.'
		]);
		expect(screen.getByRole('alert').querySelectorAll('li')).toHaveLength(2);
		expect(screen.getByText('Accepts image/*, up to 2 KB each')).toBeTruthy();
		expect(screen.getByRole('list', { name: 'Chosen files' }).textContent).toContain('10 B');

		await fireEvent.drop(zone, { dataTransfer: { files: [png()] } });
		expect(state().files).toEqual(['photo.png']);
		await fireEvent.drop(zone, {});
		await fireEvent.click(screen.getByRole('button', { name: 'Remove photo.png' }));
		expect(state().files).toEqual([]);
		expect(screen.getByRole('status').textContent).toBe('Removed photo.png.');
		expect(document.activeElement).toBe(zone);
	});

	it('replaces the file when not multiple, and takes the chooser’s files', async () => {
		const { state } = mount('files');
		const picker = document.querySelector('input[type="file"]') as HTMLInputElement;
		await fireEvent.change(picker, { target: { files: [png()] } });
		expect(state().files).toEqual(['photo.png']);
		await fireEvent.change(picker, { target: { files: [pdf()] } });
		expect(state().files).toEqual(['doc.pdf']);
		expect(screen.getByRole('status').textContent).toBe('Added doc.pdf.');
	});

	it('does nothing while disabled', async () => {
		const { state } = mount('files', { props: { disabled: true, prompt: 'Upload' } });
		const zone = screen.getByRole('button', { name: 'Attachments Upload' }) as HTMLButtonElement;
		expect(zone.disabled).toBe(true);
		await fireEvent.dragOver(zone);
		expect(zone.classList.contains('filedrop__zone--dragging')).toBe(false);
		await fireEvent.drop(zone, { dataTransfer: { files: [png()] } });
		expect(state().files).toEqual([]);
	});
});
