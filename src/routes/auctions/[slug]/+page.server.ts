import { error, fail, redirect } from '@sveltejs/kit';
import {
	PaymentProviderError,
	BID_REFUSALS,
	buyNowAuction,
	closeAuction,
	getAuction,
	getOrder,
	getProduct,
	listBids,
	manualPayments,
	placeAuctionBid,
	setOrderShippingAddress,
	setPaymentReference,
	stripePayments,
	validateShippingAddress,
	type Auction
} from '@nebulakit/commerce';
import { auctionView, bidViews } from '$lib/server/auctions';
import { dollarsToCents } from '$lib/server/admin-products';
import { auctionPricing } from '$lib/server/auction-pricing';
import { mailOutbid, requestMailer } from '$lib/server/auction-emails';
import { settleSale } from '$lib/server/auction-sale';
import type { CommerceEnv } from '$lib/server/site-info';
import type { Actions, PageServerLoad } from './$types';

function database(platform: App.Platform | undefined) {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'The site database is not available');
	return db;
}

function signedIn(locals: App.Locals, slug: string) {
	if (!locals.user)
		throw redirect(303, `/auth/login?next=${encodeURIComponent(`/auctions/${slug}`)}`);
	return { id: locals.user.id, email: locals.user.email };
}

/** Read the auction, closing it first if its time is up, so the page never shows a stale "live". */
async function fresh(db: D1Database, slug: string): Promise<Auction> {
	let auction = await getAuction(db, slug);
	if (!auction || auction.slug !== slug) throw error(404, 'Auction not found');
	if (auction.status === 'open') auction = (await closeAuction(db, auction.id)) ?? auction;
	return auction;
}

type D1Database = NonNullable<App.Platform['env']>['DB'];

export const load: PageServerLoad = async ({ params, locals, platform }) => {
	const db = database(platform);
	let auction = await fresh(db, params.slug);
	const viewer = locals.user?.id ?? null;
	// The winner gets their order the moment they look, not only when the sweep runs.
	if (auction.status === 'sold' && !auction.orderId && viewer === auction.winnerId) {
		auction = (
			await settleSale(
				db,
				requestMailer(platform),
				auction.id,
				auctionPricing((platform?.env ?? {}) as CommerceEnv)
			)
		).auction;
	}
	const product = await getProduct(db, auction.productId);
	const view = auctionView(auction, viewer);
	const order = view.youWon && auction.orderId ? await getOrder(db, auction.orderId) : null;
	return {
		auction: view,
		description: product?.description ?? '',
		imageUrl: product?.imageUrl ?? null,
		physical: product?.type === 'physical',
		bids: bidViews(await listBids(db, auction.id, 30), auction.currency),
		signedIn: viewer !== null,
		order: order
			? {
					status: order.status,
					total: new Intl.NumberFormat('en-US', {
						style: 'currency',
						currency: order.currency.toUpperCase()
					}).format(order.totalCents / 100),
					needsAddress: product?.type === 'physical' && !order.shippingAddress
				}
			: null
	};
};

export const actions: Actions = {
	bid: async ({ params, locals, platform, request }) => {
		const bidder = signedIn(locals, params.slug);
		const db = database(platform);
		const auction = await getAuction(db, params.slug);
		if (!auction) throw error(404, 'Auction not found');
		const raw = String((await request.formData()).get('max') ?? '');
		const maxCents = dollarsToCents(raw);
		if (maxCents === null)
			return fail(400, { action: 'bid', problem: BID_REFUSALS['invalid-amount'], max: raw });
		const result = await placeAuctionBid(db, auction.id, bidder, maxCents);
		if (!result.ok) {
			if (result.reason === 'not-found') throw error(404, 'Auction not found');
			if (result.reason === 'busy') {
				return fail(503, {
					action: 'bid',
					problem: 'Many bids are arriving at once. Try again.',
					max: raw
				});
			}
			const refusal = result.reason;
			return fail(409, { action: 'bid', problem: BID_REFUSALS[refusal], max: raw });
		}
		if (result.outbidEmail) {
			await mailOutbid(
				requestMailer(platform),
				result.auction,
				result.outbidEmail,
				auctionView(result.auction, null).minimumBid
			);
		}
		return {
			action: 'bid',
			message: result.leading
				? 'You are the highest bidder.'
				: 'You were outbid by a higher maximum. Raise your bid to take the lead.'
		};
	},

	buynow: async ({ params, locals, platform }) => {
		const buyer = signedIn(locals, params.slug);
		const db = database(platform);
		const auction = await getAuction(db, params.slug);
		if (!auction) throw error(404, 'Auction not found');
		const result = await buyNowAuction(db, auction.id, buyer);
		if (!result.ok) {
			return fail(409, { action: 'buynow', problem: 'Buy now is no longer available.' });
		}
		await settleSale(
			db,
			requestMailer(platform),
			auction.id,
			auctionPricing((platform?.env ?? {}) as CommerceEnv)
		);
		return { action: 'buynow', message: 'It is yours. Complete your order below.' };
	},

	pay: async ({ params, locals, platform, request, url }) => {
		const winner = signedIn(locals, params.slug);
		const db = database(platform);
		const env = (platform?.env ?? {}) as CommerceEnv;
		const auction = await fresh(db, params.slug);
		if (auction.status !== 'sold' || auction.winnerId !== winner.id) {
			throw error(403, 'Only the winner can pay for this auction');
		}
		const { order } = await settleSale(
			db,
			requestMailer(platform),
			auction.id,
			auctionPricing(env)
		);
		if (!order) throw error(409, 'There is no order to pay yet');
		if (order.status !== 'pending') {
			return { action: 'pay', message: 'This order is already paid.' };
		}

		const product = await getProduct(db, auction.productId);
		if (product?.type === 'physical' && !order.shippingAddress) {
			const form = await request.formData();
			const address = validateShippingAddress({
				name: form.get('name'),
				line1: form.get('line1'),
				line2: form.get('line2') || undefined,
				city: form.get('city'),
				state: form.get('state') || undefined,
				postalCode: form.get('postalCode'),
				country: String(form.get('country') ?? '').toUpperCase()
			});
			if (!address.ok) return fail(400, { action: 'pay', problem: address.errors.join(' ') });
			await setOrderShippingAddress(db, order.id, address.value);
		}

		const current = (await getOrder(db, order.id)) ?? order;
		const provider = env.STRIPE_SECRET_KEY ? stripePayments(env.STRIPE_SECRET_KEY) : manualPayments;
		let redirectUrl: string | null;
		try {
			const payment = await provider.createPayment(current, {
				successUrl: `${url.origin}/auctions/${auction.slug}?paid=1`,
				cancelUrl: `${url.origin}/auctions/${auction.slug}`
			});
			await setPaymentReference(db, order.id, payment.reference);
			redirectUrl = payment.redirectUrl;
		} catch (err) {
			if (err instanceof PaymentProviderError) {
				return fail(502, {
					action: 'pay',
					problem: 'The payment provider is unavailable. Try again.'
				});
			}
			throw err;
		}
		if (redirectUrl) throw redirect(303, redirectUrl);
		return {
			action: 'pay',
			message: 'Your order is placed. The shop will contact you to arrange payment.'
		};
	}
};
