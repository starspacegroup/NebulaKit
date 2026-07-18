/**
 * Cloudflare Turnstile verification (server-side).
 *
 * Greenfield in the kit — there was no prior captcha code. Turnstile is
 * OPTIONAL: it only engages when `TURNSTILE_SECRET_KEY` is configured, matching
 * the kit's zero-env-setup philosophy (a fresh clone with no secret still has a
 * working contact form; add the key to turn on bot protection). The public
 * site key is surfaced to the client separately via `TURNSTILE_SITE_KEY`.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** True when Turnstile is configured and should be enforced. */
export function turnstileEnabled(secretKey: string | undefined | null): boolean {
	return Boolean(secretKey);
}

export interface TurnstileVerifyOptions {
	secretKey: string;
	/** The `cf-turnstile-response` token from the widget. */
	token: string | null | undefined;
	/** Visitor IP (`CF-Connecting-IP`), optional but recommended. */
	remoteIp?: string | null;
	/** Injected in tests; defaults to global fetch. */
	fetchImpl?: typeof fetch;
}

/**
 * Verify a Turnstile token against Cloudflare's siteverify endpoint. Returns
 * `false` on a missing token, a non-OK response, a thrown network error, or an
 * unsuccessful payload — callers treat any falsy result as "failed challenge".
 */
export async function verifyTurnstile(options: TurnstileVerifyOptions): Promise<boolean> {
	const { secretKey, token, remoteIp, fetchImpl = fetch } = options;
	if (!token) return false;

	const body = new FormData();
	body.append('secret', secretKey);
	body.append('response', token);
	if (remoteIp) body.append('remoteip', remoteIp);

	try {
		const resp = await fetchImpl(SITEVERIFY_URL, { method: 'POST', body });
		if (!resp.ok) return false;
		const payload = (await resp.json()) as { success?: boolean };
		return Boolean(payload.success);
	} catch {
		return false;
	}
}
