import type { D1Database } from '@cloudflare/workers-types';

/** Insert an order (and one line) straight into the real schema. */
export async function seedOrder(
	db: D1Database,
	overrides: Partial<{
		id: string;
		status: string;
		email: string;
		totalCents: number;
		currency: string;
		paymentReference: string | null;
	}> = {}
) {
	const id = overrides.id ?? crypto.randomUUID();
	const total = overrides.totalCents ?? 2500;
	await db
		.prepare(
			`INSERT INTO commerce_orders
			 (id, status, email, currency, subtotal_cents, shipping_cents, tax_cents, total_cents, payment_provider, payment_reference)
			 VALUES (?, ?, ?, ?, ?, 0, 0, ?, 'stripe', ?)`
		)
		.bind(
			id,
			overrides.status ?? 'pending',
			overrides.email ?? 'ada@example.com',
			overrides.currency ?? 'usd',
			total,
			total,
			overrides.paymentReference === undefined ? 'cs_test_1' : overrides.paymentReference
		)
		.run();
	await db
		.prepare(
			`INSERT INTO commerce_order_items (id, order_id, product_id, name, unit_price_cents, quantity, line_total_cents)
			 VALUES (?, ?, NULL, 'Tee <b>', ?, 1, ?)`
		)
		.bind(crypto.randomUUID(), id, total, total)
		.run();
	return id;
}

/** Sign a Stripe webhook payload the way Stripe does. */
export async function stripeSignature(
	body: string,
	secret: string,
	t = Math.floor(Date.now() / 1000)
) {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = Array.from(
		new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${body}`))),
		(b) => b.toString(16).padStart(2, '0')
	).join('');
	return { t, sig, header: `t=${t},v1=${sig}` };
}
