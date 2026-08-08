import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	canRevealPii,
	PII_REVEAL_COOKIE,
	PII_REVEAL_COOKIE_PATH,
	PII_REVEAL_MAX_AGE
} from '$lib/server/pii-mask';

/**
 * Toggle the admin PII-reveal state. Re-authorizes server-side (never trusts
 * the client) and stores the choice in a short-lived, httpOnly `pii_reveal`
 * cookie sent to both `/admin` pages and `/api/admin` response boundaries.
 * Opting out deletes the cookie.
 */
export const POST: RequestHandler = async ({ request, locals, cookies }) => {
	if (!canRevealPii(locals.user)) {
		throw error(403, 'Forbidden');
	}

	const { reveal } = (await request.json()) as { reveal?: boolean };

	if (reveal) {
		cookies.set(PII_REVEAL_COOKIE, '1', {
			path: PII_REVEAL_COOKIE_PATH,
			httpOnly: true,
			sameSite: 'strict',
			maxAge: PII_REVEAL_MAX_AGE
		});
	} else {
		cookies.delete(PII_REVEAL_COOKIE, { path: PII_REVEAL_COOKIE_PATH });
	}

	return json({ ok: true });
};
