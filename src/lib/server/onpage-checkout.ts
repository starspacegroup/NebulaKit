/**
 * On-page checkout: one cart checkout is one order and one Stripe PaymentIntent, however often the
 * shopper presses "Pay" or edits the cart before paying (docs/CHECKOUT.md).
 *
 * The cart page sends a random `checkoutKey` with every submit. The first submit makes the order
 * and its PaymentIntent; later ones find them by the key and:
 * - change nothing when the server prices the cart the same (a double click, a retry);
 * - when the price, lines, email or address changed: update the PaymentIntent's amount first (an
 *   intent that is already being paid refuses, and the shopper is shown their order), then reprice
 *   the order in one guarded batch (store.ts `repriceOrder`).
 *
 * Every amount is the server's: `cart` is `priceCheckout`'s, built from the catalog. The response
 * carries the PaymentIntent's client secret, and the total only so the card form can show it.
 */
import type { D1Database } from '@cloudflare/workers-types';
import {
	CommerceConflictError,
	createOrder,
	findOrderByCheckoutKey,
	getOrder,
	getPaymentRevision,
	repriceOrder,
	type Order,
	type OrderRegionalPricing,
	type PricedCart,
	type ShippingAddress,
	type StripeIntent,
	type StripeOnPage
} from '@nebulakit/commerce';

/** The checkout this key started is over (paid, being paid, or cancelled): nothing is charged again. */
export class CheckoutClosedError extends Error {
	readonly status = 409;
	constructor(
		readonly orderId: string,
		readonly orderStatus: string,
		message: string
	) {
		super(message);
	}
}

export interface OnPageInput {
	checkoutKey: string;
	cart: PricedCart;
	email: string;
	shippingAddress: ShippingAddress | null;
	regional: OrderRegionalPricing | null;
}

export interface OnPageResult {
	order: Order;
	clientSecret: string;
	/** True when this request made the order (201); false when it found the key's order (200). */
	created: boolean;
}

const sameAddress = (a: ShippingAddress | null, b: ShippingAddress | null) =>
	JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const sameRegional = (a: OrderRegionalPricing | null, b: OrderRegionalPricing | null) =>
	(a === null && b === null) ||
	(a !== null &&
		b !== null &&
		Math.round(a.multiplier * 100) === Math.round(b.multiplier * 100) &&
		a.baseSubtotalCents === b.baseSubtotalCents &&
		JSON.stringify(a.countries) === JSON.stringify(b.countries));

/** Whether an order already says exactly what this fresh pricing says. */
export function orderMatches(order: Order, input: Omit<OnPageInput, 'checkoutKey'>): boolean {
	const { cart } = input;
	return (
		order.email === input.email &&
		sameAddress(order.shippingAddress, input.shippingAddress) &&
		sameRegional(order.regional, input.regional) &&
		order.currency === cart.currency &&
		order.subtotalCents === cart.subtotalCents &&
		order.shippingCents === cart.shippingCents &&
		order.taxCents === cart.taxCents &&
		order.totalCents === cart.totalCents &&
		order.items.length === cart.lines.length &&
		order.items.every((item, i) => {
			const line = cart.lines[i];
			return (
				item.productId === line.product.id &&
				item.quantity === line.quantity &&
				item.unitPriceCents === line.unitPriceCents &&
				item.lineTotalCents === line.lineTotalCents
			);
		})
	);
}

/** Record the PaymentIntent on an order that has none yet; a racing peer's identical one stands. */
async function claimReference(db: D1Database, orderId: string, reference: string) {
	await db
		.prepare(
			`UPDATE commerce_orders SET payment_reference = ?, updated_at = datetime('now')
			 WHERE id = ? AND payment_reference IS NULL`
		)
		.bind(reference, orderId)
		.run();
}

function closed(order: Order): CheckoutClosedError {
	return order.status === 'cancelled'
		? new CheckoutClosedError(order.id, order.status, 'This checkout was cancelled. Start again.')
		: new CheckoutClosedError(order.id, order.status, 'This order has already been paid.');
}

