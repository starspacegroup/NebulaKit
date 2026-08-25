/**
 * Admin CMS — edit item, server load.
 *
 * Loads the content type definition, the single item, and (if the type uses
 * tags) the full tag list for the tag picker.
 */
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, params }) => {
	const { type: typeSlug, id } = params;

	const typesRes = await fetch('/api/cms/types');
	if (!typesRes.ok) {
		throw error(500, 'Failed to load content types');
	}
	const typesData = await typesRes.json();
	const contentType = typesData.types?.find((t: any) => t.slug === typeSlug);
	if (!contentType) {
		throw error(404, `Content type "${typeSlug}" not found`);
	}

	const itemRes = await fetch(`/api/cms/${typeSlug}/${id}`);
	if (!itemRes.ok) {
		if (itemRes.status === 404) throw error(404, 'Item not found');
		throw error(500, 'Failed to load item');
	}
	const itemData = await itemRes.json();

	let tags: any[] = [];
	if (contentType.settings?.hasTags) {
		try {
			const tagsRes = await fetch(`/api/cms/${typeSlug}/tags`);
			if (tagsRes.ok) {
				const tagsData = await tagsRes.json();
				tags = tagsData.tags || [];
			}
		} catch {
			// Tags are optional
		}
	}

	return { contentType, item: itemData.item, tags };
};
