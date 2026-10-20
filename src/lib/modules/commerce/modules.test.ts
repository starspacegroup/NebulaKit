import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Harness from '../../../../tests/fixtures/ModulesCommerceHarness.svelte';
import type { Invoice, Release, Review } from './logic';

const NOW = new Date('2026-10-13T12:00:00Z');

function mount(
	which: string,
	props: Record<string, unknown> = {},
	extra: Record<string, unknown> = {}
) {
	const onEvent = vi.fn();
	const result = render(Harness, { props: { which, props, onEvent, ...extra } });
	const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}');
	return { ...result, onEvent, state };
}

const type = (el: Element, value: string) => fireEvent.input(el, { target: { value } });

afterEach(() => {
	vi.useRealTimers();
});

describe('RatingStars', () => {
	it('gives one text alternative for a display rating', () => {
		mount('stars', { value: 4.5, count: 12 }, { value: 4.5 });
		expect(screen.getByText('4.5 out of 5 stars, 12 reviews')).toHaveClass('sr-only');
	});

	it('shows the number and count when asked', () => {
		const { container } = mount('stars', { count: 3, showValue: true }, { value: 3.2 });
		expect(container.querySelector('.rating__value')?.textContent).toMatch(/3\.0\s*\(3\)/);
	});

	it('is a radio group in input mode and reports the choice', async () => {
		const { onEvent, state } = mount(
			'stars',
			{ variant: 'input', label: 'Your rating' },
			{ value: 0 }
		);
		const group = screen.getByRole('group', { name: 'Your rating' });
		const radios = within(group).getAllByRole('radio');
		expect(radios).toHaveLength(5);
		expect(screen.getByRole('radio', { name: '3 out of 5 stars' })).not.toBeChecked();
		await fireEvent.click(radios[2]);
		expect(state().value).toBe(3);
		expect(onEvent).toHaveBeenCalledWith('change', { value: 3 });
		expect(radios[2]).toBeChecked();
	});

	it('does not change when disabled and shows its error', async () => {
		const { onEvent } = mount(
			'stars',
			{ variant: 'input', disabled: true, error: 'Pick one', required: true },
			{ value: 0 }
		);
		expect(screen.getByRole('group')).toHaveAccessibleDescription('Pick one');
		await fireEvent.change(screen.getAllByRole('radio')[1]);
		expect(onEvent).not.toHaveBeenCalled();
	});
});

describe('UsageMeters', () => {
	const meters = [
		{ id: 'a', label: 'API calls', used: 100, limit: 1000, unit: 'calls' },
		{ id: 'b', label: 'Storage', used: 85, limit: 100, unit: 'GB' },
		{ id: 'c', label: 'Seats', used: 12, limit: 10, unit: 'seats' },
		{ id: 'd', label: 'Emails', used: 42, limit: null }
	];

	it('gives each bar meter semantics with a text value', () => {
		mount('usage', { meters, resetsAt: '2026-11-01T00:00:00Z', now: NOW });
		const api = screen.getByRole('meter', { name: 'API calls' });
		expect(api).toHaveAttribute('aria-valuemin', '0');
		expect(api).toHaveAttribute('aria-valuemax', '1000');
		expect(api).toHaveAttribute('aria-valuenow', '100');
		expect(api).toHaveAttribute('aria-valuetext', '100 of 1,000 calls. Within limit');
		expect(screen.getByRole('meter', { name: 'Storage' })).toHaveAttribute(
			'aria-valuetext',
			expect.stringContaining('Near limit')
		);
		expect(screen.getByRole('meter', { name: 'Seats' })).toHaveAttribute(
			'aria-valuetext',
			expect.stringContaining('Over by 2 seats')
		);
		expect(screen.getByRole('meter', { name: 'Seats' })).toHaveAttribute('aria-valuenow', '10');
		const unl = screen.getByRole('meter', { name: 'Emails' });
		expect(unl).toHaveAttribute('aria-valuetext', '42 used. Unlimited');
		expect(screen.getByText('Resets Nov 1, 2026 (in 19 days)')).toBeInTheDocument();
	});

	it('words the reset for tomorrow, today and without a clock', () => {
		const { unmount } = mount('usage', { meters, resetsAt: '2026-10-14T00:00:00Z', now: NOW });
		expect(screen.getByText(/tomorrow/)).toBeInTheDocument();
		unmount();
		const second = mount('usage', { meters, resetsAt: '2026-10-13T12:00:00Z', now: NOW });
		expect(screen.getByText(/today/)).toBeInTheDocument();
		second.unmount();
		mount('usage', { meters, resetsAt: '2026-11-01T00:00:00Z' });
		expect(screen.getByText('Resets Nov 1, 2026')).toBeInTheDocument();
	});

	it('has an empty state and a configurable heading level', () => {
		mount('usage', { meters: [], heading: 'Quotas', level: 4 });
		expect(screen.getByRole('heading', { level: 4, name: 'Quotas' })).toBeInTheDocument();
		expect(screen.getByText('No usage to show.')).toBeInTheDocument();
	});
});

describe('BillingOverview', () => {
	const base = {
		plan: { name: 'Pro', priceCents: 2900, interval: 'month' },
		renewsAt: '2026-11-01T00:00:00Z',
		now: NOW
	};

	it('shows plan, price and renewal', () => {
		mount('billing', base);
		expect(screen.getByRole('region', { name: 'Billing' })).toBeInTheDocument();
		expect(screen.getByText('Pro')).toBeInTheDocument();
		expect(screen.getByText('$29.00 per month')).toBeInTheDocument();
		expect(screen.getByText('November 1, 2026')).toBeInTheDocument();
		expect(screen.getByText('(in 19 days)')).toBeInTheDocument();
		expect(screen.getByText('Active')).toBeInTheDocument();
	});

	it('charges yearly plans in the plan currency', () => {
		mount('billing', {
			...base,
			plan: { name: 'Team', priceCents: 29000, interval: 'year', currency: 'EUR' },
			locale: 'en-GB'
		});
		expect(screen.getByText('€290.00 per year')).toBeInTheDocument();
	});

	it('fires upgrade', async () => {
		const { onEvent } = mount('billing', base);
		await fireEvent.click(screen.getByRole('button', { name: 'Upgrade plan' }));
		expect(onEvent).toHaveBeenCalledWith('upgrade', null);
	});

	it('asks before cancelling', async () => {
		const { onEvent } = mount('billing', base);
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel plan' }));
		const dialog = screen.getByRole('alertdialog', { hidden: true });
		expect(dialog).toHaveAccessibleName('Cancel your plan?');
		expect(onEvent).not.toHaveBeenCalled();
		await fireEvent.click(
			within(dialog).getByRole('button', { name: 'Cancel plan', hidden: true })
		);
		expect(onEvent).toHaveBeenCalledWith('cancel', null);
	});

	it('keeps the plan when the dialog is declined', async () => {
		const { onEvent } = mount('billing', base);
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel plan' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Keep plan', hidden: true }));
		expect(onEvent).not.toHaveBeenCalled();
	});

	it('warns when payment is overdue and when ending', () => {
		const { unmount } = mount('billing', { ...base, status: 'past_due' });
		expect(screen.getByRole('alert')).toHaveTextContent('Your last payment failed');
		expect(screen.getByText('Payment overdue')).toBeInTheDocument();
		unmount();
		mount('billing', { ...base, cancelAtPeriodEnd: true });
		expect(screen.getByRole('alert')).toHaveTextContent(
			'Your plan is set to end on November 1, 2026'
		);
		expect(screen.getByText('Ends on')).toBeInTheDocument();
	});

	it('offers to resume a scheduled cancellation', async () => {
		const { onEvent } = mount('billing', { ...base, cancelAtPeriodEnd: true });
		expect(screen.queryByRole('button', { name: 'Cancel plan' })).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Keep my plan' }));
		expect(onEvent).toHaveBeenCalledWith('resume', null);
	});

	it('has no actions once canceled and shows usage when given', () => {
		mount('billing', {
			...base,
			status: 'canceled',
			meters: [{ id: 'a', label: 'API calls', used: 1, limit: 10 }],
			level: 5
		});
		expect(screen.queryByRole('button', { name: 'Cancel plan' })).toBeNull();
		expect(screen.getByRole('meter', { name: 'API calls' })).toBeInTheDocument();
		expect(screen.getByText('Canceled')).toBeInTheDocument();
	});

	it('shows a trial badge and today/tomorrow wording', () => {
		const { unmount } = mount('billing', {
			...base,
			status: 'trialing',
			renewsAt: '2026-10-14T00:00:00Z'
		});
		expect(screen.getByText('Trial')).toBeInTheDocument();
		expect(screen.getByText('(tomorrow)')).toBeInTheDocument();
		unmount();
		mount('billing', { ...base, renewsAt: '2026-10-13T12:00:00Z' });
		expect(screen.getByText('(today)')).toBeInTheDocument();
	});
});

