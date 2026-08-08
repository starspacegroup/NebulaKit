/**
 * Dynamic CMS Content Type List Page - Server Load
 *
 * Handles /{contentType} routes (e.g., /blog, /faq, /kb).
 * Matches both system (registry) and user-created content types from the DB.
 */
import type { ContentItemFilters } from '$lib/cms/types';
import {
	getContentTypeBySlug,
	isContentTypeSlug,
	listContentItems,
	syncContentTypes
} from '$lib/services/cms';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, platform, url }) => {
	const typeSlug = params.contentType;

	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	// Ensure content types are synced
	await syncContentTypes(db);

	// Check if this slug exists in DB (covers both system and user-created types)
	const exists = await isContentTypeSlug(db, typeSlug);
	if (!exists) {
		throw error(404, 'Not found');
	}

	const contentType = await getContentTypeBySlug(db, typeSlug);
	if (!contentType) {
		throw error(404, 'Content type not found');
	}
	if (contentType.settings.isPublic === false) {
		throw error(404, 'Not found');
	}

	// Parse query params
	const filters: ContentItemFilters = {
		status: 'published', // Public routes only show published items
		search: url.searchParams.get('search') || undefined,
		tagSlug: url.searchParams.get('tag') || undefined,
		page: parseInt(url.searchParams.get('page') || '1'),
		pageSize: contentType.settings.listPageSize || 12,
		sortBy: contentType.settings.defaultSort || 'published_at',
		sortDirection: contentType.settings.defaultSortDirection || 'desc'
	};

	const result = await listContentItems(db, contentType.id, filters);

	return {
		contentType,
		...result
	};
};
