/**
 * Body of /.well-known/security.txt (RFC 9116).
 *
 * The file is a promise that someone reads what arrives at `Contact`, so the
 * template invents none: it is served only when the operator sets the
 * SECURITY_CONTACT binding, and is a 404 otherwise. site.config carries no
 * contact address, and guessing one would send a researcher's report to a
 * stranger.
 *
 * `Expires` is required by the RFC and must be less than a year away. It is
 * computed from the request time, so the file never goes stale and never
 * claims a validity longer than the RFC allows.
 *
 * This lives outside the route file because SvelteKit rejects extra exports
 * from a `+server.ts`.
 */
import { SECURITY_TXT_PATH } from '$lib/agent-discovery';
import { site } from '$lib/site.config';

/** Days until `Expires`. RFC 9116 asks for less than one year. */
export const SECURITY_TXT_VALID_DAYS = 180;

const EMAIL = /^[^\s@<>"',;:\\]+@[^\s@<>"',;:\\]+\.[^\s@<>"',;:\\]+$/;

/**
 * Turn the configured value into `Contact` URIs. An email becomes `mailto:`,
 * an https URL is kept, anything else (http, javascript:, tel:, whitespace,
 * control characters) is dropped. An empty result means "not configured".
 */
export function parseSecurityContacts(raw: string | undefined | null): string[] {
	const contacts: string[] = [];
	for (const part of (raw ?? '').split(',')) {
		const value = part.trim();
		if (!value) continue;
		if (EMAIL.test(value)) {
			contacts.push(`mailto:${value}`);
		} else if (/^https:\/\/[^\s]+$/i.test(value)) {
			try {
				const url = new URL(value);
				if (!url.username && !url.password) contacts.push(url.href);
			} catch {
				// not a URL: dropped
			}
		}
	}
	return contacts;
}

/** The file body, or null when no usable contact is configured. */
export function buildSecurityTxt(
	rawContact: string | undefined | null,
	now: Date = new Date()
): string | null {
	const contacts = parseSecurityContacts(rawContact);
	if (contacts.length === 0) return null;
	const expires = new Date(now.getTime() + SECURITY_TXT_VALID_DAYS * 24 * 60 * 60 * 1000);
	return [
		...contacts.map((contact) => `Contact: ${contact}`),
		`Expires: ${expires.toISOString().replace(/\.\d{3}Z$/, 'Z')}`,
		'Preferred-Languages: en',
		`Canonical: ${site.url}${SECURITY_TXT_PATH}`,
		''
	].join('\n');
}
