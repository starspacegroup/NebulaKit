/**
 * GET /.well-known/security.txt: RFC 9116 contact for vulnerability reports.
 *
 * 404 unless the SECURITY_CONTACT binding is set; see
 * `$lib/server/security-txt` for why. The `[x+2e]well-known` directory name is
 * explained in ../api-catalog/+server.ts.
 */
import { error } from '@sveltejs/kit';
import { buildSecurityTxt } from '$lib/server/security-txt';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ platform }) => {
	const body = buildSecurityTxt(platform?.env?.SECURITY_CONTACT);
	if (!body) throw error(404, 'No security contact is configured');
	return new Response(body, {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'public, max-age=3600'
		}
	});
};
