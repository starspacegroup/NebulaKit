import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
// happy-dom reports no form method, which SvelteKit's enhance refuses; the actions are not under test.
vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }) }));

import Detail from '../../src/routes/auctions/[slug]/+page.svelte';
import List from '../../src/routes/auctions/+page.svelte';
import Admin from '../../src/routes/admin/auctions/+page.svelte';

const view = (over: Record<string, unknown> = {}) => ({
	id: 'a1',
	slug: 'mug',
	title: 'Blue mug',
	phase: 'live',
	startsAt: '2030-01-01T00:00:00.000Z',
	endsAt: '2030-01-02T00:00:00.000Z',
	price: '$10.00',
	priceCents: 1000,
	bidCount: 0,
	reserve: 'none',
	buyNow: null,
	minimumBid: '$10.00',
	minimumBidInput: '10.00',
	leader: null,
	extendSeconds: 0,
	youLead: false,
	youWon: false,
	finalPrice: null,
	orderId: null,
	payDueAt: null,
	...over
});
const detail = (over: Record<string, unknown> = {}, auction: Record<string, unknown> = {}) =>
	({
		auction: view(auction),
		description: 'Holds coffee.',
		imageUrl: null,
		physical: false,
		bids: [],
		signedIn: true,
		order: null,
		...over
	}) as never;

