/**
 * Dynamic CMS Content Item Page - Server Load
 *
 * Handles /{contentType}/{slug} routes (e.g., /blog/my-first-post).
 * Matches both system (registry) and user-created content types from the DB.
 */
import {
	getContentItemBySlug,
	getContentTypeBySlug,
	getItemTags,
	isContentTypeSlug,
	syncContentTypes
} from '$lib/services/cms';
import { awaitingGoLiveProof, startGoLiveProof } from '$lib/cms/go-live';
import { isLiveItem } from '$lib/cms/schedule';
import { getContentTypeRoutePrefix } from '$lib/cms/utils';
import { runTimestampProofJob } from '$lib/content-proof/proof-job';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, platform, locals, url }) => {
	const typeSlug = params.contentType;
	const itemSlug = params.slug;

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

	const item = await getContentItemBySlug(db, contentType.id, itemSlug);
	if (!item) {
		throw error(404, 'Content not found');
	}

	// Only show published items on public routes, and not ones scheduled for later
	if (!isLiveItem(item)) {
		throw error(404, 'Content not found');
	}

	// A scheduled item's timestamp proof could not start when it was saved, so
	// the first visit after go-live starts it. The claim makes this safe to race.
	if (contentType.settings.enableTimestampProof && awaitingGoLiveProof(item)) {
		const publicUrl = `${url.origin}${getContentTypeRoutePrefix(contentType)}/${item.slug}`;
		platform?.context?.waitUntil(startGoLiveProof(db, item, publicUrl, runTimestampProofJob));
	}

	// Attribute this view to the item. pageViewsHandler runs after the load and
	// reads it back, so counting a read costs no extra query.
	locals.viewedContentId = item.id;

	// Get tags if the type supports them
	let tags: any[] = [];
	if (contentType.settings.hasTags) {
		tags = await getItemTags(db, item.id);
	}

	return {
		contentType,
		item,
		tags
	};
};
