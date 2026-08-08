/**
 * OAuth `state` issue/verify.
 *
 * The init routes used to mint a state, put it in the authorize URL, and never
 * persist it — and the callbacks read the returned state into a variable they
 * never compared. That is a login-CSRF hole: an attacker could hand a victim a
 * callback URL bearing the attacker's authorization code and silently bind the
 * victim's session (or, in linking mode, the victim's account) to the
 * attacker's identity. State now round-trips through an HttpOnly cookie.
 */
import type { Cookies } from '@sveltejs/kit';

const STATE_COOKIE_PREFIX = 'oauth_state_';

/** Long enough for a human to complete the consent screen, short enough to not linger. */
const STATE_TTL_SECONDS = 10 * 60;

function cookieName(provider: string): string {
	return `${STATE_COOKIE_PREFIX}${provider}`;
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}
	let mismatch = 0;
	for (let i = 0; i < a.length; i++) {
		mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return mismatch === 0;
}

/**
 * Mint a state value and stash it in an HttpOnly cookie for the callback.
 * SameSite=Lax so it still rides along on the top-level GET the provider
 * redirects back with.
 */
export function issueOAuthState(cookies: Cookies, provider: string, secure: boolean): string {
	const state = crypto.randomUUID();

	cookies.set(cookieName(provider), state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure,
		maxAge: STATE_TTL_SECONDS
	});

	return state;
}

/**
 * Compare the returned state against the stashed one, then clear the cookie so
 * a state can only be spent once. Returns false when either side is missing —
 * fail closed.
 */
export function consumeOAuthState(
	cookies: Cookies,
	provider: string,
	received: string | null
): boolean {
	const name = cookieName(provider);
	const expected = cookies.get(name);

	// Single-use regardless of outcome.
	cookies.delete(name, { path: '/' });

	if (!expected || !received) {
		return false;
	}

	return timingSafeEqual(expected, received);
}
