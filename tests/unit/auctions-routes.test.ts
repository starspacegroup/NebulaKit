import { describe, expect, it } from 'vitest';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import {
	closeAuction,
	createAuction,
	createProduct,
	getAuction,
	getOrder,
	placeAuctionBid,
	listBids
} from '@nebulakit/commerce';
import { actions, load } from '../../src/routes/auctions/[slug]/+page.server';
import { load as listLoad } from '../../src/routes/auctions/+page.server';
import {
	actions as adminActions,
	load as adminLoad
} from '../../src/routes/admin/auctions/+page.server';
import { auctionView, bidViews, parseAuctionValues, parseUtc } from '../../src/lib/server/auctions';
import { SETTLE_AUCTIONS_JOB } from '../../src/lib/server/scheduler/jobs/settle-auctions';

const amy = { id: 'u-amy', email: 'amy@x.test', isOwner: false } as never;
const bo = { id: 'u-bo', email: 'bo@x.test', isOwner: false } as never;
const owner = { id: 'u-owner', email: 'o@x.test', isOwner: true } as never;
const shopAdmin = { id: 'u-adm', email: 'a@x.test', isAdmin: true, permissions: ['shop'] } as never;

const NOW = Date.now();
const HOUR = 3600_000;
const iso = (ms: number) => new Date(ms).toISOString();

async function setup(over: Record<string, unknown> = {}, product: Record<string, unknown> = {}) {
	const db = createSqliteD1();
	const made = await createProduct(db, {
		slug: 'mug',
		name: 'Blue mug',
		priceCents: 5000,
		type: 'digital',
		...product
	});
	const auction = await createAuction(db, {
		slug: 'mug-auction',
		productId: made.id,
		startingCents: 1000,
		startsAt: iso(NOW - HOUR),
		endsAt: iso(NOW + 24 * HOUR),
		...over
	});
	return { db, auction, product: made };
}

const event = (db: unknown, user: unknown, fields: Record<string, string> = {}, env = {}) => {
	const body = new FormData();
	for (const [k, v] of Object.entries(fields)) body.set(k, v);
	return {
		params: { slug: 'mug-auction' },
		locals: user ? { user } : {},
		platform: db ? { env: { DB: db, ...env } } : undefined,
		url: new URL('https://site.test/auctions/mug-auction'),
		request: new Request('https://site.test/auctions/mug-auction', { method: 'POST', body })
	} as never;
};
const run = (name: keyof typeof actions) =>
	actions[name] as (e: never) => Promise<Record<string, unknown>>;

describe('public auction page', () => {
	it('shows the price and bid history without emails, maximums or the reserve', async () => {
		const { db, auction } = await setup({ reserveCents: 9000 });
		// A leader whose maximum is under the reserve: the price is still the starting price.
		await placeAuctionBid(db, auction.id, { id: 'u-amy', email: 'amy@x.test' }, 7777);
		const data = (await load(event(db, null) as never)) as never as {
			auction: Record<string, unknown>;
			bids: unknown[];
		};
		const text = JSON.stringify(data);
		expect(text).not.toContain('amy@x.test');
		expect(text).not.toContain('7777');
		expect(text).not.toContain('77.77');
		expect(text).not.toContain('9000');
		expect(text).not.toContain('90.00');
		expect(data.auction).toMatchObject({
			phase: 'live',
			bidCount: 1,
			reserve: 'not-met',
			price: '$10.00'
		});
		expect(data.bids).toHaveLength(1);
	});

	it('shows the price at the reserve once it is met, and no more', async () => {
		const { db, auction } = await setup({ reserveCents: 9000 });
		await placeAuctionBid(db, auction.id, { id: 'u-amy', email: 'amy@x.test' }, 20_000);
		const data = (await load(event(db, null) as never)) as never as {
			auction: Record<string, unknown>;
		};
		expect(data.auction).toMatchObject({ reserve: 'met', price: '$90.00' });
		expect(JSON.stringify(data)).not.toContain('20000');
	});

	it('404s an unknown auction', async () => {
		const { db } = await setup();
		await expect(
			load({ ...(event(db, null) as object), params: { slug: 'nope' } } as never)
		).rejects.toMatchObject({ status: 404 });
	});

	it('closes an auction whose time is up the moment it is read', async () => {
		const { db, auction } = await setup({
			startsAt: iso(NOW - 3 * HOUR),
			endsAt: iso(NOW - HOUR)
		});
		await load(event(db, null) as never);
		expect((await getAuction(db, auction.id))!.status).toBe('unsold');
	});

	it('says only that the viewer leads, never who else does', async () => {
		const { db, auction } = await setup();
		await placeAuctionBid(db, auction.id, { id: 'u-amy', email: 'amy@x.test' }, 5000);
		const asAmy = auctionView((await getAuction(db, auction.id))!, 'u-amy');
		const asBo = auctionView((await getAuction(db, auction.id))!, 'u-bo');
		expect(asAmy.youLead).toBe(true);
		expect(asBo.youLead).toBe(false);
		expect(asBo.leader).toMatch(/^Bidder [0-9A-F]{4}$/);
		const bids = bidViews(await listBids(db, auction.id), 'usd');
		expect(bids[0].at).toMatch(/Z$/);
	});
});

