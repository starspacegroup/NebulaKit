import type { D1Database } from '@cloudflare/workers-types';
import {
	ensureAuctionOrder,
	getAuction,
	type Auction,
	type Order,
	type OrderPricing
} from '@nebulakit/commerce';
import { mailWinner, type Mailer } from './auction-emails';

/**
 * A sold auction gets its order and its winner gets told. Safe to call from
 * every place a sale can first be noticed (buy now, the winner opening the
 * page, an admin ending it, the sweep): the order is made once and the email is
 * once-only, so whichever gets there first does the work and the rest do nothing.
 */
export async function settleSale(
	db: D1Database,
	mail: Mailer,
	auctionId: string,
	pricing: OrderPricing
): Promise<{ auction: Auction; order: Order | null }> {
	const before = await getAuction(db, auctionId);
	const result = await ensureAuctionOrder(db, auctionId, pricing);
	if (result.order && result.auction.status === 'sold') {
		// Told only when the order is new, so a page view never re-sends and never logs a skip.
		if (before && !before.orderId) await mailWinner(mail, result.auction, result.order);
	}
	return result;
}
