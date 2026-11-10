/**
 * D1 storage for auctions: `commerce_auctions` and `commerce_auction_bids`
 * (migration 0026). The rules are in auction.ts; this file reads and writes
 * what they decide.
 *
 * Every write that depends on the auction's state is a compare-and-set on
 * `version`: the rules run against a snapshot, and the write lands only if the
 * auction is still that snapshot. A lost race re-reads and runs the rules
 * again, so two bids at the same moment are ordered, never both applied.
 */
import type { D1Database } from '@cloudflare/workers-types';
import {
	buyNow,
	placeBid,
	settleAuction,
	validateAuctionTerms,
	phaseOf,
	type AuctionPhase,
	type AuctionState,
	type AuctionStatus,
	type AuctionTerms,
	type BidRefused,
	type Settlement
} from './auction';
import { calculateTaxCents, calculateTotalCents, NO_TAX, type TaxRule } from './money';
import type { PricedCart } from './cart';
import { CommerceConflictError, createOrder, getOrder, getProduct } from './store';
import type { Order, Product } from './types';

type Row = Record<string, unknown>;

export interface Auction {
	id: string;
	slug: string;
	productId: string;
	title: string;
	currency: string;
	startingCents: number;
	reserveCents: number | null;
	buyNowCents: number | null;
	incrementCents: number | null;
	startsAt: string;
	endsAt: string;
	extendSeconds: number;
	extensions: number;
	status: AuctionStatus;
	currentCents: number | null;
	leaderId: string | null;
	leaderEmail: string | null;
	leaderMaxCents: number | null;
	bidCount: number;
	version: number;
	winnerId: string | null;
	winnerEmail: string | null;
	finalCents: number | null;
	orderId: string | null;
	settledAt: string | null;
	/** Hours a winner has to pay once their order exists. 0 = no deadline. */
	payWithinHours: number;
	/** When the winner's payment is due; null when there is no deadline or no order yet. */
	payDueAt: string | null;
	remindedAt: string | null;
	/** The auction this one replaced. */
	relistedFrom: string | null;
	createdAt: string;
}

export interface AuctionBid {
	id: string;
	auctionId: string;
	bidderId: string;
	bidderEmail: string;
	maxCents: number;
	priceAfterCents: number;
	leading: boolean;
	createdAt: string;
}

const nullable = (value: unknown) => (value === null || value === undefined ? null : Number(value));

function toAuction(row: Row): Auction {
	return {
		id: row.id as string,
		slug: row.slug as string,
		productId: row.product_id as string,
		title: row.title as string,
		currency: row.currency as string,
		startingCents: Number(row.starting_cents),
		reserveCents: nullable(row.reserve_cents),
		buyNowCents: nullable(row.buy_now_cents),
		incrementCents: nullable(row.increment_cents),
		startsAt: row.starts_at as string,
		endsAt: row.ends_at as string,
		extendSeconds: Number(row.extend_seconds),
		extensions: Number(row.extensions),
		status: row.status as AuctionStatus,
		currentCents: nullable(row.current_cents),
		leaderId: (row.leader_id as string | null) ?? null,
		leaderEmail: (row.leader_email as string | null) ?? null,
		leaderMaxCents: nullable(row.leader_max_cents),
		bidCount: Number(row.bid_count),
		version: Number(row.version),
		winnerId: (row.winner_id as string | null) ?? null,
		winnerEmail: (row.winner_email as string | null) ?? null,
		finalCents: nullable(row.final_cents),
		orderId: (row.order_id as string | null) ?? null,
		settledAt: (row.settled_at as string | null) ?? null,
		payWithinHours: Number(row.pay_within_hours ?? 0),
		payDueAt: (row.pay_due_at as string | null) ?? null,
		remindedAt: (row.reminded_at as string | null) ?? null,
		relistedFrom: (row.relisted_from as string | null) ?? null,
		createdAt: row.created_at as string
	};
}

