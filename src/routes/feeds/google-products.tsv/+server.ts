import { handleFeedRequest } from '$lib/server/google-feed-http';
import type { RequestHandler } from './$types';

/** GET /feeds/google-products.tsv: the same feed, tab-separated. See docs/GOOGLE_LISTINGS.md. */
export const GET: RequestHandler = (event) => handleFeedRequest(event, 'tsv');
