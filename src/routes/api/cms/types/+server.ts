/**
 * CMS Content Types API
 *
 * GET  /api/cms/types - List all content types (syncs registry first)
 * POST /api/cms/types - Create a new user-defined content type
 */
import { requireAdmin } from '$lib/server/auth-guards';
import { validateContentTypeInput } from '$lib/cms/utils';
import { createContentTypeInDB, getContentTypes, syncContentTypes } from '$lib/services/cms';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform, locals }) => {
	requireAdmin(locals);

	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	try {
		// Sync registry to DB (safe to call repeatedly)
		await syncContentTypes(db);

		// Return all types
		const types = await getContentTypes(db);
		return json({ types });
	} catch (err: any) {
		if (err?.status) throw err;
		console.error('Failed to fetch content types:', err);
		throw error(500, 'Failed to fetch content types');
	}
};

export const POST: RequestHandler = async ({ platform, locals, request }) => {
	requireAdmin(locals);

	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	try {
		const body = await request.json();

		if (!body.name || !body.name.trim()) {
			throw error(400, 'Content type name is required');
		}

		// Validate the input
		const validationErrors = validateContentTypeInput({
			name: body.name,
			slug: body.slug,
			fields: body.fields,
			settings: body.settings
		});

		if (validationErrors.length > 0) {
			throw error(400, validationErrors.join(', '));
		}

		const contentType = await createContentTypeInDB(db, {
			name: body.name.trim(),
			slug: body.slug?.trim() || undefined,
			description: body.description?.trim() || undefined,
			icon: body.icon || 'document',
			fields: body.fields || [],
			settings: body.settings || {}
		});

		if (!contentType) {
			throw error(409, 'A content type with this slug already exists');
		}

		return json({ contentType }, { status: 201 });
	} catch (err: any) {
		if (err?.status) throw err;
		console.error('Failed to create content type:', err);
		throw error(500, 'Failed to create content type');
	}
};
