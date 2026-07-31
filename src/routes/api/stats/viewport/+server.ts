import { json } from '@sveltejs/kit';
import { recordViewportSample, utcDay, viewportBucketFromWidth } from '$lib/utils/page-views';
import type { RequestHandler } from './$types';

const BOT_UA = /bot|crawler|spider|preview|facebookexternalhit|lighthouse|headless/i;

/**
 * Viewport beacon (docs/ADMIN_STATS.md). Viewport is the one audience dimension
 * request headers can't provide, so the client reports its innerWidth once per
 * session. Only the CSS-breakpoint BUCKET is stored — the raw width is
 * validated and discarded. An aggregate daily counter, no cookies, no
 * identifiers.
 *
 * Always answers 200: a beacon is fire-and-forget, and telling a caller that
 * its analytics ping failed serves no one.
 */
export const POST: RequestHandler = async ({ request, platform }) => {
	const db = platform?.env?.DB;
	if (!db || BOT_UA.test(request.headers.get('user-agent') ?? '')) {
		return json({ received: true });
	}

	let width: unknown;
	try {
		({ width } = await request.json());
	} catch {
		return json({ received: true });
	}

	const bucket = typeof width === 'number' ? viewportBucketFromWidth(width) : null;
	if (bucket) {
		const write = recordViewportSample(db, utcDay(new Date()), bucket).catch(() => {});
		if (platform?.context?.waitUntil) {
			platform.context.waitUntil(write);
		} else {
			await write;
		}
	}

	return json({ received: true });
};
