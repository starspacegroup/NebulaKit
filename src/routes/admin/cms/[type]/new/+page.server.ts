/**
 * Admin CMS — create item, server load.
 *
 * Loads the content type definition and (if the type uses tags) the tag list.
 * No item is loaded — the editor renders in create mode.
 */
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, params }) => {
	const typeSlug = params.type;

	const typesRes = await fetch('/api/cms/types');
	if (!typesRes.ok) {
		throw error(500, 'Failed to load content types');
	}
	const typesData = await typesRes.json();
	const contentType = typesData.types?.find((t: any) => t.slug === typeSlug);
	if (!contentType) {
		throw error(404, `Content type "${typeSlug}" not found`);
	}

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

	return { contentType, tags };
};
