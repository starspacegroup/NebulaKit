import { describe, expect, it, vi } from 'vitest';
import { DELETE, GET, POST } from '../../src/routes/api/admin/settings/stats-token/+server';
import { STATS_TOKEN_KEY, verifyStatsToken } from '../../src/lib/server/stats-token';

const OWNER = { id: 'u1', isOwner: true };
const SUPERADMIN = { id: 'u2', isOwner: false, isAdmin: true, isSuperAdmin: true };
/** An admin who may read the built-in stats but must not hand out a credential
 *  for them. */
const STATS_ADMIN = { id: 'u3', isOwner: false, isAdmin: true, canViewStats: true };

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

function createEvent(user: unknown, kv: ReturnType<typeof createKv> | null) {
	return {
		locals: { user },
		platform: kv ? { env: { KV: kv } } : {}
	} as never;
}

describe('GET /api/admin/settings/stats-token', () => {
	it('reports no token when none is issued', async () => {
		expect(await (await GET(createEvent(OWNER, createKv()))).json()).toEqual({ meta: null });
	});

	it('reports the issue date and prefix of an issued token, never the hash', async () => {
		const kv = createKv();
		await POST(createEvent(OWNER, kv));
		const body = await (await GET(createEvent(OWNER, kv))).json();
		expect(body.meta).toEqual({
			prefix: expect.stringMatching(/^nks_[0-9a-f]{6}$/),
			createdAt: expect.stringMatching(/^\d{4}-/)
		});
		expect(JSON.stringify(body)).not.toContain('hash');
	});

	it('answers without a KV binding rather than failing the read', async () => {
		expect(await (await GET(createEvent(OWNER, null))).json()).toEqual({ meta: null });
	});

	it('allows a downstream superadmin', async () => {
		expect((await GET(createEvent(SUPERADMIN, createKv()))).status).toBe(200);
	});

	it('refuses an admin who only holds the stats grant, and anonymous callers', async () => {
		await expect(GET(createEvent(STATS_ADMIN, createKv()))).rejects.toMatchObject({ status: 403 });
		await expect(GET(createEvent(null, createKv()))).rejects.toMatchObject({ status: 403 });
	});
});

describe('POST /api/admin/settings/stats-token', () => {
	it('issues a token the summary endpoint will accept, and stores only its hash', async () => {
		const kv = createKv();
		const body = await (await POST(createEvent(OWNER, kv))).json();

		expect(body.success).toBe(true);
		expect(body.secret).toMatch(/^nks_[0-9a-f]{48}$/);
		expect(body.meta.prefix).toBe(body.secret.slice(0, 10));
		expect(kv.put).toHaveBeenCalledWith(STATS_TOKEN_KEY, expect.any(String));
		expect(kv.store.value).not.toContain(body.secret);
		expect(await verifyStatsToken(kv as never, `Bearer ${body.secret}`)).toBe('ok');
	});

	it('rotates: a second issue invalidates the first token', async () => {
		const kv = createKv();
		const first = await (await POST(createEvent(OWNER, kv))).json();
		const second = await (await POST(createEvent(OWNER, kv))).json();
		expect(second.secret).not.toBe(first.secret);
		expect(await verifyStatsToken(kv as never, `Bearer ${first.secret}`)).toBe('invalid');
	});

	it('fails without KV rather than issuing a token nothing can verify', async () => {
		await expect(POST(createEvent(OWNER, null))).rejects.toMatchObject({ status: 500 });
	});

	it('is owner-only', async () => {
		await expect(POST(createEvent(STATS_ADMIN, createKv()))).rejects.toMatchObject({
			status: 403
		});
	});
});

describe('DELETE /api/admin/settings/stats-token', () => {
	it('revokes, so the old token reports missing', async () => {
		const kv = createKv();
		const { secret } = await (await POST(createEvent(OWNER, kv))).json();

		const body = await (await DELETE(createEvent(OWNER, kv))).json();
		expect(body).toEqual({ success: true, meta: null });
		expect(await verifyStatsToken(kv as never, `Bearer ${secret}`)).toBe('missing');
	});

	it('fails without KV', async () => {
		await expect(DELETE(createEvent(OWNER, null))).rejects.toMatchObject({ status: 500 });
	});

	it('is owner-only', async () => {
		await expect(DELETE(createEvent(STATS_ADMIN, createKv()))).rejects.toMatchObject({
			status: 403
		});
	});
});
