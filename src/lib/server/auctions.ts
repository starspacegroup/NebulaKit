import {
	AUCTION_STATUSES,
	auctionPhase,
	auctionState,
	bidderAlias,
	buyNowAvailable,
	formatMoney,
	minimumBidCents,
	reserveMet,
	type Auction,
	type AuctionBid,
	type AuctionInput,
	type AuctionPhase
} from '@nebulakit/commerce';
import { centsToDollars, dollarsToCents } from './admin-products';

/**
 * What the public may see of an auction. Never an email, never the leader's
 * maximum, never the reserve amount: only whether the reserve has been met.
 */
export interface AuctionView {
	id: string;
	slug: string;
	title: string;
	phase: AuctionPhase;
	startsAt: string;
	endsAt: string;
	/** The price to beat, or the starting price before any bid. */
	price: string;
	priceCents: number;
	bidCount: number;
	/** `none` = no reserve; otherwise whether the reserve has been met. */
	reserve: 'none' | 'met' | 'not-met';
	buyNow: { price: string; available: boolean } | null;
	minimumBid: string;
	minimumBidInput: string;
	leader: string | null;
	extendSeconds: number;
	youLead: boolean;
	youWon: boolean;
	finalPrice: string | null;
	orderId: string | null;
	/** When the winner must pay by, shown only to the winner. */
	payDueAt: string | null;
}

export function auctionView(
	auction: Auction,
	viewerId: string | null,
	now = Date.now()
): AuctionView {
	const state = auctionState(auction);
	const priceCents = auction.currentCents ?? auction.startingCents;
	const money = (c: number) => formatMoney(c, auction.currency);
	return {
		id: auction.id,
		slug: auction.slug,
		title: auction.title,
		phase: auctionPhase(auction, now),
		startsAt: auction.startsAt,
		endsAt: auction.endsAt,
		price: money(priceCents),
		priceCents,
		bidCount: auction.bidCount,
		reserve: auction.reserveCents === null ? 'none' : reserveMet(state) ? 'met' : 'not-met',
		buyNow:
			auction.buyNowCents === null
				? null
				: { price: money(auction.buyNowCents), available: buyNowAvailable(state, now) },
		minimumBid: money(minimumBidCents(state)),
		minimumBidInput: centsToDollars(minimumBidCents(state)),
		leader: auction.leaderId ? bidderAlias(auction.leaderId) : null,
		extendSeconds: auction.extendSeconds,
		youLead: viewerId !== null && auction.status === 'open' && auction.leaderId === viewerId,
		youWon: viewerId !== null && auction.status === 'sold' && auction.winnerId === viewerId,
		finalPrice: auction.finalCents === null ? null : money(auction.finalCents),
		orderId: viewerId !== null && auction.winnerId === viewerId ? auction.orderId : null,
		payDueAt: viewerId !== null && auction.winnerId === viewerId ? auction.payDueAt : null
	};
}

export interface BidView {
	bidder: string;
	price: string;
	leading: boolean;
	at: string;
}

/** The public bid history: who (as an alias) pushed the price to what, never a maximum. */
export function bidViews(bids: AuctionBid[], currency: string): BidView[] {
	return bids.map((bid) => ({
		bidder: bidderAlias(bid.bidderId),
		price: formatMoney(bid.priceAfterCents, currency),
		leading: bid.leading,
		// D1's datetime('now') is UTC without a zone; say so.
		at: new Date(
			bid.createdAt.includes('T') ? bid.createdAt : `${bid.createdAt.replace(' ', 'T')}Z`
		).toISOString()
	}));
}

/** What an admin typed into the auction form, kept to show a rejected form back as typed. */
export interface AuctionFormValues {
	productId: string;
	slug: string;
	title: string;
	starting: string;
	reserve: string;
	buyNow: string;
	increment: string;
	startsAt: string;
	endsAt: string;
	extendSeconds: string;
	payWithinHours: string;
}

export function readAuctionForm(form: FormData): AuctionFormValues {
	const field = (key: string) => String(form.get(key) ?? '').trim();
	return {
		productId: field('product_id'),
		slug: field('slug').toLowerCase(),
		title: field('title'),
		starting: field('starting'),
		reserve: field('reserve'),
		buyNow: field('buy_now'),
		increment: field('increment'),
		startsAt: field('starts_at'),
		endsAt: field('ends_at'),
		extendSeconds: field('extend_seconds') || '0',
		payWithinHours: field('pay_within_hours') || '0'
	};
}

/** `2030-01-01T09:30` from a datetime-local field is read as UTC; null if it is not a date. */
export function parseUtc(value: string): number | null {
	if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
	const ms = Date.parse(`${value}:00Z`);
	return Number.isFinite(ms) ? ms : null;
}

export function utcInput(iso: string): string {
	return iso.slice(0, 16);
}

export type ParsedAuction = { ok: true; value: AuctionInput } | { ok: false; errors: string[] };

export function parseAuctionValues(values: AuctionFormValues): ParsedAuction {
	const errors: string[] = [];
	const starting = dollarsToCents(values.starting);
	if (starting === null) errors.push('Starting price must be dollars and cents, like 10.00.');
	const optional = (raw: string, label: string) => {
		if (!raw) return null;
		const cents = dollarsToCents(raw);
		if (cents === null) errors.push(`${label} must be dollars and cents, like 10.00.`);
		return cents;
	};
	const reserve = optional(values.reserve, 'Reserve price');
	const buyNow = optional(values.buyNow, 'Buy-now price');
	const increment = optional(values.increment, 'Bid increment');
	const startsAt = parseUtc(values.startsAt);
	const endsAt = parseUtc(values.endsAt);
	if (startsAt === null) errors.push('Choose a start time.');
	if (endsAt === null) errors.push('Choose an end time.');
	const extend = Number(values.extendSeconds);
	if (!/^\d+$/.test(values.extendSeconds) || !Number.isSafeInteger(extend)) {
		errors.push('Extension must be a whole number of seconds.');
	}
	const payWithin = Number(values.payWithinHours);
	if (!/^\d+$/.test(values.payWithinHours) || !Number.isSafeInteger(payWithin)) {
		errors.push('Payment window must be a whole number of hours.');
	}
	if (errors.length || starting === null || startsAt === null || endsAt === null) {
		return { ok: false, errors };
	}
	return {
		ok: true,
		value: {
			slug: values.slug,
			productId: values.productId,
			title: values.title,
			startingCents: starting,
			reserveCents: reserve,
			buyNowCents: buyNow,
			incrementCents: increment,
			startsAt: new Date(startsAt).toISOString(),
			endsAt: new Date(endsAt).toISOString(),
			extendSeconds: extend,
			payWithinHours: payWithin
		}
	};
}

export const STATUS_LABELS: Record<(typeof AUCTION_STATUSES)[number], string> = {
	open: 'Open',
	sold: 'Sold',
	unsold: 'Ended without a sale',
	cancelled: 'Cancelled',
	lapsed: 'Sold, but the winner did not pay'
};
