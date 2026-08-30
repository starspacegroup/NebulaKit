import { describe, expect, it, vi } from 'vitest';
import { DELETE, GET, POST } from '../../src/routes/api/admin/settings/analytics/+server';

const OWNER = { id: 'u1', isOwner: true };
const SUPERADMIN = { id: 'u2', isOwner: false, isAdmin: true, isSuperAdmin: true };
/** An admin who may read the built-in stats but must not point the site's
 *  visitors at a third party. */
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

function createEvent(
	user: unknown,
	kv: ReturnType<typeof createKv> | null,
	body?: unknown | string
) {
	return {
		locals: { user },
		platform: kv ? { env: { KV: kv } } : {},
		request: {
			json: async () => {
				if (typeof body === 'string') throw new SyntaxError('bad json');
				return body;
			}
		}
	} as never;
}

const stored = (measurementId = 'G-ABCD123456', enabled = true) =>
	JSON.stringify({
		provider: 'ga4',
		measurementId,
		enabled,
		updatedAt: '2026-08-01T00:00:00.000Z'
	});

describe('GET /api/admin/settings/analytics', () => {
	it('reports the saved connection to the owner', async () => {
		const kv = createKv(stored());
		const response = await GET(createEvent(OWNER, kv));

		expect(await response.json()).toEqual({
			config: {
				provider: 'ga4',
				measurementId: 'G-ABCD123456',
				enabled: true,
				updatedAt: '2026-08-01T00:00:00.000Z'
			}
		});
	});

	it('reports no connection when nothing is saved', async () => {
		const response = await GET(createEvent(OWNER, createKv(null)));
		expect(await response.json()).toEqual({ config: null });
	});

	it('answers without a KV binding rather than failing the read', async () => {
		const response = await GET(createEvent(OWNER, null));
		expect(await response.json()).toEqual({ config: null });
	});

	it('allows a downstream superadmin', async () => {
		const response = await GET(createEvent(SUPERADMIN, createKv(stored())));
		expect(response.status).toBe(200);
	});

	it('refuses an admin who only holds the stats grant', async () => {
		await expect(GET(createEvent(STATS_ADMIN, createKv(stored())))).rejects.toMatchObject({
			status: 403
		});
	});

	it('refuses an anonymous request', async () => {
		await expect(GET(createEvent(null, createKv(stored())))).rejects.toMatchObject({ status: 403 });
	});
});

describe('POST /api/admin/settings/analytics', () => {
	it('saves a bare measurement ID', async () => {
		const kv = createKv(null);
		const response = await POST(createEvent(OWNER, kv, { measurementId: 'g-abcd123456' }));
		const payload = await response.json();

		expect(payload.success).toBe(true);
		expect(payload.config.measurementId).toBe('G-ABCD123456');
		expect(payload.config.enabled).toBe(true);
		expect(JSON.parse(kv.store.value as string).measurementId).toBe('G-ABCD123456');
	});

	it('saves the ID out of a pasted snippet', async () => {
		const kv = createKv(null);
		const snippet =
			'<script async src="https://www.googletagmanager.com/gtag/js?id=G-PASTE12345"></script>';

		const response = await POST(createEvent(OWNER, kv, { measurementId: snippet }));
		expect((await response.json()).config.measurementId).toBe('G-PASTE12345');
	});

	it('rejects input with no measurement ID in it, explaining why', async () => {
		await expect(
			POST(createEvent(OWNER, createKv(null), { measurementId: 'UA-123456-1' }))
		).rejects.toMatchObject({ status: 400, body: { message: expect.stringMatching(/Universal/) } });
	});

	// The toggle must not make the owner retype the ID.
	it('flips enabled on the saved connection when no ID is sent', async () => {
		const kv = createKv(stored('G-ABCD123456', true));
		const response = await POST(createEvent(OWNER, kv, { enabled: false }));
		const payload = await response.json();

		expect(payload.config).toMatchObject({ measurementId: 'G-ABCD123456', enabled: false });
		expect(JSON.parse(kv.store.value as string).enabled).toBe(false);
	});

	it('refuses to toggle a connection that does not exist', async () => {
		await expect(POST(createEvent(OWNER, createKv(null), { enabled: true }))).rejects.toMatchObject(
			{ status: 400 }
		);
	});

	it('refuses a request that changes nothing', async () => {
		await expect(POST(createEvent(OWNER, createKv(stored()), {}))).rejects.toMatchObject({
			status: 400
		});
	});

	it('honours an explicit enabled flag alongside a new ID', async () => {
		const response = await POST(
			createEvent(OWNER, createKv(null), { measurementId: 'G-ABCD123456', enabled: false })
		);
		expect((await response.json()).config.enabled).toBe(false);
	});

	it('rejects a non-string measurement ID', async () => {
		await expect(
			POST(createEvent(OWNER, createKv(null), { measurementId: 12345 }))
		).rejects.toMatchObject({ status: 400 });
	});

	it('rejects an unparseable body', async () => {
		await expect(POST(createEvent(OWNER, createKv(null), 'not json'))).rejects.toMatchObject({
			status: 400
		});
	});

	it('fails loudly without a KV binding', async () => {
		await expect(
			POST(createEvent(OWNER, null, { measurementId: 'G-ABCD123456' }))
		).rejects.toMatchObject({ status: 500 });
	});

	it('refuses an admin who only holds the stats grant', async () => {
		await expect(
			POST(createEvent(STATS_ADMIN, createKv(null), { measurementId: 'G-ABCD123456' }))
		).rejects.toMatchObject({ status: 403 });
	});
});

describe('DELETE /api/admin/settings/analytics', () => {
	it('disconnects, leaving nothing to re-enable', async () => {
		const kv = createKv(stored());
		const response = await DELETE(createEvent(OWNER, kv));

		expect(await response.json()).toEqual({ success: true, config: null });
		expect(kv.store.value).toBeNull();
	});

	it('refuses an admin who only holds the stats grant', async () => {
		await expect(DELETE(createEvent(STATS_ADMIN, createKv(stored())))).rejects.toMatchObject({
			status: 403
		});
	});

	it('fails loudly without a KV binding', async () => {
		await expect(DELETE(createEvent(OWNER, null))).rejects.toMatchObject({ status: 500 });
	});
});