describe('InvoiceList', () => {
	const invoices: Invoice[] = Array.from({ length: 7 }, (_, i) => ({
		id: `i${i}`,
		number: `INV-${100 + i}`,
		date: `2026-0${i + 1}-01`,
		amountCents: 1000,
		status: (['paid', 'open', 'overdue', 'void', 'refunded', 'paid', 'paid'] as const)[i],
		description: i === 0 ? 'Pro plan' : undefined,
		downloadUrl: i === 1 ? 'https://example.com/i1.pdf' : undefined
	}));

	it('is a table with status words and totals', () => {
		mount('invoices', { invoices, pageSize: 10 });
		expect(screen.getByRole('table', { name: 'Invoices' })).toBeInTheDocument();
		expect(screen.getAllByRole('row')).toHaveLength(8);
		expect(screen.getAllByRole('columnheader').map((c) => c.textContent?.trim())).toContain(
			'Status'
		);
		expect(screen.getAllByText('Overdue')).toHaveLength(1);
		expect(screen.getByText('Refunded')).toBeInTheDocument();
		expect(screen.getByText('Total paid').nextElementSibling).toHaveTextContent('$30.00');
		expect(screen.getByText('Outstanding').nextElementSibling).toHaveTextContent('$20.00');
		expect(screen.getByText('Jan 1, 2026')).toBeInTheDocument();
	});

	it('downloads by link or by event, each named', async () => {
		const { onEvent } = mount('invoices', { invoices, pageSize: 10 });
		const link = screen.getByRole('link', { name: 'Download invoice INV-101' });
		expect(link).toHaveAttribute('href', 'https://example.com/i1.pdf');
		expect(link).toHaveAttribute('download');
		await fireEvent.click(screen.getByRole('button', { name: 'Download invoice INV-100' }));
		expect(onEvent).toHaveBeenCalledWith('download', { invoice: invoices[0] });
	});

	it('pages itself and announces the page', async () => {
		const { onEvent, state } = mount('invoices', { invoices, pageSize: 3 });
		expect(screen.getAllByRole('row')).toHaveLength(4);
		expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));
		expect(onEvent).toHaveBeenCalledWith('pagechange', { page: 2 });
		expect(state().page).toBe(2);
		expect(screen.getByText('INV-103')).toBeInTheDocument();
		expect(screen.queryByText('INV-100')).toBeNull();
	});

	it('leaves paging to the app when totalCount is given', async () => {
		const { onEvent } = mount('invoices', {
			invoices: invoices.slice(0, 3),
			totalCount: 30,
			pageSize: 3,
			page: 1
		});
		expect(screen.getAllByRole('row')).toHaveLength(4);
		await fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));
		expect(onEvent).toHaveBeenCalledWith('pagechange', { page: 2 });
	});

	it('has empty and loading states', () => {
		const { unmount } = mount('invoices', { invoices: [] });
		expect(screen.getByText('No invoices yet')).toBeInTheDocument();
		unmount();
		mount('invoices', { invoices, loading: true });
		expect(screen.getByRole('status')).toHaveTextContent('Loading invoices');
		expect(screen.queryByRole('table')).toBeNull();
	});
});

describe('PaymentMethodCard', () => {
	const method = {
		id: 'pm1',
		brand: 'visa',
		last4: '4242',
		expMonth: 12,
		expYear: 2028,
		holder: 'Ada'
	};

	it('names the card and masks the number', () => {
		mount('pm-card', { method, now: NOW });
		expect(screen.getByRole('article', { name: 'Visa ending in 4242' })).toBeInTheDocument();
		expect(screen.getByText('Expires 12/28')).toBeInTheDocument();
		expect(screen.getByText('Cardholder: Ada')).toBeInTheDocument();
		expect(screen.queryByText('Expired')).toBeNull();
	});

	it('writes out expired and expiring-soon', () => {
		const { unmount } = mount('pm-card', {
			method: { ...method, expYear: 2026, expMonth: 9 },
			now: NOW
		});
		expect(screen.getByText('Expired')).toBeInTheDocument();
		unmount();
		mount('pm-card', { method: { ...method, expYear: 2026, expMonth: 11 }, now: NOW });
		expect(screen.getByText('Expires soon')).toBeInTheDocument();
	});

	it('sets default, and hides that button on the default card', async () => {
		const { onEvent, unmount } = mount('pm-card', { method, now: NOW });
		await fireEvent.click(
			screen.getByRole('button', { name: 'Set as default: Visa ending in 4242' })
		);
		expect(onEvent).toHaveBeenCalledWith('setDefault', { id: 'pm1' });
		unmount();
		mount('pm-card', { method: { ...method, isDefault: true } });
		expect(screen.queryByRole('button', { name: /Set as default/ })).toBeNull();
		expect(screen.getByText('Default')).toBeInTheDocument();
	});

	it('confirms removal', async () => {
		const { onEvent } = mount('pm-card', { method });
		await fireEvent.click(screen.getByRole('button', { name: 'Remove: Visa ending in 4242' }));
		expect(onEvent).not.toHaveBeenCalled();
		await fireEvent.click(screen.getByRole('button', { name: 'Remove card', hidden: true }));
		expect(onEvent).toHaveBeenCalledWith('remove', { id: 'pm1' });
	});

	it('disables actions while busy', () => {
		mount('pm-card', { method, busy: true });
		expect(screen.getByRole('button', { name: /Remove:/ })).toBeDisabled();
	});
});

