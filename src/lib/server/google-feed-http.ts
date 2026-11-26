/**
 * The HTTP side of the two feed routes: cache, headers, "last fetched".
 *
 * Caching uses the Workers Cache API, never KV: a cache write is not a KV
 * write, so a crawler hitting the feed cannot spend the free plan's KV or D1
 * write budget, and a hit costs zero D1 reads (docs/LESSONS_FROM_PINFOOL.md).
 * The TTL is short because a price edit should reach Google within a quarter
 * hour, and because Cache API entries are per data centre anyway.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { recordFeedFetch } from '@nebulakit/commerce';
import { feedStream, listingContext, type FeedFormat } from './google-feed';
import type { CommerceEnv } from './site-info';

export const FEED_TTL_SECONDS = 900;

const TYPES: Record<FeedFormat, string> = {
	rss: 'application/xml; charset=utf-8',
	tsv: 'text/tab-separated-values; charset=utf-8'
};

/** The pieces of Cache API the handler uses; a test passes a Map-backed fake. */
export interface FeedCache {
	match(request: Request): Promise<Response | undefined>;
	put(request: Request, response: Response): Promise<void>;
}

export async function handleFeedRequest(
	event: {
		request: Request;
		url: URL;
		platform?: App.Platform;
	},
	format: FeedFormat,
	deps: { cache?: FeedCache | null; now?: () => number } = {}
): Promise<Response> {
	const db = event.platform?.env?.DB as D1Database | undefined;
	if (!db) return new Response('The site database is not available', { status: 503 });
	const now = deps.now ?? Date.now;
	const headers = {
		'Content-Type': TYPES[format],
		'Cache-Control': `public, max-age=${FEED_TTL_SECONDS}`,
		// A feed is for Merchant Center, not for search results.
		'X-Robots-Tag': 'noindex'
	};

	const waitUntil = (p: Promise<unknown>) => {
		const wait = event.platform?.context?.waitUntil;
		if (wait) wait.call(event.platform?.context, p);
		else void p;
	};
	// Before the cache lookup, so a cache hit still counts as a fetch.
	waitUntil(
		recordFeedFetch(
			db,
			event.request.headers.get('user-agent') ?? '',
			new Date(now()).toISOString()
		).catch((err) => console.error('google feed: could not record the fetch', err))
	);

	const cache =
		deps.cache === undefined
			? ((globalThis as { caches?: { default?: FeedCache } }).caches?.default ?? null)
			: deps.cache;
	// The key is the canonical path only: a query string must not fan the cache out.
	const key = new Request(`${event.url.origin}${event.url.pathname}`);
	if (cache) {
		const hit = await cache.match(key);
		if (hit) return hit;
	}

	const ctx = await listingContext(db, event.platform?.env as unknown as CommerceEnv, now());
	const body = feedStream(format, db, ctx);
	if (!cache || event.request.method === 'HEAD') return new Response(body, { headers });
	const [forClient, forCache] = body.tee();
	waitUntil(
		cache
			.put(key, new Response(forCache, { headers }))
			.catch((err) => console.error('google feed: could not cache the feed', err))
	);
	return new Response(forClient, { headers });
}
