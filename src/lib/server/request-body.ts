import { error } from '@sveltejs/kit';

/**
 * Read a request body that must be a JSON object.
 *
 * `request.json()` throws on an empty or malformed body and returns `null`,
 * an array or a primitive for other valid JSON. Handlers that read fields off
 * the result then fail with a 500. The caller sent a bad request, so this
 * answers 400 instead.
 */
export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Request body must be valid JSON.');
	}
	if (body === null || typeof body !== 'object' || Array.isArray(body)) {
		throw error(400, 'Request body must be a JSON object.');
	}
	return body as Record<string, unknown>;
}