describe('bidding', () => {
	it('sends a signed-out visitor to sign in, and keeps their place', async () => {
		const { db } = await setup();
		await expect(run('bid')(event(db, null, { max: '20' }))).rejects.toMatchObject({
			status: 303,
			location: '/auth/login?next=%2Fauctions%2Fmug-auction'
		});
	});

	it('places a bid in dollars and says who leads', async () => {
		const { db, auction } = await setup();
		expect(await run('bid')(event(db, amy, { max: '50' }))).toMatchObject({
			message: 'You are the highest bidder.'
		});
		expect(await run('bid')(event(db, bo, { max: '20' }))).toMatchObject({
			message: expect.stringContaining('outbid')
		});
		const now = (await getAuction(db, auction.id))!;
		expect(now).toMatchObject({ leaderId: 'u-amy', leaderMaxCents: 5000, currentCents: 2050 });
	});

	it('explains a refusal and keeps what was typed', async () => {
		const { db } = await setup();
		expect(await run('bid')(event(db, amy, { max: 'lots' }))).toMatchObject({
			status: 400,
			data: { problem: 'Enter your bid in dollars and cents.', max: 'lots' }
		});
		expect(await run('bid')(event(db, amy, { max: '5' }))).toMatchObject({
			status: 409,
			data: { problem: 'Your bid is below the minimum.', max: '5' }
		});
	});

	it('reports a missing database', async () => {
		await expect(run('bid')(event(null, amy, { max: '5' }))).rejects.toMatchObject({
			status: 503
		});
	});
});

describe('buy now', () => {
	it('buys at the buy-now price once, then it is gone', async () => {
		const { db, auction } = await setup({ buyNowCents: 9000 });
		expect(await run('buynow')(event(db, amy))).toMatchObject({ action: 'buynow' });
		expect((await getAuction(db, auction.id))!).toMatchObject({
			status: 'sold',
			winnerId: 'u-amy',
			finalCents: 9000
		});
		expect(await run('buynow')(event(db, bo))).toMatchObject({ status: 409 });
	});
});

describe('winning and paying', () => {
	it('gives the winner an order when they look, and lets nobody else pay', async () => {
		const { db, auction } = await setup();
		await placeAuctionBid(db, auction.id, { id: 'u-amy', email: 'amy@x.test' }, 5000);
		await closeAuction(db, auction.id, { force: true });

		const data = (await load(event(db, amy) as never)) as never as {
			auction: { youWon: boolean };
			order: { status: string; total: string; needsAddress: boolean } | null;
		};
		expect(data.auction.youWon).toBe(true);
		expect(data.order).toMatchObject({ status: 'pending', total: '$10.00', needsAddress: false });

		const bystander = (await load(event(db, bo) as never)) as never as {
			order: unknown;
			auction: { orderId: string | null };
		};
		expect(bystander.order).toBeNull();
		expect(bystander.auction.orderId).toBeNull();
		await expect(run('pay')(event(db, bo))).rejects.toMatchObject({ status: 403 });
		await expect(run('pay')(event(db, null))).rejects.toMatchObject({ status: 303 });
	});

	it('places the order for manual payment when Stripe is not set up', async () => {
		const { db, auction } = await setup();
		await placeAuctionBid(db, auction.id, { id: 'u-amy', email: 'amy@x.test' }, 5000);
		await closeAuction(db, auction.id, { force: true });
		expect(await run('pay')(event(db, amy))).toMatchObject({
			action: 'pay',
			message: expect.stringContaining('The shop will contact you')
		});
		const sold = (await getAuction(db, auction.id))!;
		const order = (await getOrder(db, sold.orderId!))!;
		expect(order).toMatchObject({ status: 'pending', paymentProvider: 'manual', totalCents: 1000 });
		expect(order.paymentReference).toBe(`manual_${order.id}`);
	});

	it('asks for a shipping address on a physical product, and refuses a bad one', async () => {
		const { db, auction } = await setup({}, { slug: 'poster', type: 'physical' });
		await placeAuctionBid(db, auction.id, { id: 'u-amy', email: 'amy@x.test' }, 5000);
		await closeAuction(db, auction.id, { force: true });
		const data = (await load(event(db, amy) as never)) as never as {
			order: { needsAddress: boolean };
		};
		expect(data.order.needsAddress).toBe(true);

		expect(await run('pay')(event(db, amy, { name: 'Amy' }))).toMatchObject({ status: 400 });
		expect(
			await run('pay')(
				event(db, amy, {
					name: 'Amy A',
					line1: '1 Main St',
					city: 'Portland',
					state: 'ME',
					postalCode: '04101',
					country: 'us'
				})
			)
		).toMatchObject({ action: 'pay' });
		const order = (await getOrder(db, (await getAuction(db, auction.id))!.orderId!))!;
		expect(order.shippingAddress).toMatchObject({ city: 'Portland', country: 'US' });
	});

	it('sends the winner to Stripe when it is configured', async () => {
		const { db, auction } = await setup();
		await placeAuctionBid(db, auction.id, { id: 'u-amy', email: 'amy@x.test' }, 5000);
		await closeAuction(db, auction.id, { force: true });
		const realFetch = globalThis.fetch;
		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ id: 'cs_1', url: 'https://pay.stripe.test/cs_1' }), {
				status: 200
			})) as typeof fetch;
		try {
			await expect(
				run('pay')(event(db, amy, {}, { STRIPE_SECRET_KEY: 'sk_test_x' }))
			).rejects.toMatchObject({ status: 303, location: 'https://pay.stripe.test/cs_1' });
		} finally {
			globalThis.fetch = realFetch;
		}
		const order = (await getOrder(db, (await getAuction(db, auction.id))!.orderId!))!;
		expect(order).toMatchObject({ paymentProvider: 'stripe', paymentReference: 'cs_1' });
	});
});

