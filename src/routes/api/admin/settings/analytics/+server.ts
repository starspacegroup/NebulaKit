import { error, json } from '@sveltejs/kit';
import {
	buildAnalyticsConfig,
	clearAnalyticsConfig,
	readAnalyticsConfig,
	writeAnalyticsConfig
} from '$lib/server/analytics-config';
import { canManageStatsConnection } from '$lib/server/stats-guard';
import type { RequestHandler } from './$types';

/**
 * Google Analytics connection (docs/ADMIN_STATS.md §7).
 *
 * Owner-only on every verb. `canManageStatsConnection` is the existing policy
 * for "manage a connected third-party analytics account" — an admin holding
 * `can_view_stats` reads the numbers but does not get to point the site's
 * visitors at a third party.
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

// GET — current connection, for the admin page.
export const GET: RequestHandler = async ({ locals, platform }) => {
	assertCanManage(locals);
	return json({ config: await readAnalyticsConfig(platform?.env?.KV) });
};

// POST — connect, re-point, or enable/disable an existing connection.
//
// `measurementId` accepts a bare ID or a pasted snippet; omitting it while
// sending `enabled` flips the switch without retyping the ID.
export const POST: RequestHandler = async ({ request, locals, platform }) => {
	assertCanManage(locals);
	const kv = requireKv(platform);

	let body: { measurementId?: unknown; enabled?: unknown };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid request body');
	}

	const enabledRequested = typeof body.enabled === 'boolean' ? body.enabled : undefined;
	const rawId = typeof body.measurementId === 'string' ? body.measurementId : '';

	if (!rawId.trim()) {
		const existing = await readAnalyticsConfig(kv);
		if (!existing) throw error(400, 'No Measurement ID saved yet — add one first.');
		if (enabledRequested === undefined) throw error(400, 'Nothing to change.');

		const updated = { ...existing, enabled: enabledRequested, updatedAt: new Date().toISOString() };
		await writeAnalyticsConfig(kv, updated);
		return json({ success: true, config: updated });
	}

	const built = buildAnalyticsConfig(rawId, enabledRequested ?? true);
	if (!built.ok) throw error(400, built.reason);

	await writeAnalyticsConfig(kv, built.config);
	return json({ success: true, config: built.config });
};

// DELETE — disconnect entirely, so nothing is left in KV to re-enable.
export const DELETE: RequestHandler = async ({ locals, platform }) => {
	assertCanManage(locals);
	await clearAnalyticsConfig(requireKv(platform));
	return json({ success: true, config: null });
};
