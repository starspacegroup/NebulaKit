import { error } from '@sveltejs/kit';
import { timingSafeEqualStrings } from '$lib/server/timing-safe';

/**
 * Authorize a request to a `/api/cron/*` route. Throws, so a route can call it
 * and carry on.
 *
 * The caller is a scheduler, not a user, so the credential is the shared
 * `CRON_SECRET` bearer rather than a session. It fails closed: an unset secret
 * is a 503, never an open endpoint. The compare is constant-time.
 */
export function authorizeCronRequest(
	request: Request,
	env: { CRON_SECRET?: string } | undefined
): void {
	const secret = env?.CRON_SECRET;
	if (!secret) throw error(503, 'CRON_SECRET not configured');

	const header = request.headers.get('authorization') ?? '';
	if (!timingSafeEqualStrings(header, `Bearer ${secret}`)) throw error(401, 'Unauthorized');
}