describe('PaymentMethodForm', () => {
	const fill = async (number: string, expiry: string, cvc: string, name = 'Ada Lovelace') => {
		await type(screen.getByLabelText(/Name on card/), name);
		await type(screen.getByLabelText(/Card number/), number);
		await type(screen.getByLabelText(/Expiry/), expiry);
		await type(screen.getByLabelText(/Security code/), cvc);
	};

	it('has cc autocomplete attributes and says it is a demo', () => {
		mount('pm-form', { now: NOW });
		expect(screen.getByLabelText(/Name on card/)).toHaveAttribute('autocomplete', 'cc-name');
		expect(screen.getByLabelText(/Card number/)).toHaveAttribute('autocomplete', 'cc-number');
		expect(screen.getByLabelText(/Expiry/)).toHaveAttribute('autocomplete', 'cc-exp');
		expect(screen.getByLabelText(/Security code/)).toHaveAttribute('autocomplete', 'cc-csc');
		expect(screen.getByText(/Demo fields/)).toBeInTheDocument();
	});

	it('can hide the demo notice', () => {
		mount('pm-form', { showDemoNotice: false });
		expect(screen.queryByText(/Demo fields/)).toBeNull();
	});

	it('groups the number, detects the brand and sizes the cvc', async () => {
		mount('pm-form', { now: NOW });
		const number = screen.getByLabelText(/Card number/) as HTMLInputElement;
		await type(number, '4242424242424242');
		expect(number.value).toBe('4242 4242 4242 4242');
		expect(screen.getByText('Card type: Visa')).toBeInTheDocument();
		await type(number, '378282246310005');
		expect(number.value).toBe('3782 822463 10005');
		expect(screen.getByText('Card type: American Express')).toBeInTheDocument();
		expect(screen.getByText('4 digits')).toBeInTheDocument();
		expect(screen.getByLabelText(/Security code/)).toHaveAttribute('maxlength', '4');
	});

	it('formats the expiry as MM/YY and the cvc as digits', async () => {
		mount('pm-form', { now: NOW });
		const expiry = screen.getByLabelText(/Expiry/) as HTMLInputElement;
		await type(expiry, '1228');
		expect(expiry.value).toBe('12/28');
		await type(expiry, '3');
		expect(expiry.value).toBe('03/');
		const cvc = screen.getByLabelText(/Security code/) as HTMLInputElement;
		await type(cvc, '12a3456');
		expect(cvc.value).toBe('123');
	});

	it('shows inline errors on blur, tied to the field', async () => {
		mount('pm-form', { now: NOW });
		const number = screen.getByLabelText(/Card number/);
		await type(number, '4242 4242 4242 4241');
		await fireEvent.blur(number);
		expect(number).toHaveAttribute('aria-invalid', 'true');
		expect(number).toHaveAccessibleDescription(expect.stringContaining('not valid'));
	});

	it('summarises every error on submit and moves focus to the summary', async () => {
		const { onEvent } = mount('pm-form', { now: NOW });
		await fireEvent.submit(
			screen.getByRole('button', { name: 'Save card' }).closest('form') as HTMLFormElement
		);
		await tick();
		const alert = screen.getByRole('alert');
		expect(alert).toHaveTextContent('Fix 4 problems to continue');
		expect(document.activeElement).toBe(alert);
		expect(onEvent).not.toHaveBeenCalled();
		const link = within(alert).getByRole('link', { name: /Card number/ });
		await fireEvent.click(link);
		expect(document.activeElement).toBe(screen.getByLabelText(/Card number/));
	});

	it('uses the singular summary for one problem and flags an expired card', async () => {
		mount('pm-form', { now: NOW });
		await fill('4242 4242 4242 4242', '09/26', '123');
		await fireEvent.submit(
			screen.getByRole('button', { name: 'Save card' }).closest('form') as HTMLFormElement
		);
		await tick();
		expect(screen.getByRole('alert')).toHaveTextContent('Fix 1 problem to continue');
		expect(screen.getByRole('alert')).toHaveTextContent('This card has expired.');
	});

	it('submits a valid card with the brand and last four', async () => {
		const { onEvent } = mount('pm-form', { now: NOW });
		await fill('4242 4242 4242 4242', '1230', '123');
		await fireEvent.click(screen.getByRole('checkbox', { name: 'Use as my default card' }));
		await fireEvent.submit(
			screen.getByRole('button', { name: 'Save card' }).closest('form') as HTMLFormElement
		);
		expect(onEvent).toHaveBeenCalledWith('submit', {
			name: 'Ada Lovelace',
			number: '4242424242424242',
			brand: 'visa',
			last4: '4242',
			expMonth: 12,
			expYear: 2030,
			cvc: '123',
			makeDefault: true
		});
	});

	it('shows a server error and a loading button, and can drop the default checkbox', () => {
		mount('pm-form', {
			now: NOW,
			error: 'Your card was declined.',
			loading: true,
			offerDefault: false
		});
		expect(screen.getByRole('alert')).toHaveTextContent('Your card was declined.');
		expect(screen.getByRole('button', { name: 'Save card' })).toHaveAttribute('aria-busy', 'true');
		expect(screen.queryByRole('checkbox')).toBeNull();
	});

	it('works without an injected clock', async () => {
		mount('pm-form');
		await fill('4242 4242 4242 4242', '12/99', '123');
		await fireEvent.submit(
			screen.getByRole('button', { name: 'Save card' }).closest('form') as HTMLFormElement
		);
		await tick();
		expect(screen.getByRole('alert')).toHaveTextContent('too far away');
	});
});

