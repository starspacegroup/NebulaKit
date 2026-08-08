/**
 * Admin CMS Content Type Management - Server Load
 *
 * Loads the content type definition and its items.
 */
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, params, url }) => {
	const typeSlug = params.type;

	// Load content type info
	const typesRes = await fetch('/api/cms/types');
	if (!typesRes.ok) {
		throw error(500, 'Failed to load content types');
	}
	const typesData = await typesRes.json();
	const contentType = typesData.types?.find((t: any) => t.slug === typeSlug);
	if (!contentType) {
		throw error(404, `Content type "${typeSlug}" not found`);
	}

	// Build query string for items
	const status = url.searchParams.get('status') || '';
	const search = url.searchParams.get('search') || '';
	const page = url.searchParams.get('page') || '1';
	const sortBy = url.searchParams.get('sortBy') || '';
	const sortDirection = url.searchParams.get('sortDirection') || '';

	const qp = new URLSearchParams();
	if (status) qp.set('status', status);
	if (search) qp.set('search', search);
	if (page !== '1') qp.set('page', page);
	if (sortBy) qp.set('sortBy', sortBy);
	if (sortDirection) qp.set('sortDirection', sortDirection);

	const qs = qp.toString() ? `?${qp.toString()}` : '';
	const itemsRes = await fetch(`/api/cms/${typeSlug}${qs}`);
	let items: any[] = [];
	let totalItems = 0;
	let totalPages = 1;
	let currentPage = 1;

	if (itemsRes.ok) {
		const itemsData = await itemsRes.json();
		items = itemsData.items || [];
		totalItems = itemsData.total || 0;
		totalPages = itemsData.totalPages || 1;
		currentPage = itemsData.page || 1;
	}

	// Load tags if the type supports them
	let tags: any[] = [];
	if (contentType.settings?.hasTags) {
		try {
			const tagsRes = await fetch(`/api/cms/${typeSlug}/tags`);
			if (tagsRes.ok) {
				const tagsData = await tagsRes.json();
				tags = tagsData.tags || [];
			}
		} catch {
			// Tags are optional, continue without them
		}
	}

	return {
		contentType,
		items,
		tags,
		totalItems,
		totalPages,
		currentPage,
		filters: { status, search }
	};
};
