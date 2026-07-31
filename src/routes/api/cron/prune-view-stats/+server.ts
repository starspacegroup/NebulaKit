import { error, json } from '@sveltejs/kit';
import { pruneViewStats, utcDay } from '$lib/utils/page-views';
import type { RequestHandler } from './$types';

/** Roughly 13 months, so year-over-year comparisons still have last year's data. */
const RETENTION_DAYS = 400;

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let mismatch = 0;
	for (let i = 0; i < a.length; i++) {
		mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return mismatch === 0;
}

/**
 * Prune page-view counter rows past the retention window. Without this the
 * counter tables grow one row per day per dimension forever — small rows, but
 * unbounded.
 *
 * Authenticated with a shared bearer secret rather than a session, because the
 * caller is a scheduler (a Cron Trigger Worker or any external scheduler), not
 * a user. Set `CRON_SECRET` and POST with `Authorization: Bearer <secret>`.
 */
export const POST: RequestHandler = async ({ request, platform }) => {
	const secret = platform?.env?.CRON_SECRET;
	if (!secret) {
		throw error(503, 'CRON_SECRET not configured');
	}

	const authHeader = request.headers.get('authorization') ?? '';
	if (!timingSafeEqual(authHeader, `Bearer ${secret}`)) {
		throw error(401, 'Unauthorized');
	}

	const db = platform?.env?.DB;
	if (!db) {
		throw error(503, 'Database not available');
	}

	const beforeDay = utcDay(new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000));
	await pruneViewStats(db, beforeDay);

	return json({ prunedBefore: beforeDay });
};