describe('CheckoutForm', () => {
	const items = [
		{ id: 'a', name: 'Mug', variant: 'White', unitCents: 1800, quantity: 2 },
		{ id: 'b', name: 'Tote', unitCents: 2400, quantity: 1 }
	];
	const shippingMethods = [
		{ id: 'std', label: 'Standard', cents: 500, eta: '3 to 5 days' },
		{ id: 'free', label: 'Pickup', cents: 0 }
	];
	const props = { items, shippingMethods, taxRate: 0.1 };

	const submitForm = () =>
		fireEvent.submit(
			screen.getByRole('button', { name: /^Pay/ }).closest('form') as HTMLFormElement
		);

	it('lays out fieldsets with shipping autocomplete tokens', () => {
		mount('checkout', props);
		expect(screen.getByRole('group', { name: 'Contact' })).toBeInTheDocument();
		expect(screen.getByRole('group', { name: 'Shipping address' })).toBeInTheDocument();
		expect(screen.getByLabelText(/Email/)).toHaveAttribute('autocomplete', 'email');
		expect(screen.getByLabelText(/Full name/)).toHaveAttribute('autocomplete', 'shipping name');
		expect(screen.getByLabelText(/^Address/)).toHaveAttribute(
			'autocomplete',
			'shipping address-line1'
		);
		expect(screen.getByLabelText(/ZIP code/)).toHaveAttribute(
			'autocomplete',
			'shipping postal-code'
		);
		expect(screen.getByText('Payment fields here')).toBeInTheDocument();
	});

	it('totals the order, with tax and the chosen shipping, and updates it', async () => {
		mount('checkout', props);
		const aside = screen.getByRole('complementary', { name: 'Order summary' });
		expect(within(aside).getByText('Quantity 2')).toBeInTheDocument();
		// 6000 goods + 500 shipping + 600 tax
		expect(screen.getByRole('button', { name: 'Pay $71.00' })).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('radio', { name: /Pickup/ }));
		expect(screen.getByRole('button', { name: 'Pay $66.00' })).toBeInTheDocument();
		expect(within(aside).getByText('Free')).toBeInTheDocument();
	});

	it('changes the address fields with the country', async () => {
		mount('checkout', props);
		expect(screen.getByLabelText(/State/).tagName).toBe('SELECT');
		await fireEvent.change(screen.getByLabelText(/Country/), { target: { value: 'GB' } });
		expect(screen.getByLabelText(/Postcode/)).toBeInTheDocument();
		expect(screen.getByLabelText(/County/).tagName).toBe('INPUT');
		await fireEvent.change(screen.getByLabelText(/Country/), { target: { value: 'CA' } });
		expect(screen.getByLabelText(/Province/).tagName).toBe('SELECT');
	});

	it('summarises errors, focuses the summary, and links to fields', async () => {
		const { onEvent } = mount('checkout', props);
		await submitForm();
		await tick();
		const alert = screen.getByRole('alert');
		expect(alert).toHaveTextContent(/Fix \d+ problems to continue/);
		expect(document.activeElement).toBe(alert);
		expect(screen.getByLabelText(/Email/)).toHaveAttribute('aria-invalid', 'true');
		expect(screen.getByLabelText(/Email/)).toHaveAccessibleDescription('Enter your email address.');
		expect(onEvent).not.toHaveBeenCalled();
		await fireEvent.click(within(alert).getByRole('link', { name: /Email/ }));
		expect(document.activeElement).toBe(screen.getByLabelText(/Email/));
	});

	it('rejects a bad email and bad ZIP, then submits when fixed', async () => {
		const { onEvent } = mount('checkout', {
			...props,
			email: 'nope',
			address: {
				name: 'Ada',
				line1: '1 Main',
				line2: '',
				city: 'Lewiston',
				region: 'ME',
				postal: '123',
				country: 'US'
			}
		});
		await submitForm();
		expect(screen.getByLabelText(/Email/)).toHaveAccessibleDescription(
			'Enter a valid email address, like name@example.com.'
		);
		expect(screen.getByLabelText(/ZIP code/)).toHaveAccessibleDescription(
			expect.stringContaining('Enter a valid ZIP code')
		);
		await type(screen.getByLabelText(/Email/), 'ada@example.com');
		await type(screen.getByLabelText(/ZIP code/), '04240');
		await fireEvent.blur(screen.getByLabelText(/ZIP code/));
		await submitForm();
		expect(onEvent).toHaveBeenCalledTimes(1);
		const [name, detail] = onEvent.mock.calls[0];
		expect(name).toBe('submit');
		expect(detail.email).toBe('ada@example.com');
		expect(detail.shippingMethod).toBe('std');
		expect(detail.totals.total).toBe(7100);
		expect(detail.address.postal).toBe('04240');
	});

	it('shows a payment error and loading on the pay button', () => {
		mount('checkout', { ...props, error: 'Card declined', loading: true });
		expect(screen.getByRole('alert')).toHaveTextContent('Card declined');
		expect(screen.getByRole('button', { name: /^Pay/ })).toHaveAttribute('aria-busy', 'true');
	});

	it('asks for a method when none is chosen, and works without any', async () => {
		mount('checkout', { ...props, shippingMethod: '' });
		await submitForm();
		expect(screen.getByRole('alert')).toHaveTextContent('Choose a shipping method.');
	});

	it('lists discounts from a promo, and renders with no shipping methods', () => {
		mount('checkout', {
			items,
			taxRate: 0,
			promo: { code: 'X', kind: 'percent', value: 10 }
		});
		expect(screen.getByText('Discount')).toBeInTheDocument();
		expect(screen.getByText('Choose a method')).toBeInTheDocument();
		expect(screen.queryByRole('group', { name: 'Shipping method' })).toBeNull();
	});
});

describe('CartSummary', () => {
	const items = [
		{ id: 'a', name: 'Mug', unitCents: 1000, quantity: 2, variant: 'White', image: 'data:,' },
		{ id: 'b', name: 'Tote', unitCents: 2000, quantity: 1 }
	];
	const promos = [
		{ code: 'SAVE10', kind: 'percent' as const, value: 10 },
		{ code: 'BIG', kind: 'fixed' as const, value: 500, minSubtotalCents: 100000 }
	];

	it('lists lines and totals', () => {
		mount('cart', { promos, taxRate: 0.1, shippingCents: 500 }, { items });
		expect(screen.getByText('3 items')).toBeInTheDocument();
		expect(screen.getByRole('spinbutton', { name: 'Quantity of Mug' })).toHaveValue('2');
		const totals = screen.getByText('Subtotal').closest('dl') as HTMLElement;
		expect(within(totals).getByText('$40.00')).toBeInTheDocument();
		expect(within(totals).getByText('$5.00')).toBeInTheDocument();
		expect(within(totals).getByText('$4.00')).toBeInTheDocument();
		expect(within(totals).getByText('$49.00')).toBeInTheDocument();
	});

	it('says shipping is calculated later, or free', () => {
		const { unmount } = mount('cart', {}, { items });
		expect(screen.getByText('Calculated at checkout')).toBeInTheDocument();
		unmount();
		mount('cart', { shippingCents: 0 }, { items });
		expect(screen.getByText('Free')).toBeInTheDocument();
	});

	it('updates quantity and announces it', async () => {
		const { onEvent, state } = mount('cart', {}, { items });
		await fireEvent.click(screen.getByRole('button', { name: 'Increase Quantity of Mug' }));
		expect(onEvent).toHaveBeenCalledWith('quantity', { id: 'a', quantity: 3 });
		expect(state().items[0].quantity).toBe(3);
		expect(screen.getByText('Mug: quantity 3.')).toBeInTheDocument();
	});

	it('removes a line, announces it and returns focus to the heading', async () => {
		const { onEvent, state } = mount('cart', {}, { items });
		await fireEvent.click(screen.getByRole('button', { name: 'Remove Mug from cart' }));
		await tick();
		expect(onEvent).toHaveBeenCalledWith('remove', { id: 'a' });
		expect(state().items).toHaveLength(1);
		expect(screen.getByText('Mug removed from cart.')).toBeInTheDocument();
		expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Your cart' }));
		expect(screen.getByText('1 item')).toBeInTheDocument();
	});

	it('shows the empty state', () => {
		mount('cart', {}, { items: [] });
		expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Checkout' })).toBeNull();
	});

	it('applies a promo code and can remove it', async () => {
		const { onEvent } = mount('cart', { promos }, { items });
		await type(screen.getByLabelText('Promo code'), ' save10 ');
		await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
		expect(screen.getByText('Code SAVE10 applied')).toBeInTheDocument();
		expect(screen.getByText('Discount')).toBeInTheDocument();
		expect(screen.getByText('−$4.00')).toBeInTheDocument();
		expect(onEvent).toHaveBeenCalledWith('promo', { promo: promos[0] });
		await fireEvent.click(screen.getByRole('button', { name: 'Remove code' }));
		expect(onEvent).toHaveBeenCalledWith('promo', { promo: null });
		expect(screen.getByLabelText('Promo code')).toBeInTheDocument();
	});

	it('shows promo errors on the input', async () => {
		mount('cart', { promos }, { items });
		const button = screen.getByRole('button', { name: 'Apply' });
		await fireEvent.click(button);
		expect(screen.getByLabelText('Promo code')).toHaveAccessibleDescription('Enter a promo code.');
		await type(screen.getByLabelText('Promo code'), 'nope');
		await fireEvent.click(button);
		expect(screen.getByLabelText('Promo code')).toHaveAccessibleDescription(
			'That code is not valid.'
		);
		await type(screen.getByLabelText('Promo code'), 'big');
		await fireEvent.click(button);
		expect(screen.getByLabelText('Promo code')).toHaveAccessibleDescription(
			'Spend $1,000.00 or more to use this code.'
		);
		expect(screen.getByLabelText('Promo code')).toHaveAttribute('aria-invalid', 'true');
	});

	it('hands codes to the app when no list is given', async () => {
		const { onEvent } = mount('cart', { promoError: 'Expired code' }, { items });
		await type(screen.getByLabelText('Promo code'), 'abc');
		await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
		expect(onEvent).toHaveBeenCalledWith('applypromo', { code: 'abc' });
		expect(screen.getByLabelText('Promo code')).toHaveAccessibleDescription('Expired code');
	});

	it('checks out as a button or a link', async () => {
		const { onEvent, unmount } = mount('cart', { taxRate: 0 }, { items });
		await fireEvent.click(screen.getByRole('button', { name: 'Checkout' }));
		expect(onEvent).toHaveBeenCalledWith(
			'checkout',
			expect.objectContaining({ totals: expect.any(Object) })
		);
		unmount();
		mount('cart', { checkoutHref: '/checkout' }, { items });
		expect(screen.getByRole('link', { name: 'Checkout' })).toHaveAttribute('href', '/checkout');
	});
});

