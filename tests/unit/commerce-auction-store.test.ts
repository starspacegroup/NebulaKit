import { describe, expect, it } from 'vitest';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import {
	AuctionInputError,
	CommerceConflictError,
	buyNowAuction,
	cancelAuction,
	closeAuction,
	createAuction,
	createProduct,
	ensureAuctionOrder,
	getAuction,
	getOrder,
	listAuctions,
	listBids,
	placeAuctionBid,
	settleDueAuctions
} from '@nebulakit/commerce';

const START = Date.parse('2030-01-01T00:00:00Z');
const HOUR = 3600_000;
const iso = (ms: number) => new Date(ms).toISOString();
const amy = { id: 'u-amy', email: 'amy@x.test' };
const bo = { id: 'u-bo', email: 'bo@x.test' };

async function setup(
	over: Record<string, unknown> = {},
	productOver: Record<string, unknown> = {}
) {
	const db = createSqliteD1();
	const product = await createProduct(db, {
		slug: 'mug',
		name: 'Blue mug',
		priceCents: 5000,
		type: 'digital',
		...productOver
	});
	const auction = await createAuction(db, {
		slug: 'mug-auction',
		productId: product.id,
		startingCents: 1000,
		startsAt: iso(START),
		endsAt: iso(START + 24 * HOUR),
		...over
	});
	return { db, product, auction };
}
const NOW = START + HOUR;

describe('createAuction', () => {
	it('copies the product title and currency and starts open with no bids', async () => {
		const { auction, product } = await setup();
		expect(auction).toMatchObject({
			title: 'Blue mug',
			currency: 'usd',
			productId: product.id,
			status: 'open',
			currentCents: null,
			bidCount: 0
		});
	});

	it('says every reason it refuses', async () => {
		const { db, product } = await setup();
		const err = await createAuction(db, {
			slug: 'Bad Slug',
			productId: 'missing',
			startingCents: 1000,
			reserveCents: 10,
			startsAt: iso(START),
			endsAt: iso(START - 1)
		}).catch((e) => e);
		expect(err).toBeInstanceOf(AuctionInputError);
		expect(err.errors.length).toBeGreaterThanOrEqual(4);
		expect(product.id).toBeTruthy();
	});

	it('refuses a slug already taken', async () => {
		const { db, product } = await setup();
		await expect(
			createAuction(db, {
				slug: 'mug-auction',
				productId: product.id,
				startingCents: 100,
				startsAt: iso(START),
				endsAt: iso(START + HOUR)
			})
		).rejects.toBeInstanceOf(CommerceConflictError);
	});
});

describe('bidding', () => {
	it('records bids and keeps the leader’s max private to the row', async () => {
		const { db, auction } = await setup();
		const first = await placeAuctionBid(db, auction.id, amy, 5000, NOW);
		expect(first).toMatchObject({ ok: true, leading: true, priceAfterCents: 1000 });
		const second = await placeAuctionBid(db, auction.id, bo, 2000, NOW + 1);
		expect(second).toMatchObject({ ok: true, leading: false, priceAfterCents: 2050 });

		const now = (await getAuction(db, auction.id))!;
		expect(now).toMatchObject({
			leaderId: amy.id,
			leaderEmail: amy.email,
			leaderMaxCents: 5000,
			currentCents: 2050,
			bidCount: 2
		});
		const bids = await listBids(db, auction.id);
		expect(bids.map((b) => [b.bidderId, b.leading])).toEqual([
			[bo.id, false],
			[amy.id, true]
		]);
	});

	it('moves the leader’s email with the lead', async () => {
		const { db, auction } = await setup();
		await placeAuctionBid(db, auction.id, amy, 2000, NOW);
		const r = await placeAuctionBid(db, auction.id, bo, 4000, NOW + 1);
		expect(r).toMatchObject({ ok: true, leading: true, outbidId: amy.id });
		expect((await getAuction(db, auction.id))!.leaderEmail).toBe(bo.email);
	});

	it('refuses with the rules’ reason and writes nothing', async () => {
		const { db, auction } = await setup();
		await placeAuctionBid(db, auction.id, amy, 2000, NOW);
		const before = await getAuction(db, auction.id);
		expect(await placeAuctionBid(db, auction.id, bo, 1000, NOW)).toMatchObject({
			ok: false,
			reason: 'too-low'
		});
		expect(await placeAuctionBid(db, auction.id, bo, 5000, START - 1)).toMatchObject({
			reason: 'not-started'
		});
		expect(await placeAuctionBid(db, auction.id, bo, 5000, START + 25 * HOUR)).toMatchObject({
			reason: 'ended'
		});
		expect(await getAuction(db, auction.id)).toEqual(before);
		expect(await listBids(db, auction.id)).toHaveLength(1);
		expect(await placeAuctionBid(db, 'nope', bo, 5000, NOW)).toEqual({
			ok: false,
			reason: 'not-found'
		});
	});

	it('extends the end for a bid in the closing window', async () => {
		const { db, auction } = await setup({ extendSeconds: 300 });
		const late = START + 24 * HOUR - 60_000;
		const r = await placeAuctionBid(db, auction.id, amy, 2000, late);
		expect(r).toMatchObject({ ok: true, extended: true });
		const after = (await getAuction(db, auction.id))!;
		expect(after.endsAt).toBe(iso(late + 300_000));
		expect(after.extensions).toBe(1);
	});

	it('orders racing bids: one version wins, the other is re-run against it', async () => {
		const { db, auction } = await setup();
		// Fired together, both read version 0; only one write can match it.
		const [a, b] = await Promise.all([
			placeAuctionBid(db, auction.id, amy, 3000, NOW),
			placeAuctionBid(db, auction.id, bo, 3000, NOW)
		]);
		expect(a.ok && b.ok).toBe(true);
		const after = (await getAuction(db, auction.id))!;
		expect(after.bidCount).toBe(2);
		expect(after.version).toBe(2);
		expect(await listBids(db, auction.id)).toHaveLength(2);
		// The tie went to whoever was first; the loser is not in front.
		expect([amy.id, bo.id]).toContain(after.leaderId);
		expect(after.currentCents).toBe(3000);
	});

	it('never writes a bid row for a bid that lost the version race', async () => {
		const { db, auction } = await setup();
		await placeAuctionBid(db, auction.id, amy, 3000, NOW);
		// Move the version underneath a bid that has already read it.
		const stale = await getAuction(db, auction.id);
		await db
			.prepare('UPDATE commerce_auctions SET version = version + 1 WHERE id = ?')
			.bind(auction.id)
			.run();
		const results = await db.batch([
			db
				.prepare('UPDATE commerce_auctions SET bid_count = 99 WHERE id = ? AND version = ?')
				.bind(auction.id, stale!.version),
			db
				.prepare(
					`INSERT INTO commerce_auction_bids
					 (id, auction_id, bidder_id, bidder_email, max_cents, price_after_cents, leading)
					 SELECT 'ghost', ?, 'x', 'x@x.test', 1, 1, 0 WHERE changes() > 0`
				)
				.bind(auction.id)
		]);
		expect(results[0].meta.changes).toBe(0);
		expect(await listBids(db, auction.id)).toHaveLength(1);
	});
});

