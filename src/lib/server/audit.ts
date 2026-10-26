/**
 * Admin audit log (docs/AUDIT_LOG.md): who changed what, from the admin area
 * or the site API. Mutations only, never page views or reads.
 *
 * Three rules this file exists to keep:
 *  - recording never throws into a request. A full table, a missing migration
 *    or a bad detail value is logged and the request carries on;
 *  - nothing secret is written. Detail objects are scrubbed by KEY NAME
 *    (token, secret, password, code, key, ...) at any depth, and a settings or
 *    key change records THAT it changed, never the value;
 *  - the row is bounded: strings, arrays, depth and the serialized detail are
 *    all capped, so one odd payload cannot bloat D1.
 *
 * The actor and target are snapshots, not foreign keys, so a row outlives the
 * user it names.
 */
import type { RequestEvent } from '@sveltejs/kit';
import type { D1Database } from '@cloudflare/workers-types';

export const AUDIT_RETENTION_DAYS = 365;
export const AUDIT_DETAIL_MAX_CHARS = 2000;
const STRING_MAX = 200;
const ARRAY_MAX = 20;
const DEPTH_MAX = 4;
const REDACTED = '[redacted]';

/** Key names whose values are never recorded. */
const SECRET_KEY =
	/token|secret|pass(?:word|wd|phrase)?|code|key|authorization|cookie|signature|credential|hash/i;
/** `keyId`, `key_id`, `userId`: identifiers of a secret, not the secret. */
const ID_KEY = /(?:Id|_id)$/;

export function isSecretKey(name: string): boolean {
	return SECRET_KEY.test(name) && !ID_KEY.test(name);
}

function scrubValue(value: unknown, depth: number): unknown {
	if (value === null || value === undefined) return null;
	if (typeof value === 'string') {
		return value.length > STRING_MAX ? `${value.slice(0, STRING_MAX)}…` : value;
	}
	if (typeof value === 'number' || typeof value === 'boolean') return value;
	if (depth >= DEPTH_MAX) return '[too deep]';
	if (Array.isArray(value)) return value.slice(0, ARRAY_MAX).map((v) => scrubValue(v, depth + 1));
	if (typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const [name, inner] of Object.entries(value as Record<string, unknown>)) {
			out[name] = isSecretKey(name) ? REDACTED : scrubValue(inner, depth + 1);
		}
		return out;
	}
	return String(value);
}

/**
 * The detail as it will be stored: secrets redacted by key name, values
 * clipped, and the whole thing replaced by a marker if it still serializes
 * past AUDIT_DETAIL_MAX_CHARS. Null when there is nothing to record.
 */
export function scrubDetail(detail: unknown): string | null {
	if (detail === undefined || detail === null) return null;
	let json: string;
	try {
		json = JSON.stringify(scrubValue(detail, 0));
	} catch {
		return JSON.stringify({ note: 'detail could not be serialized' });
	}
	if (json.length > AUDIT_DETAIL_MAX_CHARS) return JSON.stringify({ truncated: true });
	return json;
}

export interface AuditEntry {
	actorId?: string | null;
	actorLogin: string;
	action: string;
	targetType?: string | null;
	targetId?: string | null;
	summary: string;
	detail?: unknown;
}

const clip = (value: string | null | undefined, max: number): string | null =>
	value ? value.slice(0, max) : null;

