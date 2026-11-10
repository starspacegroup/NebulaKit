/**
 * Who hears about an auction, and when. Every send is once-only through
 * `email_log` (see email.ts): the same bidder is never told twice about the
 * same outbid, win, reminder or lapse, however often a sweep or a page load
 * comes back to it. None of these throws; a mail provider having a bad day
 * never fails a bid or a sweep.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { formatMoney, getOrder, type Auction, type Order } from '@nebulakit/commerce';
import {
	auctionLapsed,
	auctionOutbid,
	auctionPaymentReminder,
	auctionWon
} from '$lib/emails/auction-templates';
import { site } from '$lib/site.config';
import {
	sendEmail,
	sendEmailAfterResponse,
	type EmailEnv,
	type OutgoingEmail,
	type SendResult
} from '$lib/server/email';

/** How an email leaves: after the response in a request, or straight away in a scheduled job. */
export type Mailer = (email: OutgoingEmail) => Promise<SendResult>;

export function requestMailer(platform: App.Platform | undefined): Mailer {
	return (email) => sendEmailAfterResponse(platform, email);
}

export function jobMailer(env: unknown, db: D1Database): Mailer {
	return (email) => sendEmail({ ...(env as EmailEnv), DB: db }, email);
}

const path = (a: Auction) => `/auctions/${a.slug}`;
const base = site.url;

/** The winner is told they won, with the total and the deadline. Once per auction. */
export function mailWinner(mail: Mailer, auction: Auction, order: Order): Promise<SendResult> {
	if (!auction.winnerEmail) return Promise.resolve({ ok: false, reason: 'no-recipient' });
	const rendered = auctionWon(
		{
			title: auction.title,
			path: path(auction),
			finalPrice: formatMoney(auction.finalCents ?? 0, auction.currency),
			total: formatMoney(order.totalCents, order.currency),
			payDueAt: auction.payDueAt
		},
		{},
		base
	);
	return mail({
		to: auction.winnerEmail,
		...rendered,
		template: 'auction-won',
		relatedType: 'auction',
		relatedId: auction.id
	});
}

/**
 * A bidder who lost the lead is told, once for each time it happens (the
 * auction's version after the bid names the event).
 */
export function mailOutbid(
	mail: Mailer,
	auction: Auction,
	to: string,
	minimumBid: string
): Promise<SendResult> {
	const rendered = auctionOutbid(
		{
			title: auction.title,
			path: path(auction),
			price: formatMoney(auction.currentCents ?? auction.startingCents, auction.currency),
			minimum: minimumBid,
			endsAt: auction.endsAt
		},
		{},
		base
	);
	return mail({
		to,
		...rendered,
		template: 'auction-outbid',
		relatedType: 'auction',
		relatedId: `${auction.id}:${auction.version}`
	});
}

export async function mailReminder(
	mail: Mailer,
	db: D1Database,
	auction: Auction
): Promise<SendResult> {
	const order = auction.orderId ? await getOrder(db, auction.orderId) : null;
	if (!auction.winnerEmail || !auction.payDueAt || !order) {
		return { ok: false, reason: 'no-recipient' };
	}
	const rendered = auctionPaymentReminder(
		{
			title: auction.title,
			path: path(auction),
			total: formatMoney(order.totalCents, order.currency),
			payDueAt: auction.payDueAt
		},
		{},
		base
	);
	return mail({
		to: auction.winnerEmail,
		...rendered,
		template: 'auction-payment-reminder',
		relatedType: 'auction',
		relatedId: auction.id
	});
}

export function mailLapsed(mail: Mailer, auction: Auction): Promise<SendResult> {
	if (!auction.winnerEmail) return Promise.resolve({ ok: false, reason: 'no-recipient' });
	const rendered = auctionLapsed({ title: auction.title, path: path(auction) });
	return mail({
		to: auction.winnerEmail,
		...rendered,
		template: 'auction-lapsed',
		relatedType: 'auction',
		relatedId: auction.id
	});
}
