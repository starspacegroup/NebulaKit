import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import {
	AuctionInputError,
	CommerceConflictError,
	closeAuction,
	createAuction,
	createProduct,
	ensureAuctionOrder,
	getAuction,
	getOrder,
	lapseAuction,
	placeAuctionBid,
	relistAuction,
	settleDueAuctions,
	transitionOrder
} from '@nebulakit/commerce';
import {
	auctionLapsed,
	auctionOutbid,
	auctionPaymentReminder,
	auctionWon
} from '../../src/lib/emails/auction-templates';
import { actions } from '../../src/routes/auctions/[slug]/+page.server';
import { actions as adminActions } from '../../src/routes/admin/auctions/+page.server';
import { SETTLE_AUCTIONS_JOB } from '../../src/lib/server/scheduler/jobs/settle-auctions';

const START = Date.parse('2030-01-01T00:00:00Z');
const HOUR = 3600_000;
const iso = (ms: number) => new Date(ms).toISOString();
const amy = { id: 'u-amy', email: 'amy@x.test' };
const bo = { id: 'u-bo', email: 'bo@x.test' };

async function setup(over: Record<string, unknown> = {}) {
	const db = createSqliteD1();
	const product = await createProduct(db, {
		slug: 'mug',
		name: 'Blue mug',
		priceCents: 5000,
		type: 'digital'
	});
	const auction = await createAuction(db, {
		slug: 'mug-auction',
		productId: product.id,
		startingCents: 1000,
		startsAt: iso(START),
		endsAt: iso(START + 24 * HOUR),
		payWithinHours: 72,
		...over
	});
	return { db, product, auction };
}
/** An auction that has been won: amy leads, it has closed, and it has an order. */
async function won(over: Record<string, unknown> = {}) {
	const made = await setup(over);
	await placeAuctionBid(made.db, made.auction.id, amy, 5000, START + HOUR);
	await closeAuction(made.db, made.auction.id, { force: true });
	const { order } = await ensureAuctionOrder(made.db, made.auction.id, { now: START + 25 * HOUR });
	return { ...made, order: order! };
}

describe('payment deadline', () => {
	it('sets the due time from when the order is made', async () => {
		const { db, auction } = await won();
		expect((await getAuction(db, auction.id))!.payDueAt).toBe(iso(START + 25 * HOUR + 72 * HOUR));
	});
	it('sets none when there is no deadline', async () => {
		const { db, auction } = await won({ payWithinHours: 0 });
		expect((await getAuction(db, auction.id))!.payDueAt).toBeNull();
	});
	it('refuses a window outside 0 to 720 hours', async () => {
		const { db, product } = await setup();
		for (const hours of [-1, 721, 1.5]) {
			await expect(
				createAuction(db, {
					slug: `s${hours}`.replace('.', '-').replace('-', 'm'),
					productId: product.id,
					startingCents: 100,
					startsAt: iso(START),
					endsAt: iso(START + HOUR),
					payWithinHours: hours
				})
			).rejects.toBeInstanceOf(AuctionInputError);
		}
	});
});

