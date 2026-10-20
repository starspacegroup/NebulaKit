/**
 * Payments behind one small interface, so a site picks a provider in config
 * and checkout never knows which.
 *
 * No Stripe SDK: the two calls a shop needs — create a Checkout Session and
 * verify a webhook signature — are a form POST and an HMAC, and the SDK would
 * add a dependency to every client site for that. `fetch` is injectable so
 * tests never reach the network.
 */
import type { Order } from './types';

export interface PaymentSession {
	provider: string;
	reference: string;
	/** Where to send the shopper to pay. Absent for providers settled out of band. */
	redirectUrl: string | null;
}

export interface PaymentProvider {
	readonly name: string;
	createPayment(
		order: Order,
		urls: { successUrl: string; cancelUrl: string }
	): Promise<PaymentSession>;
}

/**
 * Settled out of band (invoice, cash, bank transfer). The order stays
 * `pending` until someone with `orders:write` marks it paid.
 */
export const manualPayments: PaymentProvider = {
	name: 'manual',
	async createPayment(order) {
		return { provider: 'manual', reference: `manual_${order.id}`, redirectUrl: null };
	}
};

export class PaymentProviderError extends Error {
	readonly status = 502;
}

export function stripePayments(
	secretKey: string,
	fetchImpl: typeof fetch = fetch,
	apiBase = 'https://api.stripe.com'
): PaymentProvider {
	if (!secretKey) throw new Error('A Stripe secret key is required');
	return {
		name: 'stripe',
		async createPayment(order, urls) {
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
				headers: {
					Authorization: `Bearer ${secretKey}`,
					'Content-Type': 'application/x-www-form-urlencoded',
					'Idempotency-Key': `order-${order.id}`
				},
				body: form.toString()
			});
			if (!response.ok) {
				throw new PaymentProviderError(`Stripe refused the checkout session (${response.status})`);
			}
			const session = (await response.json()) as { id?: string; url?: string };
			if (!session.id) throw new PaymentProviderError('Stripe returned no session id');
			return { provider: 'stripe', reference: session.id, redirectUrl: session.url ?? null };
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
