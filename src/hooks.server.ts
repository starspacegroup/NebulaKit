import { buildLinkHeader } from '$lib/agent-discovery';
import {
	isConvertibleHtml,
	prefersMarkdown,
	toMarkdownResponse
} from '$lib/server/markdown-negotiation';
import { resolveOwnerStatus } from '$lib/utils/auth-identity';
import { findValidSession } from '$lib/utils/db';
import { isDevAuthSimulationEnabled } from '$lib/utils/dev-auth';
import {
	createSessionUser,
	decodeDatabaseSessionCookie,
	decodeSessionCookie
} from '$lib/utils/session';
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
export function authHandler(input: {
	event: any;
	resolve: (event: any) => Response | Promise<Response>;
}): Promise<Response>;
export async function authHandler({ event, resolve }: Parameters<Handle>[0]): Promise<Response> {
	// Get session cookie
	const sessionCookie = event.cookies.get('session');

	if (sessionCookie) {
		try {
			// Self-contained identities are reserved for the explicitly enabled
			// local development simulator. Production identity always comes from D1.
			if (isDevAuthSimulationEnabled(event.url, event.platform)) {
				const pretendUser = await decodeSessionCookie(
					sessionCookie,
					event.platform?.env?.SESSION_SECRET
				);
				if (pretendUser?.isPretend) {
					event.locals.user = pretendUser;
				}
			}

			if (!event.locals.user) {
				const db = event.platform?.env?.DB;
				if (!db) throw new Error('Session database unavailable');
				const sessionToken = await decodeDatabaseSessionCookie(
					sessionCookie,
					event.platform?.env?.SESSION_SECRET
				);
				if (!sessionToken) throw new Error('Session cookie is unsigned or malformed');

				const session = await findValidSession(db, sessionToken);
				if (!session) throw new Error('Session is missing, expired, or revoked');

				type AuthUserRecord = {
					id: string;
					email: string;
					name: string | null;
					github_login: string | null;
					github_avatar_url: string | null;
					is_admin: number;
					can_view_stats?: number;
				};
				let userRecord: AuthUserRecord | null;
				try {
					userRecord = await db
						.prepare(
							`SELECT id, email, name, github_login, github_avatar_url,
							        is_admin, can_view_stats
							 FROM users WHERE id = ?`
						)
						.bind(session.user_id)
						.first<AuthUserRecord>();
				} catch {
					// Migration 0009 added can_view_stats; retain compatibility with
					// a locally created database that has not applied it yet.
					userRecord = await db
						.prepare(
							`SELECT id, email, name, github_login, github_avatar_url, is_admin
							 FROM users WHERE id = ?`
						)
						.bind(session.user_id)
						.first<AuthUserRecord>();
				}

				if (!userRecord) throw new Error('Session user no longer exists');
				const isOwner = await resolveOwnerStatus(event.platform, userRecord);
				event.locals.user = {
					...createSessionUser({
						...userRecord,
						isOwner,
						isAdmin: userRecord.is_admin === 1 || isOwner
					}),
					canViewStats: userRecord.can_view_stats === 1
				};
			}
		} catch {
			delete event.locals.user;
			event.cookies.delete('session', { path: '/' });
		}
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

// Combine all hooks
export const handle = sequence(usageHandler, agentDiscoveryHandler, authHandler, pageViewsHandler);
