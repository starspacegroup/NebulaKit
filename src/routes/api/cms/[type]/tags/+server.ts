/**
 * CMS Tags API
 *
 * GET  /api/cms/[type]/tags - List tags for a content type
 * POST /api/cms/[type]/tags - Create a new tag
 */
import { createContentTag, getContentTypeBySlug, getTagsForType } from '$lib/services/cms';
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

		const tags = await getTagsForType(db, contentType.id);
		return json({ tags });
	} catch (err: any) {
		if (err?.status) throw err;
		console.error('Failed to fetch tags:', err);
		throw error(500, 'Failed to fetch tags');
	}
};

export const POST: RequestHandler = async ({ platform, locals, params, request }) => {
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

		const body = await request.json();
		if (!body.name) {
			throw error(400, 'Tag name is required');
		}

		const tag = await createContentTag(db, contentType.id, body.name);
		if (!tag) {
			throw error(500, 'Failed to create tag');
		}

		return json({ tag }, { status: 201 });
	} catch (err: any) {
		if (err?.status) throw err;
		console.error('Failed to create tag:', err);
		throw error(500, 'Failed to create tag');
	}
};
