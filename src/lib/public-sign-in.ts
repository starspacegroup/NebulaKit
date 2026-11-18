/**
 * Public sign-in: whether visitors are invited to sign in or sign up.
 *
 * A shop's visitors never sign in; only its admins do. Linking a sign-in form
 * and an OAuth button from every page of a days-old domain is the shape
 * Google Safe Browsing flags as "Deceptive pages" (pinfool.com, 2026-11-15;
 * see docs/PUBLIC_SIGN_IN.md). With `site.publicSignIn: false` the Sign In /
 * Sign Up links leave the navigation, footer, command palette and home page,
 * and sign-up is refused. `/auth/login` and the OAuth callbacks keep working,
 * unlinked, so admins still sign in.
 *
 * Unset means `true`: a site built before this flag existed keeps its links.
 *
 * Dependency-free so components, server routes and hooks share one rule.
 */

export interface PublicSignInConfig {
	readonly publicSignIn?: boolean;
}

export function publicSignInEnabled(config: PublicSignInConfig): boolean {
	return config.publicSignIn !== false;
}

const AUTH_PREFIXES = ['/auth', '/api/auth'] as const;

/** `/auth`, `/auth/…`, `/api/auth`, `/api/auth/…` — whole segments only. */
export function isAuthPath(pathname: string): boolean {
	return AUTH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Sent on every auth response whatever the flag: a sign-in form or an OAuth
 * callback is never content to index. robots.txt already Disallows these
 * paths; the header covers a crawler that reached one through a link.
 */
export const AUTH_ROBOTS_TAG = 'noindex, nofollow, noarchive';

export function robotsTagFor(pathname: string): string | null {
	return isAuthPath(pathname) ? AUTH_ROBOTS_TAG : null;
}
