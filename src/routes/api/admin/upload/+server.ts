/**
 * Admin media upload API.
 * POST /api/admin/upload (multipart/form-data, field "file") → 201
 *   { url, key, size, contentType }
 * Stores images in the R2 BUCKET binding; served back via /media/[...key].
 */
import { requireAdmin } from '$lib/server/auth-guards';
import { buildMediaKey, mediaUrlForKey, validateUpload } from '$lib/cms/upload';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	requireAdmin(locals);

	const bucket = platform?.env?.BUCKET;
	if (!bucket) {
		throw error(500, 'Storage not available');
	}

	const formData = await request.formData().catch(() => null);
	const file = formData?.get('file');
	if (!file || typeof file === 'string') {
		throw error(400, 'No file provided (multipart field "file")');
	}

	const validation = validateUpload({ type: file.type, size: file.size });
	if (!validation.ok) {
		throw error(400, validation.error);
	}

	const key = buildMediaKey(validation.ext, crypto.randomUUID());
	await bucket.put(key, await file.arrayBuffer(), {
		httpMetadata: { contentType: file.type }
	});

	return json(
		{ url: mediaUrlForKey(key), key, size: file.size, contentType: file.type },
		{ status: 201 }
	);
};
