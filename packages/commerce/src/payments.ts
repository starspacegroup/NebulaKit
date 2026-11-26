/**
 * Payments behind one small interface, so a site picks a provider in config
 * and checkout never knows which.
 *
 * No Stripe SDK: what a shop needs — a Checkout Session (hosted page), a
 * PaymentIntent (the card form on the site's own cart), closing either, and
 * verifying a webhook signature — is a few form POSTs and an HMAC, and the SDK
 * would add a dependency to every client site for that. `fetch` is injectable
 * so tests never reach the network.
 *
 * Every POST to Stripe carries an Idempotency-Key derived from the order (and,
 * for an amount change, the order's payment revision), so a retried request is
 * one request at Stripe. Amounts come only from an `Order`, which the server
 * priced; nothing here takes an amount from anywhere else.
 */
import { isChargeableAmount } from './payment-core';
import type { Order } from './types';

export interface PaymentSession {
	provider: string;
	reference: string;
	/** Where to send the shopper to pay. Absent for providers settled out of band, and when paying on the site. */
	redirectUrl: string | null;
	/**
	 * For paying on the site's own page: what the page hands to Stripe.js to confirm the payment.
	 * Null when the shopper is sent to the provider's page.
	 */
	clientSecret?: string | null;
}

/**
 * Where the shopper pays.
 * - `successUrl` + `cancelUrl`: on the provider's page; they come back to one of these.
 * - `returnUrl`: on the site's own page, in a card form drawn there. The answer then carries a
 *   `clientSecret` and no address. (A card whose bank insists on a full page of its own comes back
 *   to this address; the page passes it when it confirms the payment.)
 */
export type PaymentUrls = { successUrl: string; cancelUrl: string } | { returnUrl: string };

export interface PaymentProvider {
	readonly name: string;
	createPayment(order: Order, urls: PaymentUrls): Promise<PaymentSession>;
	/**
	 * Close a payment that has not been made, so it can no longer be paid. True when it is closed
	 * (now or already); false when the provider says it cannot be (it has been paid, or is being).
	 */
	expirePayment(reference: string): Promise<boolean>;
}

/**
 * Settled out of band (invoice, cash, bank transfer). The order stays
 * `pending` until someone with `orders:write` marks it paid.
 */
export const manualPayments: PaymentProvider = {
	name: 'manual',
	async createPayment(order) {
		return { provider: 'manual', reference: `manual_${order.id}`, redirectUrl: null };
	},
	async expirePayment() {
		return true;
	}
};

export class PaymentProviderError extends Error {
	readonly status = 502;
}

/**
 * Stripe refused to change or close a payment because it is already being paid (or was). The
 * checkout answers 409 and shows the shopper their order instead of charging again.
 */
export class PaymentInProgressError extends Error {
	readonly status = 409;
}

/**
 * The Stripe API version the on-page card form is written against (ported from PinFool). These
 * calls name the version so a change of the account's default cannot surprise the page, which
 * loads the matching Stripe.js (`STRIPE_JS_URL` in src/lib/shop/stripe-js.ts). Change the two
 * together.
 */
export const STRIPE_ONPAGE_API_VERSION = '2026-10-28.endive';

/** A Stripe publishable key: safe to give to the browser, and needed there to draw the card form. */
export function isStripePublishableKey(value: unknown): value is string {
	return typeof value === 'string' && /^pk_(live|test)_[A-Za-z0-9]{10,}$/.test(value);
}

const INTENT_ID = /^pi_[A-Za-z0-9_]+$/;
const SESSION_ID = /^cs_[A-Za-z0-9_]+$/;

/** What the site reads back from a PaymentIntent. */
export interface StripeIntent {
	id: string;
	status: string;
	clientSecret: string;
	amount: number;
	currency: string;
}

/**
 * The on-page card form's side of Stripe: one PaymentIntent per order, created once, updated when
 * the order is repriced, cancelled when the shopper backs out.
 */
export interface StripeOnPage {
	createIntent(order: Order, revision?: number): Promise<StripeIntent>;
	retrieveIntent(id: string): Promise<StripeIntent>;
	/** Set the intent's amount to the repriced order's total. Throws PaymentInProgressError once it is being paid. */
	updateIntent(id: string, order: Order, revision: number): Promise<StripeIntent>;
}

