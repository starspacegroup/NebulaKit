import { error, json } from '@sveltejs/kit';
import { canManageStatsConnection } from '$lib/server/stats-guard';
import { issueStatsToken, readStatsTokenMeta, revokeStatsToken } from '$lib/server/stats-token';
import type { RequestHandler } from './$types';

/**
 * The stats token (docs/ADMIN_STATS.md, "Reading the numbers from outside").
 *
 * Owner-only on every verb, under the same policy as the Google Analytics
 * connection: an admin holding `can_view_stats` reads the numbers on `/admin`
 * but does not get to hand a third party a standing credential for them.
 *
 * POST issues (or rotates) and is the only place the plaintext ever appears.
 */
function assertCanManage(locals: App.Locals): void {
	if (!canManageStatsConnection(locals.user)) {
		throw error(403, 'Owner access required');
	}
}

function requireKv(platform: App.Platform | undefined) {
	const kv = platform?.env?.KV;
	if (!kv) throw error(500, 'KV storage not available');
	return kv;
}

// GET — whether a token exists, when it was issued, and its visible prefix.
export const GET: RequestHandler = async ({ locals, platform }) => {
	assertCanManage(locals);
	return json({ meta: await readStatsTokenMeta(platform?.env?.KV) });
};

// POST — issue a new token, replacing any existing one. Returns the plaintext
// once; it is not stored and cannot be fetched again.
export const POST: RequestHandler = async ({ locals, platform }) => {
	assertCanManage(locals);
	const { token, meta } = await issueStatsToken(requireKv(platform));
	return json({ success: true, secret: token, meta });
};

// DELETE — revoke. The dashboard holding the old token gets 401 on its next read.
export const DELETE: RequestHandler = async ({ locals, platform }) => {
	assertCanManage(locals);
	await revokeStatsToken(requireKv(platform));
	return json({ success: true, meta: null });
};
