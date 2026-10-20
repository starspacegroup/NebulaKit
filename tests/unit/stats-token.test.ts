import { describe, expect, it, vi } from 'vitest';
import {
	STATS_TOKEN_KEY,
	STATS_TOKEN_PREFIX,
	bearerToken,
	generateStatsToken,
	hashStatsToken,
	issueStatsToken,
	readStatsTokenMeta,
	revokeStatsToken,
	verifyStatsToken
} from '../../src/lib/server/stats-token';

function createKv(initial: string | null = null) {
	const store = { value: initial };
	return {
		store,
		get: vi.fn(async () => store.value),
		put: vi.fn(async (_key: string, value: string) => {
			store.value = value;
		}),
		delete: vi.fn(async () => {
			store.value = null;
		})
	};
}

describe('generateStatsToken', () => {
	it('produces a prefixed 48-hex-character token, different every time', () => {
		const a = generateStatsToken();
		const b = generateStatsToken();
		expect(a).toMatch(new RegExp(`^${STATS_TOKEN_PREFIX}[0-9a-f]{48}$`));
		expect(b).not.toBe(a);
	});
});

describe('hashStatsToken', () => {
	it('is deterministic and never echoes the token', async () => {
		const token = generateStatsToken();
		const hash = await hashStatsToken(token);
		expect(hash).toBe(await hashStatsToken(token));
		expect(hash).not.toContain(token.slice(4, 20));
	});
});

describe('issueStatsToken', () => {
	it('stores only the hash and visible prefix, and returns the plaintext once', async () => {
		const kv = createKv();
		const now = new Date('2026-10-10T12:00:00.000Z');
		const { token, meta } = await issueStatsToken(kv as never, now);

		expect(token.startsWith(STATS_TOKEN_PREFIX)).toBe(true);
		expect(meta).toEqual({ prefix: token.slice(0, 10), createdAt: '2026-10-10T12:00:00.000Z' });
		expect(kv.put).toHaveBeenCalledWith(STATS_TOKEN_KEY, expect.any(String));

		const stored = JSON.parse(kv.store.value as string);
		expect(stored).toEqual({
			prefix: meta.prefix,
			createdAt: meta.createdAt,
			hash: await hashStatsToken(token)
		});
		expect(kv.store.value).not.toContain(token);
	});

	it('replaces a previous token', async () => {
		const kv = createKv();
		const first = await issueStatsToken(kv as never);
		const second = await issueStatsToken(kv as never);
		expect(second.token).not.toBe(first.token);
		expect(await verifyStatsToken(kv as never, `Bearer ${first.token}`)).toBe('invalid');
		expect(await verifyStatsToken(kv as never, `Bearer ${second.token}`)).toBe('ok');
	});
});

describe('readStatsTokenMeta', () => {
	it('reports the issue date and prefix, never the hash', async () => {
		const kv = createKv();
		const { meta } = await issueStatsToken(kv as never);
		expect(await readStatsTokenMeta(kv as never)).toEqual(meta);
	});

	it('is null without a binding or a stored token', async () => {
		expect(await readStatsTokenMeta(undefined)).toBeNull();
		expect(await readStatsTokenMeta(createKv(null) as never)).toBeNull();
	});

	it('treats a malformed or incomplete record as no token', async () => {
		expect(await readStatsTokenMeta(createKv('{not json') as never)).toBeNull();
		expect(await readStatsTokenMeta(createKv('null') as never)).toBeNull();
		expect(
			await readStatsTokenMeta(
				createKv(JSON.stringify({ prefix: 'nks_ab', createdAt: 'x' })) as never
			)
		).toBeNull();
		expect(
			await readStatsTokenMeta(
				createKv(JSON.stringify({ hash: '', prefix: 'a', createdAt: 'b' })) as never
			)
		).toBeNull();
		expect(
			await readStatsTokenMeta(
				createKv(JSON.stringify({ hash: 'h', prefix: 1, createdAt: 'b' })) as never
			)
		).toBeNull();
	});

	it('fails soft when KV throws', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const kv = {
			get: vi.fn(async () => {
				throw new Error('kv down');
			})
		};
		expect(await readStatsTokenMeta(kv as never)).toBeNull();
		expect(consoleError).toHaveBeenCalled();
		consoleError.mockRestore();
	});
});

describe('revokeStatsToken', () => {
	it('deletes the record so the token stops verifying', async () => {
		const kv = createKv();
		const { token } = await issueStatsToken(kv as never);
		await revokeStatsToken(kv as never);
		expect(kv.delete).toHaveBeenCalledWith(STATS_TOKEN_KEY);
		expect(await verifyStatsToken(kv as never, `Bearer ${token}`)).toBe('missing');
	});
});

describe('bearerToken', () => {
	it('extracts the credential from a well-formed header', () => {
		expect(bearerToken('Bearer abc')).toBe('abc');
		expect(bearerToken('bearer   abc ')).toBe('abc');
	});

	it('rejects anything else', () => {
		expect(bearerToken(null)).toBeNull();
		expect(bearerToken(undefined)).toBeNull();
		expect(bearerToken('')).toBeNull();
		expect(bearerToken('Basic abc')).toBeNull();
		expect(bearerToken('Bearer')).toBeNull();
		expect(bearerToken('Bearer a b')).toBeNull();
	});
});

describe('verifyStatsToken', () => {
	it('reports missing when no token has been issued, whatever the header', async () => {
		expect(await verifyStatsToken(createKv(null) as never, 'Bearer nks_anything')).toBe('missing');
		expect(await verifyStatsToken(undefined, null)).toBe('missing');
	});

	it('accepts the issued token and nothing else', async () => {
		const kv = createKv();
		const { token } = await issueStatsToken(kv as never);

		expect(await verifyStatsToken(kv as never, `Bearer ${token}`)).toBe('ok');
		expect(await verifyStatsToken(kv as never, null)).toBe('invalid');
		expect(await verifyStatsToken(kv as never, 'Bearer ')).toBe('invalid');
		expect(await verifyStatsToken(kv as never, `Basic ${token}`)).toBe('invalid');
		expect(await verifyStatsToken(kv as never, `Bearer ${token}x`)).toBe('invalid');
		expect(await verifyStatsToken(kv as never, `Bearer ${token.slice(0, -1)}`)).toBe('invalid');
		expect(await verifyStatsToken(kv as never, 'Bearer sk-not-a-stats-token')).toBe('invalid');
	});
});
