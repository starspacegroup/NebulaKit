import '../helpers/server-response';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { applyStripeEvent, getOrderStatus, verifyStripeSignature } from '@nebulakit/commerce';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import { seedOrder, stripeSignature } from '../helpers/commerce-fixtures';
import * as stripeHook from '../../src/routes/api/v1/webhooks/stripe/+server';
import * as statusRoute from '../../src/routes/api/v1/orders/[id]/status/+server';
import * as orderRoute from '../../src/routes/api/v1/orders/[id]/+server';

const SECRET = 'whsec_test';
let db: D1Database;
let env: Record<string, unknown>;
let waitUntil: ReturnType<typeof vi.fn>;
let resend: ReturnType<typeof vi.fn>;

beforeEach(() => {
	db = createSqliteD1();
	waitUntil = vi.fn();
	env = {
		DB: db,
		STRIPE_WEBHOOK_SECRET: SECRET,
		RESEND_API_KEY: 're_test',
		EMAIL_FROM: 'Shop <o@shop.test>'
	};
	resend = vi.fn(async () => new Response(JSON.stringify({ id: 're_1' }), { status: 200 }));
	vi.spyOn(globalThis, 'fetch').mockImplementation(resend as never);
});

function session(orderId: string, extra: Record<string, unknown> = {}) {
	return {
		id: 'cs_test_1',
		payment_status: 'paid',
		amount_total: 2500,
		currency: 'usd',
		metadata: { orderId },
		customer_details: { email: 'verified@example.com' },
		...extra
	};
}
const evt = (type: string, object: Record<string, unknown>) => ({ type, data: { object } });

async function deliver(payload: unknown, opts: { header?: string; secret?: string } = {}) {
	const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
	const header = opts.header ?? (await stripeSignature(body, opts.secret ?? SECRET)).header;
	const url = new URL('/api/v1/webhooks/stripe', 'https://shop.test');
	const request = new Request(url, {
		method: 'POST',
		body,
		headers: { 'stripe-signature': header }
	});
	const response = await stripeHook.POST({
		request,
		url,
		params: {},
		locals: {},
		platform: { env, context: { waitUntil } }
	} as never);
	return { status: response.status, json: await response.json() };
}

const statusOf = (id: string) => getOrderStatus(db, id);
const sentMails = () => resend.mock.calls.length;
const flushMail = async () => {
	await Promise.all(waitUntil.mock.calls.map(([p]) => p));
};

describe('stripe webhook: paid', () => {
	it('marks the order paid and sends exactly one receipt, however often the event is replayed', async () => {
		const id = await seedOrder(db);
		const event = evt('checkout.session.completed', session(id));
		expect((await deliver(event)).json).toEqual({ received: true });
		expect((await deliver(event)).json).toEqual({ received: true });
		expect((await deliver(event)).json).toEqual({ received: true });
		await flushMail();
		expect(await statusOf(id)).toBe('paid');
		expect(sentMails()).toBe(1);
		const body = JSON.parse((resend.mock.calls[0][1] as RequestInit).body as string);
		expect(body.to).toEqual(['verified@example.com']);
		expect(body.subject).toContain('receipt');
		expect(body.html).toContain('Tee &lt;b&gt;');
		const log = await db.prepare('SELECT template, status, related_id FROM email_log').all();
		expect(log.results).toEqual([{ template: 'order-receipt', status: 'sent', related_id: id }]);
	});

	it('hands the email to waitUntil so the response does not wait for it', async () => {
		const id = await seedOrder(db);
		await deliver(evt('checkout.session.completed', session(id)));
		expect(waitUntil).toHaveBeenCalledTimes(1);
	});

	it('falls back to the order email when Stripe sends no address', async () => {
		const id = await seedOrder(db);
		await deliver(evt('checkout.session.completed', session(id, { customer_details: null })));
		await flushMail();
		const body = JSON.parse((resend.mock.calls[0][1] as RequestInit).body as string);
		expect(body.to).toEqual(['ada@example.com']);
	});

	it('does not email, and still marks paid, when email is not configured', async () => {
		delete env.RESEND_API_KEY;
		const id = await seedOrder(db);
		await deliver(evt('checkout.session.completed', session(id)));
		await flushMail();
		expect(await statusOf(id)).toBe('paid');
		expect(sentMails()).toBe(0);
		const log = await db.prepare('SELECT status FROM email_log').all();
		expect(log.results).toEqual([{ status: 'skipped' }]);
	});

	it('ignores a completed-but-unpaid session, then pays on async_payment_succeeded', async () => {
		const id = await seedOrder(db);
		const unpaid = await deliver(
			evt('checkout.session.completed', session(id, { payment_status: 'unpaid' }))
		);
		expect(unpaid.json).toEqual({ received: true, ignored: true });
		expect(await statusOf(id)).toBe('pending');
		await deliver(evt('checkout.session.async_payment_succeeded', session(id)));
		await flushMail();
		expect(await statusOf(id)).toBe('paid');
		expect(sentMails()).toBe(1);
	});

	it('does not trust metadata alone: a different session id, unknown order or missing id is ignored', async () => {
		const id = await seedOrder(db);
		for (const object of [
			session(id, { id: 'cs_forged' }),
			session('ghost'),
			{ payment_status: 'paid' },
			session(id, { id: undefined })
		]) {
			expect((await deliver(evt('checkout.session.completed', object))).json.ignored).toBe(true);
		}
		expect(await statusOf(id)).toBe('pending');
		expect(sentMails()).toBe(0);
	});

	it('leaves the order pending when the amount taken is short or in another currency', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const id = await seedOrder(db);
		expect(
			(await deliver(evt('checkout.session.completed', session(id, { amount_total: 100 })))).json
		).toEqual({ received: true, ignored: true });
		expect(
			(await deliver(evt('checkout.session.completed', session(id, { currency: 'eur' })))).json
				.ignored
		).toBe(true);
		expect(await statusOf(id)).toBe('pending');
		// Paying more than the total (e.g. a tip) is accepted.
		await deliver(evt('checkout.session.completed', session(id, { amount_total: 2600 })));
		expect(await statusOf(id)).toBe('paid');
	});

	it('accepts a session without amount_total or currency', async () => {
		const id = await seedOrder(db);
		await deliver(
			evt(
				'checkout.session.completed',
				session(id, { amount_total: undefined, currency: undefined })
			)
		);
		expect(await statusOf(id)).toBe('paid');
	});

	it('does not revive a cancelled order, and says so in the log', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const id = await seedOrder(db, { status: 'cancelled' });
		const res = await deliver(evt('checkout.session.completed', session(id)));
		expect(res.json.ignored).toBe(true);
		expect(await statusOf(id)).toBe('cancelled');
		expect(sentMails()).toBe(0);
		expect(error).toHaveBeenCalledWith(
			'stripe webhook: needs attention',
			expect.objectContaining({ reason: 'order-cancelled' })
		);
	});

	it('leaves later states alone and sends no second receipt', async () => {
		const id = await seedOrder(db, { status: 'shipped' });
		const res = await deliver(evt('checkout.session.completed', session(id)));
		expect(res.json).toEqual({ received: true });
		await flushMail();
		expect(await statusOf(id)).toBe('shipped');
		expect(sentMails()).toBe(0);
	});
});