export function stripePayments(
	secretKey: string,
	fetchImpl: typeof fetch = fetch,
	apiBase = 'https://api.stripe.com'
): PaymentProvider & StripeOnPage {
	if (!secretKey) throw new Error('A Stripe secret key is required');
	const headers = (extra: Record<string, string> = {}) => ({
		Authorization: `Bearer ${secretKey}`,
		'Content-Type': 'application/x-www-form-urlencoded',
		...extra
	});
	const intentHeaders = (idempotencyKey: string) =>
		headers({ 'Idempotency-Key': idempotencyKey, 'Stripe-Version': STRIPE_ONPAGE_API_VERSION });

	function chargeable(order: Order): number {
		const amount = order.totalCents;
		if (!isChargeableAmount(amount, order.currency)) {
			throw new PaymentProviderError(
				`The order total cannot be charged by card (${amount} ${order.currency})`
			);
		}
		return amount;
	}

	async function readIntent(response: Response, what: string): Promise<StripeIntent> {
		if (!response.ok) {
			// 400 on an update or confirm-state conflict means the intent is past changing.
			if (response.status === 400 || response.status === 409) {
				const body = (await response.json().catch(() => ({}))) as {
					error?: { code?: string };
				};
				if (body.error?.code === 'payment_intent_unexpected_state') {
					throw new PaymentInProgressError('This payment is already being made');
				}
			}
			throw new PaymentProviderError(`Stripe refused to ${what} the payment (${response.status})`);
		}
		const intent = (await response.json()) as {
			id?: string;
			status?: string;
			client_secret?: string | null;
			amount?: number;
			currency?: string;
		};
		if (!intent.id || !INTENT_ID.test(intent.id) || !intent.client_secret) {
			throw new PaymentProviderError('Stripe returned no payment to confirm');
		}
		return {
			id: intent.id,
			status: intent.status ?? 'unknown',
			clientSecret: intent.client_secret,
			amount: Number(intent.amount),
			currency: String(intent.currency ?? '')
		};
	}

	/**
	 * Paid on the site's own page: a PaymentIntent for the order's total. Cards only, matching the
	 * card form the page draws (`CARD_ONLY` in src/lib/shop/stripe-js.ts).
	 */
	async function createIntent(order: Order, revision = 0): Promise<StripeIntent> {
		const form = new URLSearchParams();
		form.set('amount', String(chargeable(order)));
		form.set('currency', order.currency);
		// Cards only. (`payment_method_types` is refused by this API version; this is its successor.)
		form.set('allowed_payment_method_types[0]', 'card');
		form.set('metadata[orderId]', order.id);
		form.set('metadata[revision]', String(revision));
		form.set('description', `Order ${order.id.slice(0, 8)}`);
		const response = await fetchImpl(`${apiBase}/v1/payment_intents`, {
			method: 'POST',
			headers: intentHeaders(`order-intent-${order.id}`),
			body: form.toString()
		});
		return readIntent(response, 'create');
	}

	return {
		name: 'stripe',
		createIntent,

		async retrieveIntent(id) {
			if (!INTENT_ID.test(id)) throw new PaymentProviderError('Not a payment this site made');
			const response = await fetchImpl(`${apiBase}/v1/payment_intents/${id}`, {
				headers: {
					Authorization: `Bearer ${secretKey}`,
					'Stripe-Version': STRIPE_ONPAGE_API_VERSION
				}
			});
			return readIntent(response, 'read');
		},

		async updateIntent(id, order, revision) {
			if (!INTENT_ID.test(id)) throw new PaymentProviderError('Not a payment this site made');
			const form = new URLSearchParams();
			form.set('amount', String(chargeable(order)));
			form.set('currency', order.currency);
			form.set('metadata[revision]', String(revision));
			const response = await fetchImpl(`${apiBase}/v1/payment_intents/${id}`, {
				method: 'POST',
				// One key per revision: a retried update is one update, a later one is a new one.
				headers: intentHeaders(`order-intent-${order.id}-r${revision}`),
				body: form.toString()
			});
			return readIntent(response, 'update');
		},

		async createPayment(order, urls) {
			if ('returnUrl' in urls) {
				const intent = await createIntent(order);
				return {
					provider: 'stripe',
					reference: intent.id,
					redirectUrl: null,
					clientSecret: intent.clientSecret
				};
			}
			const form = new URLSearchParams();
			form.set('mode', 'payment');
			form.set('success_url', urls.successUrl);
			form.set('cancel_url', urls.cancelUrl);
			form.set('customer_email', order.email);
			form.set('client_reference_id', order.id);
			form.set('metadata[orderId]', order.id);
			order.items.forEach((item, i) => {
				form.set(`line_items[${i}][quantity]`, String(item.quantity));
				form.set(`line_items[${i}][price_data][currency]`, order.currency);
				form.set(`line_items[${i}][price_data][unit_amount]`, String(item.unitPriceCents));
				form.set(`line_items[${i}][price_data][product_data][name]`, item.name);
			});
			// Tax and shipping were priced by the site (priceCart), so they go to
			// Stripe as their own lines rather than being recomputed there.
			// Inclusive tax is already inside the item prices, so only exclusive tax gets a line.
			const taxIsAdded =
				order.totalCents === order.subtotalCents + order.shippingCents + order.taxCents;
			const extras: Array<[string, number]> = [
				['Shipping', order.shippingCents],
				['Tax', taxIsAdded ? order.taxCents : 0]
			];
			let next = order.items.length;
			for (const [name, cents] of extras) {
				if (cents <= 0) continue;
				form.set(`line_items[${next}][quantity]`, '1');
				form.set(`line_items[${next}][price_data][currency]`, order.currency);
				form.set(`line_items[${next}][price_data][unit_amount]`, String(cents));
				form.set(`line_items[${next}][price_data][product_data][name]`, name);
				next += 1;
			}
			const response = await fetchImpl(`${apiBase}/v1/checkout/sessions`, {
				method: 'POST',
				headers: headers({ 'Idempotency-Key': `order-${order.id}` }),
				body: form.toString()
			});
			if (!response.ok) {
				throw new PaymentProviderError(`Stripe refused the checkout session (${response.status})`);
			}
			const session = (await response.json()) as { id?: string; url?: string };
			if (!session.id) throw new PaymentProviderError('Stripe returned no session id');
			return { provider: 'stripe', reference: session.id, redirectUrl: session.url ?? null };
		},

		async expirePayment(reference) {
			// Only a reference this site recorded reaches here; the shape is checked all the same.
			// A payment on the site's page (pi_…) is cancelled; one on Stripe's page (cs_…) is expired.
			const intent = INTENT_ID.test(reference);
			if (!intent && !SESSION_ID.test(reference)) return false;
			const path = intent
				? `/v1/payment_intents/${reference}`
				: `/v1/checkout/sessions/${reference}`;
			const response = await fetchImpl(`${apiBase}${path}/${intent ? 'cancel' : 'expire'}`, {
				method: 'POST',
				headers: intent
					? intentHeaders(`close-${reference}`)
					: headers({ 'Idempotency-Key': `close-${reference}` })
			});
			if (response.ok) return true;
			// Stripe refuses to close what is not open. If that is because it was closed already, the
			// payment is closed, which is what was asked; if it was paid (or is being paid), it is not.
			const seen = await fetchImpl(`${apiBase}${path}`, {
				headers: { Authorization: `Bearer ${secretKey}` }
			});
			if (!seen.ok) return false;
			const now = (await seen.json()) as { status?: string };
			return now.status === (intent ? 'canceled' : 'expired');
		}
	};
}

function toHex(buffer: ArrayBuffer): string {
	return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

/**
 * Verify a `Stripe-Signature` header: `t=<unix>,v1=<hex hmac>[,v1=…]`, the
 * HMAC-SHA256 of `${t}.${payload}` under the endpoint's signing secret.
 * Signatures older than `toleranceSeconds` are refused, which stops replay.
 */
export async function verifyStripeSignature(
	payload: string,
	header: string | null,
	secret: string,
	nowSeconds = Math.floor(Date.now() / 1000),
	toleranceSeconds = 300
): Promise<boolean> {
	if (!header || !secret) return false;
	let timestamp = '';
	const signatures: string[] = [];
	for (const part of header.split(',')) {
		const [key, value] = part.split('=', 2);
		if (key === 't') timestamp = value ?? '';
		else if (key === 'v1' && value) signatures.push(value);
	}
	const t = Number(timestamp);
	if (!Number.isInteger(t) || signatures.length === 0) return false;
	if (Math.abs(nowSeconds - t) > toleranceSeconds) return false;

	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const expected = toHex(
		await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`))
	);
	return signatures.some((signature) => constantTimeEqual(signature, expected));
}
