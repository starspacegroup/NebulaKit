/**
 * Redirect manager: admin-editable URL redirects with hit counts.
 *
 * `redirectsHandler` (src/hooks.server.ts) consults this table only when the
 * normal response is a 404, so a healthy page never pays for the lookup.
 *
 * Two rules keep a redirect table from becoming a liability:
 *  - no open redirects. `to_path` is a same-site path, or an https URL whose
 *    host is on the allowlist (the site's own host, plus anything an operator
 *    lists in REDIRECT_ALLOWED_HOSTS). `javascript:`, `//host`, `/\host`,
 *    embedded credentials and control characters are all refused.
 *  - no loops. A write is refused when following the stored chain from the new
 *    target would come back to the new source.
 *
 * The same target check runs again at request time, so a row inserted by hand
 * (or by a future bug) still cannot send a visitor off-site.
 */
import { site } from '$lib/site.config';
import type { D1Database } from '@cloudflare/workers-types';

export const REDIRECT_STATUSES = [301, 302, 307, 308] as const;
export type RedirectStatus = (typeof REDIRECT_STATUSES)[number];

export interface Redirect {
	id: number;
	fromPath: string;
	toPath: string;
	status: RedirectStatus;
	hits: number;
	createdAt: string;
}

export interface RedirectInput {
	fromPath: string;
	toPath: string;
	status: number;
}

interface Row {
	id: number;
	from_path: string;
	to_path: string;
	status: number;
	hits: number;
	created_at: string;
}

const MAX_PATH = 500;
/** Follow at most this many stored hops when looking for a loop. */
const MAX_CHAIN = 10;
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARS = /[\u0000-\u001f\u007f\\\s]/;

function toRedirect(row: Row): Redirect {
	return {
		id: row.id,
		fromPath: row.from_path,
		toPath: row.to_path,
		status: row.status as RedirectStatus,
		hits: row.hits,
		createdAt: row.created_at
	};
}

/** Leading slash required, trailing slashes stripped (the root stays `/`). */
export function normalizeFromPath(path: string): string {
	let normalized = path.trim();
	if (!normalized.startsWith('/')) normalized = `/${normalized}`;
	while (normalized.length > 1 && normalized.endsWith('/')) normalized = normalized.slice(0, -1);
	return normalized;
}

/** Hostnames a redirect may leave to: this site's own, plus operator extras. */
export function allowedRedirectHosts(extra?: string | null): Set<string> {
	const hosts = new Set<string>();
	for (const host of ownHosts()) hosts.add(host);
	for (const raw of (extra ?? '').split(',')) {
		const host = raw.trim().toLowerCase();
		if (host && /^[a-z0-9.-]+$/.test(host)) hosts.add(host);
	}
	return hosts;
}

/** A same-site path: one leading slash, no `//`, no backslash, no controls. */
export function isSameSitePath(value: string): boolean {
	return (
		value.startsWith('/') &&
		!value.startsWith('//') &&
		!UNSAFE_CHARS.test(value) &&
		value.length <= MAX_PATH
	);
}

/**
 * True when `value` is a safe redirect destination: a same-site path, or an
 * https URL on the allowlist with no credentials.
 */
export function isSafeRedirectTarget(value: string, allowedHosts: Set<string>): boolean {
	if (isSameSitePath(value)) return true;
	if (!value.toLowerCase().startsWith('https://')) return false;
	if (UNSAFE_CHARS.test(value) || value.length > MAX_PATH) return false;
	try {
		const url = new URL(value);
		return (
			url.protocol === 'https:' &&
			!url.username &&
			!url.password &&
			allowedHosts.has(url.hostname.toLowerCase())
		);
	} catch {
		return false;
	}
}

/** This site's own hostname and its www/apex twin. */
function ownHosts(): Set<string> {
	const own = new URL(site.url).hostname.toLowerCase();
	return new Set([own, own.startsWith('www.') ? own.slice(4) : `www.${own}`]);
}