describe('public list', () => {
	it('lists open auctions, and what sold', async () => {
		const { db, auction, product } = await setup();
		await createAuction(db, {
			slug: 'sold-one',
			productId: product.id,
			startingCents: 100,
			startsAt: iso(NOW - 2 * HOUR),
			endsAt: iso(NOW + HOUR)
		});
		await placeAuctionBid(db, auction.id, { id: 'u-amy', email: 'amy@x.test' }, 5000);
		await closeAuction(db, auction.id, { force: true });
		const data = (await listLoad({
			locals: {},
			platform: { env: { DB: db } }
		} as never)) as never as {
			open: Array<{ slug: string }>;
			sold: Array<{ slug: string }>;
		};
		expect(data.open.map((a) => a.slug)).toEqual(['sold-one']);
		expect(data.sold.map((a) => a.slug)).toEqual(['mug-auction']);
	});
});

describe('/admin/auctions', () => {
	const adminEvent = (db: unknown, user: unknown, fields: Record<string, string> = {}) => {
		const body = new FormData();
		for (const [k, v] of Object.entries(fields)) body.set(k, v);
		return {
			locals: user ? { user } : {},
			platform: db ? { env: { DB: db } } : undefined,
			request: new Request('https://site.test/admin/auctions', { method: 'POST', body })
		} as never;
	};
	const act = (name: keyof typeof adminActions) =>
		adminActions[name] as (e: never) => Promise<Record<string, unknown>>;
	const fields = (productId: string) => ({
		product_id: productId,
		slug: 'new-auction',
		title: '',
		starting: '10',
		reserve: '50',
		buy_now: '90',
		increment: '',
		starts_at: '2030-01-01T09:00',
		ends_at: '2030-01-02T09:00',
		extend_seconds: '300',
		pay_within_hours: '72'
	});

	it('needs the shop permission for the load and every action', async () => {
		const { db } = await setup();
		await expect(adminLoad(adminEvent(db, null))).rejects.toMatchObject({ status: 401 });
		await expect(
			adminLoad(adminEvent(db, { isAdmin: true, permissions: ['pages'] }))
		).rejects.toMatchObject({ status: 403 });
		for (const name of ['create', 'end', 'cancel'] as const) {
			await expect(act(name)(adminEvent(db, null))).rejects.toMatchObject({ status: 401 });
		}
		await expect(adminLoad(adminEvent(db, shopAdmin))).resolves.toBeTruthy();
	});

	it('creates an auction from dollars and UTC times', async () => {
		const { db, product } = await setup();
		expect(await act('create')(adminEvent(db, owner, fields(product.id)))).toMatchObject({
			message: 'Created Blue mug.'
		});
		const created = (await getAuction(db, 'new-auction'))!;
		expect(created).toMatchObject({
			startingCents: 1000,
			reserveCents: 5000,
			buyNowCents: 9000,
			extendSeconds: 300,
			startsAt: '2030-01-01T09:00:00.000Z',
			endsAt: '2030-01-02T09:00:00.000Z'
		});
	});

	it('shows a rejected form back as typed, with every reason', async () => {
		const { db, product } = await setup();
		const result = await act('create')(
			adminEvent(db, owner, { ...fields(product.id), starting: 'free', reserve: '5', ends_at: '' })
		);
		expect(result).toMatchObject({
			status: 400,
			data: { action: 'create', values: { starting: 'free', slug: 'new-auction' } }
		});
		const problems = (result as never as { data: { problems: string[] } }).data.problems;
		expect(problems).toContain('Starting price must be dollars and cents, like 10.00.');
		expect(problems).toContain('Choose an end time.');
	});

	it('refuses a taken slug and an unknown product', async () => {
		const { db, product } = await setup();
		expect(
			await act('create')(adminEvent(db, owner, { ...fields(product.id), slug: 'mug-auction' }))
		).toMatchObject({ status: 409 });
		expect(await act('create')(adminEvent(db, owner, fields('missing')))).toMatchObject({
			status: 400,
			data: { problems: expect.arrayContaining(['Pick a product to auction.']) }
		});
	});

	it('ends an auction now: sells to the leader and creates the order', async () => {
		const { db, auction } = await setup();
		await placeAuctionBid(db, auction.id, { id: 'u-amy', email: 'amy@x.test' }, 5000);
		expect(await act('end')(adminEvent(db, owner, { id: auction.id }))).toMatchObject({
			message: 'Ended. Sold to the high bidder for $10.00.'
		});
		const sold = (await getAuction(db, auction.id))!;
		expect(sold).toMatchObject({ status: 'sold', winnerEmail: 'amy@x.test' });
		expect(sold.orderId).toBeTruthy();
	});

	it('cancels an open auction, and refuses a closed one', async () => {
		const { db, auction } = await setup();
		expect(await act('cancel')(adminEvent(db, owner, { id: auction.id }))).toMatchObject({
			action: 'cancel'
		});
		expect(await act('cancel')(adminEvent(db, owner, { id: auction.id }))).toMatchObject({
			status: 409
		});
		expect(await act('cancel')(adminEvent(db, owner, { id: 'nope' }))).toMatchObject({
			status: 404
		});
		expect(await act('end')(adminEvent(db, owner, {}))).toMatchObject({ status: 400 });
	});

	it('lists auctions with the private fields only an admin sees', async () => {
		const { db, auction } = await setup({ reserveCents: 5000 });
		await placeAuctionBid(db, auction.id, { id: 'u-amy', email: 'amy@x.test' }, 5000);
		const data = (await adminLoad(adminEvent(db, owner))) as never as {
			auctions: Array<{ reserve: string; leaderEmail: string }>;
		};
		expect(data.auctions[0]).toMatchObject({ reserve: '$50.00', leaderEmail: 'amy@x.test' });
	});
});