describe('lapsing', () => {
	it('cancels the order and lapses the auction once the deadline passes', async () => {
		const { db, auction, order } = await won();
		const late = START + 25 * HOUR + 73 * HOUR;
		const report = await settleDueAuctions(db, { now: late });
		expect(report).toMatchObject({ lapsed: 1, lapsedIds: [auction.id] });
		expect((await getAuction(db, auction.id))!.status).toBe('lapsed');
		expect((await getOrder(db, order.id))!.status).toBe('cancelled');
		// And it is done: another sweep changes nothing.
		expect(await settleDueAuctions(db, { now: late + HOUR })).toMatchObject({ lapsed: 0 });
	});

	it('leaves a sale alone before the deadline', async () => {
		const { db, auction } = await won();
		expect(await settleDueAuctions(db, { now: START + 30 * HOUR })).toMatchObject({ lapsed: 0 });
		expect((await getAuction(db, auction.id))!.status).toBe('sold');
	});

	it('never lapses a paid order, even long past the deadline', async () => {
		const { db, auction, order } = await won();
		await transitionOrder(db, order.id, 'paid', { paymentReference: 'cs_1' });
		const report = await settleDueAuctions(db, { now: START + 1000 * HOUR });
		expect(report.lapsed).toBe(0);
		expect((await getAuction(db, auction.id))!.status).toBe('sold');
		await expect(lapseAuction(db, auction.id)).rejects.toBeInstanceOf(CommerceConflictError);
		expect((await getOrder(db, order.id))!.status).toBe('paid');
	});

	it('finishes a lapse that died after the order was cancelled', async () => {
		const { db, auction, order } = await won();
		await transitionOrder(db, order.id, 'cancelled'); // the first half of a lapse
		const report = await settleDueAuctions(db, { now: START + 1000 * HOUR });
		expect(report.lapsed).toBe(1);
		expect((await getAuction(db, auction.id))!.status).toBe('lapsed');
	});

	it('does nothing to an auction without a deadline', async () => {
		const { db, auction } = await won({ payWithinHours: 0 });
		expect(await settleDueAuctions(db, { now: START + 5000 * HOUR })).toMatchObject({ lapsed: 0 });
		expect((await getAuction(db, auction.id))!.status).toBe('sold');
	});

	it('refuses to lapse what is not a sold auction with an order', async () => {
		const { db, auction } = await setup();
		await expect(lapseAuction(db, auction.id)).rejects.toBeInstanceOf(CommerceConflictError);
		expect(await lapseAuction(db, 'nope')).toBeNull();
	});
});

describe('reminders', () => {
	it('are claimed once, only inside the reminder window, and only while unpaid', async () => {
		const { db, auction, order } = await won();
		const due = START + 25 * HOUR + 72 * HOUR;
		// 48 hours out: too early.
		expect(await settleDueAuctions(db, { now: due - 48 * HOUR })).toMatchObject({ reminders: 0 });
		// Inside the last 24 hours: claimed.
		const first = await settleDueAuctions(db, { now: due - 20 * HOUR });
		expect(first).toMatchObject({ reminders: 1, reminderIds: [auction.id] });
		// Never again.
		expect(await settleDueAuctions(db, { now: due - 10 * HOUR })).toMatchObject({ reminders: 0 });
		expect((await getAuction(db, auction.id))!.remindedAt).toBeTruthy();
		expect(order.id).toBeTruthy();
	});

	it('are not sent for a paid order', async () => {
		const { db, order } = await won();
		await transitionOrder(db, order.id, 'paid');
		const due = START + 25 * HOUR + 72 * HOUR;
		expect(await settleDueAuctions(db, { now: due - HOUR })).toMatchObject({ reminders: 0 });
	});

	it('come halfway through a window shorter than a day', async () => {
		const { db } = await won({ payWithinHours: 10 });
		const due = START + 25 * HOUR + 10 * HOUR;
		expect(await settleDueAuctions(db, { now: due - 8 * HOUR })).toMatchObject({ reminders: 0 });
		expect(await settleDueAuctions(db, { now: due - 4 * HOUR })).toMatchObject({ reminders: 1 });
	});
});

