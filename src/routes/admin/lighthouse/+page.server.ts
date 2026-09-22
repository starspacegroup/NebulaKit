import { error } from '@sveltejs/kit';
import { listAudits, listFindings } from '$lib/server/lighthouse';
import { site } from '$lib/site.config';
import type { PageServerLoad } from './$types';

/**
 * The stored audit, worst first. The admin layout guard has already required
 * an admin session; this adds nothing on top, because the scores of your own
 * public pages are not more sensitive than the pages themselves.
 */
export const load: PageServerLoad = async ({ platform }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(503, 'Database not available');
	}

	const [audits, findings] = await Promise.all([listAudits(db), listFindings(db)]);

	return {
		audits,
		findings,
		/* PageSpeed Insights can only reach a public URL, so an app still on the
		   template's placeholder has nothing to audit. The page says that rather
		   than showing an empty table and letting someone conclude it is broken. */
		siteUrl: site.url,
		urlLooksPlaceholder: /\.pages\.dev$|REPLACE_ME|localhost/i.test(site.url)
	};
};