describe('form parsing', () => {
	it('reads a datetime-local value as UTC and refuses anything else', () => {
		expect(parseUtc('2030-01-01T09:30')).toBe(Date.parse('2030-01-01T09:30:00Z'));
		for (const bad of ['', '2030-01-01', 'soon', '2030-13-45T99:99']) {
			expect(parseUtc(bad)).toBeNull();
		}
	});
	it('refuses a non-numeric extension', () => {
		const parsed = parseAuctionValues({
			productId: 'p',
			slug: 's',
			title: '',
			starting: '1',
			reserve: '',
			buyNow: '',
			increment: '',
			startsAt: '2030-01-01T09:00',
			endsAt: '2030-01-02T09:00',
			extendSeconds: '-5',
			payWithinHours: '0'
		});
		expect(parsed.ok).toBe(false);
	});
});

describe('the settle-auctions job', () => {
	it('closes ended auctions and orders the winner, with the site’s pricing', async () => {
		const { db, auction } = await setup({
			startsAt: iso(NOW - 3 * HOUR),
			endsAt: iso(NOW - HOUR)
		});
		// Bids are refused after the end, so write the leader the way an earlier bid would have.
		await db
			.prepare(
				`UPDATE commerce_auctions SET current_cents = 1000, leader_id = 'u-amy',
				 leader_email = 'amy@x.test', leader_max_cents = 5000, bid_count = 1 WHERE id = ?`
			)
			.bind(auction.id)
			.run();
		const detail = await SETTLE_AUCTIONS_JOB.run({
			db,
			env: { COMMERCE_TAX_RATE_PERCENT: '10' },
			now: Math.floor(NOW / 1000),
			signal: new AbortController().signal,
			params: new URLSearchParams()
		} as never);
		expect(detail).toEqual({ closed: 1, sold: 1, unsold: 0, orders: 1, lapsed: 0, reminders: 0 });
		const order = (await getOrder(db, (await getAuction(db, auction.id))!.orderId!))!;
		expect(order).toMatchObject({ subtotalCents: 1000, taxCents: 100, totalCents: 1100 });
	});
});
