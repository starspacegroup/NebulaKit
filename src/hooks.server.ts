import { buildLinkHeader } from '$lib/agent-discovery';
import { canonicalRedirect, withHostRobots } from '$lib/server/canonical-host';
import {
	isConvertibleHtml,
	prefersMarkdown,
	toMarkdownResponse
} from '$lib/server/markdown-negotiation';
import {
	allowedRedirectHosts,
	getRedirectByFromPath,
	recordRedirectHit,
	redirectLocation
} from '$lib/server/redirects';
import { PERMISSIONS, parsePermissions } from '$lib/access/permissions';
import { effectiveRole } from '$lib/access/roles';
import { auditAround } from '$lib/server/audit';
import { withSecurityHeaders } from '$lib/server/security-headers';
import { trackSessionSeen } from '$lib/server/sign-ins';
import { resolveOwnerStatus } from '$lib/utils/auth-identity';
import { getAuthSession } from '$lib/utils/db';
import { isDevAuthSimulationEnabled } from '$lib/utils/dev-auth';
import { createSessionUser } from '$lib/utils/session';
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

// Auth handling hook.
//
// Merge resolution record (opaque-sessions x main): the COOKIE MECHANISM is
// the opaque-sessions design — the cookie carries an opaque random token,
// the trusted payload lives server-side in sessions.data, and a forged cookie
// names no session and fails closed. What survives from main's competing
// scheme is its PER-REQUEST PRIVILEGE REFRESH: identity comes from the stored
// session, but is_admin / can_view_stats / owner status are re-read from the
// users table on every request, so granting or revoking access takes effect
// without a re-login. Dev-simulated identities are honored only under
// isDevAuthSimulationEnabled, exactly as on main — a pretend payload in a
// production database must not authenticate anyone.
export function authHandler(input: {
	event: any;
	resolve: (event: any) => Response | Promise<Response>;
}): Promise<Response>;
export async function authHandler({ event, resolve }: Parameters<Handle>[0]): Promise<Response> {
	const sessionToken = event.cookies.get('session');

	if (sessionToken) {
		try {
			const db = event.platform?.env?.DB;
			if (!db) throw new Error('Session database unavailable');

			const stored = await getAuthSession(db, sessionToken);
			if (!stored) throw new Error('Session is missing, expired, or revoked');

			if (stored.isPretend) {
				// Self-contained simulated identities are reserved for the
				// explicitly enabled local development simulator.
				if (!isDevAuthSimulationEnabled(event.url, event.platform)) {
					throw new Error('Simulated session outside the dev simulator');
				}
				// Simulated admins hold every area; the simulator is dev-only.
				const pretendRole = effectiveRole(stored);
				event.locals.user = {
					...stored,
					role: pretendRole,
					permissions: pretendRole === 'admin' ? [...PERMISSIONS] : []
				};
			} else {
				type AuthUserRecord = {
					id: string;
					email: string;
					name: string | null;
					github_login: string | null;
					github_avatar_url: string | null;
					is_admin: number;
					can_view_stats?: number;
					role?: string | null;
				};
				let userRecord: AuthUserRecord | null;
				try {
					userRecord = await db
						.prepare(
							`SELECT id, email, name, github_login, github_avatar_url,
							        is_admin, can_view_stats, role
							 FROM users WHERE id = ?`
						)
						.bind(stored.id)
						.first<AuthUserRecord>();
				} catch {
					// Migration 0021 added role (0009 added can_view_stats); retain
					// compatibility with a local database that has not applied them.
					try {
						userRecord = await db
							.prepare(
								`SELECT id, email, name, github_login, github_avatar_url,
								        is_admin, can_view_stats
								 FROM users WHERE id = ?`
							)
							.bind(stored.id)
							.first<AuthUserRecord>();
					} catch {
						userRecord = await db
							.prepare(
								`SELECT id, email, name, github_login, github_avatar_url, is_admin
								 FROM users WHERE id = ?`
							)
							.bind(stored.id)
							.first<AuthUserRecord>();
					}
				}

				if (!userRecord) throw new Error('Session user no longer exists');
				const isOwner = await resolveOwnerStatus(event.platform, userRecord);
				const role = effectiveRole({
					isOwner,
					role: userRecord.role,
					isAdmin: userRecord.is_admin === 1
				});
				// The granted areas are re-read every request too, so revoking one
				// bites on the next click. Fails closed: no table, no grants.
				let permissions: string[] = [];
				if (role === 'admin') {
					try {
						const rows = await db
							.prepare('SELECT permission FROM user_permissions WHERE user_id = ?')
							.bind(userRecord.id)
							.all<{ permission: string }>();
						permissions = parsePermissions((rows.results ?? []).map((r) => r.permission));
					} catch {
						permissions = [];
					}
					// `can_view_stats` (0009) and the `stats` permission are one grant.
					if (userRecord.can_view_stats === 1 && !permissions.includes('stats')) {
						permissions = [...permissions, 'stats'];
					}
				}
				event.locals.user = {
					...createSessionUser({
						...userRecord,
						isOwner,
						isAdmin: role !== 'user'
					}),
					role,
					permissions,
					isSuperAdmin: role === 'superadmin',
					canViewStats: userRecord.can_view_stats === 1 || permissions.includes('stats')
				};
			}
		} catch {
			// Unknown, expired, or unverifiable session — clear the stale cookie.
			delete event.locals.user;
			event.cookies.delete('session', { path: '/' });
		}
	}

	// Opt-in sign-in tracking (docs/SIGN_IN_TRACKING.md): a no-op unless the owner
	// turned it on, throttled to once per 5 minutes per session, never throws.
	if (sessionToken && event.locals.user && !event.locals.user.isPretend) {
		await trackSessionSeen(event.platform, sessionToken);
	}

	return resolve(event);
}

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
			contentId: event.locals.viewedContentId,
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

