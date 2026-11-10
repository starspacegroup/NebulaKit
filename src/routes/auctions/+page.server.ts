import { error } from '@sveltejs/kit';
import { listAuctions, settleDueAuctions } from '@nebulakit/commerce';
import { auctionView } from '$lib/server/auctions';
import type { PageServerLoad } from './$types';

/** /auctions: what is open for bidding, soonest to end first, then what just ended. */
export const load: PageServerLoad = async ({ locals, platform }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'The site database is not available');
	// Close what is past its end before listing, so nothing shows as live that is over.
	await settleDueAuctions(db, { limit: 20 });
	const viewer = locals.user?.id ?? null;
	const open = await listAuctions(db, { status: 'open', limit: 100 });
	const recent = (await listAuctions(db, { limit: 40 })).filter((a) => a.status === 'sold');
	return {
		open: open.map((a) => auctionView(a, viewer)),
		sold: recent.slice(0, 12).map((a) => auctionView(a, viewer))
	};
};
