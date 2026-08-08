/**
 * POST /api/cms/[type]/[id]/wayback-check
 *
 * Manually checks whether a Wayback Machine snapshot has appeared for this
 * item's public URL, and records it if found. Safe to call repeatedly —
 * there's no cron in this deployment, so this is the manual "check now"
 * equivalent for the capture triggered at first publish.
 */
import { getContentTypeRoutePrefix } from '$lib/cms/utils';
import { getContentItem, getContentTypeBySlug, recordWaybackSnapshot } from '$lib/services/cms';
import { checkWaybackSnapshot } from '$lib/timestamp/wayback';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ platform, locals, params, url }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	if (!locals.user.isOwner && !locals.user.isAdmin) {
		throw error(403, 'Forbidden');
	}

	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	try {
		const contentType = await getContentTypeBySlug(db, params.type);
		if (!contentType) {
			throw error(404, `Content type "${params.type}" not found`);
		}

		const item = await getContentItem(db, params.id);
		if (!item) {
			throw error(404, 'Content item not found');
		}

		if (!item.publishedAt) {
			throw error(400, 'This item has never been published');
		}

		const publicUrl = `${url.origin}${getContentTypeRoutePrefix(contentType)}/${item.slug}`;
		const result = await checkWaybackSnapshot(publicUrl);

		if (result.ok && result.snapshotUrl) {
			await recordWaybackSnapshot(db, item.id, {
				url: result.snapshotUrl,
				checkedAt: new Date().toISOString()
			});
		}

		const updated = await getContentItem(db, item.id);
		return json({ item: updated });
	} catch (err: any) {
		if (err?.status) throw err;
		console.error('Failed to check Wayback snapshot:', err);
		throw error(500, 'Failed to check Wayback snapshot');
	}
};
