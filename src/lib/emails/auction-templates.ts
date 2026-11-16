/**
 * The emails an auction sends, as pure functions over `notice()`.
 *
 * Like the rest of `templates.ts` they read nothing and send nothing: they take
 * what the email should say and return `{ subject, html, text }`. Prices arrive
 * already formatted, so the wording is testable without a database or a currency.
 */
import { notice, type EmailContext, type RenderedEmail } from './templates';

function absolute(path: string, ctx: EmailContext, base: string): string {
	return new URL(path, ctx.siteUrl ?? base).href;
}

const when = (iso: string) =>
	new Date(iso).toLocaleString('en-US', {
		dateStyle: 'long',
		timeStyle: 'short',
		timeZone: 'UTC'
	}) + ' UTC';

export interface AuctionEmailSubject {
	title: string;
	/** `/auctions/<slug>` */
	path: string;
}

/** To the winner: the auction is theirs and here is how to pay. */
export function auctionWon(
	a: AuctionEmailSubject & { finalPrice: string; total: string; payDueAt: string | null },
	ctx: EmailContext = {},
	base = 'https://example.com'
): RenderedEmail {
	return notice(
		{
			subject: `You won: ${a.title}`,
			heading: `You won ${a.title}`,
			paragraphs: [
				`Your winning price is ${a.finalPrice}. Your total, with any tax and shipping, is ${a.total}.`,
				a.payDueAt
					? `Please pay by ${when(a.payDueAt)}. After that the sale goes to someone else.`
					: 'Open the auction to pay and finish your order.'
			],
			cta: { label: 'Pay now', href: absolute(a.path, ctx, base) }
		},
		ctx
	);
}

/** To a bidder who lost the lead. Never says by how much or who: only the price and the minimum. */
export function auctionOutbid(
	a: AuctionEmailSubject & { price: string; minimum: string; endsAt: string },
	ctx: EmailContext = {},
	base = 'https://example.com'
): RenderedEmail {
	return notice(
		{
			subject: `You were outbid on ${a.title}`,
			heading: `Someone outbid you on ${a.title}`,
			paragraphs: [
				`The price is now ${a.price}. To take the lead again, bid at least ${a.minimum}.`,
				`The auction ends ${when(a.endsAt)}.`
			],
			cta: { label: 'Bid again', href: absolute(a.path, ctx, base) }
		},
		ctx
	);
}

/** To the winner, once, shortly before the payment deadline. */
export function auctionPaymentReminder(
	a: AuctionEmailSubject & { total: string; payDueAt: string },
	ctx: EmailContext = {},
	base = 'https://example.com'
): RenderedEmail {
	return notice(
		{
			subject: `Pay for ${a.title} by ${when(a.payDueAt)}`,
			heading: `Your payment for ${a.title} is due soon`,
			paragraphs: [
				`You won this auction. Your total is ${a.total}, due by ${when(a.payDueAt)}.`,
				'If it is not paid by then, the sale is cancelled.'
			],
			cta: { label: 'Pay now', href: absolute(a.path, ctx, base) }
		},
		ctx
	);
}

/** To the winner whose deadline passed: the sale is cancelled. */
export function auctionLapsed(a: AuctionEmailSubject, ctx: EmailContext = {}): RenderedEmail {
	return notice(
		{
			subject: `Your win on ${a.title} was cancelled`,
			heading: `Your win on ${a.title} was cancelled`,
			paragraphs: [
				'The payment was not received by the deadline, so the sale was cancelled and the item may be offered again.',
				'If you meant to pay, contact the shop.'
			]
		},
		ctx
	);
}
