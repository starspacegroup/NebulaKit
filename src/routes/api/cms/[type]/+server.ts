/**
 * CMS Content Items API
 *
 * GET  /api/cms/[type] - List items for a content type
 * POST /api/cms/[type] - Create a new item
 */
import type { ContentItemFilters } from '$lib/cms/types';
import { sanitizeRichtextFields } from '$lib/cms/sanitize';
import { getContentTypeRoutePrefix, validateFields } from '$lib/cms/utils';
import { runTimestampProofJob } from '$lib/content-proof/proof-job';
import { createContentItem, getContentTypeBySlug, listContentItems } from '$lib/services/cms';
import { requireAdmin } from '$lib/server/auth-guards';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform, locals, params, url }) => {
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

		// Parse query params for filters
		const filters: ContentItemFilters = {
			status: (url.searchParams.get('status') as any) || undefined,
			authorId: url.searchParams.get('authorId') || undefined,
			search: url.searchParams.get('search') || undefined,
			tagSlug: url.searchParams.get('tag') || undefined,
			page: parseInt(url.searchParams.get('page') || '1'),
			pageSize: parseInt(
				url.searchParams.get('pageSize') || String(contentType.settings.listPageSize || 12)
			),
			sortBy: url.searchParams.get('sortBy') || contentType.settings.defaultSort,
			sortDirection:
				(url.searchParams.get('sortDirection') as 'asc' | 'desc') ||
				contentType.settings.defaultSortDirection
		};

		const result = await listContentItems(db, contentType.id, filters);
		return json({
			...result,
			contentType: {
				id: contentType.id,
				slug: contentType.slug,
				name: contentType.name,
				settings: contentType.settings
			}
		});
	} catch (err: any) {
		if (err?.status) throw err;
		console.error('Failed to list content items:', err);
		throw error(500, 'Failed to list content items');
	}
};

export const POST: RequestHandler = async ({ platform, locals, params, request, url }) => {
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

		const body = await request.json();

		if (!body.title) {
			throw error(400, 'Title is required');
		}
		const fields = sanitizeRichtextFields(body.fields || {}, contentType.fields);
		const fieldErrors = validateFields(fields, contentType.fields);
		if (fieldErrors.length > 0) throw error(400, fieldErrors.join(', '));
		const item = await createContentItem(db, {
			contentTypeSlug: params.type,
			title: body.title,
			slug: body.slug,
			status: body.status,
			fields,
			seoTitle: body.seoTitle,
			seoDescription: body.seoDescription,
			seoImage: body.seoImage,
			showInCommandPalette: body.showInCommandPalette,
			authorId: locals.user.id,
			tagIds: body.tagIds
		});

		if (!item) {
			throw error(500, 'Failed to create content item');
		}

		// An item created straight into 'published' is a first publish too.
		if (item.publishedAt && contentType.settings.enableTimestampProof) {
			const publicUrl = `${url.origin}${getContentTypeRoutePrefix(contentType)}/${item.slug}`;
			platform?.context?.waitUntil(runTimestampProofJob(db, item, publicUrl));
		}

		return json({ item }, { status: 201 });
	} catch (err: any) {
		if (err?.name === 'CmsFieldValidationError') throw error(400, err.message);
		if (err?.status) throw err;
		console.error('Failed to create content item:', err);
		throw error(500, 'Failed to create content item');
	}
};