describe('OrderStatusTracker', () => {
	const steps = [
		{ id: 'p', label: 'Placed', at: '2026-10-11' },
		{ id: 's', label: 'Shipped', description: 'With the courier' },
		{ id: 'd', label: 'Delivered' }
	];

	it('marks the current step and writes out every state', () => {
		mount('tracker', { steps, current: 1, eta: '2026-10-17', orderNumber: '#1' });
		const items = screen.getAllByRole('listitem');
		expect(items).toHaveLength(3);
		expect(items[1]).toHaveAttribute('aria-current', 'step');
		expect(items[0]).not.toHaveAttribute('aria-current');
		expect(within(items[0]).getByText('Completed')).toBeInTheDocument();
		expect(within(items[1]).getByText('Current step')).toBeInTheDocument();
		expect(within(items[2]).getByText('Upcoming')).toBeInTheDocument();
		expect(screen.getByText('October 17, 2026')).toBeInTheDocument();
		expect(screen.getByText('Order #1')).toBeInTheDocument();
		expect(screen.getByText('With the courier')).toBeInTheDocument();
	});

	it('reports completion when every step is done', () => {
		mount('tracker', { steps, current: 3 });
		expect(screen.getByText('All steps complete')).toBeInTheDocument();
		expect(document.querySelector('[aria-current="step"]')).toBeNull();
	});
});

