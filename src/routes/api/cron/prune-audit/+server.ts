import { error, json } from '@sveltejs/kit';
import { AUDIT_RETENTION_DAYS, pruneAudit } from '$lib/server/audit';
import { timingSafeEqualStrings } from '$lib/server/timing-safe';
import type { RequestHandler } from './$types';

/**
 * Delete admin audit rows older than the retention window (365 days). Without
 * this the table grows by one row per admin action forever.
 *
 * Same contract as /api/cron/prune-view-stats: a shared bearer secret, because
 * the caller is a scheduler. Set `CRON_SECRET` and POST with
 * `Authorization: Bearer <secret>`.
 */
export const POST: RequestHandler = async ({ request, platform }) => {
	const secret = platform?.env?.CRON_SECRET;
	if (!secret) throw error(503, 'CRON_SECRET not configured');

	const authHeader = request.headers.get('authorization') ?? '';
	if (!timingSafeEqualStrings(authHeader, `Bearer ${secret}`)) throw error(401, 'Unauthorized');

	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Database not available');

	const pruned = await pruneAudit(db, AUDIT_RETENTION_DAYS);
	return json({ retentionDays: AUDIT_RETENTION_DAYS, pruned });
};
