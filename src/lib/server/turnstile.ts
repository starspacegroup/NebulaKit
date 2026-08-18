/**
 * Cloudflare Turnstile verification (server-side).
 *
 * Greenfield in the kit — there was no prior captcha code. Turnstile is
 * OPTIONAL: it only engages when both Turnstile keys are configured. A partial
 * configuration is invalid and must fail closed so the browser and server can
 * never disagree about whether a challenge is required.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileConfig =
	{ enabled: false; error?: string } | { enabled: true; siteKey: string; secretKey: string };

/** Resolve both keys atomically and report partial operator configuration. */
export function getTurnstileConfig(
	siteKey: string | undefined | null,
	secretKey: string | undefined | null
): TurnstileConfig {
	const site = siteKey?.trim();
	const secret = secretKey?.trim();
	if (!site && !secret) return { enabled: false };
	if (!site || !secret) {
		return {
			enabled: false,
			error: 'Turnstile requires both TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY.'
		};
	}
	return { enabled: true, siteKey: site, secretKey: secret };
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