describe('relisting', () => {
	it('puts an unsold auction back up with the same terms, starting now', async () => {
		const { db, auction } = await setup({
			reserveCents: 5000,
			buyNowCents: 9000,
			extendSeconds: 300
		});
		await closeAuction(db, auction.id, { force: true });
		const now = START + 50 * HOUR;
		const again = await relistAuction(db, auction.id, { now });
		expect(again).toMatchObject({
			slug: 'mug-auction-r2',
			status: 'open',
			title: 'Blue mug',
			productId: auction.productId,
			startingCents: 1000,
			reserveCents: 5000,
			buyNowCents: 9000,
			extendSeconds: 300,
			payWithinHours: 72,
			bidCount: 0,
			currentCents: null,
			relistedFrom: auction.id,
			startsAt: iso(now),
			endsAt: iso(now + 24 * HOUR)
		});
	});

	it('relists a lapsed or cancelled auction, and a relist of a relist keeps one suffix', async () => {
		const { db, auction } = await won();
		await settleDueAuctions(db, { now: START + 1000 * HOUR });
		const second = await relistAuction(db, auction.id, { now: START + 1001 * HOUR });
		expect(second.slug).toBe('mug-auction-r2');
		await closeAuction(db, second.id, { force: true });
		const third = await relistAuction(db, second.id, { now: START + 1100 * HOUR });
		expect(third.slug).toBe('mug-auction-r3');
	});

	it('refuses an open or sold auction, and a second relist while the first is open', async () => {
		const { db, auction } = await setup();
		await expect(relistAuction(db, auction.id)).rejects.toBeInstanceOf(CommerceConflictError);
		await closeAuction(db, auction.id, { force: true });
		await relistAuction(db, auction.id);
		await expect(relistAuction(db, auction.id)).rejects.toThrow(/Already relisted/);

		const sold = await won();
		await expect(relistAuction(sold.db, sold.auction.id)).rejects.toThrow(
			/sold cannot be relisted/
		);
		await expect(relistAuction(sold.db, 'nope')).rejects.toBeInstanceOf(CommerceConflictError);
	});

	it('copes with two relists racing: one wins, the other is refused', async () => {
		const { db, auction } = await setup();
		await closeAuction(db, auction.id, { force: true });
		const results = await Promise.allSettled([
			relistAuction(db, auction.id),
			relistAuction(db, auction.id)
		]);
		expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
	});
});

describe('email templates', () => {
	const ctx = { siteName: 'Shop', siteUrl: 'https://shop.test' };
	it('tell a winner what they owe and by when', () => {
		const mail = auctionWon(
			{
				title: 'Blue mug',
				path: '/auctions/mug',
				finalPrice: '$10.00',
				total: '$12.00',
				payDueAt: '2030-01-05T12:00:00.000Z'
			},
			ctx
		);
		expect(mail.subject).toBe('You won: Blue mug');
		expect(mail.text).toContain('$10.00');
		expect(mail.text).toContain('$12.00');
		expect(mail.text).toContain('January 5, 2030');
		expect(mail.text).toContain('https://shop.test/auctions/mug');
		expect(mail.html).toContain('href="https://shop.test/auctions/mug"');
	});
	it('say nothing of a deadline when there is none', () => {
		const mail = auctionWon(
			{
				title: 'Blue mug',
				path: '/auctions/mug',
				finalPrice: '$10.00',
				total: '$10.00',
				payDueAt: null
			},
			ctx
		);
		expect(mail.text).not.toContain('Please pay by');
	});
	it('tell an outbid bidder the price and the minimum, never who', () => {
		const mail = auctionOutbid(
			{
				title: 'Blue mug',
				path: '/auctions/mug',
				price: '$20.50',
				minimum: '$21.00',
				endsAt: '2030-01-02T00:00:00.000Z'
			},
			ctx
		);
		expect(mail.subject).toBe('You were outbid on Blue mug');
		expect(mail.text).toContain('$20.50');
		expect(mail.text).toContain('$21.00');
		expect(mail.text).not.toMatch(/Bidder [0-9A-F]{4}/);
	});
	it('warn before the deadline and say when the sale is cancelled', () => {
		const reminder = auctionPaymentReminder(
			{
				title: 'Blue mug',
				path: '/auctions/mug',
				total: '$12.00',
				payDueAt: '2030-01-05T12:00:00.000Z'
			},
			ctx
		);
		expect(reminder.text).toContain('due by');
		const lapsed = auctionLapsed({ title: 'Blue mug', path: '/auctions/mug' }, ctx);
		expect(lapsed.subject).toBe('Your win on Blue mug was cancelled');
	});
	it('escape a title that carries markup', () => {
		const mail = auctionOutbid(
			{
				title: '<script>alert(1)</script>',
				path: '/auctions/x',
				price: '$1.00',
				minimum: '$2.00',
				endsAt: '2030-01-02T00:00:00.000Z'
			},
			ctx
		);
		expect(mail.html).not.toContain('<script>');
		expect(mail.html).toContain('&lt;script&gt;');
	});
});