function toBid(row: Row): AuctionBid {
	return {
		id: row.id as string,
		auctionId: row.auction_id as string,
		bidderId: row.bidder_id as string,
		bidderEmail: row.bidder_email as string,
		maxCents: Number(row.max_cents),
		priceAfterCents: Number(row.price_after_cents),
		leading: Number(row.leading) === 1,
		createdAt: row.created_at as string
	};
}

/** The auction as the rules see it: times as milliseconds. */
export function auctionState(auction: Auction): AuctionState {
	return {
		status: auction.status,
		startingCents: auction.startingCents,
		reserveCents: auction.reserveCents,
		buyNowCents: auction.buyNowCents,
		incrementCents: auction.incrementCents,
		startsAt: Date.parse(auction.startsAt),
		endsAt: Date.parse(auction.endsAt),
		extendSeconds: auction.extendSeconds,
		extensions: auction.extensions,
		currentCents: auction.currentCents,
		leaderId: auction.leaderId,
		leaderMaxCents: auction.leaderMaxCents,
		bidCount: auction.bidCount
	};
}

export function auctionPhase(auction: Auction, now = Date.now()): AuctionPhase {
	return phaseOf(auctionState(auction), now);
}

export class AuctionInputError extends Error {
	readonly status = 400;
	constructor(readonly errors: string[]) {
		super(errors.join(' '));
	}
}

export interface AuctionInput {
	slug: string;
	productId: string;
	/** Defaults to the product's name. */
	title?: string;
	startingCents: number;
	reserveCents?: number | null;
	buyNowCents?: number | null;
	incrementCents?: number | null;
	startsAt: string;
	endsAt: string;
	extendSeconds?: number;
	/** Hours the winner has to pay; 0 or absent = no deadline. */
	payWithinHours?: number;
	/** The auction this one replaces (set by relisting). */
	relistedFrom?: string | null;
}

export const MAX_PAY_WITHIN_HOURS = 720;

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

function isUniqueViolation(err: unknown): boolean {
	return err instanceof Error && /UNIQUE constraint failed/i.test(err.message);
}