/** The path part of a target, when it points back at this site. */
function ownPathOf(target: string): string | null {
	if (target.startsWith('/')) return normalizeFromPath(target.split(/[?#]/)[0]);
	try {
		const url = new URL(target);
		return ownHosts().has(url.hostname.toLowerCase()) ? normalizeFromPath(url.pathname) : null;
	} catch {
		return null;
	}
}

export type RedirectCheck =
	| { ok: true; value: { fromPath: string; toPath: string; status: RedirectStatus } }
	| { ok: false; error: string };

/** Validate the shape of an input; loop detection needs the table, see below. */
export function validateRedirect(input: RedirectInput, allowedHosts: Set<string>): RedirectCheck {
	const fromRaw = input.fromPath.trim();
	const toPath = input.toPath.trim();
	if (!fromRaw.startsWith('/') || fromRaw.startsWith('//')) {
		return {
			ok: false,
			error: 'The old address must start with a single "/" (for example /old-page).'
		};
	}
	if (/[?#]/.test(fromRaw)) {
		return { ok: false, error: 'The old address is a path only: leave out "?" and "#" parts.' };
	}
	if (!isSameSitePath(fromRaw)) {
		return { ok: false, error: 'The old address has characters that cannot be in a path.' };
	}
	const fromPath = normalizeFromPath(fromRaw);
	if (fromPath === '/') return { ok: false, error: 'The home page cannot be redirected.' };
	if (!toPath) return { ok: false, error: 'Give the new address.' };
	if (!isSafeRedirectTarget(toPath, allowedHosts)) {
		return {
			ok: false,
			error:
				'The new address must be a path on this site (like /new-page) or an https address on an allowed host.'
		};
	}
	if (!(REDIRECT_STATUSES as readonly number[]).includes(input.status)) {
		return { ok: false, error: 'Status must be 301, 302, 307 or 308.' };
	}
	if (ownPathOf(toPath) === fromPath) {
		return { ok: false, error: 'The old and new address are the same, which would loop.' };
	}
	return { ok: true, value: { fromPath, toPath, status: input.status as RedirectStatus } };
}

export async function listRedirects(db: D1Database): Promise<Redirect[]> {
	const result = await db.prepare('SELECT * FROM redirects ORDER BY from_path ASC').all<Row>();
	return (result.results ?? []).map(toRedirect);
}

export async function getRedirectByFromPath(
	db: D1Database,
	fromPath: string
): Promise<Redirect | null> {
	const row = await db
		.prepare('SELECT * FROM redirects WHERE from_path = ?')
		.bind(normalizeFromPath(fromPath))
		.first<Row>();
	return row ? toRedirect(row) : null;
}

/**
 * True when adding `fromPath -> toPath` would make a cycle: following the
 * stored redirects from the new target reaches the new source. `ignoreId` is
 * the row being edited, whose old value no longer counts.
 */
export async function wouldLoop(
	db: D1Database,
	fromPath: string,
	toPath: string,
	ignoreId?: number
): Promise<boolean> {
	let current = ownPathOf(toPath);
	const seen = new Set<string>();
	for (let hop = 0; current && hop < MAX_CHAIN; hop++) {
		if (current === fromPath) return true;
		if (seen.has(current)) return true;
		seen.add(current);
		const next = await getRedirectByFromPath(db, current);
		if (!next || next.id === ignoreId) return false;
		current = ownPathOf(next.toPath);
	}
	// A chain longer than MAX_CHAIN is treated as a loop rather than trusted.
	return current !== null;
}

export async function createRedirect(
	db: D1Database,
	value: { fromPath: string; toPath: string; status: number }
): Promise<Redirect> {
	const row = await db
		.prepare('INSERT INTO redirects (from_path, to_path, status) VALUES (?, ?, ?) RETURNING *')
		.bind(value.fromPath, value.toPath, value.status)
		.first<Row>();
	if (!row) throw new Error('Failed to create redirect');
	return toRedirect(row);
}

export async function updateRedirect(
	db: D1Database,
	id: number,
	value: { fromPath: string; toPath: string; status: number }
): Promise<void> {
	await db
		.prepare('UPDATE redirects SET from_path = ?, to_path = ?, status = ? WHERE id = ?')
		.bind(value.fromPath, value.toPath, value.status, id)
		.run();
}

export async function deleteRedirect(db: D1Database, id: number): Promise<void> {
	await db.prepare('DELETE FROM redirects WHERE id = ?').bind(id).run();
}

/** One UPDATE, safe to fire from the hot path through `waitUntil`. */
export async function recordRedirectHit(db: D1Database, id: number): Promise<void> {
	await db.prepare('UPDATE redirects SET hits = hits + 1 WHERE id = ?').bind(id).run();
}

/**
 * The `Location` for a request that matched `redirect`, or null when the row's
 * target fails the safety check (then the visitor gets the plain 404).
 * The request's query string is carried over unless the target has its own.
 */
export function redirectLocation(
	redirect: Redirect,
	requestUrl: URL,
	allowedHosts: Set<string>
): string | null {
	if (!isSafeRedirectTarget(redirect.toPath, allowedHosts)) return null;
	if (ownPathOf(redirect.toPath) === normalizeFromPath(requestUrl.pathname)) {
		return null;
	}
	const target = new URL(redirect.toPath, requestUrl.origin);
	if (!target.search && requestUrl.search) target.search = requestUrl.search;
	return target.href;
}