describe('sending', () => {
	const sent: Array<{ to: string[]; subject: string; text: string }> = [];
	const realFetch = globalThis.fetch;
	beforeEach(() => {
		sent.length = 0;
		globalThis.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
			sent.push(JSON.parse(String(init?.body)));
			return new Response(JSON.stringify({ id: `msg_${sent.length}` }), { status: 200 });
		}) as never;
	});
	afterEach(() => {
		globalThis.fetch = realFetch;
	});
	const mailEnv = { RESEND_API_KEY: 're_x', EMAIL_FROM: 'Shop <shop@x.test>' };
	const event = (db: unknown, user: unknown, fields: Record<string, string> = {}) => {
		const body = new FormData();
		for (const [k, v] of Object.entries(fields)) body.set(k, v);
		return {
			params: { slug: 'mug-auction' },
			locals: user ? { user } : {},
			platform: { env: { DB: db, ...mailEnv } },
			url: new URL('https://site.test/auctions/mug-auction'),
			request: new Request('https://site.test/auctions/mug-auction', { method: 'POST', body })
		} as never;
	};
	const bid = actions.bid as (e: never) => Promise<Record<string, unknown>>;
	const buynow = actions.buynow as (e: never) => Promise<Record<string, unknown>>;
	const logged = async (db: ReturnType<typeof createSqliteD1>) =>
		(
			await db
				.prepare('SELECT template, status, related_id FROM email_log ORDER BY created_at, rowid')
				.all<{ template: string; status: string; related_id: string }>()
		).results;

	// Live auctions need "now" times, so these use a window around the real clock.
	async function live(over: Record<string, unknown> = {}) {
		const db = createSqliteD1();
		const product = await createProduct(db, {
			slug: 'mug',
			name: 'Blue mug',
			priceCents: 5000,
			type: 'digital'
		});
		const auction = await createAuction(db, {
			slug: 'mug-auction',
			productId: product.id,
			startingCents: 1000,
			startsAt: iso(Date.now() - HOUR),
			endsAt: iso(Date.now() + 24 * HOUR),
			...over
		});
		return { db, auction };
	}

	it('tells a bidder when they lose the lead, and only then', async () => {
		const { db } = await live();
		const amyUser = { id: amy.id, email: amy.email, isOwner: false };
		const boUser = { id: bo.id, email: bo.email, isOwner: false };
		await bid(event(db, amyUser, { max: '20' }));
		expect(sent).toHaveLength(0); // first bid: nobody to tell
		await bid(event(db, boUser, { max: '10.50' })); // amy defends: she is not outbid
		expect(sent).toHaveLength(0);
		await bid(event(db, boUser, { max: '30' })); // bo takes the lead
		expect(sent).toHaveLength(1);
		expect(sent[0].to).toEqual([amy.email]);
		expect(sent[0].subject).toBe('You were outbid on Blue mug');
		expect(sent[0].text).not.toContain('3000');
		expect(sent[0].text).not.toContain('30.00');
		expect((await logged(db)).map((r) => r.template)).toEqual(['auction-outbid']);
	});

	it('does not send an outbid email for a bid that was refused', async () => {
		const { db } = await live();
		const amyUser = { id: amy.id, email: amy.email, isOwner: false };
		await bid(event(db, amyUser, { max: '20' }));
		await bid(event(db, { id: bo.id, email: bo.email, isOwner: false }, { max: '1' }));
		expect(sent).toHaveLength(0);
	});

	it('tells a buy-now winner once, with their total', async () => {
		const { db } = await live({ buyNowCents: 9000 });
		await buynow(event(db, { id: bo.id, email: bo.email, isOwner: false }));
		expect(sent).toHaveLength(1);
		expect(sent[0]).toMatchObject({ to: [bo.email], subject: 'You won: Blue mug' });
		expect(sent[0].text).toContain('$90.00');
		expect((await logged(db)).map((r) => [r.template, r.status])).toEqual([
			['auction-won', 'sent']
		]);
	});

	it('skips quietly, and logs the skip, when email is not configured', async () => {
		const { db } = await live({ buyNowCents: 9000 });
		const e = event(db, { id: bo.id, email: bo.email, isOwner: false }) as {
			platform: { env: object };
		};
		e.platform.env = { DB: db };
		await buynow(e as never);
		expect(sent).toHaveLength(0);
		expect((await logged(db)).map((r) => [r.template, r.status])).toEqual([
			['auction-won', 'skipped']
		]);
	});

	it('lets the sweep email the winner, remind them, and tell them the sale lapsed, each once', async () => {
		const { db, auction } = await setup();
		await placeAuctionBid(db, auction.id, amy, 5000, START + HOUR);
		const run = (now: number) =>
			SETTLE_AUCTIONS_JOB.run({
				db,
				env: { ...mailEnv },
				now: Math.floor(now / 1000),
				signal: new AbortController().signal,
				params: new URLSearchParams()
			} as never);

		// Closes, orders, emails the winner.
		expect(await run(START + 25 * HOUR)).toMatchObject({ orders: 1 });
		expect(sent.map((m) => m.subject)).toEqual(['You won: Blue mug']);
		// A repeat tick sends nothing more.
		await run(START + 25 * HOUR + 60_000);
		expect(sent).toHaveLength(1);
		// Inside the last day: one reminder, even over several ticks.
		const due = START + 25 * HOUR + 72 * HOUR;
		await run(due - 20 * HOUR);
		await run(due - 19 * HOUR);
		expect(sent.map((m) => m.subject)).toEqual([
			'You won: Blue mug',
			expect.stringContaining('Pay for Blue mug by')
		]);
		// Past the deadline: the sale lapses and the winner is told.
		expect(await run(due + HOUR)).toMatchObject({ lapsed: 1 });
		await run(due + 2 * HOUR);
		expect(sent.at(-1)!.subject).toBe('Your win on Blue mug was cancelled');
		expect(sent).toHaveLength(3);
		expect((await logged(db)).map((r) => r.template)).toEqual([
			'auction-won',
			'auction-payment-reminder',
			'auction-lapsed'
		]);
	});
});

