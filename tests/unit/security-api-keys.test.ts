import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import {
	API_KEY_PREFIX,
	authenticateApiKey,
	bearerToken,
	createApiKey,
	hasScope,
	isApiScope,
	listApiKeys,
	logApiCall,
	recentApiCalls,
	revokeApiKey,
	sha256Hex
} from '@nebulakit/security';
import { createSqliteD1 } from '../helpers/sqlite-d1';

let db: D1Database;
beforeEach(() => {
	db = createSqliteD1(['0018_site_api_keys.sql']);
});

describe('site API keys', () => {
	it('stores only the hash and shows the key once', async () => {
		const { key, record } = await createApiKey(db, {
			name: 'Mobile app',
			scopes: ['products:read', 'orders:read', 'products:read'],
			createdBy: 'u1'
		});
		expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
		expect(key).toHaveLength(API_KEY_PREFIX.length + 64);
		expect(record).toMatchObject({
			name: 'Mobile app',
			prefix: key.slice(0, 11),
			scopes: ['orders:read', 'products:read'],
			createdBy: 'u1',
			expiresAt: null,
			revokedAt: null
		});
		const raw = await db.prepare('SELECT key_hash FROM api_keys').first<{ key_hash: string }>();
		expect(raw?.key_hash).toBe(await sha256Hex(key));
		expect(JSON.stringify(await listApiKeys(db))).not.toContain(key);
	});

	it('authenticates a live key and records its use', async () => {
		const { key, record } = await createApiKey(db, { name: 'k', scopes: ['pages:write'] });
		const principal = await authenticateApiKey(db, `Bearer ${key}`);
		expect(principal).toEqual({
			kind: 'key',
			keyId: record.id,
			name: 'k',
			scopes: ['pages:write']
		});
		expect((await listApiKeys(db))[0].lastUsedAt).not.toBeNull();
	});

	it('refuses unknown, malformed, revoked and expired keys alike', async () => {
		const { key, record } = await createApiKey(db, { name: 'k', scopes: ['site:read'] });
		expect(await authenticateApiKey(db, null)).toBeNull();
		expect(await authenticateApiKey(db, 'Basic abc')).toBeNull();
		expect(await authenticateApiKey(db, 'Bearer sk_other')).toBeNull();
		expect(await authenticateApiKey(db, `Bearer ${key}x`)).toBeNull();

		const { key: expiring } = await createApiKey(db, {
			name: 'old',
			scopes: ['site:read'],
			expiresAt: '2026-01-01T00:00:00Z'
		});
		expect(
			await authenticateApiKey(db, `Bearer ${expiring}`, { now: new Date('2026-06-01') })
		).toBeNull();
		expect(
			await authenticateApiKey(db, `Bearer ${expiring}`, { now: new Date('2025-06-01') })
		).not.toBeNull();

		expect(await revokeApiKey(db, record.id)).toBe(true);
		expect(await revokeApiKey(db, record.id)).toBe(false);
		expect(await authenticateApiKey(db, `Bearer ${key}`)).toBeNull();
		// Revoked keys sort last.
		expect((await listApiKeys(db)).at(-1)?.id).toBe(record.id);
	});

	it('accepts the orchestrator key from its environment hash only', async () => {
		const orchestratorKey = `${API_KEY_PREFIX}orchestrator-test-key`;
		const hash = await sha256Hex(orchestratorKey);
		expect(
			await authenticateApiKey(db, `Bearer ${orchestratorKey}`, {
				orchestratorKeySha256: ` ${hash.toUpperCase()} `
			})
		).toEqual({ kind: 'orchestrator', keyId: null, name: 'orchestrator', scopes: ['site:admin'] });
		expect(await authenticateApiKey(db, `Bearer ${orchestratorKey}`)).toBeNull();
		expect(
			await authenticateApiKey(db, `Bearer ${orchestratorKey}`, { orchestratorKeySha256: 'abc' })
		).toBeNull();
	});

	it('logs calls per key', async () => {
		await logApiCall(db, { keyId: 'a', method: 'GET', path: '/api/v1/site', status: 200 });
		await logApiCall(db, { keyId: null, method: 'POST', path: '/x'.repeat(400), status: 201 });
		const all = await recentApiCalls(db, { limit: 0 });
		expect(all).toHaveLength(1);
		expect(all[0]).toMatchObject({ keyId: null, method: 'POST', status: 201 });
		expect(all[0].path).toHaveLength(300);
		expect(await recentApiCalls(db, { keyId: 'a' })).toEqual([
			expect.objectContaining({ path: '/api/v1/site', status: 200 })
		]);
		expect(await recentApiCalls(db)).toHaveLength(2);
	});
});

describe('scopes and bearer parsing', () => {
	it('lets site:admin imply every scope and nothing else imply anything', () => {
		expect(hasScope(['site:admin'], 'orders:write')).toBe(true);
		expect(hasScope(['orders:read'], 'orders:write')).toBe(false);
		expect(hasScope(['orders:write'], 'orders:write')).toBe(true);
		expect(isApiScope('pages:write')).toBe(true);
		expect(isApiScope('everything')).toBe(false);
	});

	it('parses bearer headers strictly', () => {
		expect(bearerToken('Bearer abc')).toBe('abc');
		expect(bearerToken('  bearer abc ')).toBe('abc');
		expect(bearerToken('Bearer a b')).toBeNull();
		expect(bearerToken(null)).toBeNull();
	});
});
