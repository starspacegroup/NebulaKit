/**
 * The site API (`/api/v1/*`) — how everything reaches a NebulaKit site: its
 * own admin pages, scripts, agents, and Ammoura. There is no second path.
 *
 * A caller is one of:
 * - an API key the owner issued at /admin/api-keys (scoped, expiring);
 * - Ammoura's orchestrator key, matched against `ORCHESTRATOR_KEY_SHA256`;
 * - a signed-in admin's session — so the site's own admin screens are API
 *   clients too. Owners get `site:admin`; ordinary admins get every scope but
 *   that one, so owner-only operations stay owner-only (AGENTS.md).
 *
 * Session callers must send JSON on writes. A cross-site form post can carry
 * a cookie but cannot set `Content-Type: application/json` without a CORS
 * preflight this API never answers, so that requirement is the CSRF guard.
 *
 * Every keyed call is logged against its key (`api_key_calls`).
 */
import type { RequestEvent } from '@sveltejs/kit';
import type { D1Database } from '@cloudflare/workers-types';
import {
	API_SCOPES,
	authenticateApiKey,
	hasScope,
	logApiCall,
	type ApiPrincipal,
	type ApiScope
} from '@nebulakit/security';
import { recordAudit, ruleFor } from '$lib/server/audit';

export type SitePrincipal =
	ApiPrincipal | { kind: 'session'; keyId: null; name: string; scopes: ApiScope[] };

export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly details?: string[]
	) {
		super(message);
	}
}

export interface ApiContext {
	event: RequestEvent;
	db: D1Database;
	/** Null on a public endpoint called without credentials. */
	principal: SitePrincipal | null;
	can(scope: ApiScope): boolean;
}

type Env = { DB?: D1Database; ORCHESTRATOR_KEY_SHA256?: string };

export function apiJson(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
	});
}

function sessionPrincipal(event: RequestEvent): SitePrincipal | null {
	const user = event.locals.user;
	if (!user) return null;
	if (user.isOwner || user.isSuperAdmin) {
		return { kind: 'session', keyId: null, name: user.login, scopes: ['site:admin'] };
	}
	if (user.isAdmin) {
		return {
			kind: 'session',
			keyId: null,
			name: user.login,
			scopes: API_SCOPES.filter((scope) => scope !== 'site:admin')
		};
	}
	return null;
}

export async function resolvePrincipal(
	event: RequestEvent,
	db: D1Database,
	env: Env
): Promise<SitePrincipal | null> {
	const authorization = event.request.headers.get('authorization');
	if (authorization) {
		const principal = await authenticateApiKey(db, authorization, {
			orchestratorKeySha256: env.ORCHESTRATOR_KEY_SHA256
		});
		// A bad key is refused outright, never downgraded to the session or to anonymous.
		if (!principal) throw new ApiError(401, 'Invalid, expired or revoked API key');
		return principal;
	}
	const session = sessionPrincipal(event);
	if (session && !['GET', 'HEAD'].includes(event.request.method)) {
		const type = event.request.headers.get('content-type') ?? '';
		if (!type.toLowerCase().startsWith('application/json')) {
			throw new ApiError(415, 'Send JSON (Content-Type: application/json)');
		}
	}
	return session;
}

/**
 * Wrap an endpoint. `scope` null means public: credentials are optional but,
 * if sent, must be valid, and `can()` reports what they allow.
 */
export function siteApi(
	scope: ApiScope | null,
	handler: (ctx: ApiContext) => Promise<Response>
): (event: RequestEvent) => Promise<Response> {
	return async (event) => {
		const env = (event.platform?.env ?? {}) as Env;
		const db = env.DB;
		if (!db) return apiJson({ error: 'The site database is not available' }, 503);

		let principal: SitePrincipal | null = null;
		let response: Response;
		try {
			principal = await resolvePrincipal(event, db, env);
			if (scope) {
				if (!principal) throw new ApiError(401, 'Authentication required');
				if (!hasScope(principal.scopes, scope)) {
					throw new ApiError(403, `This key lacks the ${scope} scope`);
				}
			}
			const who = principal;
			response = await handler({
				event,
				db,
				principal: who,
				can: (needed) => !!who && hasScope(who.scopes, needed)
			});
		} catch (err) {
			response = errorResponse(err);
		}

		if (principal?.kind === 'key' || principal?.kind === 'orchestrator') {
			try {
				await logApiCall(db, {
					keyId: principal.keyId,
					method: event.request.method,
					path: event.url.pathname,
					status: response.status
				});
			} catch (err) {
				// The call itself succeeded or failed on its own merits; a full log
				// table must not turn it into an error.
				console.error('Failed to log API call', err);
			}
		}
		if (scope && principal && response.status < 400) {
			await auditApiCall(event, db, principal);
		}
		return response;
	};
}

/**
 * Record a successful write by a keyed or signed-in caller (admin audit log,
 * docs/AUDIT_LOG.md). Reads and public endpoints are not audited. Never throws.
 */
async function auditApiCall(
	event: RequestEvent,
	db: D1Database,
	principal: SitePrincipal
): Promise<void> {
	try {
		const method = event.request.method;
		if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return;
		const rule = ruleFor(method, event.route?.id);
		const via = principal.kind;
		const actorId = via === 'session' ? (event.locals?.user?.id ?? null) : principal.keyId;
		const actorLogin = via === 'key' ? `key:${principal.name}` : principal.name;
		const targetId = rule?.param
			? (((event.params ?? {}) as Record<string, string | undefined>)[rule.param] ?? null)
			: null;
		await recordAudit(db, {
			actorId,
			actorLogin,
			action: rule?.action ?? `api.${method.toLowerCase()}`,
			targetType: rule?.targetType ?? 'api',
			targetId,
			summary: rule?.summary ?? `${method} ${event.url.pathname}`,
			detail: { via }
		});
	} catch (err) {
		console.error('[audit] could not audit an API call:', err);
	}
}

function errorResponse(err: unknown): Response {
	if (err instanceof ApiError) {
		return apiJson(
			{ error: err.message, ...(err.details ? { details: err.details } : {}) },
			err.status
		);
	}
	// Domain errors from the packages carry their own HTTP status.
	const status = (err as { status?: unknown })?.status;
	if (err instanceof Error && typeof status === 'number' && status >= 400 && status < 600) {
		return apiJson({ error: err.message }, status);
	}
	console.error('Site API failure', err);
	return apiJson({ error: 'Internal error' }, 500);
}

export async function readJson(event: RequestEvent): Promise<unknown> {
	try {
		return await event.request.json();
	} catch {
		throw new ApiError(400, 'The body must be JSON');
	}
}

export function invalid(errors: string[]): ApiError {
	return new ApiError(422, 'Validation failed', errors);
}

export function notFound(what: string): ApiError {
	return new ApiError(404, `${what} not found`);
}
