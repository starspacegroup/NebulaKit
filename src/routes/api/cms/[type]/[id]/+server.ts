/**
 * CMS Single Content Item API
 *
 * GET    /api/cms/[type]/[id] - Get a single item
 * PUT    /api/cms/[type]/[id] - Update an item
 * DELETE /api/cms/[type]/[id] - Delete an item
 */
import { sanitizeRichtextFields } from '$lib/cms/sanitize';
import { LockedContentError } from '$lib/cms/types';
import { getContentTypeRoutePrefix } from '$lib/cms/utils';
import { runTimestampProofJob } from '$lib/content-proof/proof-job';
import {
	deleteContentItem,
	getContentItem,
	getContentTypeBySlug,
	getItemTags,
	updateContentItem
} from '$lib/services/cms';
import { requireAdmin } from '$lib/server/auth-guards';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform, locals, params }) => {
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
		if (!item || item.contentTypeId !== contentType.id) {
			throw error(404, 'Content item not found');
		}

		// Attach assigned tags so editors can round-trip them. Best-effort:
		// a tag lookup failure must not break loading the item itself.
		try {
			(item as typeof item & { tags?: unknown }).tags = await getItemTags(db, params.id);
		} catch {
			// tags are optional
		}

		return json({ item });
	} catch (err: any) {
		if (err?.status) throw err;
		console.error('Failed to get content item:', err);
		throw error(500, 'Failed to get content item');
	}
};

export const PUT: RequestHandler = async ({ platform, locals, params, request, url }) => {
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

		// Read before writing: the proof job fires only on the FIRST publish,
		// which we can only detect by comparing against the prior state.
		const existing = await getContentItem(db, params.id);
		if (!existing) {
			throw error(404, 'Content item not found');
		}

		if (existing.contentTypeId !== contentType.id) {
			throw error(404, 'Content item not found');
		}
		const body = await request.json();
		const fields = body.fields
			? sanitizeRichtextFields(body.fields, contentType.fields)
			: undefined;

		const item = await updateContentItem(
			db,
			params.id,
			{
				title: body.title,
				slug: body.slug,
				status: body.status,
				fields,
				seoTitle: body.seoTitle,
				seoDescription: body.seoDescription,
				seoImage: body.seoImage,
				showInCommandPalette: body.showInCommandPalette,
				tagIds: body.tagIds
			},
			// Provenance actor comes from the session, never the request body.
			locals.user.id
		);

		if (!item) {
			throw error(404, 'Content item not found');
		}

		if (!existing.publishedAt && item.publishedAt && contentType.settings.enableTimestampProof) {
			const publicUrl = `${url.origin}${getContentTypeRoutePrefix(contentType)}/${item.slug}`;
			platform?.context?.waitUntil(runTimestampProofJob(db, item, publicUrl));
		}

		return json({ item });
	} catch (err: any) {
		if (err instanceof LockedContentError) throw error(400, err.message);
		if (err?.name === 'CmsFieldValidationError') throw error(400, err.message);
		if (err?.status) throw err;
		console.error('Failed to update content item:', err);
		throw error(500, 'Failed to update content item');
	}
};

export const DELETE: RequestHandler = async ({ platform, locals, params }) => {
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
		const existing = await getContentItem(db, params.id);
		if (!existing || existing.contentTypeId !== contentType.id) {
			throw error(404, 'Content item not found');
		}
		const deleted = await deleteContentItem(db, params.id);
		if (!deleted) {
			throw error(404, 'Content item not found');
		}

		return json({ success: true });
	} catch (err: any) {
		if (err instanceof LockedContentError) throw error(400, err.message);
		if (err?.status) throw err;
		console.error('Failed to delete content item:', err);
		throw error(500, 'Failed to delete content item');
	}
};