/** Write one audit row. Returns whether it was stored; never throws. */
export async function recordAudit(db: D1Database | undefined, entry: AuditEntry): Promise<boolean> {
	if (!db) return false;
	try {
		await db
			.prepare(
				`INSERT INTO admin_actions
				   (id, actor_id, actor_login, action, target_type, target_id, summary, detail_json)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				crypto.randomUUID(),
				clip(entry.actorId, 100),
				clip(entry.actorLogin, 100) ?? 'unknown',
				clip(entry.action, 100) ?? 'unknown',
				clip(entry.targetType, 60),
				clip(entry.targetId, 200),
				clip(entry.summary, 300) ?? '',
				scrubDetail(entry.detail)
			)
			.run();
		return true;
	} catch (err) {
		console.error('[audit] could not record an action:', err);
		return false;
	}
}

export interface AuditRow {
	id: string;
	at: string;
	actor: string;
	actorId: string | null;
	action: string;
	targetType: string | null;
	targetId: string | null;
	summary: string;
	detail: unknown;
}

export const AUDIT_LIST_MAX = 500;

/** Newest first. Fails soft to an empty list (before 0025 is applied). */
export async function listAudit(
	db: D1Database,
	opts: { actor?: string; action?: string; limit?: number } = {}
): Promise<AuditRow[]> {
	const where: string[] = [];
	const binds: unknown[] = [];
	if (opts.actor) {
		where.push('actor_login = ?');
		binds.push(opts.actor);
	}
	if (opts.action) {
		where.push('action = ?');
		binds.push(opts.action);
	}
	const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 200), 1), AUDIT_LIST_MAX);
	try {
		const { results } = await db
			.prepare(
				`SELECT id, actor_id, actor_login, action, target_type, target_id, summary,
				        detail_json, created_at
				 FROM admin_actions ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
				 ORDER BY created_at DESC, rowid DESC LIMIT ?`
			)
			.bind(...binds, limit)
			.all<{
				id: string;
				actor_id: string | null;
				actor_login: string;
				action: string;
				target_type: string | null;
				target_id: string | null;
				summary: string;
				detail_json: string | null;
				created_at: string;
			}>();
		return results.map((r) => ({
			id: r.id,
			at: r.created_at,
			actor: r.actor_login,
			actorId: r.actor_id,
			action: r.action,
			targetType: r.target_type,
			targetId: r.target_id,
			summary: r.summary,
			detail: parseDetail(r.detail_json)
		}));
	} catch (err) {
		console.error('[audit] could not list actions:', err);
		return [];
	}
}

function parseDetail(json: string | null): unknown {
	if (!json) return undefined;
	try {
		return JSON.parse(json);
	} catch {
		return undefined;
	}
}

/** Delete rows past the retention window. Returns how many went. */
export async function pruneAudit(
	db: D1Database,
	days: number = AUDIT_RETENTION_DAYS
): Promise<number> {
	const result = await db
		.prepare(
			`DELETE FROM admin_actions WHERE created_at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now', ?)`
		)
		.bind(`-${Math.max(1, Math.trunc(days))} days`)
		.run();
	return result.meta?.changes ?? 0;
}

/** Distinct action names on record, for the filter. Fails soft. */
export async function listAuditActions(db: D1Database): Promise<string[]> {
	try {
		const { results } = await db
			.prepare('SELECT DISTINCT action FROM admin_actions ORDER BY action LIMIT 200')
			.all<{ action: string }>();
		return results.map((r) => r.action);
	} catch {
		return [];
	}
}

/** Severity shown in the log: destructive or privilege changes stand out. */
export function auditSeverity(action: string): 'info' | 'notice' | 'warning' | 'critical' {
	if (action === 'site.reset') return 'critical';
	if (/\.(delete|revoke|merge|role_change)$/.test(action)) return 'warning';
	if (/^(settings|ai_key|auth_key|api_key)\./.test(action)) return 'notice';
	return 'info';
}

/** A stored row shaped for the AuditLog module. */
export function toAuditEvent(row: AuditRow) {
	return {
		id: row.id,
		// Stored as UTC ISO text; the module formats it in the viewer's zone.
		at: row.at,
		actor: row.actor,
		action: row.action,
		target: row.targetType
			? `${row.targetType}${row.targetId ? `: ${row.targetId}` : ''}`
			: undefined,
		severity: auditSeverity(row.action),
		details: { summary: row.summary, ...(row.detail ? { detail: row.detail } : {}) }
	};
}

// ---------------------------------------------------------------------------
// What counts as an auditable mutation
// ---------------------------------------------------------------------------

export interface AuditRule {
	action: string;
	targetType: string;
	summary: string;
	/** The route param that names the target, when there is one. */
	param?: string;
	/** JSON body fields that are safe to copy into the detail (an allowlist). */
	body?: readonly string[];
}

/**
 * `METHOD routeId` -> rule, for every admin or API mutation worth a row.
 * Form actions are keyed `ACTION routeId?/name`. A route not listed here is
 * not audited; secrets never need excluding because the detail is built from
 * an allowlist of body fields plus route params, never from the whole body.
 */
export const AUDIT_RULES: Record<string, AuditRule> = {
	'POST /api/admin/users': { action: 'user.invite', targetType: 'user', summary: 'Invited a user' },
	'PATCH /api/admin/users/[id]': {
		action: 'user.role_change',
		targetType: 'user',
		summary: 'Changed a user’s admin role',
		param: 'id',
		body: ['isAdmin']
	},
	'DELETE /api/admin/users/[id]': {
		action: 'user.delete',
		targetType: 'user',
		summary: 'Deleted a user',
		param: 'id'
	},
	'POST /api/cms/[type]': {
		action: 'cms.create',
		targetType: 'content',
		summary: 'Created content',
		param: 'type',
		body: ['status']
	},
	'PUT /api/cms/[type]/[id]': {
		action: 'cms.update',
		targetType: 'content',
		summary: 'Updated content',
		param: 'id',
		body: ['status']
	},
	'DELETE /api/cms/[type]/[id]': {
		action: 'cms.delete',
		targetType: 'content',
		summary: 'Deleted content',
		param: 'id'
	},
	'POST /api/cms/types': {
		action: 'cms_type.create',
		targetType: 'content_type',
		summary: 'Created a content type'
	},
	'PUT /api/cms/types/[id]': {
		action: 'cms_type.update',
		targetType: 'content_type',
		summary: 'Updated a content type',
		param: 'id'
	},
	'DELETE /api/cms/types/[id]': {
		action: 'cms_type.delete',
		targetType: 'content_type',
		summary: 'Deleted a content type',
		param: 'id'
	},
	'POST /api/admin/ai-keys': {
		action: 'ai_key.create',
		targetType: 'ai_key',
		summary: 'Added an AI provider key (value not recorded)'
	},
	'PUT /api/admin/ai-keys/[id]': {
		action: 'ai_key.update',
		targetType: 'ai_key',
		summary: 'Changed an AI provider key (value not recorded)',
		param: 'id'
	},
	'PATCH /api/admin/ai-keys/[id]': {
		action: 'ai_key.update',
		targetType: 'ai_key',
		summary: 'Changed an AI provider key (value not recorded)',
		param: 'id'
	},
	'PATCH /api/admin/ai-keys/[id]/toggle': {
		action: 'ai_key.toggle',
		targetType: 'ai_key',
		summary: 'Switched an AI provider key on or off',
		param: 'id'
	},
	'DELETE /api/admin/ai-keys/[id]': {
		action: 'ai_key.delete',
		targetType: 'ai_key',
		summary: 'Removed an AI provider key',
		param: 'id'
	},
	'POST /api/admin/auth-keys': {
		action: 'auth_key.create',
		targetType: 'auth_key',
		summary: 'Added a sign-in provider credential (value not recorded)'
	},
	'PUT /api/admin/auth-keys/[id]': {
		action: 'auth_key.update',
		targetType: 'auth_key',
		summary: 'Changed a sign-in provider credential (value not recorded)',
		param: 'id'
	},
	'DELETE /api/admin/auth-keys/[id]': {
		action: 'auth_key.delete',
		targetType: 'auth_key',
		summary: 'Removed a sign-in provider credential',
		param: 'id'
	},
	'POST /api/admin/settings/analytics': {
		action: 'settings.analytics',
		targetType: 'setting',
		summary: 'Changed the Google Analytics connection',
		body: ['enabled']
	},
	'DELETE /api/admin/settings/analytics': {
		action: 'settings.analytics',
		targetType: 'setting',
		summary: 'Disconnected Google Analytics'
	},
	'POST /api/admin/settings/reset-route': {
		action: 'settings.reset_route',
		targetType: 'setting',
		summary: 'Changed the reset route setting'
	},
	'POST /api/admin/settings/stats-token': {
		action: 'settings.stats_token',
		targetType: 'setting',
		summary: 'Issued a new stats token (value not recorded)'
	},
	'DELETE /api/admin/settings/stats-token': {
		action: 'settings.stats_token',
		targetType: 'setting',
		summary: 'Revoked the stats token'
	},
	'POST /api/reset': { action: 'site.reset', targetType: 'site', summary: 'Reset the site' },
	'ACTION /admin/api-keys?/create': {
		action: 'api_key.create',
		targetType: 'api_key',
		summary: 'Created a site API key (value not recorded)'
	},
	'ACTION /admin/api-keys?/revoke': {
		action: 'api_key.revoke',
		targetType: 'api_key',
		summary: 'Revoked a site API key'
	},
	'ACTION /admin/pages?/create': {
		action: 'page.create',
		targetType: 'page',
		summary: 'Created a page'
	},
	'ACTION /admin/contact-form-submission/[id]?/resolve': {
		action: 'contact.resolve',
		targetType: 'contact_submission',
		summary: 'Resolved a contact submission',
		param: 'id'
	},
	'ACTION /admin/sign-ins?/tracking': {
		action: 'settings.sign_in_tracking',
		targetType: 'setting',
		summary: 'Changed sign-in tracking'
	},
	'ACTION /admin/sign-ins?/clear': {
		action: 'sign_in.clear_history',
		targetType: 'setting',
		summary: 'Deleted the recorded sign-in history'
	},
	'ACTION /admin/sign-ins?/revoke': {
		action: 'session.revoke',
		targetType: 'session',
		summary: 'Revoked a session'
	},
	// The site API (/api/v1). These go through siteApi(), which records them
	// with the key or session that made the call.
	'PUT /api/v1/pages/[slug]': {
		action: 'page.save',
		targetType: 'page',
		summary: 'Saved a page',
		param: 'slug'
	},
	'DELETE /api/v1/pages/[slug]': {
		action: 'page.delete',
		targetType: 'page',
		summary: 'Deleted a page',
		param: 'slug'
	},
	'POST /api/v1/pages/[slug]/revisions/[id]': {
		action: 'page.restore',
		targetType: 'page',
		summary: 'Restored a page revision',
		param: 'slug'
	},
	'POST /api/v1/products': {
		action: 'product.create',
		targetType: 'product',
		summary: 'Created a product'
	},
	'PATCH /api/v1/products/[id]': {
		action: 'product.update',
		targetType: 'product',
		summary: 'Updated a product',
		param: 'id'
	},
	'DELETE /api/v1/products/[id]': {
		action: 'product.delete',
		targetType: 'product',
		summary: 'Deleted a product',
		param: 'id'
	},
	'PATCH /api/v1/orders/[id]': {
		action: 'order.update',
		targetType: 'order',
		summary: 'Updated an order',
		param: 'id',
		body: ['status']
	},
	'PUT /api/v1/site/updates': {
		action: 'settings.site_updates',
		targetType: 'setting',
		summary: 'Changed which site updates are applied'
	}
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const BODY_READ_MAX_BYTES = 256 * 1024;

/** The rule for this request, or null when it is not an auditable mutation. */
export function ruleFor(
	method: string,
	routeId: string | null | undefined,
	actionName?: string | null
): AuditRule | null {
	if (!routeId || SAFE_METHODS.has(method)) return null;
	if (actionName) return AUDIT_RULES[`ACTION ${routeId}?/${actionName}`] ?? null;
	return AUDIT_RULES[`${method} ${routeId}`] ?? null;
}

/** The form action name in `?/name`, when this request is a form action. */
export function formActionName(url: URL): string | null {
	for (const key of url.searchParams.keys()) {
		if (key.startsWith('/')) return key.slice(1);
	}
	return null;
}

/**
 * The allowlisted body fields of a JSON request, read from a CLONE so the
 * handler still gets an unread body. Skipped (empty) for non-JSON or large
 * bodies, and on any error.
 */
export async function allowedBodyFields(
	request: Request,
	fields: readonly string[] | undefined
): Promise<Record<string, unknown>> {
	if (!fields?.length) return {};
	try {
		const type = request.headers.get('content-type') ?? '';
		const length = Number(request.headers.get('content-length') ?? 0);
		if (!type.toLowerCase().startsWith('application/json') || length > BODY_READ_MAX_BYTES) {
			return {};
		}
		const body = (await request.clone().json()) as Record<string, unknown> | null;
		const out: Record<string, unknown> = {};
		for (const field of fields) {
			if (body && field in body) out[field] = body[field];
		}
		return out;
	} catch {
		return {};
	}
}

export type AuditActor = { id: string | null; login: string };

/** Build and write the row for a matched rule. Never throws. */
export async function recordRule(
	db: D1Database | undefined,
	rule: AuditRule,
	actor: AuditActor,
	context: { params: Record<string, string | undefined>; extra?: Record<string, unknown> }
): Promise<boolean> {
	const targetId = rule.param ? (context.params[rule.param] ?? null) : null;
	return recordAudit(db, {
		actorId: actor.id,
		actorLogin: actor.login,
		action: rule.action,
		targetType: rule.targetType,
		targetId,
		summary: rule.summary,
		detail: context.extra && Object.keys(context.extra).length ? context.extra : undefined
	});
}

/** Whether a SvelteKit form-action response reports success. */
export async function formActionSucceeded(
	response: Response,
	event: RequestEvent
): Promise<boolean> {
	if (response.status >= 400) return false;
	if (response.status >= 300) return true; // redirect after a successful action
	if (!event.request.headers.has('x-sveltekit-action')) return true;
	try {
		const result = (await response.clone().json()) as { type?: string };
		return result.type === 'success' || result.type === 'redirect';
	} catch {
		return false;
	}
}

/**
 * The hook body (`auditHandler` in hooks.server.ts delegates here). Allowlisted
 * body fields are read BEFORE the handler runs, from a clone; the row is
 * written after, and only on success. Only a signed-in admin or owner is
 * recorded (a public POST such as the contact form is not an admin action),
 * and `/api/v1/*` is skipped because `siteApi()` records those with the API key
 * that made them. It never changes or delays the response beyond one insert.
 */
export async function auditAround(
	event: RequestEvent,
	resolve: (event: RequestEvent) => Response | Promise<Response>
): Promise<Response> {
	const routeId = event.route?.id;
	const rule =
		routeId && !routeId.startsWith('/api/v1/')
			? ruleFor(event.request.method, routeId, formActionName(event.url))
			: null;
	if (!rule) return resolve(event);

	const extra = await allowedBodyFields(event.request, rule.body);
	const response = await resolve(event);
	try {
		const user = event.locals.user;
		if (!user || (!user.isOwner && !user.isAdmin && !user.isSuperAdmin)) return response;
		if (!(await formActionSucceeded(response, event))) return response;
		await recordRule(
			event.platform?.env?.DB,
			rule,
			{ id: user.id, login: user.login },
			{ params: event.params, extra }
		);
	} catch (err) {
		console.error('[audit] request audit failed:', err);
	}
	return response;
}
