/**
 * POST /api/cms/[type]/[id]/timestamp-retry
 *
 * Manually (re-)runs the RFC 3161 timestamp request for a published item.
 * If a hash was already computed (the normal case — it's computed once by
 * the background job at first publish), that stored hash is reused as-is,
 * never recomputed. If no hash exists yet (the background job never ran or
 * never completed — e.g. no waitUntil support in this environment), one is
 * computed now from the item's current core fields. This is safe precisely
 * because those fields (title/slug/body/date window) are all locked once
 * published, so "current" and "at publish time" are guaranteed identical.
 * Refuses to run if a proof was already successfully obtained, since
 * silently replacing existing evidence would undermine the whole point of
 * the proof.
 */
import { requireAdmin } from '$lib/server/auth-guards';
import { computeCanonicalHash } from '$lib/content-proof/hash';
import {
	getContentTypeBySlug,
	getContentItem,
	recordTimestampProofAttempt
} from '$lib/services/cms';
import { requestTimestamp } from '$lib/timestamp/rfc3161';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface HashableFields {
	body?: string;
	date_window_start?: string | null;
	date_window_end?: string | null;
}

export const POST: RequestHandler = async ({ platform, locals, params }) => {
	requireAdmin(locals);

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
		if (item.timestampProofTsr) {
			throw error(400, 'A timestamp proof already exists for this item');
		}

		const fields = item.fields as HashableFields;
		const hash =
			item.timestampProofHash ||
			(await computeCanonicalHash({
				title: item.title,
				slug: item.slug,
				body: fields.body ?? '',
				dateWindowStart: fields.date_window_start ?? null,
				dateWindowEnd: fields.date_window_end ?? null
			}));

		const requestedAt = new Date().toISOString();
		const result = await requestTimestamp(hash);

		await recordTimestampProofAttempt(db, item.id, {
			hash,
			tsr: result.ok ? (result.tsrBase64 ?? null) : null,
			requestedAt,
			tsaUrl: result.tsaUrl,
			error: result.ok ? null : (result.error ?? 'Unknown timestamp request error')
		});

		const updated = await getContentItem(db, item.id);
		return json({ item: updated });
	} catch (err: any) {
		if (err?.status) throw err;
		console.error('Failed to retry timestamp proof:', err);
		throw error(500, 'Failed to retry timestamp proof');
	}
};
