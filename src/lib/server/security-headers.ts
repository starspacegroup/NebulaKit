/**
 * Response security headers, set on every response the Worker produces.
 *
 * Static assets are served by Cloudflare Pages, not the Worker, so the same
 * headers are repeated for them in `_headers`. A test keeps the two in
 * step.
 *
 * Content-Security-Policy is set by SvelteKit (`kit.csp` in svelte.config.js)
 * because only SvelteKit knows the nonce of its own inline bootstrap script.
 * It enforces `object-src`, `base-uri` and `frame-ancestors` and leaves
 * `script-src` open: a script allowlist depends on what each site embeds
 * (analytics, payment frames, CMS embeds), so a site adds its own once it has
 * listed them. Turning on a strict `script-src` here would break those sites.
 *
 * HSTS has no `includeSubDomains` and no `preload`. Both commit every
 * subdomain to HTTPS for a year and preload is hard to undo, so the owner
 * decides that after checking each subdomain.
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
	'Strict-Transport-Security': 'max-age=31536000',
	'X-Content-Type-Options': 'nosniff',
	// SAMEORIGIN, not DENY: an admin screen may preview the site in a frame.
	'X-Frame-Options': 'SAMEORIGIN',
	'Referrer-Policy': 'strict-origin-when-cross-origin'
};

/** Add the headers. Works on a copy when the response headers are immutable. */
export function withSecurityHeaders(response: Response): Response {
	try {
		for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
			if (!response.headers.has(name)) response.headers.set(name, value);
		}
		return response;
	} catch {
		// A fetch() passthrough has immutable headers.
		const copy = new Response(response.body, response);
		for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
			if (!copy.headers.has(name)) copy.headers.set(name, value);
		}
		return copy;
	}
}