describe('stripe webhook: failed and expired', () => {
	it.each(['checkout.session.async_payment_failed', 'checkout.session.expired'])(
		'%s cancels a pending order once',
		async (type) => {
			const id = await seedOrder(db);
			const event = evt(type, session(id, { payment_status: 'unpaid' }));
			expect((await deliver(event)).json).toEqual({ received: true });
			expect(await statusOf(id)).toBe('cancelled');
			const updated = await db
				.prepare('SELECT updated_at FROM commerce_orders')
				.first('updated_at');
			expect((await deliver(event)).json).toEqual({ received: true });
			expect(await db.prepare('SELECT updated_at FROM commerce_orders').first('updated_at')).toBe(
				updated
			);
			expect(sentMails()).toBe(0);
		}
	);

	it('never cancels an order that is already paid', async () => {
		const id = await seedOrder(db, { status: 'paid' });
		const res = await deliver(evt('checkout.session.expired', session(id)));
		expect(res.json.ignored).toBe(true);
		expect(await statusOf(id)).toBe('paid');
	});

	it('ignores a failure for a session this site did not record', async () => {
		const id = await seedOrder(db);
		await deliver(evt('checkout.session.expired', session(id, { id: 'cs_other' })));
		expect(await statusOf(id)).toBe('pending');
	});
});

describe('stripe webhook: authentication and unrelated events', () => {
	it('answers 503 without a signing secret so Stripe retries', async () => {
		delete env.STRIPE_WEBHOOK_SECRET;
		expect((await deliver({})).status).toBe(503);
	});

	it('rejects a wrong secret, a missing signature, a stale timestamp and a tampered body', async () => {
		const id = await seedOrder(db);
		const body = JSON.stringify(evt('checkout.session.completed', session(id)));
		expect((await deliver(body, { secret: 'whsec_wrong' })).status).toBe(400);
		expect((await deliver(body, { header: '' })).status).toBe(400);
		const stale = await stripeSignature(body, SECRET, Math.floor(Date.now() / 1000) - 3600);
		expect((await deliver(body, { header: stale.header })).status).toBe(400);
		const good = await stripeSignature(body, SECRET);
		expect((await deliver(body + ' ', { header: good.header })).status).toBe(400);
		expect(await statusOf(id)).toBe('pending');
	});

	it('accepts any matching v1 signature, not just the last', async () => {
		const id = await seedOrder(db);
		const body = JSON.stringify(evt('checkout.session.completed', session(id)));
		const { t, sig } = await stripeSignature(body, SECRET);
		const header = `t=${t},v1=${sig},v1=${'0'.repeat(64)}`;
		expect((await deliver(body, { header })).status).toBe(200);
		expect(await statusOf(id)).toBe('paid');
	});

	it('rejects malformed headers and equal-length wrong signatures', async () => {
		const body = '{}';
		const t = Math.floor(Date.now() / 1000);
		for (const header of [
			null,
			'garbage',
			`t=abc,v1=aa`,
			`t=${t}`,
			`t=${t},v1=${'0'.repeat(64)}`
		]) {
			expect(await verifyStripeSignature(body, header, SECRET)).toBe(false);
		}
		expect(await verifyStripeSignature(body, 'x', '')).toBe(false);
	});

	it('rejects a signed body that is not a JSON object', async () => {
		expect((await deliver('not json')).status).toBe(400);
		expect((await deliver('null')).status).toBe(400);
	});

	it('acknowledges event types it has no use for', async () => {
		expect((await deliver(evt('charge.refunded', {}))).json).toEqual({
			received: true,
			ignored: true
		});
	});
});

