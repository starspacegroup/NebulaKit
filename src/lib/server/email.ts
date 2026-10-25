/**
 * Transactional email through Resend, and the record of having sent it.
 *
 * Resend is reached with `fetch`, not an SDK: it is one JSON POST. Swapping
 * provider means changing `deliver()` and nothing else.
 *
 * Three properties this is built for:
 *
 * NEVER THROWS INTO A REQUEST. An order must not fail because an email
 * provider is having an afternoon. Every path resolves to a `SendResult`.
 *
 * ONCE ONLY, ENFORCED BY THE DATABASE. Stripe retries webhooks and can
 * deliver one event twice. A send first claims its slot in `email_log`
 * (migration 0020: partial unique index on (template, related_id) where
 * status = 'sent'); a second attempt loses the insert and stops. Claiming
 * before sending is deliberate: a duplicate email is worse than a row marked
 * sent whose provider call died in flight (visible as a 'sent' row with no
 * `provider_id`). A provider refusal flips the row to 'failed', which frees
 * the slot so the send can be retried.
 *
 * SILENCE IS CONFIGURED, NOT BROKEN. With no `RESEND_API_KEY` (or no
 * `EMAIL_FROM`) nothing is sent and a 'skipped' row is written, so a shop
 * that has not set email up behaves as it did before.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { isValidEmail } from '$lib/modules/account/logic';

export interface EmailEnv {
	DB?: D1Database;
	/** Resend API key (`re_...`). Without it nothing is sent. */
	RESEND_API_KEY?: string;
	/** The From header, e.g. `Shop <orders@example.com>`. Required to send. */
	EMAIL_FROM?: string;
	/** Optional Reply-To. */
	EMAIL_REPLY_TO?: string;
}

export interface OutgoingEmail {
	to: string;
	subject: string;
	html: string;
	text: string;
	/** Names the email ('order-receipt', ...). Goes in the log. */
	template: string;
	relatedType?: string | null;
	/**
	 * The id of the thing it is about. Supplying it makes the send once-only
	 * per template; omitting it means "send every time".
	 */
	relatedId?: string | null;
	replyTo?: string;
}

export type SendResult =
	| { ok: true; id: string | null }
	| {
			ok: false;
			reason: 'not-configured' | 'no-recipient' | 'already-sent' | 'send-failed';
			error?: string;
	  };

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/** The log row id when this send is ours to make; null when it already happened. */
async function claim(db: D1Database, email: OutgoingEmail, to: string): Promise<string | null> {
	const id = crypto.randomUUID();
	try {
		await db
			.prepare(
				`INSERT INTO email_log (id, to_address, template, subject, status, related_type, related_id)
				 VALUES (?, ?, ?, ?, 'sent', ?, ?)`
			)
			.bind(
				id,
				to,
				email.template,
				email.subject,
				email.relatedType ?? null,
				email.relatedId ?? null
			)
			.run();
		return id;
	} catch (err) {
		// The unique index did its job. Any other error is also a reason not to
		// send: a log we cannot write is a duplicate we cannot prevent.
		console.warn('email: claim rejected', { template: email.template, error: String(err) });
		return null;
	}
}

async function settle(
	db: D1Database,
	logId: string,
	outcome: { providerId: string | null } | { error: string }
): Promise<void> {
	try {
		if ('providerId' in outcome) {
			await db
				.prepare('UPDATE email_log SET provider_id = ? WHERE id = ?')
				.bind(outcome.providerId, logId)
				.run();
		} else {
			await db
				.prepare("UPDATE email_log SET status = 'failed', error = ? WHERE id = ?")
				.bind(outcome.error.slice(0, 2000), logId)
				.run();
		}
	} catch (err) {
		console.error('email: could not settle log row', { logId, error: String(err) });
	}
}

