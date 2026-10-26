// "Sign in, then come back here." Another app on this origin (the shop, at
// /shop) links to /auth/login?next=/shop/orders; after any kind of sign-in the
// visitor lands on that path instead of the home page.
//
// Only a plain path on this same site is accepted — never another host, a
// protocol-relative "//evil.example", a backslash trick or a control
// character — so `next` cannot be turned into an open redirect.
//
// Password sign-in and sign-up go straight to it. OAuth (GitHub, Discord)
// leaves the site and comes back to the provider callback's own redirect, so
// the path is also kept in sessionStorage for this tab and the root layout
// takes it once a signed-in page loads.

const KEY = 'after-login';

export function safeNext(value: string | null | undefined): string | null {
	if (!value || value.length > 512) return null;
	if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
	// eslint-disable-next-line no-control-regex
	if (/[\u0000-\u001f\u007f]/.test(value)) return null;
	try {
		// Resolve against a throwaway origin: anything that leaves it is refused.
		const url = new URL(value, 'https://same.invalid');
		if (url.origin !== 'https://same.invalid') return null;
		return url.pathname + url.search + url.hash;
	} catch {
		return null;
	}
}

/** Called by the login and sign-up pages: keep `next` for this tab, or forget a stale one. */
export function rememberNext(value: string | null | undefined) {
	try {
		const next = safeNext(value);
		if (next) sessionStorage.setItem(KEY, next);
		else sessionStorage.removeItem(KEY);
	} catch {
		// Storage blocked: the visitor lands on the default page instead.
	}
}

/** The kept path, once. */
export function takeNext(): string | null {
	try {
		const next = safeNext(sessionStorage.getItem(KEY));
		sessionStorage.removeItem(KEY);
		return next;
	} catch {
		return null;
	}
}