export async function createAuction(db: D1Database, input: AuctionInput): Promise<Auction> {
	const errors: string[] = [];
	if (!SLUG.test(input.slug)) errors.push('Slug must be lowercase letters, digits and dashes.');
	const product = await getProduct(db, input.productId);
	if (!product) errors.push('Pick a product to auction.');
	const terms: AuctionTerms = {
		startingCents: input.startingCents,
		reserveCents: input.reserveCents ?? null,
		buyNowCents: input.buyNowCents ?? null,
		incrementCents: input.incrementCents ?? null,
		startsAt: Date.parse(input.startsAt),
		endsAt: Date.parse(input.endsAt),
		extendSeconds: input.extendSeconds ?? 0
	};
	errors.push(...validateAuctionTerms(terms));
	const payWithin = input.payWithinHours ?? 0;
	if (!Number.isInteger(payWithin) || payWithin < 0 || payWithin > MAX_PAY_WITHIN_HOURS) {
		errors.push(`Payment window must be 0 to ${MAX_PAY_WITHIN_HOURS} hours.`);
	}
	if (errors.length || !product) throw new AuctionInputError(errors);

	const id = crypto.randomUUID();
	try {
		await db
			.prepare(
				`INSERT INTO commerce_auctions
				 (id, slug, product_id, title, currency, starting_cents, reserve_cents, buy_now_cents,
				  increment_cents, starts_at, ends_at, extend_seconds, pay_within_hours, relisted_from)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				id,
				input.slug,
				product.id,
				(input.title ?? '').trim() || product.name,
				product.currency,
				terms.startingCents,
				terms.reserveCents,
				terms.buyNowCents,
				terms.incrementCents,
				new Date(terms.startsAt).toISOString(),
				new Date(terms.endsAt).toISOString(),
				terms.extendSeconds,
				payWithin,
				input.relistedFrom ?? null
			)
			.run();
	} catch (err) {
		if (isUniqueViolation(err)) throw new CommerceConflictError(`Slug "${input.slug}" is taken`);
		throw err;
	}
	return (await getAuction(db, id)) as Auction;
}

export async function getAuction(db: D1Database, idOrSlug: string): Promise<Auction | null> {
	const row = await db
		.prepare('SELECT * FROM commerce_auctions WHERE id = ? OR slug = ? LIMIT 1')
		.bind(idOrSlug, idOrSlug)
		.first<Row>();
	return row ? toAuction(row) : null;
}

export async function listAuctions(
	db: D1Database,
	options: { status?: AuctionStatus; limit?: number } = {}
): Promise<Auction[]> {
	const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
	const query = options.status
		? db
				.prepare(
					'SELECT * FROM commerce_auctions WHERE status = ? ORDER BY ends_at ASC, slug LIMIT ?'
				)
				.bind(options.status, limit)
		: db.prepare('SELECT * FROM commerce_auctions ORDER BY ends_at DESC, slug LIMIT ?').bind(limit);
	const { results } = await query.all<Row>();
	return results.map(toAuction);
}

export async function listBids(
	db: D1Database,
	auctionId: string,
	limit = 100
): Promise<AuctionBid[]> {
	const { results } = await db
		.prepare(
			'SELECT * FROM commerce_auction_bids WHERE auction_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?'
		)
		.bind(auctionId, Math.min(Math.max(limit, 1), 500))
		.all<Row>();
	return results.map(toBid);
}

export interface Bidder {
	id: string;
	email: string;
}

export type PlaceBidResult =
	| {
			ok: true;
			auction: Auction;
			leading: boolean;
			priceAfterCents: number;
			outbidId: string | null;
			/** The address of the bidder who just lost the lead, for the "outbid" email. */
			outbidEmail: string | null;
			extended: boolean;
	  }
	| BidRefused
	| { ok: false; reason: 'not-found' | 'busy' };

const MAX_ATTEMPTS = 6;

/**
 * Place a bid. The rules run against the auction as just read, and the write
 * (auction row and bid row, in one batch) lands only if `version` is still the
 * one read. On a lost race it reads again and re-runs the rules, so the
 * answer the bidder gets is the answer for the auction as it truly was.
 */
export async function placeAuctionBid(
	db: D1Database,
	auctionId: string,
	bidder: Bidder,
	maxCents: number,
	now = Date.now()
): Promise<PlaceBidResult> {
	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		const auction = await getAuction(db, auctionId);
		if (!auction) return { ok: false, reason: 'not-found' };
		const outcome = placeBid(auctionState(auction), { bidderId: bidder.id, maxCents }, now);
		if (!outcome.ok) return outcome;

		const next = outcome.next;
		const leaderEmail =
			next.leaderId === auction.leaderId
				? auction.leaderEmail
				: next.leaderId === bidder.id
					? bidder.email
					: auction.leaderEmail;
		const results = await db.batch([
			db
				.prepare(
					`UPDATE commerce_auctions
					 SET current_cents = ?, leader_id = ?, leader_email = ?, leader_max_cents = ?,
					     bid_count = ?, ends_at = ?, extensions = ?, version = version + 1,
					     updated_at = datetime('now')
					 WHERE id = ? AND version = ? AND status = 'open'`
				)
				.bind(
					next.currentCents,
					next.leaderId,
					leaderEmail,
					next.leaderMaxCents,
					next.bidCount,
					new Date(next.endsAt).toISOString(),
					next.extensions,
					auction.id,
					auction.version
				),
			// Written only if the update above changed a row: changes() is the
			// row count of the statement just run on this connection, so a lost
			// race (0 rows) writes no bid, whatever the version has become.
			db
				.prepare(
					`INSERT INTO commerce_auction_bids
					 (id, auction_id, bidder_id, bidder_email, max_cents, price_after_cents, leading)
					 SELECT ?, ?, ?, ?, ?, ?, ? WHERE changes() > 0`
				)
				.bind(
					crypto.randomUUID(),
					auction.id,
					bidder.id,
					bidder.email,
					maxCents,
					outcome.priceAfterCents,
					outcome.leading ? 1 : 0
				)
		]);
		if ((results[0]?.meta?.changes ?? 0) === 0) continue; // lost the race: read again
		return {
			ok: true,
			auction: (await getAuction(db, auction.id)) as Auction,
			leading: outcome.leading,
			priceAfterCents: outcome.priceAfterCents,
			outbidId: outcome.outbidId,
			outbidEmail: outcome.outbidId ? auction.leaderEmail : null,
			extended: outcome.extended
		};
	}
	return { ok: false, reason: 'busy' };
}

/** Write a closing: only if the auction is still open and still the snapshot read. */
async function close(
	db: D1Database,
	auction: Auction,
	settlement: Settlement,
	winnerEmail: string | null,
	status: AuctionStatus = settlement.status
): Promise<boolean> {
	const result = await db
		.prepare(
			`UPDATE commerce_auctions
			 SET status = ?, winner_id = ?, winner_email = ?, final_cents = ?,
			     settled_at = datetime('now'), version = version + 1, updated_at = datetime('now')
			 WHERE id = ? AND version = ? AND status = 'open'`
		)
		.bind(
			status,
			settlement.winnerId,
			winnerEmail,
			settlement.finalCents,
			auction.id,
			auction.version
		)
		.run();
	return (result.meta?.changes ?? 0) > 0;
}

export type BuyNowResult =
	{ ok: true; auction: Auction } | { ok: false; reason: 'not-found' | 'unavailable' | 'busy' };

/** Buy an auction outright at its buy-now price, while that is on offer. */
export async function buyNowAuction(
	db: D1Database,
	auctionId: string,
	buyer: Bidder,
	now = Date.now()
): Promise<BuyNowResult> {
	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		const auction = await getAuction(db, auctionId);
		if (!auction) return { ok: false, reason: 'not-found' };
		const outcome = buyNow(auctionState(auction), buyer.id, now);
		if (!outcome.ok) return outcome;
		if (await close(db, auction, outcome.settlement, buyer.email)) {
			return { ok: true, auction: (await getAuction(db, auction.id)) as Auction };
		}
	}
	return { ok: false, reason: 'busy' };
}

/**
 * Close an auction as the rules say: sold to the leader if the reserve was
 * met, unsold otherwise. `force` ends it before its time (the admin's "End
 * now"); without it an auction that has not reached its end is left alone.
 */
export async function closeAuction(
	db: D1Database,
	auctionId: string,
	options: { now?: number; force?: boolean } = {}
): Promise<Auction | null> {
	const now = options.now ?? Date.now();
	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		const auction = await getAuction(db, auctionId);
		if (!auction) return null;
		if (auction.status !== 'open') return auction;
		const state = auctionState(auction);
		if (!options.force && now < state.endsAt) return auction;
		const settlement = settleAuction(state);
		const email = settlement.winnerId ? auction.leaderEmail : null;
		if (await close(db, auction, settlement, email)) return getAuction(db, auction.id);
	}
	throw new CommerceConflictError('The auction changed while it was being closed');
}

/** Cancel an auction. Only one still open can be; a sold auction has an order to cancel instead. */
export async function cancelAuction(db: D1Database, auctionId: string): Promise<Auction | null> {
	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		const auction = await getAuction(db, auctionId);
		if (!auction) return null;
		if (auction.status !== 'open') {
			throw new CommerceConflictError(`An auction that is ${auction.status} cannot be cancelled`);
		}
		const none: Settlement = { status: 'unsold', winnerId: null, finalCents: null };
		if (await close(db, auction, none, null, 'cancelled')) return getAuction(db, auction.id);
	}
	throw new CommerceConflictError('The auction changed while it was being cancelled');
}

export interface OrderPricing {
	taxRule?: TaxRule;
	/** Flat shipping, charged when the product is physical. */
	shippingCents?: number;
	paymentProvider?: string;
	/** The clock, in ms. Only the payment deadline reads it. */
	now?: number;
}

/** The winning price as a one-line cart: nothing regional, no quantity to choose. */
export function auctionCart(
	product: Product,
	finalCents: number,
	pricing: OrderPricing = {}
): PricedCart {
	const taxRule = pricing.taxRule ?? NO_TAX;
	const shippingCents = product.type === 'physical' ? (pricing.shippingCents ?? 0) : 0;
	const taxCents = calculateTaxCents(finalCents, taxRule);
	return {
		lines: [
			{
				product,
				quantity: 1,
				unitPriceCents: finalCents,
				baseUnitPriceCents: finalCents,
				lineTotalCents: finalCents
			}
		],
		currency: product.currency,
		subtotalCents: finalCents,
		baseSubtotalCents: finalCents,
		shippingCents,
		taxCents,
		totalCents: calculateTotalCents(finalCents, shippingCents, taxCents, taxRule),
		taxRule
	};
}

/**
 * Give a sold auction its order, once. Safe to call again and again: an
 * auction that already has an order is returned as is, and two racing callers
 * cannot both attach one (the loser's order is cancelled).
 */
export async function ensureAuctionOrder(
	db: D1Database,
	auctionId: string,
	pricing: OrderPricing = {}
): Promise<{ auction: Auction; order: Order | null }> {
	const auction = await getAuction(db, auctionId);
	if (!auction) throw new CommerceConflictError('Unknown auction');
	if (auction.orderId) return { auction, order: await getOrder(db, auction.orderId) };
	if (auction.status !== 'sold') return { auction, order: null };
	const product = await getProduct(db, auction.productId);
	if (!product || auction.finalCents === null || !auction.winnerEmail) {
		throw new CommerceConflictError('The auction has no product or winner to bill');
	}
	const cart = auctionCart({ ...product, name: auction.title }, auction.finalCents, pricing);
	const order = await createOrder(db, cart, {
		email: auction.winnerEmail,
		shippingAddress: null,
		paymentProvider: pricing.paymentProvider ?? 'manual'
	});
	const result = await db
		.prepare(
			`UPDATE commerce_auctions SET order_id = ?, pay_due_at = ?, updated_at = datetime('now')
			 WHERE id = ? AND order_id IS NULL`
		)
		.bind(
			order.id,
			auction.payWithinHours > 0
				? new Date((pricing.now ?? Date.now()) + auction.payWithinHours * 3600_000).toISOString()
				: null,
			auction.id
		)
		.run();
	if ((result.meta?.changes ?? 0) === 0) {
		// Someone else attached an order first; ours is a duplicate, so void it.
		await db
			.prepare(
				`UPDATE commerce_orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ? AND status = 'pending'`
			)
			.bind(order.id)
			.run();
		return ensureAuctionOrder(db, auctionId, pricing);
	}
	return { auction: (await getAuction(db, auction.id)) as Auction, order };
}

export interface SettleReport {
	closed: number;
	sold: number;
	unsold: number;
	/** Orders created this sweep. */
	orders: number;
	/** Sold auctions whose winner did not pay in time. */
	lapsed: number;
	/** "Pay soon" reminders claimed this sweep. */
	reminders: number;
	/** Which auctions each of the above happened to, so the caller can email the people involved. */
	ordered: string[];
	lapsedIds: string[];
	reminderIds: string[];
}

/** A reminder goes out this long before the deadline, or halfway through a shorter window. */
export const REMINDER_HOURS = 24;

/**
 * An unpaid winner loses the sale: the order is cancelled, then the auction
 * becomes `lapsed`. The order goes first and only from `pending`, so an order
 * that was paid a moment ago is never cancelled and its auction never lapses.
 * A crash between the two steps is finished by the next sweep (a cancelled
 * order past its deadline lapses its auction).
 */
export async function lapseAuction(db: D1Database, auctionId: string): Promise<Auction | null> {
	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		const auction = await getAuction(db, auctionId);
		if (!auction) return null;
		if (auction.status !== 'sold' || !auction.orderId) {
			throw new CommerceConflictError('Only a sold auction with an order can lapse');
		}
		const order = await getOrder(db, auction.orderId);
		if (order && order.status !== 'cancelled') {
			if (order.status !== 'pending') {
				throw new CommerceConflictError('The order is already paid, so the sale stands');
			}
			const cancelled = await db
				.prepare(
					`UPDATE commerce_orders SET status = 'cancelled', updated_at = datetime('now')
					 WHERE id = ? AND status = 'pending'`
				)
				.bind(order.id)
				.run();
			if ((cancelled.meta?.changes ?? 0) === 0) continue; // paid or changed just now: look again
		}
		const result = await db
			.prepare(
				`UPDATE commerce_auctions SET status = 'lapsed', version = version + 1, updated_at = datetime('now')
				 WHERE id = ? AND version = ? AND status = 'sold'`
			)
			.bind(auction.id, auction.version)
			.run();
		if ((result.meta?.changes ?? 0) > 0) return getAuction(db, auction.id);
	}
	throw new CommerceConflictError('The auction changed while it was being lapsed');
}

/**
 * Put a finished, unsold, lapsed or cancelled auction back up: same terms, same
 * product, starting now for as long as it ran the first time. An auction can be
 * relisted once at a time (the double click is refused).
 */
export async function relistAuction(
	db: D1Database,
	auctionId: string,
	options: { now?: number } = {}
): Promise<Auction> {
	const from = await getAuction(db, auctionId);
	if (!from) throw new CommerceConflictError('Unknown auction');
	if (from.status === 'open' || from.status === 'sold') {
		throw new CommerceConflictError(`An auction that is ${from.status} cannot be relisted`);
	}
	const live = await db
		.prepare(
			"SELECT slug FROM commerce_auctions WHERE relisted_from = ? AND status = 'open' LIMIT 1"
		)
		.bind(from.id)
		.first<Row>();
	if (live) throw new CommerceConflictError(`Already relisted as ${live.slug as string}`);

	const now = options.now ?? Date.now();
	const ran = Date.parse(from.endsAt) - Date.parse(from.startsAt);
	const duration = Math.min(Math.max(ran, 3600_000), 60 * 24 * 3600_000);
	const root = from.slug.replace(/-r\d+$/, '');
	for (let n = 2; n < 1000; n++) {
		const slug = `${root}-r${n}`;
		if (await db.prepare('SELECT 1 AS x FROM commerce_auctions WHERE slug = ?').bind(slug).first())
			continue;
		try {
			return await createAuction(db, {
				slug,
				productId: from.productId,
				title: from.title,
				startingCents: from.startingCents,
				reserveCents: from.reserveCents,
				buyNowCents: from.buyNowCents,
				incrementCents: from.incrementCents,
				startsAt: new Date(now).toISOString(),
				endsAt: new Date(now + duration).toISOString(),
				extendSeconds: from.extendSeconds,
				payWithinHours: from.payWithinHours,
				relistedFrom: from.id
			});
		} catch (err) {
			if (!(err instanceof CommerceConflictError)) throw err;
			// Either another relist took this slug, or another relist of this very auction won.
			const winner = await db
				.prepare(
					"SELECT slug FROM commerce_auctions WHERE relisted_from = ? AND status = 'open' LIMIT 1"
				)
				.bind(from.id)
				.first<Row>();
			if (winner) throw new CommerceConflictError(`Already relisted as ${winner.slug as string}`);
		}
	}
	throw new CommerceConflictError('No free slug to relist under');
}

/**
 * The sweep the scheduler runs, in four steps, each safe to repeat:
 *  1. close every auction whose time is up;
 *  2. give every sold auction without one its order (this also repairs a crash
 *     between the two);
 *  3. lapse sold auctions whose winner is past the payment deadline;
 *  4. claim the "pay soon" reminder, once, for winners nearing it.
 */
export async function settleDueAuctions(
	db: D1Database,
	options: { now?: number; pricing?: OrderPricing; limit?: number } = {}
): Promise<SettleReport> {
	const now = options.now ?? Date.now();
	const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
	const report: SettleReport = {
		closed: 0,
		sold: 0,
		unsold: 0,
		orders: 0,
		lapsed: 0,
		reminders: 0,
		ordered: [],
		lapsedIds: [],
		reminderIds: []
	};

	const due = await db
		.prepare(
			"SELECT id FROM commerce_auctions WHERE status = 'open' AND ends_at <= ? ORDER BY ends_at LIMIT ?"
		)
		.bind(new Date(now).toISOString(), limit)
		.all<Row>();
	for (const row of due.results) {
		const closed = await closeAuction(db, row.id as string, { now });
		if (closed && closed.status !== 'open') {
			report.closed += 1;
			if (closed.status === 'sold') report.sold += 1;
			else report.unsold += 1;
		}
	}

	const owed = await db
		.prepare(
			"SELECT id FROM commerce_auctions WHERE status = 'sold' AND order_id IS NULL ORDER BY settled_at LIMIT ?"
		)
		.bind(limit)
		.all<Row>();
	for (const row of owed.results) {
		const before = await getAuction(db, row.id as string);
		const { order } = await ensureAuctionOrder(db, row.id as string, {
			...options.pricing,
			now
		});
		if (order && before && !before.orderId) {
			report.orders += 1;
			report.ordered.push(before.id);
		}
	}

	const late = await db
		.prepare(
			`SELECT a.id FROM commerce_auctions a JOIN commerce_orders o ON o.id = a.order_id
			 WHERE a.status = 'sold' AND a.pay_due_at IS NOT NULL AND a.pay_due_at <= ?
			   AND o.status IN ('pending', 'cancelled') ORDER BY a.pay_due_at LIMIT ?`
		)
		.bind(new Date(now).toISOString(), limit)
		.all<Row>();
	for (const row of late.results) {
		try {
			const lapsed = await lapseAuction(db, row.id as string);
			if (lapsed?.status === 'lapsed') {
				report.lapsed += 1;
				report.lapsedIds.push(lapsed.id);
			}
		} catch (err) {
			if (!(err instanceof CommerceConflictError)) throw err; // paid in the meantime: the sale stands
		}
	}

	const soon = await db
		.prepare(
			`SELECT a.id, a.pay_due_at, a.pay_within_hours FROM commerce_auctions a
			 JOIN commerce_orders o ON o.id = a.order_id
			 WHERE a.status = 'sold' AND a.pay_due_at IS NOT NULL AND a.reminded_at IS NULL
			   AND a.pay_due_at > ? AND o.status = 'pending' ORDER BY a.pay_due_at LIMIT ?`
		)
		.bind(new Date(now).toISOString(), limit)
		.all<Row>();
	for (const row of soon.results) {
		const windowHours = Number(row.pay_within_hours);
		const leadMs = Math.min(REMINDER_HOURS, windowHours / 2) * 3600_000;
		if (Date.parse(row.pay_due_at as string) - now > leadMs) continue;
		const claimed = await db
			.prepare(
				`UPDATE commerce_auctions SET reminded_at = ?, updated_at = datetime('now')
				 WHERE id = ? AND reminded_at IS NULL`
			)
			.bind(new Date(now).toISOString(), row.id)
			.run();
		if ((claimed.meta?.changes ?? 0) > 0) {
			report.reminders += 1;
			report.reminderIds.push(row.id as string);
		}
	}
	return report;
}
