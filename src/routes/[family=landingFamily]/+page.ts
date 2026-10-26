import { error, redirect } from '@sveltejs/kit';
import { LANDING, familyPages, findFamily, legacyRedirect } from '$lib/landing';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params, url }) => {
	const moved = legacyRedirect(LANDING, url);
	if (moved) redirect(301, moved);
	const family = findFamily(LANDING, params.family);
	if (!family || !familyPages(LANDING, family.key).length) error(404, 'Not found');
	return { family };
};
