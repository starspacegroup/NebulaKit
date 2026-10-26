/**
 * Site API keys (migration 0018).
 *
 * Every NebulaKit site is reached through its API — by its own pages, by a
 * script, and by Ammoura, which has no back door. The owner manages keys at
 * `/admin/api-keys`: name, scopes, expiry, last used, revoke.
 *
 * - A key is shown once, at creation. Only its SHA-256 is stored.
 * - A revoked or expired key is refused exactly like an unknown one.
 * - Ammoura's key is the one exception to "keys live in D1": its hash is an
 *   environment secret (`ORCHESTRATOR_KEY_SHA256`) set when the site is
 *   deployed, so a fresh site is reachable before anyone has signed in, and a
 *   site owner cannot lock the control room out by clearing a table. Removing
 *   the secret is how that access is withdrawn.
 */
import type { D1Database } from '@cloudflare/workers-types';

export const API_SCOPES = [
	'site:read',
	'site:admin',
	'products:read',
	'products:write',
	'orders:read',
	'orders:write',
	'pages:read',
	'pages:write',
	'pricing:read',
	'pricing:write'
] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const API_KEY_PREFIX = 'nk_';
const KEY_BYTES = 32;
const VISIBLE_PREFIX = API_KEY_PREFIX.length + 8;

export interface ApiKeyRecord {
	id: string;
	name: string;
	prefix: string;
	scopes: ApiScope[];
	createdBy: string | null;
	createdAt: string;
	expiresAt: string | null;
	lastUsedAt: string | null;
	revokedAt: string | null;
}

export type ApiPrincipal =
	| { kind: 'key'; keyId: string; name: string; scopes: ApiScope[] }
	| { kind: 'orchestrator'; keyId: null; name: 'orchestrator'; scopes: ApiScope[] };

type Row = Record<string, unknown>;

export function isApiScope(value: unknown): value is ApiScope {
	return typeof value === 'string' && (API_SCOPES as readonly string[]).includes(value);
}

/** `site:admin` implies every other scope; nothing else implies anything. */
export function hasScope(scopes: readonly ApiScope[], needed: ApiScope): boolean {
	return scopes.includes(needed) || scopes.includes('site:admin');
}

export async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateApiKey(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(KEY_BYTES));
	return API_KEY_PREFIX + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

export function bearerToken(header: string | null): string | null {
	if (!header) return null;
	const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
	return match ? match[1] : null;
}

function toRecord(row: Row): ApiKeyRecord {
	return {
		id: row.id as string,
		name: row.name as string,
		prefix: row.prefix as string,
		scopes: String(row.scopes).split(' ').filter(isApiScope),
		createdBy: (row.created_by as string | null) ?? null,
		createdAt: row.created_at as string,
		expiresAt: (row.expires_at as string | null) ?? null,
		lastUsedAt: (row.last_used_at as string | null) ?? null,
		revokedAt: (row.revoked_at as string | null) ?? null
	};
}

export async function createApiKey(
	db: D1Database,
	input: { name: string; scopes: ApiScope[]; expiresAt?: string | null; createdBy?: string | null }
): Promise<{ key: string; record: ApiKeyRecord }> {
	const key = generateApiKey();
	const id = crypto.randomUUID();
	const scopes = [...new Set(input.scopes)].sort();
	await db
		.prepare(
			`INSERT INTO api_keys (id, name, prefix, key_hash, scopes, created_by, expires_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			id,
			input.name,
			key.slice(0, VISIBLE_PREFIX),
			await sha256Hex(key),
			scopes.join(' '),
			input.createdBy ?? null,
			input.expiresAt ?? null
		)
		.run();
	const row = await db.prepare('SELECT * FROM api_keys WHERE id = ?').bind(id).first<Row>();
	return { key, record: toRecord(row as Row) };
}

export async function listApiKeys(db: D1Database): Promise<ApiKeyRecord[]> {
	const { results } = await db
		.prepare('SELECT * FROM api_keys ORDER BY revoked_at IS NOT NULL, created_at DESC')
		.all<Row>();
	return results.map(toRecord);
}

export async function revokeApiKey(db: D1Database, id: string): Promise<boolean> {
	const result = await db
		.prepare("UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ? AND revoked_at IS NULL")
		.bind(id)
		.run();
	return (result.meta?.changes ?? 0) > 0;
}

/**
 * Resolve a bearer token to the principal it names, or null.
 *
 * The orchestrator hash is checked first and in constant time; database keys
 * are looked up by hash, so the plaintext never reaches a query.
 */
export async function authenticateApiKey(
	db: D1Database,
	authorization: string | null,
	options: { orchestratorKeySha256?: string; now?: Date } = {}
): Promise<ApiPrincipal | null> {
	const token = bearerToken(authorization);
	if (!token || !token.startsWith(API_KEY_PREFIX)) return null;
	const hash = await sha256Hex(token);

	const orchestrator = options.orchestratorKeySha256?.trim().toLowerCase();
	if (orchestrator && constantTimeEqual(hash, orchestrator)) {
		return { kind: 'orchestrator', keyId: null, name: 'orchestrator', scopes: ['site:admin'] };
	}

	const row = await db.prepare('SELECT * FROM api_keys WHERE key_hash = ?').bind(hash).first<Row>();
	if (!row) return null;
	const record = toRecord(row);
	const now = options.now ?? new Date();
	if (record.revokedAt) return null;
	if (record.expiresAt && Date.parse(record.expiresAt) <= now.getTime()) return null;

	await db
		.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?")
		.bind(record.id)
		.run();
	return { kind: 'key', keyId: record.id, name: record.name, scopes: record.scopes };
}

export async function logApiCall(
	db: D1Database,
	call: { keyId: string | null; method: string; path: string; status: number }
): Promise<void> {
	await db
		.prepare('INSERT INTO api_key_calls (key_id, method, path, status) VALUES (?, ?, ?, ?)')
		.bind(call.keyId, call.method, call.path.slice(0, 300), call.status)
		.run();
}

export interface ApiCall {
	keyId: string | null;
	method: string;
	path: string;
	status: number;
	calledAt: string;
}

export async function recentApiCalls(
	db: D1Database,
	options: { keyId?: string; limit?: number } = {}
): Promise<ApiCall[]> {
	const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
	const query = options.keyId
		? db
				.prepare('SELECT * FROM api_key_calls WHERE key_id = ? ORDER BY id DESC LIMIT ?')
				.bind(options.keyId, limit)
		: db.prepare('SELECT * FROM api_key_calls ORDER BY id DESC LIMIT ?').bind(limit);
	const { results } = await query.all<Row>();
	return results.map((row) => ({
		keyId: (row.key_id as string | null) ?? null,
		method: row.method as string,
		path: row.path as string,
		status: Number(row.status),
		calledAt: row.called_at as string
	}));
}