describe('closing', () => {
	it('leaves an auction alone until its end, then sells to the leader at the board price', async () => {
		const { db, auction } = await setup();
		await placeAuctionBid(db, auction.id, amy, 5000, NOW);
		await placeAuctionBid(db, auction.id, bo, 2000, NOW + 1);
		expect((await closeAuction(db, auction.id, { now: NOW }))!.status).toBe('open');
		const closed = (await closeAuction(db, auction.id, { now: START + 25 * HOUR }))!;
		expect(closed).toMatchObject({
			status: 'sold',
			winnerId: amy.id,
			winnerEmail: amy.email,
			finalCents: 2050
		});
		// Closing again changes nothing.
		expect(await closeAuction(db, auction.id, { now: START + 26 * HOUR })).toEqual(closed);
	});

	it('ends unsold when the reserve is not met, or nobody bid', async () => {
		const reserved = await setup({ reserveCents: 9000 });
		await placeAuctionBid(reserved.db, reserved.auction.id, amy, 5000, NOW);
		const closed = await closeAuction(reserved.db, reserved.auction.id, { force: true });
		expect(closed).toMatchObject({ status: 'unsold', winnerId: null, finalCents: null });

		const empty = await setup();
		expect((await closeAuction(empty.db, empty.auction.id, { force: true }))!.status).toBe(
			'unsold'
		);
	});

	it('refuses a bid once closed', async () => {
		const { db, auction } = await setup();
		await closeAuction(db, auction.id, { force: true });
		expect(await placeAuctionBid(db, auction.id, amy, 5000, NOW)).toMatchObject({
			reason: 'not-open'
		});
	});

	it('cancels an open auction once, and not a closed one', async () => {
		const { db, auction } = await setup();
		await placeAuctionBid(db, auction.id, amy, 5000, NOW);
		expect((await cancelAuction(db, auction.id))!.status).toBe('cancelled');
		await expect(cancelAuction(db, auction.id)).rejects.toBeInstanceOf(CommerceConflictError);
		expect(await cancelAuction(db, 'nope')).toBeNull();
	});
});

describe('buy it now', () => {
	it('sells at the buy-now price and closes the auction', async () => {
		const { db, auction } = await setup({ buyNowCents: 9000 });
		const r = await buyNowAuction(db, auction.id, bo, NOW);
		expect(r).toMatchObject({
			ok: true,
			auction: { status: 'sold', winnerId: bo.id, finalCents: 9000 }
		});
		expect(await buyNowAuction(db, auction.id, amy, NOW)).toEqual({
			ok: false,
			reason: 'unavailable'
		});
	});
	it('is refused once a bid has removed it', async () => {
		const { db, auction } = await setup({ buyNowCents: 9000 });
		await placeAuctionBid(db, auction.id, amy, 2000, NOW);
		expect(await buyNowAuction(db, auction.id, bo, NOW)).toEqual({
			ok: false,
			reason: 'unavailable'
		});
	});
	it('lets only one of two racing buyers win', async () => {
		const { db, auction } = await setup({ buyNowCents: 9000 });
		const results = await Promise.all([
			buyNowAuction(db, auction.id, amy, NOW),
			buyNowAuction(db, auction.id, bo, NOW)
		]);
		expect(results.filter((r) => r.ok)).toHaveLength(1);
	});
});

