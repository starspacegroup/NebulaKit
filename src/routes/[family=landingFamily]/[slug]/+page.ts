import { error, redirect } from '@sveltejs/kit';
import { LANDING, findPage, legacyRedirect } from '$lib/landing';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params, url }) => {
	const moved = legacyRedirect(LANDING, url);
	if (moved) redirect(301, moved);
	const found = findPage(LANDING, params.family, params.slug);
	if (!found) error(404, 'Not found');
	return found;
};