/**
 * Agent discovery (docs/AGENT_READINESS.md): advertise the machine-readable
 * entry points on every HTML response via RFC 8288 `Link` headers, and serve
 * Markdown to agents that ask for it with `Accept: text/markdown`.
 *
 * Runs OUTSIDE the stats handlers in the sequence so `pageViewsHandler` still
 * sees the original `text/html` response and keeps counting agent reads as page
 * views — an agent fetching a page is a real view, and hiding it would quietly
 * under-report traffic.
 *
 * `Vary: Accept` goes on the HTML branch too, not just the Markdown one:
 * without it a shared cache can hand a stored HTML body to an agent that asked
 * for Markdown, or the reverse.
 *
 * Exported for direct unit testing (sequence() needs Kit's request store).
 */
export const agentDiscoveryHandler: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	if (!isConvertibleHtml(response)) return response;

	response.headers.set('Link', buildLinkHeader());
	response.headers.set('Vary', 'Accept');

	if (!prefersMarkdown(event.request.headers.get('accept'))) return response;

	try {
		return await toMarkdownResponse(response);
	} catch (error) {
		// A conversion failure must never cost the caller the page — fall back to
		// the HTML we already have.
		console.error('markdown negotiation: conversion failed', error);
		return response;
	}
};

/**
 * Admin audit log (docs/AUDIT_LOG.md): one row per successful admin mutation,
 * never per page view. Sits before authHandler so it wraps it; it reads
 * `locals.user` only after the response, when authHandler has filled it in.
 * The relative order of the other handlers is unchanged.
 */
export const auditHandler: Handle = ({ event, resolve }) => auditAround(event, resolve);

/**
 * HSTS, nosniff, frame and referrer headers (security-headers.ts). Outermost,
 * so redirects and error responses get them too. It only decorates the
 * response, so it does not change when the other handlers run.
 */
export const securityHeadersHandler: Handle = async ({ event, resolve }) =>
	withSecurityHeaders(await resolve(event));

/**
 * Canonical host (src/lib/server/canonical-host.ts): `www.<site host>` is sent
 * to the host in site.config (301 for GET/HEAD, 308 otherwise) because the
 * session cookie is host-only, and every other non-canonical host (localhost,
 * *.pages.dev, previews, tunnels) is answered normally with
 * `X-Robots-Tag: noindex, nofollow`.
 *
 * Inside usageHandler, so the bounce is still counted as an invocation, and
 * outside everything else, so a redirected request never reaches auth, D1 or
 * page-view recording.
 *
 * Exported for direct unit testing (sequence() needs Kit's request store).
 */
export const canonicalHostHandler: Handle = async ({ event, resolve }) => {
	const redirect = canonicalRedirect(event.url, event.request.method);
	if (redirect) return redirect;
	return withHostRobots(await resolve(event), event.url.hostname);
};

/**
 * Admin-managed redirects (docs/REDIRECTS.md, /admin/redirects). Consulted only
 * when the response is already a 404 for a GET/HEAD, so healthy pages pay
 * nothing. Checking the response rather than `route.id` matters: catch-all
 * routes like /[contentType] match any single segment and 404 from their load.
 *
 * Sits INSIDE usageHandler (a bounced request is counted once, as the redirect
 * it became) and OUTSIDE auth and pageViewsHandler (a redirect is never a page
 * view, and the stale 404 render is simply discarded). A missing table or a D1
 * error falls through to the plain 404.
 *
 * Exported for direct unit testing (sequence() needs Kit's request store).
 */
export const redirectsHandler: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	const method = event.request.method;
	const db = event.platform?.env?.DB;
	if (response.status !== 404 || !db || (method !== 'GET' && method !== 'HEAD')) return response;

	try {
		const redirect = await getRedirectByFromPath(db, event.url.pathname);
		if (!redirect) return response;
		const location = redirectLocation(
			redirect,
			event.url,
			allowedRedirectHosts(event.platform?.env?.REDIRECT_ALLOWED_HOSTS)
		);
		if (!location) return response;
		const hit = recordRedirectHit(db, redirect.id).catch(() => {});
		if (event.platform?.context?.waitUntil) {
			event.platform.context.waitUntil(hit);
		} else {
			await hit;
		}
		return new Response(null, { status: redirect.status, headers: { location } });
	} catch {
		return response;
	}
};

// Combine all hooks
export const handle = sequence(
	securityHeadersHandler,
	usageHandler,
	canonicalHostHandler,
	redirectsHandler,
	agentDiscoveryHandler,
	auditHandler,
	authHandler,
	pageViewsHandler
);
