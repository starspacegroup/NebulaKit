/**
 * Public media serving route.
 * GET /media/[...key] — streams an object from the R2 BUCKET binding.
 * Keys are UUID-addressed and immutable, so responses cache aggressively.
 */
import { isValidMediaKey } from '$lib/cms/upload';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform, params, request }) => {
	const bucket = platform?.env?.BUCKET;
	if (!bucket) {
		throw error(500, 'Storage not available');
	}

	const key = params.key;
	if (!isValidMediaKey(key)) {
		throw error(404, 'Not found');
	}

	const object = await bucket.get(key);
	if (!object) {
		throw error(404, 'Not found');
	}

	const etag = object.httpEtag;
	if (etag && request.headers.get('If-None-Match') === etag) {
		return new Response(null, { status: 304, headers: { ETag: etag } });
	}

	const headers: Record<string, string> = {
		'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
		'Cache-Control': 'public, max-age=31536000, immutable'
	};
	if (etag) {
		headers.ETag = etag;
	}

	return new Response(object.body as unknown as BodyInit, { headers });
};
