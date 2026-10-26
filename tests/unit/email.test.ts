import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import type { Order } from '@nebulakit/commerce';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import { sendEmail, sendEmailAfterResponse, type OutgoingEmail } from '../../src/lib/server/email';
import {
	escapeHtml,
	notice,
	orderReceipt,
	orderShipped,
	shortOrderRef
} from '../../src/lib/emails/templates';
import { emailTheme } from '../../src/lib/site.config';

let db: D1Database;
const mail = (over: Partial<OutgoingEmail> = {}): OutgoingEmail => ({
	to: 'ada@example.com',
	subject: 'Hi',
	html: '<p>Hi</p>',
	text: 'Hi',
	template: 'order-receipt',
	relatedType: 'order',
	relatedId: 'order-1',
	...over
});
const ok = () =>
	vi.fn(
		async (..._args: unknown[]) => new Response(JSON.stringify({ id: 're_1' }), { status: 200 })
	);
const rows = async () =>
	(
		await db
			.prepare('SELECT template, status, provider_id, error FROM email_log ORDER BY rowid')
			.all()
	).results;

beforeEach(() => {
	db = createSqliteD1();
	vi.spyOn(console, 'info').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

const live = () => ({ DB: db, RESEND_API_KEY: 're_key', EMAIL_FROM: 'Shop <o@shop.test>' });

describe('sendEmail', () => {
	it('posts to Resend with the key, From and a plain-text part', async () => {
		const fetchImpl = ok();
		const result = await sendEmail(
			{ ...live(), EMAIL_REPLY_TO: 'help@shop.test' },
			mail(),
			fetchImpl
		);
		expect(result).toEqual({ ok: true, id: 're_1' });
		const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('https://api.resend.com/emails');
		expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_key');
		expect(JSON.parse(init.body as string)).toMatchObject({
			from: 'Shop <o@shop.test>',
			to: ['ada@example.com'],
			text: 'Hi',
			reply_to: 'help@shop.test'
		});
		expect(await rows()).toEqual([
			{ template: 'order-receipt', status: 'sent', provider_id: 're_1', error: null }
		]);
	});

	it('lets a message override Reply-To', async () => {
		const fetchImpl = ok();
		await sendEmail(live(), mail({ replyTo: 'x@y.co' }), fetchImpl);
		expect(JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string).reply_to).toBe(
			'x@y.co'
		);
	});

	it('sends a given template and related id only once, even when attempts race', async () => {
		const fetchImpl = ok();
		const results = await Promise.all([
			sendEmail(live(), mail(), fetchImpl),
			sendEmail(live(), mail(), fetchImpl),
			sendEmail(live(), mail(), fetchImpl)
		]);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		expect(results.filter((r) => r.ok)).toHaveLength(1);
		expect(results.filter((r) => !r.ok && r.reason === 'already-sent')).toHaveLength(2);
		expect(await rows()).toHaveLength(1);
	});

	it('the database refuses a second sent row for the same template and subject', async () => {
		const insert = () =>
			db
				.prepare(
					`INSERT INTO email_log (id, to_address, template, subject, status, related_id)
					 VALUES (?, 'a@b.co', 't', 's', 'sent', 'r')`
				)
				.bind(crypto.randomUUID())
				.run();
		await insert();
		await expect(insert()).rejects.toThrow(/UNIQUE/);
	});

	it('allows the same order a different template, and a different order the same template', async () => {
		const fetchImpl = ok();
		await sendEmail(live(), mail(), fetchImpl);
		await sendEmail(live(), mail({ template: 'order-shipped' }), fetchImpl);
		await sendEmail(live(), mail({ relatedId: 'order-2' }), fetchImpl);
		expect(fetchImpl).toHaveBeenCalledTimes(3);
	});

	it('sends every time when no related id is given', async () => {
		const fetchImpl = ok();
		await sendEmail(live(), mail({ relatedId: null }), fetchImpl);
		await sendEmail(live(), mail({ relatedId: null }), fetchImpl);
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it('frees the slot when the provider refuses, so a retry can succeed', async () => {
		const refuse = vi.fn(async () => new Response('bad domain', { status: 422 }));
		const first = await sendEmail(live(), mail(), refuse);
		expect(first).toEqual({ ok: false, reason: 'send-failed', error: '422 bad domain' });
		expect(await rows()).toEqual([
			{ template: 'order-receipt', status: 'failed', provider_id: null, error: '422 bad domain' }
		]);
		expect((await sendEmail(live(), mail(), ok())).ok).toBe(true);
	});

	it('survives a network error and an unreadable refusal body', async () => {
		const down = vi.fn(async () => {
			throw new Error('offline');
		});
		expect(await sendEmail(live(), mail(), down)).toMatchObject({
			ok: false,
			reason: 'send-failed',
			error: expect.stringContaining('offline')
		});
		const odd = vi.fn(
			async () => ({ ok: false, status: 500, text: () => Promise.reject(new Error('x')) }) as never
		);
		expect(await sendEmail(live(), mail({ relatedId: 'o3' }), odd)).toMatchObject({
			error: '500'
		});
	});

	it('treats an unparseable success body as sent without a provider id', async () => {
		const fetchImpl = vi.fn(async () => new Response('not json', { status: 200 }));
		expect(await sendEmail(live(), mail(), fetchImpl)).toEqual({ ok: true, id: null });
	});

	it('skips and records when no key or From is configured', async () => {
		const fetchImpl = ok();
		expect(await sendEmail({ DB: db, EMAIL_FROM: 'a@b.co' }, mail(), fetchImpl)).toEqual({
			ok: false,
			reason: 'not-configured'
		});
		expect(await sendEmail({ DB: db, RESEND_API_KEY: 'k' }, mail(), fetchImpl)).toMatchObject({
			reason: 'not-configured'
		});
		expect(fetchImpl).not.toHaveBeenCalled();
		const logged = await rows();
		expect(logged.map((r) => r.status)).toEqual(['skipped', 'skipped']);
		// Skipped rows hold no slot: once configured, the same email goes out.
		expect((await sendEmail(live(), mail(), ok())).ok).toBe(true);
	});

	it('skips quietly with neither key nor database', async () => {
		expect(await sendEmail({}, mail(), ok())).toMatchObject({ reason: 'not-configured' });
	});

	it('refuses a bad recipient without writing anything', async () => {
		const fetchImpl = ok();
		for (const to of ['', 'nobody', 'a b@c.co']) {
			expect(await sendEmail(live(), mail({ to }), fetchImpl)).toEqual({
				ok: false,
				reason: 'no-recipient'
			});
		}
		expect(fetchImpl).not.toHaveBeenCalled();
		expect(await rows()).toEqual([]);
	});

	it('still sends, with a warning, when there is no database to log in', async () => {
		const { DB: _drop, ...noDb } = live();
		expect((await sendEmail(noDb, mail(), ok())).ok).toBe(true);
		expect(
			await sendEmail(
				noDb,
				mail(),
				vi.fn(async () => new Response('no', { status: 500 }))
			)
		).toMatchObject({
			reason: 'send-failed'
		});
	});

	it('does not send when the log cannot be written, and never throws', async () => {
		await db.prepare('DROP TABLE email_log').run();
		const fetchImpl = ok();
		expect(await sendEmail(live(), mail(), fetchImpl)).toMatchObject({ reason: 'already-sent' });
		expect(fetchImpl).not.toHaveBeenCalled();
		// Skipped-note and settle failures are swallowed too.
		expect(await sendEmail({ DB: db, EMAIL_FROM: 'a@b.co' }, mail(), fetchImpl)).toMatchObject({
			reason: 'not-configured'
		});
	});

	it('survives a failure while settling the log row', async () => {
		const real = db.prepare.bind(db);
		db.prepare = ((sql: string) => {
			if (sql.startsWith('UPDATE email_log')) throw new Error('db gone');
			return real(sql);
		}) as never;
		expect((await sendEmail(live(), mail(), ok())).ok).toBe(true);
		expect(
			await sendEmail(
				live(),
				mail({ relatedId: 'o9' }),
				vi.fn(async () => new Response('x', { status: 500 }))
			)
		).toMatchObject({ reason: 'send-failed' });
	});

	it('never rejects, even when something unexpected throws', async () => {
		const boom = {
			...live(),
			get RESEND_API_KEY(): string {
				throw new Error('getter');
			}
		};
		expect(await sendEmail(boom, mail(), ok())).toMatchObject({ ok: false, reason: 'send-failed' });
	});
});

describe('sendEmailAfterResponse', () => {
	it('hands the promise to waitUntil when the platform has one', async () => {
		const waitUntil = vi.fn();
		const platform = { env: live(), context: { waitUntil } } as unknown as App.Platform;
		const promise = sendEmailAfterResponse(platform, mail(), ok());
		expect(waitUntil).toHaveBeenCalledWith(promise);
		expect((await promise).ok).toBe(true);
	});

	it('works without waitUntil, and reports not-configured without a platform', async () => {
		const platform = { env: live() } as unknown as App.Platform;
		expect((await sendEmailAfterResponse(platform, mail(), ok())).ok).toBe(true);
		expect(await sendEmailAfterResponse(undefined, mail())).toEqual({
			ok: false,
			reason: 'not-configured'
		});
	});
});

const order: Order = {
	regional: null,
	id: 'abcdef12-0000-4000-8000-000000000000',
	status: 'paid',
	email: 'ada@example.com',
	currency: 'usd',
	subtotalCents: 2500,
	shippingCents: 500,
	taxCents: 200,
	totalCents: 3200,
	shippingAddress: null,
	paymentProvider: 'stripe',
	paymentReference: 'cs_1',
	fulfillmentReference: null,
	items: [
		{
			id: 'i1',
			productId: null,
			name: '<script>alert(1)</script> Tee & "Co"',
			unitPriceCents: 2500,
			quantity: 1,
			lineTotalCents: 2500
		}
	],
	createdAt: '',
	updatedAt: ''
};

describe('email templates', () => {
	it('renders a receipt with escaped names, totals and a text part', () => {
		const mailBody = orderReceipt(order);
		expect(mailBody.subject).toContain(shortOrderRef(order.id));
		expect(mailBody.html).not.toContain('<script>');
		expect(mailBody.html).toContain(
			'&lt;script&gt;alert(1)&lt;/script&gt; Tee &amp; &quot;Co&quot;'
		);
		expect(mailBody.html).toContain('$32.00');
		expect(mailBody.html).toContain('Shipping');
		expect(mailBody.text).toContain('Total  $32.00');
		expect(mailBody.text).toContain('Tax  $2.00');
	});

	it('leaves out zero shipping and tax lines', () => {
		const plain = orderReceipt({ ...order, shippingCents: 0, taxCents: 0, totalCents: 2500 });
		expect(plain.html).not.toContain('Shipping');
		expect(plain.text).not.toContain('Tax');
	});

	it('takes colours from the theme, never from the template source', () => {
		const html = orderReceipt(order).html;
		expect(html).toContain(emailTheme.accent);
		const custom = orderReceipt(order, {
			theme: { ...emailTheme, accent: '#123456' },
			siteName: 'Acme <Co>',
			siteUrl: 'https://acme.test'
		});
		expect(custom.html).toContain('#123456');
		expect(custom.html).not.toContain(emailTheme.accent);
		expect(custom.html).toContain('Acme &lt;Co&gt;');
		expect(custom.subject).toContain('Acme <Co>');
		expect(readFileSync('src/lib/emails/templates.ts', 'utf8')).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
		expect(readFileSync('src/lib/emails/templates.ts', 'utf8')).not.toMatch(/var\(--/);
	});

	it('renders a shipped notice, using only http(s) tracking links', () => {
		const shipped = orderShipped(order, {
			trackingUrl: 'https://carrier.test/t?id=1&x="2"',
			reference: 'TRACK<1>'
		});
		expect(shipped.subject).toContain('has shipped');
		expect(shipped.html).toContain('href="https://carrier.test/t?id=1&amp;x=%222%22"');
		expect(shipped.html).toContain('TRACK&lt;1&gt;');
		expect(shipped.text).toContain('Track it: https://carrier.test/');
		for (const bad of ['javascript:alert(1)', 'not a url', 'data:text/html,x']) {
			const none = orderShipped(order, { trackingUrl: bad });
			expect(none.html).not.toContain('href="javascript');
			expect(none.html).not.toContain('Track your order');
			expect(none.text).not.toContain('Track it');
		}
		expect(orderShipped(order).text).toContain('is on its way');
	});

	it('renders a generic notice (a password-reset style message)', () => {
		const reset = notice({
			subject: 'Reset your password',
			heading: 'Reset <b>now</b>',
			paragraphs: ['Use the button below.', 'If this was not you, ignore it.'],
			cta: { label: 'Reset password', href: 'https://shop.test/reset?token=abc' }
		});
		expect(reset.subject).toBe('Reset your password');
		expect(reset.html).toContain('Reset &lt;b&gt;now&lt;/b&gt;');
		expect(reset.html).toContain('href="https://shop.test/reset?token=abc"');
		expect(reset.text).toContain('Reset password: https://shop.test/reset?token=abc');
		const bare = notice({ subject: 's', heading: 'H', paragraphs: [] });
		expect(bare.html).toContain('H');
		const badLink = notice({
			subject: 's',
			heading: 'H',
			paragraphs: ['x'],
			cta: { label: 'Go', href: 'javascript:alert(1)' }
		});
		expect(badLink.html).not.toContain('javascript:');
		expect(badLink.text).not.toContain('Go:');
	});

	it('escapes the five HTML metacharacters', () => {
		expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
	});
});