export async function onPageCheckout(
	db: D1Database,
	stripe: StripeOnPage,
	input: OnPageInput
): Promise<OnPageResult> {
	const details = {
		email: input.email,
		shippingAddress: input.shippingAddress,
		regional: input.regional
	};
	let order = await findOrderByCheckoutKey(db, input.checkoutKey);
	let created = false;
	if (!order) {
		try {
			order = await createOrder(db, input.cart, {
				...details,
				paymentProvider: 'stripe',
				checkoutKey: input.checkoutKey
			});
			created = true;
		} catch (err) {
			// A double submit raced this one and made the order first: carry on with that order.
			if (!(err instanceof CommerceConflictError)) throw err;
			order = await findOrderByCheckoutKey(db, input.checkoutKey);
			if (!order) throw err;
		}
	}
	if (order.status !== 'pending') throw closed(order);
	if (order.paymentProvider !== 'stripe') {
		throw new CheckoutClosedError(order.id, order.status, 'This order is paid another way.');
	}

	// The order's PaymentIntent, made now if this is the first submit. The idempotency key is the
	// order's, so a racing submit for the same order gets the same intent back from Stripe.
	let intent: StripeIntent;
	if (!order.paymentReference) {
		intent = await stripe.createIntent(order, (await getPaymentRevision(db, order.id)) ?? 0);
		await claimReference(db, order.id, intent.id);
		order = (await getOrder(db, order.id)) as Order;
		if (order.paymentReference !== intent.id) {
			intent = await stripe.retrieveIntent(order.paymentReference as string);
		}
	} else {
		intent = await stripe.retrieveIntent(order.paymentReference);
	}
	if (intent.status === 'succeeded' || intent.status === 'processing') {
		throw new CheckoutClosedError(order.id, 'paid', 'This order has already been paid.');
	}
	if (intent.status === 'canceled') {
		throw new CheckoutClosedError(
			order.id,
			'cancelled',
			'This checkout was cancelled. Start again.'
		);
	}

	const drifted = intent.amount !== order.totalCents || intent.currency !== order.currency;
	if (!created && (drifted || !orderMatches(order, input))) {
		const revision = (await getPaymentRevision(db, order.id)) ?? 0;
		// Stripe first: an intent already being paid refuses the change (PaymentInProgressError,
		// 409), and the order is then left exactly as it was paid for.
		intent = await stripe.updateIntent(
			intent.id,
			{ ...order, currency: input.cart.currency, totalCents: input.cart.totalCents },
			revision + 1
		);
		const repriced = await repriceOrder(db, order.id, revision, input.cart, details);
		if (!repriced) {
			const now = (await getOrder(db, order.id)) ?? order;
			if (now.status !== 'pending') throw closed(now);
			throw new CheckoutClosedError(
				order.id,
				now.status,
				'Your order changed while it was being updated. Please try again.'
			);
		}
		order = repriced.order;
	}
	return { order, clientSecret: intent.clientSecret, created };
}

/** How old an unpaid on-page payment must be before it is closed, and how many at once. */
export const STALE_MINUTES = 120;
export const STALE_BATCH = 5;

/**
 * Close on-page payments (PaymentIntents) that have waited longer than two hours (ported from
 * PinFool): Stripe is asked to cancel each, and only when it says the payment is closed is the
 * order cancelled (the same code as Stripe's own `payment_intent.canceled`). One paid meanwhile is
 * left alone. Never throws.
 */
export async function closeStalePayments(
	db: D1Database,
	provider: { expirePayment(reference: string): Promise<boolean> },
	apply: (event: { type: string; data: { object: Record<string, unknown> } }) => Promise<unknown>
): Promise<void> {
	try {
		const { results } = await db
			.prepare(
				`SELECT id, payment_reference FROM commerce_orders
				  WHERE status = 'pending' AND payment_provider = 'stripe'
				    AND substr(payment_reference, 1, 3) = 'pi_'
				    AND created_at < datetime('now', ?)
				  ORDER BY created_at LIMIT ?`
			)
			.bind(`-${STALE_MINUTES} minutes`, STALE_BATCH)
			.all<{ id: string; payment_reference: string }>();
		for (const row of results) {
			if (!(await provider.expirePayment(row.payment_reference))) continue;
			await apply({
				type: 'payment_intent.canceled',
				data: { object: { id: row.payment_reference, metadata: { orderId: row.id } } }
			});
		}
	} catch (err) {
		console.error('closing stale payments failed:', err);
	}
}
