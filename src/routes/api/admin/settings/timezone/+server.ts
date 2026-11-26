import { error, json } from '@sveltejs/kit';
import { requireAdmin, requireOwner } from '$lib/server/auth-guards';
import { readAdminTimeZoneSetting, saveAdminTimeZoneSetting } from '$lib/server/site-settings';
import type { RequestHandler } from './$types';

/**
 * The admin time zone (docs/ADMIN_TIMEZONE.md): an IANA name, or "auto" to use
 * each admin's browser zone. Read by any admin; changed by the owner only,
 * since it changes what every admin sees. Audited via AUDIT_RULES.
 */
export const GET: RequestHandler = async ({ locals, platform }) => {
	requireAdmin(locals);
	return json({ timeZone: await readAdminTimeZoneSetting(platform?.env?.DB) });
};

export const PUT: RequestHandler = async ({ locals, platform, request }) => {
	requireOwner(locals);
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
		saved = await saveAdminTimeZoneSetting(db, requested);
	} catch {
		throw error(500, 'Could not save the time zone');
	}
	if (!saved)
		throw error(400, 'Unknown time zone. Use an IANA name such as Asia/Kolkata, or "auto".');
	return json({ success: true, timeZone: saved });
};