describe('applyStripeEvent', () => {
	it('reports unchanged when the order moved between the read and the write', async () => {
		const id = await seedOrder(db);
		const real = db.prepare.bind(db);
		let raced = false;
		db.prepare = ((sql: string) => {
			if (!raced && sql.startsWith('UPDATE commerce_orders')) {
				raced = true;
				// A concurrent delivery wins first.
				void real("UPDATE commerce_orders SET status = 'paid'").run();
			}
			return real(sql);
		}) as never;
		const result = await applyStripeEvent(db, evt('checkout.session.completed', session(id)));
		expect(result).toMatchObject({ outcome: 'paid', changed: false });
	});

	it('rethrows errors that are not a lost race', async () => {
		const id = await seedOrder(db);
		await db.prepare('DROP TABLE commerce_order_items').run();
		await expect(
			applyStripeEvent(db, evt('checkout.session.completed', session(id)))
		).rejects.toThrow();
	});

	it('treats a repeat cancellation as unchanged', async () => {
		const id = await seedOrder(db, { status: 'cancelled' });
		expect(await applyStripeEvent(db, evt('checkout.session.expired', session(id)))).toMatchObject({
			outcome: 'cancelled',
			changed: false
		});
	});
});

describe('order status endpoint', () => {
	async function status(id: string, headers: Record<string, string> = {}) {
		const url = new URL(`/api/v1/orders/${id}/status`, 'https://shop.test');
		const response = await statusRoute.GET({
			request: new Request(url, { headers }),
			url,
			params: { id },
			locals: {},
			platform: { env }
		} as never);
		return { status: response.status, text: await response.text() };
	}

	it('returns only the status word, nothing about the buyer or the order', async () => {
		const id = await seedOrder(db, { email: 'secret@buyer.test' });
		const res = await status(id);
		expect(res.status).toBe(200);
		expect(JSON.parse(res.text)).toEqual({ status: 'pending' });
		expect(res.text).not.toContain('buyer.test');
		expect(res.text).not.toContain('2500');
		expect(res.text).not.toContain(id);
		await deliver(evt('checkout.session.completed', session(id)));
		expect(JSON.parse((await status(id)).text)).toEqual({ status: 'paid' });
	});

	it('answers 404 for an unknown or malformed id, without a hint which', async () => {
		expect((await status(crypto.randomUUID())).status).toBe(404);
		const spy = vi.spyOn(db, 'prepare');
		expect((await status("1' OR '1'='1")).status).toBe(404);
		expect(spy).not.toHaveBeenCalled();
	});

	it('is not cacheable, and a bad bearer key is still refused', async () => {
		const id = await seedOrder(db);
		const url = new URL(`/api/v1/orders/${id}/status`, 'https://shop.test');
		const response = await statusRoute.GET({
			request: new Request(url),
			url,
			params: { id },
			locals: {},
			platform: { env }
		} as never);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect((await status(id, { authorization: 'Bearer nk_nope' })).status).toBe(401);
	});
});

describe('order emails from the orders API', () => {
	it('sends the shipped notice once when an order is moved to shipped', async () => {
		const id = await seedOrder(db, { status: 'fulfilling' });
		const url = new URL(`/api/v1/orders/${id}`, 'https://shop.test');
		const patch = () =>
			orderRoute.PATCH({
				request: new Request(url, {
					method: 'PATCH',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ status: 'shipped', fulfillmentReference: 'TRACK123' })
				}),
				url,
				params: { id },
				locals: { user: { id: 'o', login: 'owner', email: 'o@x', isOwner: true } },
				platform: { env, context: { waitUntil } }
			} as never);
		expect((await patch()).status).toBe(200);
		expect((await patch()).status).toBe(409);
		await flushMail();
		expect(sentMails()).toBe(1);
		const body = JSON.parse((resend.mock.calls[0][1] as RequestInit).body as string);
		expect(body.subject).toContain('has shipped');
		expect(body.text).toContain('TRACK123');
	});

	it('sends the receipt for an order a person marks paid', async () => {
		const id = await seedOrder(db, { paymentReference: null });
		const url = new URL(`/api/v1/orders/${id}`, 'https://shop.test');
		await orderRoute.PATCH({
			request: new Request(url, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ status: 'paid' })
			}),
			url,
			params: { id },
			locals: { user: { id: 'o', login: 'owner', email: 'o@x', isOwner: true } },
			platform: { env, context: { waitUntil } }
		} as never);
		await flushMail();
		expect(sentMails()).toBe(1);
	});
});