async function noteSkipped(
	db: D1Database | undefined,
	email: OutgoingEmail,
	to: string,
	reason: string
): Promise<void> {
	if (!db) return;
	try {
		await db
			.prepare(
				`INSERT INTO email_log (id, to_address, template, subject, status, error, related_type, related_id)
				 VALUES (?, ?, ?, ?, 'skipped', ?, ?, ?)`
			)
			.bind(
				crypto.randomUUID(),
				to,
				email.template,
				email.subject,
				reason,
				email.relatedType ?? null,
				email.relatedId ?? null
			)
			.run();
	} catch (err) {
		console.error('email: could not write log row', { error: String(err) });
	}
}

/** The provider call. The only Resend-shaped thing in this file. */
async function deliver(
	env: EmailEnv,
	email: OutgoingEmail,
	to: string,
	fetchImpl: typeof fetch
): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
	let res: Response;
	try {
		res = await fetchImpl(RESEND_ENDPOINT, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.RESEND_API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				from: env.EMAIL_FROM,
				to: [to],
				subject: email.subject,
				html: email.html,
				text: email.text,
				...(email.replyTo || env.EMAIL_REPLY_TO
					? { reply_to: email.replyTo ?? env.EMAIL_REPLY_TO }
					: {})
			})
		});
	} catch (err) {
		return { ok: false, error: `network: ${String(err)}` };
	}
	if (!res.ok) {
		const body = await res.text().catch(() => '');
		return { ok: false, error: `${res.status} ${body}`.trim() };
	}
	const data = (await res.json().catch(() => null)) as { id?: string } | null;
	return { ok: true, id: data?.id ?? null };
}

/** Send one email. Resolves to what happened; never rejects. */
export async function sendEmail(
	env: EmailEnv,
	email: OutgoingEmail,
	fetchImpl: typeof fetch = fetch
): Promise<SendResult> {
	try {
		const to = email.to.trim();
		if (!isValidEmail(to)) {
			console.info('email: no usable recipient', { template: email.template });
			return { ok: false, reason: 'no-recipient' };
		}
		if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
			await noteSkipped(env.DB, email, to, 'RESEND_API_KEY or EMAIL_FROM not set');
			console.info('email: not configured, skipped', { template: email.template });
			return { ok: false, reason: 'not-configured' };
		}
		// No database means no once-only guarantee. Send anyway (a customer
		// hearing nothing is worse) but say so.
		if (!env.DB) {
			console.warn('email: sending without a log (no DB binding)', { template: email.template });
			const result = await deliver(env, email, to, fetchImpl);
			return result.ok
				? { ok: true, id: result.id }
				: { ok: false, reason: 'send-failed', error: result.error };
		}
		const logId = await claim(env.DB, email, to);
		if (!logId) return { ok: false, reason: 'already-sent' };

		const result = await deliver(env, email, to, fetchImpl);
		if (!result.ok) {
			await settle(env.DB, logId, { error: result.error });
			console.error('email: provider refused', { template: email.template, error: result.error });
			return { ok: false, reason: 'send-failed', error: result.error };
		}
		await settle(env.DB, logId, { providerId: result.id });
		return { ok: true, id: result.id };
	} catch (err) {
		console.error('email: unexpected failure', { template: email.template, error: String(err) });
		return { ok: false, reason: 'send-failed', error: String(err) };
	}
}

/**
 * Send without making the caller wait. `waitUntil` keeps the Worker alive
 * past the response; without it (dev, tests) the promise is simply returned
 * and the caller may await it. The returned promise never rejects.
 */
export function sendEmailAfterResponse(
	platform: App.Platform | undefined,
	email: OutgoingEmail,
	fetchImpl: typeof fetch = fetch
): Promise<SendResult> {
	const env = platform?.env as EmailEnv | undefined;
	if (!env) return Promise.resolve({ ok: false, reason: 'not-configured' });
	const promise = sendEmail(env, email, fetchImpl);
	platform?.context?.waitUntil?.(promise);
	return promise;
}
