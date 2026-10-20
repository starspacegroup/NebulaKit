import { siteOpenApi } from '$lib/server/site-openapi';

/** GET /api/v1/openapi.json — the site API, described. Public: it holds no data. */
export const GET = () =>
	new Response(JSON.stringify(siteOpenApi()), {
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
	});
