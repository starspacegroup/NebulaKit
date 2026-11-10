import { error, fail } from '@sveltejs/kit';
import {
	AuctionInputError,
	CommerceConflictError,
	auctionPhase,
	cancelAuction,
	closeAuction,
	createAuction,
	relistAuction,
	formatMoney,
	getAuction,
	listAuctions,
	listProducts
} from '@nebulakit/commerce';
import { requirePermission } from '$lib/server/auth-guards';
import { auctionPricing } from '$lib/server/auction-pricing';
import { requestMailer } from '$lib/server/auction-emails';
import { settleSale } from '$lib/server/auction-sale';
import { parseAuctionValues, readAuctionForm } from '$lib/server/auctions';
import type { CommerceEnv } from '$lib/server/site-info';
import type { Actions, PageServerLoad } from './$types';

function database(platform: App.Platform | undefined) {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'The site database is not available');
	return db;
}

/** /admin/auctions: every auction, and the form to start one. */
export const load: PageServerLoad = async ({ locals, platform }) => {
	requirePermission(locals, 'shop');
	const db = database(platform);
	const [auctions, products] = await Promise.all([
		listAuctions(db, { limit: 200 }),
		listProducts(db, { includeInactive: true, limit: 500 })
	]);
	const money = (c: number | null, cur: string) => (c === null ? null : formatMoney(c, cur));
	return {
		products: products.map((p) => ({
			id: p.id,
			name: p.name,
			active: p.active,
			price: formatMoney(p.priceCents, p.currency)
		})),
		auctions: auctions.map((a) => ({
			id: a.id,
			slug: a.slug,
			title: a.title,
			phase: auctionPhase(a),
			status: a.status,
			startsAt: a.startsAt,
			endsAt: a.endsAt,
			starting: money(a.startingCents, a.currency),
			reserve: money(a.reserveCents, a.currency),
			buyNow: money(a.buyNowCents, a.currency),
			current: money(a.currentCents, a.currency),
			final: money(a.finalCents, a.currency),
			bidCount: a.bidCount,
			leaderEmail: a.leaderEmail,
			winnerEmail: a.winnerEmail,
			orderId: a.orderId,
			payDueAt: a.payDueAt,
			payWithinHours: a.payWithinHours,
			relistedFrom: a.relistedFrom
		}))
	};
};

function auctionId(form: FormData): string | null {
	const id = String(form.get('id') ?? '');
	return id || null;
}

export const actions: Actions = {
	create: async ({ locals, platform, request }) => {
		requirePermission(locals, 'shop');
		const db = database(platform);
		const values = readAuctionForm(await request.formData());
		const parsed = parseAuctionValues(values);
		if (!parsed.ok) return fail(400, { action: 'create', problems: parsed.errors, values });
		try {
			const auction = await createAuction(db, parsed.value);
			return { action: 'create', message: `Created ${auction.title}.` };
		} catch (err) {
			if (err instanceof AuctionInputError) {
				return fail(400, { action: 'create', problems: err.errors, values });
			}
			if (err instanceof CommerceConflictError) {
				return fail(409, {
					action: 'create',
					problems: ['That slug is already used by another auction.'],
					values
				});
			}
			throw err;
		}
	},

	/** End now: close an open auction as the rules say (sold if there is a bid over the reserve). */
	end: async ({ locals, platform, request }) => {
		requirePermission(locals, 'shop');
		const db = database(platform);
		const id = auctionId(await request.formData());
		if (!id) return fail(400, { action: 'end', problems: ['Missing auction.'] });
		const closed = await closeAuction(db, id, { force: true });
		if (!closed) return fail(404, { action: 'end', problems: ['That auction no longer exists.'] });
		if (closed.status === 'sold') {
			await settleSale(
				db,
				requestMailer(platform),
				closed.id,
				auctionPricing((platform?.env ?? {}) as CommerceEnv)
			);
		}
		return {
			action: 'end',
			message:
				closed.status === 'sold'
					? `Ended. Sold to the high bidder for ${formatMoney(closed.finalCents ?? 0, closed.currency)}.`
					: 'Ended without a sale.'
		};
	},

	cancel: async ({ locals, platform, request }) => {
		requirePermission(locals, 'shop');
		const db = database(platform);
		const id = auctionId(await request.formData());
		if (!id) return fail(400, { action: 'cancel', problems: ['Missing auction.'] });
		if (!(await getAuction(db, id))) {
			return fail(404, { action: 'cancel', problems: ['That auction no longer exists.'] });
		}
		try {
			await cancelAuction(db, id);
		} catch (err) {
			if (err instanceof CommerceConflictError) {
				return fail(409, { action: 'cancel', problems: [err.message + '.'] });
			}
			throw err;
		}
		return { action: 'cancel', message: 'Cancelled. Existing bids are void.' };
	},

	/** Put an unsold, lapsed or cancelled auction back up, starting now, with the same terms. */
	relist: async ({ locals, platform, request }) => {
		requirePermission(locals, 'shop');
		const db = database(platform);
		const id = auctionId(await request.formData());
		if (!id) return fail(400, { action: 'relist', problems: ['Missing auction.'] });
		try {
			const again = await relistAuction(db, id);
			return { action: 'relist', message: `Relisted as ${again.slug}.` };
		} catch (err) {
			if (err instanceof CommerceConflictError) {
				return fail(409, { action: 'relist', problems: [err.message + '.'] });
			}
			throw err;
		}
	}
};