describe('ProductCard', () => {
	const product = {
		id: 'p1',
		name: 'Mug',
		image: 'data:,',
		imageAlt: 'White ceramic mug',
		priceCents: 1800,
		rating: 4.5,
		reviewCount: 3,
		href: '/mug'
	};

	it('has an image with alt, a linked name and a rating', () => {
		mount('product', { product });
		expect(screen.getByRole('img', { name: 'White ceramic mug' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Mug' })).toHaveAttribute('href', '/mug');
		expect(screen.getByText('4.5 out of 5 stars, 3 reviews')).toBeInTheDocument();
		expect(screen.getByText('$18.00')).toBeInTheDocument();
	});

	it('writes out the sale price', () => {
		mount('product', { product: { ...product, salePriceCents: 1400 } });
		expect(screen.getByText('Sale price:')).toBeInTheDocument();
		expect(screen.getByText('Original price:')).toBeInTheDocument();
		expect(screen.getByText('$14.00')).toBeInTheDocument();
		expect(screen.getByText('$18.00').tagName).toBe('DEL');
		expect(screen.getByText('Sale')).toBeInTheDocument();
	});

	it('adds to cart and confirms', async () => {
		const { onEvent } = mount('product', { product });
		await fireEvent.click(screen.getByRole('button', { name: 'Add to cart, Mug' }));
		expect(onEvent).toHaveBeenCalledWith('add', { id: 'p1' });
		expect(screen.getByText('Mug added to cart.')).toBeInTheDocument();
	});

	it('is sold out in words and cannot be added', async () => {
		const { onEvent } = mount('product', { product: { ...product, soldOut: true } });
		const button = screen.getByRole('button', { name: 'Sold out: Mug' });
		expect(button).toBeDisabled();
		await fireEvent.click(button);
		expect(onEvent).not.toHaveBeenCalled();
		expect(screen.getAllByText('Sold out').length).toBeGreaterThan(0);
	});

	it('falls back without an image, link, rating or sale', () => {
		mount('product', {
			product: { id: 'x', name: 'Pin', priceCents: 900, salePriceCents: 900 },
			adding: true
		});
		expect(screen.queryByRole('img')).toBeNull();
		expect(screen.queryByRole('link')).toBeNull();
		expect(screen.queryByText(/out of 5/)).toBeNull();
		expect(screen.queryByText('Sale price:')).toBeNull();
		expect(screen.getByRole('button', { name: 'Add to cart, Pin' })).toHaveAttribute(
			'aria-busy',
			'true'
		);
	});
});

describe('ProductGallery', () => {
	const images = [
		{ src: 'a.jpg', alt: 'Front' },
		{ src: 'b.jpg', alt: 'Side', thumb: 'b-small.jpg' },
		{ src: 'c.jpg', alt: 'Top' }
	];

	it('shows the first image, a caption and a pressed thumbnail', () => {
		mount('gallery', { images });
		expect(screen.getByRole('group', { name: 'Product images' })).toHaveAttribute(
			'aria-roledescription',
			'gallery'
		);
		expect(screen.getByRole('img', { name: 'Front' })).toHaveAttribute('src', 'a.jpg');
		expect(screen.getByText('Image 1 of 3')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Show image 1: Front' })).toHaveAttribute(
			'aria-current',
			'true'
		);
	});

	it('moves with the buttons, wrapping', async () => {
		const { onEvent, state } = mount('gallery', { images });
		await fireEvent.click(screen.getByRole('button', { name: 'Previous image' }));
		expect(state().index).toBe(2);
		expect(onEvent).toHaveBeenCalledWith('change', { index: 2 });
		await fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
		expect(state().index).toBe(0);
	});

	it('clamps and disables the ends when not wrapping', async () => {
		mount('gallery', { images, wrap: false });
		expect(screen.getByRole('button', { name: 'Previous image' })).toBeDisabled();
		await fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
		expect(screen.getByRole('button', { name: 'Next image' })).toBeDisabled();
	});

	it('moves with arrow, Home and End keys, keeping focus on thumbnails', async () => {
		const { state } = mount('gallery', { images });
		const thumb = screen.getByRole('button', { name: 'Show image 1: Front' });
		thumb.focus();
		await fireEvent.keyDown(thumb, { key: 'ArrowRight' });
		expect(state().index).toBe(1);
		await waitFor(() =>
			expect(document.activeElement).toBe(
				screen.getByRole('button', { name: 'Show image 2: Side' })
			)
		);
		await fireEvent.keyDown(document.activeElement as Element, { key: 'End' });
		expect(state().index).toBe(2);
		await fireEvent.keyDown(document.activeElement as Element, { key: 'Home' });
		expect(state().index).toBe(0);
		await fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowLeft' });
		expect(state().index).toBe(2);
		await fireEvent.keyDown(document.activeElement as Element, { key: 'x' });
		expect(state().index).toBe(2);
		await fireEvent.keyDown(document.activeElement as Element, {
			key: 'ArrowRight',
			ctrlKey: true
		});
		expect(state().index).toBe(2);
	});

	it('picks a thumbnail with a click and uses the thumb source', async () => {
		const { state } = mount('gallery', { images });
		const thumb = screen.getByRole('button', { name: 'Show image 2: Side' });
		expect(thumb.querySelector('img')).toHaveAttribute('src', 'b-small.jpg');
		await fireEvent.click(thumb);
		expect(state().index).toBe(1);
		await fireEvent.click(thumb);
		expect(state().index).toBe(1);
	});

	it('handles one image and none', () => {
		const { unmount } = mount('gallery', { images: [images[0]] });
		expect(screen.queryByRole('button', { name: /Show image/ })).toBeNull();
		unmount();
		mount('gallery', { images: [] });
		expect(screen.getByText('No images')).toBeInTheDocument();
	});
});

describe('ReviewsRatings', () => {
	const reviews: Review[] = [
		{
			id: 'a',
			author: 'Ada',
			rating: 5,
			title: 'Great',
			body: 'Loved it.',
			date: '2026-09-01',
			helpful: 2
		},
		{ id: 'b', author: 'Bo', rating: 2, body: 'Meh.', date: '2026-09-10', helpful: 5 },
		{ id: 'c', author: 'Cy', rating: 5, body: 'Yes.', date: '2026-08-01', helpful: 0 }
	];
	const order = () =>
		screen
			.getAllByRole('article')
			.map((a) => a.querySelector('.review__meta')?.textContent?.trim().split(' ')[0]);

	it('summarises with text on every bar', () => {
		mount('reviews', { reviews });
		expect(screen.getByText('4.0')).toBeInTheDocument();
		expect(screen.getByText('Based on 3 reviews')).toBeInTheDocument();
		expect(screen.getByText('5 stars')).toBeInTheDocument();
		expect(screen.getByText('67% (2)')).toBeInTheDocument();
		expect(screen.getByText('1 star')).toBeInTheDocument();
		expect(screen.getByText('4 out of 5 stars, 3 reviews')).toBeInTheDocument();
	});

	it('sorts and announces', async () => {
		const { onEvent } = mount('reviews', { reviews });
		expect(order()).toEqual(['Bo', 'Ada', 'Cy']);
		await fireEvent.change(screen.getByLabelText('Sort reviews'), { target: { value: 'helpful' } });
		expect(order()).toEqual(['Bo', 'Ada', 'Cy']);
		await fireEvent.change(screen.getByLabelText('Sort reviews'), { target: { value: 'lowest' } });
		expect(order()).toEqual(['Bo', 'Ada', 'Cy']);
		await fireEvent.change(screen.getByLabelText('Sort reviews'), { target: { value: 'oldest' } });
		expect(order()).toEqual(['Cy', 'Ada', 'Bo']);
		expect(screen.getByText('Sorted by oldest.')).toBeInTheDocument();
		expect(onEvent).toHaveBeenCalledWith('sort', { sort: 'oldest' });
	});

	it('toggles helpful', async () => {
		const { onEvent } = mount('reviews', { reviews });
		const button = screen.getByRole('button', { name: 'Mark review by Ada as helpful' });
		expect(button).toHaveAttribute('aria-pressed', 'false');
		expect(button).toHaveTextContent('Helpful (2)');
		await fireEvent.click(button);
		expect(button).toHaveAttribute('aria-pressed', 'true');
		expect(button).toHaveTextContent('Helpful (3)');
		expect(onEvent).toHaveBeenCalledWith('helpful', { id: 'a', pressed: true });
		await fireEvent.click(button);
		expect(onEvent).toHaveBeenLastCalledWith('helpful', { id: 'a', pressed: false });
	});

	it('uses supplied counts and shows the empty state', () => {
		const { unmount } = mount('reviews', { reviews: [], counts: [0, 0, 0, 0, 0] });
		expect(screen.getByText(/Be the first/)).toBeInTheDocument();
		expect(screen.getByText('Based on 0 reviews')).toBeInTheDocument();
		unmount();
		mount('reviews', { reviews: [reviews[0]], counts: [0, 0, 0, 0, 1] });
		expect(screen.getByText('Based on 1 review')).toBeInTheDocument();
	});

	it('validates the review form, then submits', async () => {
		const { onEvent } = mount('reviews', { reviews, canWrite: true });
		const form = screen
			.getByRole('button', { name: 'Submit review' })
			.closest('form') as HTMLFormElement;
		await fireEvent.submit(form);
		expect(screen.getByRole('group', { name: /Your rating/ })).toHaveAccessibleDescription(
			'Choose a rating from 1 to 5 stars.'
		);
		expect(document.activeElement).toBe(screen.getAllByRole('radio')[0]);
		await fireEvent.click(screen.getByRole('radio', { name: '4 out of 5 stars' }));
		await fireEvent.submit(form);
		expect(screen.getByLabelText(/Your review/)).toHaveAccessibleDescription(
			'Write a few words about it.'
		);
		expect(document.activeElement).toBe(screen.getByLabelText(/Your review/));
		expect(onEvent).not.toHaveBeenCalled();
		await type(screen.getByLabelText(/Title/), ' Nice ');
		await type(screen.getByLabelText(/Your review/), ' Good value. ');
		await fireEvent.submit(form);
		expect(onEvent).toHaveBeenCalledWith('submit', {
			rating: 4,
			title: 'Nice',
			body: 'Good value.'
		});
		expect(
			screen.getByText('Thanks. Your review was submitted.', { selector: '.sr-only' })
		).toBeInTheDocument();
		expect((screen.getByLabelText(/Your review/) as HTMLTextAreaElement).value).toBe('');
	});
});

describe('StatusPage', () => {
	const days = (n: number, overrides: Record<number, 'degraded' | 'down' | 'none'> = {}) =>
		Array.from({ length: n }, (_, i) => ({
			date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
			status: overrides[i] ?? ('up' as const),
			minutes: overrides[i] ? 10 * (i + 1) : undefined
		}));
	const components = [
		{ id: 'web', name: 'Website', status: 'operational', days: days(10, { 3: 'down' }) },
		{ id: 'api', name: 'API', status: 'degraded', description: 'Slow', days: days(10) },
		{ id: 'new', name: 'Beta', status: 'maintenance', days: [] }
	];
	const incidents = [
		{
			id: 'i',
			title: 'Slow API',
			status: 'monitoring',
			startedAt: '2026-01-09T10:00:00Z',
			updates: [{ at: '2026-01-09T11:00:00Z', status: 'Monitoring', text: 'Fix deployed.' }]
		},
		{
			id: 'j',
			title: 'Old',
			status: 'resolved',
			startedAt: '2025-12-01T10:00:00Z',
			updates: [{ at: '2025-12-01T11:00:00Z', text: 'Done.' }]
		}
	];

	it('headlines the worst component in words', () => {
		mount('status', { components, incidents, updatedAt: '2026-01-10T00:00:00Z' });
		expect(screen.getByText('Some systems are affected')).toBeInTheDocument();
		expect(screen.getByText('Updated January 10, 2026')).toBeInTheDocument();
		expect(screen.getByText('Degraded performance')).toBeInTheDocument();
		expect(screen.getByText('Under maintenance')).toBeInTheDocument();
	});

	it('shows the other banners', () => {
		const { unmount } = mount('status', { components: [components[0]] });
		expect(screen.getByText('All systems operational')).toBeInTheDocument();
		unmount();
		const second = mount('status', { components: [{ ...components[2] }] });
		expect(screen.getByText('Scheduled maintenance in progress')).toBeInTheDocument();
		second.unmount();
		mount('status', { components: [{ ...components[0], status: 'outage' }] });
		expect(screen.getAllByText('Major outage').length).toBeGreaterThan(0);
	});

	it('gives every day a text alternative and the uptime figure', () => {
		mount('status', { components, incidents });
		const strip = screen.getByRole('list', { name: 'Website: uptime, last 10 days' });
		expect(within(strip).getAllByRole('listitem')).toHaveLength(10);
		expect(within(strip).getByText('Jan 4, 2026: Outage, 40 minutes')).toBeInTheDocument();
		expect(within(strip).getByText('Jan 1, 2026: No incidents')).toBeInTheDocument();
		expect(screen.getByText('90.00% uptime')).toBeInTheDocument();
		expect(screen.getByText('100.00% uptime')).toBeInTheDocument();
	});

	it('moves along the strip with the keyboard and prints the day', async () => {
		mount('status', { components, incidents });
		const strip = screen.getByRole('list', { name: 'Website: uptime, last 10 days' });
		expect(strip).toHaveAttribute('tabindex', '0');
		const detail = () =>
			strip.parentElement?.querySelector('.detail')?.textContent?.replace(/\s+/g, ' ').trim();
		expect(detail()).toBe('Selected day: Jan 10, 2026: No incidents');
		await fireEvent.keyDown(strip, { key: 'ArrowLeft' });
		expect(detail()).toContain('Jan 9, 2026');
		await fireEvent.keyDown(strip, { key: 'Home' });
		expect(detail()).toContain('Jan 1, 2026');
		await fireEvent.keyDown(strip, { key: 'ArrowRight' });
		expect(detail()).toContain('Jan 2, 2026');
		await fireEvent.keyDown(strip, { key: 'End' });
		expect(detail()).toContain('Jan 10, 2026');
		await fireEvent.keyDown(strip, { key: 'ArrowRight' });
		expect(detail()).toContain('Jan 10, 2026');
		await fireEvent.keyDown(strip, { key: 'a' });
		expect(detail()).toContain('Jan 10, 2026');
		await fireEvent.click(within(strip).getAllByRole('listitem')[3]);
		expect(detail()).toContain('Outage');
		await fireEvent.mouseEnter(within(strip).getAllByRole('listitem')[0]);
		expect(detail()).toContain('Jan 1, 2026');
	});

	it('lists only the days with trouble in a disclosure', () => {
		mount('status', { components, incidents });
		const disclosures = screen.getAllByText('Days with issues');
		expect(disclosures).toHaveLength(2);
		const first = disclosures[0].closest('details') as HTMLElement;
		expect(within(first).getByText('Jan 4, 2026: Outage, 40 minutes')).toBeInTheDocument();
		const second = disclosures[1].closest('details') as HTMLElement;
		expect(within(second).getByText('No incidents in this period.')).toBeInTheDocument();
	});

	it('lists incidents with their updates, and an empty state', () => {
		const { unmount } = mount('status', { components, incidents });
		const article = screen
			.getByRole('heading', { name: 'Slow API' })
			.closest('article') as HTMLElement;
		expect(within(article).getByText('Monitoring')).toBeInTheDocument();
		expect(within(article).getByText('Fix deployed.', { exact: false })).toBeInTheDocument();
		expect(screen.getByText('Resolved')).toBeInTheDocument();
		unmount();
		mount('status', { components: [], incidents: [] });
		expect(screen.getByText('No incidents reported.')).toBeInTheDocument();
	});
});

describe('ChangelogList', () => {
	const releases: Release[] = [
		{ version: '1.0.0', date: '2026-01-01', changes: [{ type: 'feature', text: 'First' }] },
		{
			version: '1.1.0',
			date: '2026-02-01',
			title: 'Fixes',
			changes: [
				{ type: 'fix', text: 'A bug' },
				{ type: 'feature', text: 'Second' }
			]
		},
		{ version: '1.2.0', date: '2026-03-01', changes: [{ type: 'security', text: 'Patched' }] }
	];

	it('lists releases newest first with anchor links', () => {
		mount('changelog', { releases });
		const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent?.trim());
		expect(headings).toEqual(['1.2.0', '1.1.0— Fixes', '1.0.0']);
		const link = screen.getByRole('link', { name: 'Link to version 1.1.0' });
		expect(link).toHaveAttribute('href', '#v1-1-0'.replace('v', ''));
		expect(document.getElementById('1-1-0')).not.toBeNull();
		expect(screen.getByText('Showing 3 of 3 releases')).toBeInTheDocument();
		expect(screen.getAllByText('New').length).toBe(3);
	});

	it('filters by type and clears', async () => {
		const { onEvent, state } = mount('changelog', { releases });
		await fireEvent.click(screen.getByRole('checkbox', { name: 'Fixed' }));
		expect(state().types).toEqual(['fix']);
		expect(onEvent).toHaveBeenCalledWith('filter', { types: ['fix'] });
		expect(screen.getByText('Showing 1 of 3 releases')).toBeInTheDocument();
		expect(screen.getByText('A bug')).toBeInTheDocument();
		expect(screen.queryByText('First')).toBeNull();
		await fireEvent.click(screen.getByRole('checkbox', { name: 'Security' }));
		expect(screen.getByText('Showing 2 of 3 releases')).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('checkbox', { name: 'Security' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
		expect(state().types).toEqual([]);
		expect(screen.getByText('Showing 3 of 3 releases')).toBeInTheDocument();
	});

	it('says when nothing matches or exists, and can hide the filter', () => {
		const { unmount } = mount('changelog', { releases }, { types: ['breaking'] });
		expect(screen.getByText('No releases match this filter.')).toBeInTheDocument();
		unmount();
		const second = mount('changelog', { releases: [] });
		expect(screen.getByText('No releases yet.')).toBeInTheDocument();
		second.unmount();
		mount('changelog', { releases, showFilter: false });
		expect(screen.queryByRole('group', { name: 'Show only' })).toBeNull();
	});
});

describe('WaitlistSignup', () => {
	it('validates the email and tells you why', async () => {
		const { onEvent } = mount('waitlist');
		const form = screen
			.getByRole('button', { name: 'Join the waitlist' })
			.closest('form') as HTMLFormElement;
		await fireEvent.submit(form);
		expect(screen.getByLabelText(/Email address/)).toHaveAccessibleDescription(
			'Enter your email address.'
		);
		expect(screen.getByLabelText(/Email address/)).toHaveAttribute('aria-invalid', 'true');
		expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Enter your email address.');
		await type(screen.getByLabelText(/Email address/), 'nope');
		await fireEvent.submit(form);
		expect(screen.getByLabelText(/Email address/)).toHaveAccessibleDescription(
			expect.stringContaining('valid email')
		);
		await type(screen.getByLabelText(/Email address/), 'Ada@Example.com');
		await fireEvent.submit(form);
		expect(onEvent).toHaveBeenCalledWith('join', { email: 'ada@example.com' });
		expect(screen.getByLabelText(/Email address/)).not.toHaveAttribute('aria-invalid');
	});

	it('has autocomplete and shows loading and server errors', () => {
		const { unmount } = mount('waitlist', {}, { wstate: 'submitting' });
		expect(screen.getByLabelText(/Email address/)).toBeDisabled();
		expect(screen.getByLabelText(/Email address/)).toHaveAttribute('autocomplete', 'email');
		expect(screen.getByRole('button', { name: 'Join the waitlist' })).toHaveAttribute(
			'aria-busy',
			'true'
		);
		unmount();
		mount('waitlist', { error: 'Try later' }, { wstate: 'error' });
		expect(screen.getByLabelText(/Email address/)).toHaveAccessibleDescription('Try later');
	});

	it('shows position and a share link once joined, with focus on the confirmation', async () => {
		mount(
			'waitlist',
			{ position: 1204, total: 5890, referralCode: 'ada', shareUrl: 'https://x.dev/' },
			{ wstate: 'success' }
		);
		await tick();
		await tick();
		const heading = screen.getByRole('heading', { name: /You are on the list/ });
		expect(heading).toHaveAttribute('tabindex', '-1');
		expect(screen.getByText(/Your place in line: #1,204/)).toBeInTheDocument();
		expect(screen.getByText('of 5,890')).toBeInTheDocument();
		expect((screen.getByLabelText('Your share link') as HTMLInputElement).value).toBe(
			'https://x.dev/?ref=ada'
		);
		expect(screen.getByRole('link', { name: 'Share by email' })).toHaveAttribute(
			'href',
			expect.stringContaining('mailto:')
		);
	});

	it('moves focus to the confirmation when the state flips to success', async () => {
		const { rerender } = mount('waitlist', { position: 1 }, { wstate: 'idle' });
		await rerender({ wstate: 'success' });
		await waitFor(() =>
			expect(document.activeElement).toBe(screen.getByRole('heading', { name: /on the list/ }))
		);
	});

	it('copies the link and reports it, or says it could not', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
		const { onEvent } = mount(
			'waitlist',
			{ shareUrl: 'https://x.dev/', referralCode: 'a' },
			{ wstate: 'success' }
		);
		await fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
		await waitFor(() =>
			expect(onEvent).toHaveBeenCalledWith('copy', { url: 'https://x.dev/?ref=a' })
		);
		expect(writeText).toHaveBeenCalledWith('https://x.dev/?ref=a');
		expect(screen.getAllByText('Link copied').length).toBeGreaterThan(0);
		writeText.mockRejectedValueOnce(new Error('no'));
		await fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
		await waitFor(() => expect(screen.getAllByText(/Could not copy/).length).toBeGreaterThan(0));
	});

	it('lets you start again', async () => {
		const { onEvent, state } = mount('waitlist', {}, { wstate: 'success' });
		await fireEvent.click(screen.getByRole('button', { name: 'Use a different email' }));
		expect(onEvent).toHaveBeenCalledWith('reset', null);
		expect(state().wstate).toBe('idle');
		expect(screen.getByLabelText(/Email address/)).toBeInTheDocument();
	});
});

describe('CouponBanner', () => {
	const ends = '2026-10-15T15:04:05Z';

	it('shows a countdown from the injected clock, quiet for screen readers', () => {
		mount('coupon', { endsAt: ends, now: NOW, code: 'SPRING' }, {});
		const timer = screen.getByRole('timer');
		expect(timer).toHaveAttribute('aria-live', 'off');
		expect(
			screen.getByText(
				'2 days, 3 hours, 3 minutes... '.slice(0, 0) + '2 days, 3 hours, 4 minutes left'
			)
		).toBeInTheDocument();
		const digits = timer.querySelector('.coupon__digits') as HTMLElement;
		expect(digits).toHaveAttribute('aria-hidden', 'true');
		expect(digits.textContent).toMatch(/2days03hours04min05sec/);
	});

	it('says the offer has ended and hides the code', () => {
		const onExpire = mount('coupon', { endsAt: '2026-10-01T00:00:00Z', now: NOW, code: 'OLD' });
		expect(screen.getByText('This offer has ended')).toBeInTheDocument();
		expect(screen.queryByText('OLD')).toBeNull();
		expect(onExpire.onEvent).toHaveBeenCalledWith('expire', null);
	});

	it('copies the code and dismisses', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
		const { onEvent } = mount('coupon', { endsAt: ends, now: NOW, code: 'SPRING' });
		await fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
		await waitFor(() => expect(onEvent).toHaveBeenCalledWith('copy', { code: 'SPRING' }));
		expect(screen.getByText('Code copied')).toBeInTheDocument();
		writeText.mockRejectedValueOnce(new Error('x'));
		await fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
		await waitFor(() => expect(screen.getByText('Could not copy the code')).toBeInTheDocument());
		await fireEvent.click(screen.getByRole('button', { name: 'Dismiss offer' }));
		expect(onEvent).toHaveBeenCalledWith('dismiss', null);
		expect(screen.queryByRole('timer')).toBeNull();
	});

	it('can be made not dismissible', () => {
		mount('coupon', { endsAt: ends, now: NOW, dismissible: false });
		expect(screen.queryByRole('button', { name: 'Dismiss offer' })).toBeNull();
	});

	it('keeps its own clock after mount, and stops on unmount', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-10-13T12:00:00Z'));
		const { unmount } = mount('coupon', { endsAt: '2026-10-13T12:00:03Z' });
		await tick();
		expect(screen.getByText('3 seconds left')).toBeInTheDocument();
		await vi.advanceTimersByTimeAsync(1000);
		expect(screen.getByText('2 seconds left')).toBeInTheDocument();
		await vi.advanceTimersByTimeAsync(3000);
		expect(screen.getByText('This offer has ended')).toBeInTheDocument();
		unmount();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('does not tick when told not to, and is reduced-motion safe', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-10-13T12:00:00Z'));
		const { unmount } = mount('coupon', { endsAt: ends, tick: 0 });
		await tick();
		expect(vi.getTimerCount()).toBe(0);
		unmount();
		const original = window.matchMedia;
		window.matchMedia = ((q: string) => ({
			matches: q.includes('reduce'),
			media: q,
			addEventListener() {},
			removeEventListener() {}
		})) as unknown as typeof window.matchMedia;
		mount('coupon', { endsAt: ends });
		await tick();
		const digits = document.querySelector('.coupon__digits') as HTMLElement;
		expect(digits.textContent).not.toMatch(/sec/);
		window.matchMedia = original;
	});

	it('shows a bare clock before it knows the time', () => {
		mount('coupon', { endsAt: ends, tick: 0 });
		expect(screen.getByRole('complementary')).toBeInTheDocument();
	});
});
