/**
 * One host, so one sign-in, and one host in search results.
 *
 * The session cookie is host-only (no Domain attribute), so a visitor signed in
 * on `example.com` looks signed out on `www.example.com`. When a site is served
 * on both, `www` is sent to the canonical host before anything else runs.
 *
 * The canonical host comes from `site.url`, never from a literal here. Requests
 * to anything that is not the canonical host (localhost, a `*.pages.dev`
 * deployment, a preview or tunnel host) are served as they are, but carry
 * `X-Robots-Tag: noindex, nofollow` so they never compete with production in a
 * search index.
 *
 * Machine callers that treat any 3xx as a failure are exempt from the redirect:
 * Stripe does not follow redirects, so a webhook still registered against `www`
 * would silently lose payment events.
 */
import { site } from '$lib/site.config';

/** Paths that must be served on any host, never redirected. */
export const REDIRECT_EXEMPT_PREFIXES: readonly string[] = ['/api/v1/webhooks', '/api/cron'];

const NOINDEX = 'noindex, nofollow';

function hostnameOf(siteUrl: string): string {
	try {
		return new URL(siteUrl).hostname.toLowerCase();
	} catch {
		return '';
	}
}

/** Hosts where a `www` alias makes no sense: local, IP and platform-assigned. */
function hasNoWwwAlias(host: string): boolean {
	return (
		!host ||
		host === 'localhost' ||
		host.endsWith('.localhost') ||
		host.endsWith('.pages.dev') ||
		host.endsWith('.workers.dev') ||
		host.startsWith('www.') ||
		/^[\d.]+$/.test(host) ||
		host.includes(':')
	);
}

/** The canonical hostname, from the site config. */
export function canonicalHostname(siteUrl: string = site.url): string {
	return hostnameOf(siteUrl);
}

/**
 * A redirect from `www.<canonical>` to the canonical host, or null when the
 * request is already there, is on some other host, or is exempt.
 * 301 for reads; 308 keeps the method and body of anything else.
 */
export function canonicalRedirect(
	url: URL,
	method: string,
	siteUrl: string = site.url
): Response | null {
	const canonical = hostnameOf(siteUrl);
	if (hasNoWwwAlias(canonical)) return null;
	if (url.hostname.toLowerCase() !== `www.${canonical}`) return null;
	const path = url.pathname;
	if (REDIRECT_EXEMPT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return null;

	const target = new URL(url);
	target.hostname = canonical;
	target.protocol = 'https:';
	target.port = '';
	const status = method === 'GET' || method === 'HEAD' ? 301 : 308;
	return new Response(null, { status, headers: { location: target.href } });
}

/** True when this host should be kept out of search indexes. */
export function shouldNoindexHost(hostname: string, siteUrl: string = site.url): boolean {
	const canonical = hostnameOf(siteUrl);
	return hostname.toLowerCase() !== canonical;
}

/** Set `X-Robots-Tag` on a response from a non-canonical host. */
export function withHostRobots(
	response: Response,
	hostname: string,
	siteUrl: string = site.url
): Response {
	if (!shouldNoindexHost(hostname, siteUrl)) return response;
	try {
		response.headers.set('x-robots-tag', NOINDEX);
		return response;
	} catch {
		// Redirect and fetched responses have immutable headers: copy.
		const headers = new Headers(response.headers);
		headers.set('x-robots-tag', NOINDEX);
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers
		});
	}
}
