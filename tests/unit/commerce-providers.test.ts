import { describe, expect, it, vi } from 'vitest';
import {
	buildPrintfulOrder,
	manualPayments,
	PaymentProviderError,
	PrintfulClient,
	PrintfulError,
	stripePayments,
	verifyStripeSignature,
	type Order
} from '@nebulakit/commerce';

const order: Order = {
	id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
	status: 'pending',
	email: 'ada@example.com',
	currency: 'usd',
	subtotalCents: 5000,
	shippingCents: 400,
	taxCents: 413,
	totalCents: 5813,
	shippingAddress: {
		name: 'Ada',
		line1: '1 Main',
		line2: 'Apt 2',
		city: 'Lewiston',
		state: 'ME',
		postalCode: '04240',
		country: 'US'
	},
	paymentProvider: 'stripe',
	paymentReference: null,
	fulfillmentReference: null,
	regional: null,
	items: [
		{
			id: 'i1',
			productId: 'p1',
			name: 'Tee',
			unitPriceCents: 2500,
			quantity: 2,
			lineTotalCents: 5000
		},
		{ id: 'i2', productId: 'p2', name: 'Ebook', unitPriceCents: 0, quantity: 1, lineTotalCents: 0 },
		{ id: 'i3', productId: null, name: 'Gone', unitPriceCents: 0, quantity: 1, lineTotalCents: 0 }
	],
	createdAt: '',
	updatedAt: ''
};
const urls = { successUrl: 'https://s.test/ok', cancelUrl: 'https://s.test/no' };

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