describe('/auctions/[slug]', () => {
	it('lets a signed-in visitor bid, and says the minimum', () => {
		render(Detail, { data: detail(), form: null });
		expect(screen.getByRole('heading', { name: 'Blue mug' })).toBeTruthy();
		expect(screen.getByText('Starting price')).toBeTruthy();
		expect(screen.getByLabelText('Your maximum bid')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Place bid' })).toBeTruthy();
		expect(screen.getByText(/Minimum \$10.00/)).toBeTruthy();
		expect(screen.getByText('No bids yet.')).toBeTruthy();
	});

	it('asks a signed-out visitor to sign in, and keeps their place', () => {
		render(Detail, { data: detail({ signedIn: false }), form: null });
		expect(screen.queryByRole('button', { name: 'Place bid' })).toBeNull();
		const link = screen.getByRole('link', { name: 'Sign in' });
		expect(link.getAttribute('href')).toBe('/auth/login?next=/auctions/mug');
	});

	it('shows the reserve status, the buy-now button and the extension note', () => {
		render(Detail, {
			data: detail(
				{},
				{
					bidCount: 2,
					reserve: 'not-met',
					buyNow: { price: '$90.00', available: true },
					extendSeconds: 300
				}
			),
			form: null
		});
		expect(screen.getByText('Current price')).toBeTruthy();
		expect(screen.getByText('Not yet met')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Buy now for $90.00' })).toBeTruthy();
		expect(screen.getByText(/extends the auction/)).toBeTruthy();
	});

	it('hides the buy-now button once it is gone', () => {
		render(Detail, {
			data: detail({}, { buyNow: { price: '$90.00', available: false } }),
			form: null
		});
		expect(screen.queryByRole('button', { name: /Buy now/ })).toBeNull();
	});

	it('tells the leader they lead, and shows a refusal with what was typed', () => {
		render(Detail, {
			data: detail({}, { youLead: true }),
			form: { action: 'bid', problem: 'Your bid is below the minimum.', max: '5' } as never
		});
		expect(screen.getByRole('alert').textContent).toContain('below the minimum');
		expect((screen.getByLabelText('Your maximum bid') as HTMLInputElement).value).toBe('5');
		expect(screen.getByText('You are the highest bidder.')).toBeTruthy();
	});

	it('lists the bid history by alias', () => {
		render(Detail, {
			data: detail({
				bids: [
					{ bidder: 'Bidder 7F3A', price: '$10.50', leading: true, at: '2030-01-01T00:10:00.000Z' }
				]
			}),
			form: null
		});
		const list = screen.getByRole('list', { name: 'Bid history' });
		expect(within(list).getByText('Bidder 7F3A')).toBeTruthy();
		expect(within(list).getByText('$10.50')).toBeTruthy();
	});

	it('shows how a closed auction ended', () => {
		const cases: Array<[string, RegExp]> = [
			['unsold', /ended without a sale/],
			['cancelled', /was cancelled/],
			['scheduled', /Bidding opens/]
		];
		for (const [phase, text] of cases) {
			const { unmount } = render(Detail, { data: detail({}, { phase }), form: null });
			expect(screen.getByText(text)).toBeTruthy();
			expect(screen.queryByRole('button', { name: 'Place bid' })).toBeNull();
			unmount();
		}
	});

	it('gives the winner a pay button, with an address form for a physical product', () => {
		render(Detail, {
			data: detail(
				{ order: { status: 'pending', total: '$10.00', needsAddress: true } },
				{ phase: 'sold', youWon: true, finalPrice: '$10.00' }
			),
			form: null
		});
		expect(screen.getByRole('heading', { name: 'You won this auction' })).toBeTruthy();
		expect(screen.getByText('Total due: $10.00')).toBeTruthy();
		expect(screen.getByLabelText('Postal code')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Pay now' })).toBeTruthy();
	});

	it('tells the winner when to pay by', () => {
		render(Detail, {
			data: detail(
				{ order: { status: 'pending', total: '$10.00', needsAddress: false } },
				{ phase: 'sold', youWon: true, finalPrice: '$10.00', payDueAt: '2030-01-05T12:00:00.000Z' }
			),
			form: null
		});
		expect(screen.getByText(/Please pay by Jan 5, 2030/)).toBeTruthy();
	});

	it('says a lapsed auction ended without a completed sale', () => {
		render(Detail, { data: detail({}, { phase: 'lapsed' }), form: null });
		expect(screen.getByText(/ended without a completed sale/)).toBeTruthy();
	});

	it('shows a paid order as thanks, not a pay button', () => {
		render(Detail, {
			data: detail(
				{ order: { status: 'paid', total: '$10.00', needsAddress: false } },
				{ phase: 'sold', youWon: true, finalPrice: '$10.00' }
			),
			form: null
		});
		expect(screen.queryByRole('button', { name: 'Pay now' })).toBeNull();
		expect(screen.getByText(/Your order is paid/)).toBeTruthy();
	});
});

describe('/auctions', () => {
	it('lists open and sold auctions', () => {
		render(List, {
			data: {
				open: [view({ bidCount: 3, youLead: true })],
				sold: [
					view({ id: 'a2', slug: 'old', title: 'Old tote', phase: 'sold', finalPrice: '$25.00' })
				]
			} as never
		});
		const open = screen.getByRole('list', { name: 'Open auctions' });
		expect(
			within(open)
				.getByRole('link', { name: /Blue mug/ })
				.getAttribute('href')
		).toBe('/auctions/mug');
		expect(within(open).getByText('You are winning')).toBeTruthy();
		expect(within(open).getByText(/3 bids/)).toBeTruthy();
		expect(screen.getByText('Sold for $25.00')).toBeTruthy();
	});
	it('says when nothing is open', () => {
		render(List, { data: { open: [], sold: [] } as never });
		expect(screen.getByText('No auctions are open right now.')).toBeTruthy();
	});
});

describe('/admin/auctions', () => {
	const row = (over: Record<string, unknown> = {}) => ({
		id: 'a1',
		slug: 'mug',
		title: 'Blue mug',
		phase: 'live',
		status: 'open',
		startsAt: '2030-01-01T00:00:00.000Z',
		endsAt: '2030-01-02T00:00:00.000Z',
		starting: '$10.00',
		reserve: '$50.00',
		buyNow: null,
		current: '$12.00',
		final: null,
		bidCount: 2,
		leaderEmail: 'amy@x.test',
		winnerEmail: null,
		orderId: null,
		payDueAt: null,
		payWithinHours: 72,
		relistedFrom: null,
		...over
	});
	const products = [{ id: 'p1', name: 'Blue mug', active: false, price: '$50.00' }];

	it('offers the form and lists an open auction with End now and Cancel', () => {
		render(Admin, { data: { products, auctions: [row()] } as never, form: null });
		expect(screen.getByRole('button', { name: 'Start auction' })).toBeTruthy();
		expect(screen.getByLabelText(/Reserve price/)).toBeTruthy();
		expect(screen.getByRole('option', { name: /Blue mug.*archived/ })).toBeTruthy();
		const list = screen.getByRole('list', { name: 'Auctions' });
		expect(within(list).getByText('amy@x.test')).toBeTruthy();
		expect(within(list).getByRole('button', { name: 'End Blue mug now' })).toBeTruthy();
		expect(within(list).getByRole('button', { name: 'Cancel Blue mug' })).toBeTruthy();
	});

	it('gives a closed auction no actions, and shows its winner and order', () => {
		render(Admin, {
			data: {
				products,
				auctions: [
					row({
						status: 'sold',
						phase: 'sold',
						final: '$12.00',
						winnerEmail: 'amy@x.test',
						orderId: 'o-1'
					})
				]
			} as never,
			form: null
		});
		expect(screen.queryByRole('button', { name: /End Blue mug/ })).toBeNull();
		expect(screen.getByText('Winner')).toBeTruthy();
		expect(screen.getByText('o-1')).toBeTruthy();
	});

	it('offers Relist for an auction that did not sell, lapsed or was cancelled, and for no other', () => {
		for (const status of ['unsold', 'lapsed', 'cancelled'] as const) {
			const { unmount } = render(Admin, {
				data: { products, auctions: [row({ status, phase: status })] } as never,
				form: null
			});
			expect(screen.getByRole('button', { name: 'Relist Blue mug' })).toBeTruthy();
			expect(screen.queryByRole('button', { name: /End Blue mug/ })).toBeNull();
			unmount();
		}
		render(Admin, {
			data: { products, auctions: [row({ status: 'sold', phase: 'sold' })] } as never,
			form: null
		});
		expect(screen.queryByRole('button', { name: /Relist/ })).toBeNull();
	});

	it('shows when a sold auction must be paid by, and the payment window field', () => {
		render(Admin, {
			data: {
				products,
				auctions: [
					row({
						status: 'sold',
						phase: 'sold',
						payDueAt: '2030-01-05T12:00:00.000Z',
						winnerEmail: 'amy@x.test'
					})
				]
			} as never,
			form: null
		});
		expect(screen.getByText('Payment due')).toBeTruthy();
		expect((screen.getByLabelText(/Winner must pay within/) as HTMLInputElement).value).toBe('72');
	});

	it('shows a rejected form as typed, and a success message', () => {
		render(Admin, {
			data: { products, auctions: [] } as never,
			form: {
				action: 'create',
				problems: ['Choose an end time.'],
				values: {
					productId: 'p1',
					slug: 'typed-slug',
					title: '',
					starting: 'free',
					reserve: '',
					buyNow: '',
					increment: '',
					startsAt: '',
					endsAt: '',
					extendSeconds: '300',
					payWithinHours: '72'
				}
			} as never
		});
		expect(screen.getByRole('alert').textContent).toContain('Choose an end time.');
		expect((screen.getByLabelText('Starting price') as HTMLInputElement).value).toBe('free');
		expect((screen.getByLabelText('Slug') as HTMLInputElement).value).toBe('typed-slug');
		expect(screen.getByText('No auctions yet.')).toBeTruthy();
	});
});
