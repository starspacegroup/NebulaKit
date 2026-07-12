/**
 * CMS Single Content Item API
 *
 * GET    /api/cms/[type]/[id] - Get a single item
 * PUT    /api/cms/[type]/[id] - Update an item
 * DELETE /api/cms/[type]/[id] - Delete an item
 */
import { sanitizeRichtextFields } from '$lib/cms/sanitize';
import {
	deleteContentItem,
	getContentItem,
	getContentTypeBySlug,
	updateContentItem
} from '$lib/services/cms';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform, locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	try {
		const item = await getContentItem(db, params.id);
		if (!item) {
			throw error(404, 'Content item not found');
		}

		return json({ item });
	} catch (err: any) {
		if (err?.status) throw err;
		console.error('Failed to get content item:', err);
		throw error(500, 'Failed to get content item');
	}
};

export const PUT: RequestHandler = async ({ platform, locals, params, request }) => {
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
		const body = await request.json();

		// Sanitize richtext fields server-side before storage (write-time defense).
		// Unknown content types leave fields untouched — the update path validates existence.
		let fields = body.fields;
		if (fields) {
			const contentType = await getContentTypeBySlug(db, params.type);
			if (contentType) {
				fields = sanitizeRichtextFields(fields, contentType.fields);
			}
		}

		const item = await updateContentItem(db, params.id, {
			title: body.title,
			slug: body.slug,
			status: body.status,
			fields,
			seoTitle: body.seoTitle,
			seoDescription: body.seoDescription,
			seoImage: body.seoImage,
			showInCommandPalette: body.showInCommandPalette,
			tagIds: body.tagIds
		});

		if (!item) {
			throw error(404, 'Content item not found');
		}

		return json({ item });
	} catch (err: any) {
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
		const deleted = await deleteContentItem(db, params.id);
		if (!deleted) {
			throw error(404, 'Content item not found');
		}

		return json({ success: true });
	} catch (err: any) {
		if (err?.status) throw err;
		console.error('Failed to delete content item:', err);
		throw error(500, 'Failed to delete content item');
	}
};