describe('payments', () => {
	it('manual payments settle out of band', async () => {
		expect(await manualPayments.createPayment(order, urls)).toEqual({
			provider: 'manual',
			reference: `manual_${order.id}`,
			redirectUrl: null
		});
	});

	it('creates a Stripe checkout session with site-priced lines', async () => {
		const fetchImpl = vi.fn(async () => jsonResponse({ id: 'cs_1', url: 'https://pay.test/cs_1' }));
		const session = await stripePayments('sk_test_x', fetchImpl as never).createPayment(
			order,
			urls
		);
		expect(session).toEqual({
			provider: 'stripe',
			reference: 'cs_1',
			redirectUrl: 'https://pay.test/cs_1'
		});
		const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
		expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe(`order-${order.id}`);
		const form = new URLSearchParams(init.body as string);
		expect(form.get('line_items[0][price_data][unit_amount]')).toBe('2500');
		expect(form.get('line_items[3][price_data][product_data][name]')).toBe('Shipping');
		expect(form.get('line_items[4][price_data][product_data][name]')).toBe('Tax');
		expect(form.get('metadata[orderId]')).toBe(order.id);
	});

	it('leaves inclusive tax and zero shipping out of the Stripe lines', async () => {
		const fetchImpl = vi.fn(async () => jsonResponse({ id: 'cs_2' }));
		const inclusive = { ...order, shippingCents: 0, totalCents: 5000 };
		const session = await stripePayments('sk', fetchImpl as never).createPayment(inclusive, urls);
		expect(session.redirectUrl).toBeNull();
		const form = new URLSearchParams(
			(fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string
		);
		expect(form.get('line_items[3][quantity]')).toBeNull();
	});

	it('surfaces Stripe failures', async () => {
		const refused = stripePayments('sk', (async () => jsonResponse({}, 402)) as never);
		await expect(refused.createPayment(order, urls)).rejects.toBeInstanceOf(PaymentProviderError);
		const empty = stripePayments('sk', (async () => jsonResponse({})) as never);
		await expect(empty.createPayment(order, urls)).rejects.toThrow('no session id');
		expect(() => stripePayments('')).toThrow('secret key');
	});

	it('verifies Stripe webhook signatures and refuses stale or forged ones', async () => {
		const secret = 'whsec_test';
		const payload = '{"type":"checkout.session.completed"}';
		const t = 1_700_000_000;
		const key = await crypto.subtle.importKey(
			'raw',
			new TextEncoder().encode(secret),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign']
		);
		const sig = Array.from(
			new Uint8Array(
				await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`))
			),
			(b) => b.toString(16).padStart(2, '0')
		).join('');
		const header = `t=${t},v1=deadbeef,v1=${sig}`;
		expect(await verifyStripeSignature(payload, header, secret, t + 10)).toBe(true);
		expect(await verifyStripeSignature(payload, header, secret, t + 10_000)).toBe(false);
		expect(await verifyStripeSignature(payload + ' ', header, secret, t)).toBe(false);
		expect(await verifyStripeSignature(payload, `t=${t},v1=${'0'.repeat(64)}`, secret, t)).toBe(
			false
		);
		expect(await verifyStripeSignature(payload, 'v1=abc', secret, t)).toBe(false);
		expect(await verifyStripeSignature(payload, `t=${t}`, secret, t)).toBe(false);
		expect(await verifyStripeSignature(payload, null, secret)).toBe(false);
		expect(await verifyStripeSignature(payload, header, '')).toBe(false);
	});
});

describe('printful', () => {
	const products = new Map([
		['p1', { printfulVariantId: 77 }],
		['p2', { printfulVariantId: null }]
	]);

	it('builds an order from the print-on-demand lines only', () => {
		expect(buildPrintfulOrder(order, products)).toEqual({
			external_id: 'aaaaaaaabbbbccccddddeeeeeeeeeeee',
			shipping: 'STANDARD',
			recipient: {
				name: 'Ada',
				address1: '1 Main',
				address2: 'Apt 2',
				city: 'Lewiston',
				state_code: 'ME',
				country_code: 'US',
				zip: '04240',
				email: 'ada@example.com'
			},
			items: [{ sync_variant_id: 77, quantity: 2 }]
		});
		const plain = {
			...order,
			shippingAddress: { ...order.shippingAddress!, line2: undefined, state: undefined }
		};
		expect(buildPrintfulOrder(plain, products)?.recipient).not.toHaveProperty('address2');
	});

	it('sends nothing without an address or a Printful line', () => {
		expect(buildPrintfulOrder({ ...order, shippingAddress: null }, products)).toBeNull();
		expect(buildPrintfulOrder(order, new Map())).toBeNull();
	});

	it('creates draft and confirmed orders and reads them back', async () => {
		const fetchImpl = vi.fn(async () =>
			jsonResponse({ code: 200, result: { id: 5, status: 'draft' } })
		);
		const client = new PrintfulClient('pf_key', fetchImpl as never);
		const request = buildPrintfulOrder(order, products)!;
		expect(await client.createOrder(request)).toEqual({ id: 5, status: 'draft' });
		expect(await client.createOrder(request, true)).toEqual({ id: 5, status: 'draft' });
		expect(await client.getOrder('abc')).toEqual({ id: 5, status: 'draft' });
		const calledUrls = fetchImpl.mock.calls.map((call) => (call as unknown as [string])[0]);
		expect(calledUrls).toEqual([
			'https://api.printful.com/orders',
			'https://api.printful.com/orders?confirm=1',
			'https://api.printful.com/orders/@abc'
		]);
	});

	it('raises Printful errors with the status', async () => {
		const denied = new PrintfulClient('k', (async () =>
			jsonResponse({ code: 400, error: { message: 'Bad recipient' } }, 400)) as never);
		await expect(denied.getOrder('x')).rejects.toThrow('Bad recipient');
		const garbled = new PrintfulClient(
			'k',
			(async () => new Response('nope', { status: 500 })) as never
		);
		await expect(garbled.getOrder('x')).rejects.toBeInstanceOf(PrintfulError);
		await expect(garbled.getOrder('x')).rejects.toThrow('failed (500)');
		const softError = new PrintfulClient('k', (async () => jsonResponse({ code: 429 })) as never);
		await expect(softError.getOrder('x')).rejects.toThrow('failed (200)');
		expect(() => new PrintfulClient(' ')).toThrow('API key is required');
	});
});
