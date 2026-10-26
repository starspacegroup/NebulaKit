/**
 * Public media serving route.
 * GET /media/[...key] — streams an object from the R2 BUCKET binding.
 * Keys are UUID-addressed and immutable, so responses cache aggressively.
 */
import { isValidMediaKey } from '$lib/cms/upload';
import { parseByteRange } from '$lib/server/media-range';
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

	// Safari and iOS will not play a video whose server ignores `Range`.
	const rangeHeader = request.headers.get('Range');
	let range: ReturnType<typeof parseByteRange> = null;
	if (rangeHeader) {
		const head = await bucket.head(key);
		if (!head) throw error(404, 'Not found');
		range = parseByteRange(rangeHeader, head.size);
		if (range === 'unsatisfiable') {
			return new Response(null, {
				status: 416,
				headers: { 'Content-Range': `bytes */${head.size}` }
			});
		}
	}

	const object = range ? await bucket.get(key, { range }) : await bucket.get(key);
	if (!object) {
		throw error(404, 'Not found');
	}

	const etag = object.httpEtag;
	if (etag && request.headers.get('If-None-Match') === etag) {
		return new Response(null, { status: 304, headers: { ETag: etag } });
	}

	const headers: Record<string, string> = {
		'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
		'Cache-Control': 'public, max-age=31536000, immutable',
		'Accept-Ranges': 'bytes'
	};
	if (etag) {
		headers.ETag = etag;
	}

	if (range) {
		headers['Content-Range'] =
			`bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`;
		headers['Content-Length'] = String(range.length);
		return new Response(object.body as unknown as BodyInit, { status: 206, headers });
	}

	return new Response(object.body as unknown as BodyInit, { headers });
};