describe('orders for won auctions', () => {
	it('creates one pending order for the winner at the winning price, once', async () => {
		const { db, auction, product } = await setup();
		await placeAuctionBid(db, auction.id, amy, 5000, NOW);
		await closeAuction(db, auction.id, { force: true });

		const first = await ensureAuctionOrder(db, auction.id);
		expect(first.order).toMatchObject({
			status: 'pending',
			email: amy.email,
			currency: 'usd',
			subtotalCents: 1000,
			totalCents: 1000
		});
		expect(first.order!.items).toEqual([
			expect.objectContaining({ productId: product.id, name: 'Blue mug', quantity: 1 })
		]);
		const again = await ensureAuctionOrder(db, auction.id);
		expect(again.order!.id).toBe(first.order!.id);
		const orders = await db
			.prepare('SELECT COUNT(*) AS n FROM commerce_orders')
			.first<{ n: number }>();
		expect(orders!.n).toBe(1);
	});

	it('adds the site’s tax and shipping on a physical product', async () => {
		const { db, auction } = await setup({}, { slug: 'mug2', type: 'physical' });
		await placeAuctionBid(db, auction.id, amy, 5000, NOW);
		await closeAuction(db, auction.id, { force: true });
		const { order } = await ensureAuctionOrder(db, auction.id, {
			taxRule: { enabled: true, ratePercent: 10, pricesIncludeTax: false },
			shippingCents: 500
		});
		expect(order).toMatchObject({
			subtotalCents: 1000,
			shippingCents: 500,
			taxCents: 100,
			totalCents: 1600
		});
	});

	it('gives no order to an auction that did not sell', async () => {
		const { db, auction } = await setup();
		await closeAuction(db, auction.id, { force: true });
		expect((await ensureAuctionOrder(db, auction.id)).order).toBeNull();
	});

	it('creates just one order when two callers race', async () => {
		const { db, auction } = await setup();
		await placeAuctionBid(db, auction.id, amy, 5000, NOW);
		await closeAuction(db, auction.id, { force: true });
		const [a, b] = await Promise.all([
			ensureAuctionOrder(db, auction.id),
			ensureAuctionOrder(db, auction.id)
		]);
		expect(a.order!.id).toBe(b.order!.id);
		const live = await db
			.prepare("SELECT COUNT(*) AS n FROM commerce_orders WHERE status = 'pending'")
			.first<{ n: number }>();
		expect(live!.n).toBe(1);
		expect((await getOrder(db, a.order!.id))!.status).toBe('pending');
	});
});

describe('settleDueAuctions', () => {
	it('closes what is due, orders what sold, and leaves the rest', async () => {
		const { db, product, auction } = await setup();
		await placeAuctionBid(db, auction.id, amy, 5000, NOW);
		const later = await createAuction(db, {
			slug: 'later',
			productId: product.id,
			startingCents: 100,
			startsAt: iso(START),
			endsAt: iso(START + 72 * HOUR)
		});
		const nobody = await createAuction(db, {
			slug: 'nobody',
			productId: product.id,
			startingCents: 100,
			startsAt: iso(START),
			endsAt: iso(START + 2 * HOUR)
		});

		const report = await settleDueAuctions(db, { now: START + 25 * HOUR });
		expect(report).toMatchObject({ closed: 2, sold: 1, unsold: 1, orders: 1, lapsed: 0, reminders: 0 });
		expect((await getAuction(db, auction.id))!.status).toBe('sold');
		expect((await getAuction(db, auction.id))!.orderId).toBeTruthy();
		expect((await getAuction(db, nobody.id))!.status).toBe('unsold');
		expect((await getAuction(db, later.id))!.status).toBe('open');

		// A second sweep has nothing left to do.
		expect(await settleDueAuctions(db, { now: START + 25 * HOUR })).toMatchObject({
			closed: 0,
			sold: 0,
			unsold: 0,
			orders: 0
		});
	});

	it('repairs a sold auction that lost its order', async () => {
		const { db, auction } = await setup();
		await placeAuctionBid(db, auction.id, amy, 5000, NOW);
		await closeAuction(db, auction.id, { force: true }); // no order yet: as after a crash
		const report = await settleDueAuctions(db, { now: NOW });
		expect(report.orders).toBe(1);
	});
});

describe('listAuctions', () => {
	it('lists open ones by soonest end', async () => {
		const { db, product } = await setup();
		await createAuction(db, {
			slug: 'sooner',
			productId: product.id,
			startingCents: 100,
			startsAt: iso(START),
			endsAt: iso(START + HOUR)
		});
		const open = await listAuctions(db, { status: 'open' });
		expect(open.map((a) => a.slug)).toEqual(['sooner', 'mug-auction']);
	});
});
