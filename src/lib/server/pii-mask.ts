/**
 * PII masking for admin views (ported from a downstream app).
 *
 * Personal data (names, emails, ids, avatars) is masked in admin views BY
 * DEFAULT so incidental screen-sharing/screenshots don't leak user PII. An
 * owner can flip a "reveal" toggle (a short-lived cookie) to see real values.
 *
 * Two paradigms share this module and the `pii_reveal` cookie:
 *  1. Server-side masking — `+page.server.ts` loads call `mask*()` and replace
 *     values before they ever reach the browser (used for the user + contact
 *     admin lists). When hidden, the client never receives the real data.
 *  2. Client-side context masking — `Pii.svelte` reads the reveal state from
 *     Svelte context and hides values already sent to the browser.
 *
 * Role policy for the KIT: reveal is `isOwner`-only (owner is the kit's top
 * role). Plain admins are always masked. Downstream apps with finer-grained
 * roles adjust `canRevealPii` (e.g. add a superadmin flag) — it's the one gate
 * every read routes through.
 */

/** Role flags as carried on `locals.user` (see app.d.ts). */
export type RoleFlags = {
	isOwner?: boolean;
	isAdmin?: boolean;
};

/**
 * Mask a display name: keep each word's first letter, star the rest.
 * `Ada Lovelace` -> `A** L*******`. Empty -> `*** ***`.
 */
export function maskName(name: string | null | undefined): string {
	if (!name) return '*** ***';
	return (
		name
			.split(' ')
			.filter(Boolean)
			.map((word) => (word.length <= 1 ? word : word[0] + '*'.repeat(word.length - 1)))
			.join(' ') || '***'
	);
}

/**
 * Mask an email: keep the first local-part char + the full `@domain`.
 * `ada@example.com` -> `a**@example.com`. Empty -> `***@***.***`.
 */
export function maskEmail(email: string | null | undefined): string {
	if (!email) return '***@***.***';
	const at = email.indexOf('@');
	if (at < 1) return email[0] + '*'.repeat(Math.max(email.length - 1, 3));
	const local = email.slice(0, at);
	const domain = email.slice(at);
	return local[0] + '*'.repeat(Math.max(local.length - 1, 2)) + domain;
}

/**
 * Mask a generic identifier, keeping rows distinguishable. `<= 4` chars keep
 * the first char; longer keep first 2 + last 2. `abcdefgh` -> `ab****gh`.
 * Empty -> `***`.
 */
export function maskGeneric(value: string | null | undefined): string {
	if (!value) return '***';
	if (value.length <= 4) return value[0] + '*'.repeat(value.length - 1);
	return value.slice(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2);
}

/** Whether this user may reveal PII. Owner-only in the kit. */
export function canRevealPii(user: RoleFlags | null | undefined): boolean {
	if (!user) return false;
	return Boolean(user.isOwner);
}

/**
 * Authoritative server-side read: PII is revealed only when the user is allowed
 * AND the `pii_reveal` cookie is explicitly `'1'`. Anything else stays masked.
 */
export function isPiiRevealed(
	user: RoleFlags | null | undefined,
	cookieValue: string | undefined
): boolean {
	return canRevealPii(user) && cookieValue === '1';
}

/** Cookie name + scope shared by the reveal endpoint and every server read. */
export const PII_REVEAL_COOKIE = 'pii_reveal';
// The same server-side reveal decision protects both /admin pages and
// /api/admin responses, so the browser must send the opt-in cookie to both.
export const PII_REVEAL_COOKIE_PATH = '/';
/** Reveal auto-expires (1h) so it's never left permanently on. */
export const PII_REVEAL_MAX_AGE = 60 * 60;
