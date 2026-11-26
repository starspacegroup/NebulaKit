import { error, json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth-guards';
import { readUserTimeZone, saveUserTimeZone } from '$lib/server/site-settings';
import type { RequestHandler } from './$types';

/**
 * The signed-in user's own display time zone (docs/ADMIN_TIMEZONE.md): an IANA
 * name, or "auto" for no personal choice. The user is always the session's: no
 * id is read from the body or the URL, so nobody can set another user's zone.
 */
export const GET: RequestHandler = async ({ locals, platform }) => {
	const user = requireUser(locals);
	return json({ timeZone: await readUserTimeZone(platform?.env?.DB, user.id) });
};

export const PUT: RequestHandler = async ({ locals, platform, request }) => {
	const user = requireUser(locals);
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Database not available');

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Expected a JSON body');
	}
	const requested = (body as { timeZone?: unknown } | null)?.timeZone;
	let saved: string | null;
	try {
		saved = await saveUserTimeZone(db, user.id, requested);
	} catch {
		throw error(500, 'Could not save the time zone');
	}
	if (!saved) {
		throw error(400, 'Unknown time zone. Use an IANA name such as Asia/Kolkata, or "auto".');
	}
	return json({ success: true, timeZone: saved });
};