describe('admin relist action', () => {
	const owner = { id: 'u-o', email: 'o@x.test', isOwner: true } as never;
	const adminEvent = (db: unknown, user: unknown, fields: Record<string, string> = {}) => {
		const body = new FormData();
		for (const [k, v] of Object.entries(fields)) body.set(k, v);
		return {
			locals: user ? { user } : {},
			platform: { env: { DB: db } },
			request: new Request('https://site.test/admin/auctions', { method: 'POST', body })
		} as never;
	};
	const relist = adminActions.relist as (e: never) => Promise<Record<string, unknown>>;

	it('needs the shop permission', async () => {
		const { db, auction } = await setup();
		await expect(relist(adminEvent(db, null, { id: auction.id }))).rejects.toMatchObject({
			status: 401
		});
	});
	it('relists, then refuses a double click, a live auction and a missing id', async () => {
		const { db, auction } = await setup();
		expect(await relist(adminEvent(db, owner, { id: auction.id }))).toMatchObject({
			status: 409 // still open
		});
		await closeAuction(db, auction.id, { force: true });
		expect(await relist(adminEvent(db, owner, { id: auction.id }))).toMatchObject({
			action: 'relist',
			message: 'Relisted as mug-auction-r2.'
		});
		expect(await relist(adminEvent(db, owner, { id: auction.id }))).toMatchObject({ status: 409 });
		expect(await relist(adminEvent(db, owner, {}))).toMatchObject({ status: 400 });
	});
});
