/**
 * GET /favicon.ico: send legacy requests to the SVG icon.
 *
 * `static/` ships SVG icons only, and `app.html` links them. Many clients
 * ignore that link and ask for `/favicon.ico` anyway: crawlers, feed readers,
 * link unfurlers, some browsers. With no file there, each request was a 404
 * that also ran the `redirects` table lookup in `redirectsHandler` and counted
 * against the Cloudflare plan meter.
 *
 * The redirect is temporary (302) so the target can change without a
 * client holding on to the old one.
 */
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) =>
	new Response(null, {
		status: 302,
		headers: {
			location: new URL('/favicon.svg', url).toString(),
			'cache-control': 'public, max-age=86400'
		}
	});

export const HEAD: RequestHandler = GET;
