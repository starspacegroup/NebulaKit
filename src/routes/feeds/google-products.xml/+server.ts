import { handleFeedRequest } from '$lib/server/google-feed-http';
import type { RequestHandler } from './$types';

/**
 * GET /feeds/google-products.xml: the product feed for Google Merchant
 * Center, RSS 2.0 with the `g:` namespace. See docs/GOOGLE_LISTINGS.md.
 */
export const GET: RequestHandler = (event) => handleFeedRequest(event, 'rss');
