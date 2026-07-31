import { decodeSessionCookie } from '$lib/utils/session';
import {
	browserBucket,
	deviceBucket,
	languageBucket,
	osBucket,
	recordPageView,
	referrerHostFrom,
	utcDay,
	utcHour
} from '$lib/utils/page-views';
import { recordRequest } from '$lib/utils/usage';
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

// Auth handling hook
const authHandler: Handle = async ({ event, resolve }) => {
	// Get session cookie
	const sessionId = event.cookies.get('session');

	if (sessionId) {
		const sessionData = decodeSessionCookie(sessionId);

		if (sessionData) {
			// Refresh admin flags from the database (optional - don't fail auth if
			// DB unavailable). Reading them per-request rather than trusting the
			// cookie means granting or revoking access takes effect immediately.
			if (event.platform?.env?.DB) {
				const db = event.platform.env.DB;
				let userRecord: { is_admin: number; can_view_stats?: number } | null = null;
				try {
					userRecord = await db
						.prepare('SELECT is_admin, can_view_stats FROM users WHERE id = ?')
						.bind(sessionData.id)
						.first<{ is_admin: number; can_view_stats: number }>();
				} catch {
					// `can_view_stats` arrives in migration 0009. On a database that
					// hasn't run it yet the combined SELECT fails, which must not cost
					// us the is_admin refresh — fall back to the narrower query.
					try {
						userRecord = await db
							.prepare('SELECT is_admin FROM users WHERE id = ?')
							.bind(sessionData.id)
							.first<{ is_admin: number }>();
					} catch {
						// Database error - continue with session data from cookie
					}
				}

				if (userRecord) {
					sessionData.isAdmin = userRecord.is_admin === 1;
					sessionData.canViewStats = userRecord.can_view_stats === 1;
				}
			}

			event.locals.user = sessionData;
		} else {
			// Invalid session, clear cookie
			event.cookies.delete('session', { path: '/' });
		}
	}

	return resolve(event);
};

const BOT_UA = /bot|crawler|spider|preview|facebookexternalhit|lighthouse|headless/i;
const UNTRACKED_ROUTES = /^\/(admin|api|setup)(\/|$)/;

/**
 * Page-view stats (docs/ADMIN_STATS.md): daily aggregate counters, admin-only
 * surface, no PII stored — the User-Agent is inspected for bots and audience
 * buckets, never kept.
 *
 * Deliberately narrow about what counts as a human page view: a matched route,
 * GET, 200, HTML, not an admin/api/setup route, not a bot. Runs LAST in the
 * sequence so `locals.user` is populated and `signed_in` is accurate.
 *
 * Exported for direct unit testing (sequence() needs Kit's request store).
 */
export const pageViewsHandler: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	const routeId = event.route.id;
	const db = event.platform?.env?.DB;
	if (
		db &&
		routeId &&
		event.request.method === 'GET' &&
		response.status === 200 &&
		(response.headers.get('content-type') ?? '').includes('text/html') &&
		!UNTRACKED_ROUTES.test(routeId) &&
		!BOT_UA.test(event.request.headers.get('user-agent') ?? '')
	) {
		// Audience buckets: headers are read transiently and mapped to a small
		// fixed vocabulary; the raw UA/hints are never stored.
		const headers = event.request.headers;
		const ua = headers.get('user-agent');
		const now = new Date();
		const view = {
			day: utcDay(now),
			hour: utcHour(now),
			pathKey: routeId,
			signedIn: Boolean(event.locals.user),
			referrerHost: referrerHostFrom(headers.get('referer'), event.url.hostname) ?? undefined,
			// Edge-provided country code only — no IP is read or stored.
			country: event.platform?.cf?.country,
			os: osBucket(headers.get('sec-ch-ua-platform'), ua),
			browser: browserBucket(headers.get('sec-ch-ua'), ua),
			device: deviceBucket(headers.get('sec-ch-ua-mobile'), ua),
			language: languageBucket(headers.get('accept-language'))
		};
		// Fire-and-forget: a visitor never waits on a counter write, and a stats
		// failure never breaks the page.
		const write = recordPageView(db, view).catch(() => {});
		if (event.platform?.context?.waitUntil) {
			event.platform.context.waitUntil(write);
		} else {
			await write;
		}
	}

	return response;
};

/**
 * Platform usage: count EVERY Function invocation, which is what Cloudflare
 * bills — a strictly larger set than pageViewsHandler records (that one is
 * non-bot HTML GET 200s only). Bots, /api/* calls, redirects, 404s and non-GET
 * all cost requests against the plan, and on the free plan the site stops
 * serving once the daily allowance is gone.
 *
 * Counted in-process and flushed on a rate limit so the meter does not cost a
 * D1 write per request. FIRST in the sequence so nothing that returns early
 * goes uncounted.
 *
 * Exported for direct unit testing (sequence() needs Kit's request store).
 */
export const usageHandler: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	const db = event.platform?.env?.DB;
	if (db) {
		const write = recordRequest(db, {
			day: utcDay(new Date()),
			notFound: response.status === 404,
			bot: BOT_UA.test(event.request.headers.get('user-agent') ?? '')
		});
		// Only a due flush returns work; buffered requests cost nothing here.
		if (write) {
			const guarded = write.catch(() => {});
			if (event.platform?.context?.waitUntil) {
				event.platform.context.waitUntil(guarded);
			} else {
				await guarded;
			}
		}
	}

	return response;
};

// Combine all hooks
export const handle = sequence(usageHandler, authHandler, pageViewsHandler);
