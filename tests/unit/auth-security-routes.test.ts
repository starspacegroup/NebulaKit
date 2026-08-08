import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const owner = {
	id: 'owner-1',
	login: 'owner',
	email: 'owner@example.com',
	isOwner: true,
	isAdmin: true
};

describe('authentication security route policy', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		vi.stubGlobal('crypto', webcrypto as Crypto);
	});

	it('does not trust a forged unsigned owner cookie in the auth hook', async () => {
		const { authHandler } = await import('../../src/hooks.server');
		const forged = btoa(
			JSON.stringify({ id: 'attacker', login: 'attacker', email: 'a@example.com', isOwner: true })
		);
		const remove = vi.fn();
		const event = {
			cookies: { get: vi.fn().mockReturnValue(forged), delete: remove },
			locals: {},
			platform: { env: { SESSION_SECRET: 'session-secret' } }
		};

		await authHandler({
			event,
			resolve: vi.fn().mockResolvedValue(new Response('ok'))
		} as never);

		expect(event.locals).not.toHaveProperty('user');
		expect(remove).toHaveBeenCalledWith('session', { path: '/' });
	});

	it('denies anonymous and non-owner reset requests and allows the owner', async () => {
		const { POST } = await import('../../src/routes/api/reset/+server');
		const kv = {
			get: vi.fn().mockResolvedValue(null),
			delete: vi.fn().mockResolvedValue(undefined)
		};
		const run = vi.fn().mockResolvedValue(undefined);
		const base = {
			platform: { env: { KV: kv, DB: { prepare: vi.fn(() => ({ run })) } } },
			cookies: { get: vi.fn().mockReturnValue(undefined), delete: vi.fn() }
		};

		await expect(POST({ ...base, locals: {} } as never)).rejects.toMatchObject({ status: 401 });
		await expect(
			POST({ ...base, locals: { user: { ...owner, isOwner: false } } } as never)
		).rejects.toMatchObject({ status: 403 });

		const response = await POST({ ...base, locals: { user: owner } } as never);
		expect(response.status).toBe(200);
		expect(kv.delete).toHaveBeenCalledWith('github_owner_id');
	});

	it('requires a bootstrap secret for pristine setup and rejects mismatches', async () => {
		const { POST } = await import('../../src/routes/api/setup/+server');
		const kv = {
			get: vi.fn().mockResolvedValue(null),
			put: vi.fn().mockResolvedValue(undefined)
		};
		const body = {
			clientId: 'client-id',
			clientSecret: 'client-secret',
			adminGithubUsername: 'owner'
		};
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue({ id: 123, login: 'owner' })
			})
		);
		const event = (authorization?: string) => ({
			request: new Request('https://example.com/api/setup', {
				method: 'POST',
				headers: authorization ? { authorization } : undefined,
				body: JSON.stringify(body)
			}),
			platform: { env: { KV: kv, SETUP_SECRET: 'bootstrap-secret' } },
			locals: {}
		});

		await expect(POST(event() as never)).rejects.toMatchObject({ status: 401 });
		await expect(POST(event('Bearer wrong') as never)).rejects.toMatchObject({ status: 401 });
		const response = await POST(event('Bearer bootstrap-secret') as never);
		expect(response.status).toBe(200);
	});

	it('requires a verified owner once setup identity exists', async () => {
		const { POST } = await import('../../src/routes/api/setup/+server');
		const kv = {
			get: vi
				.fn()
				.mockImplementation((key: string) =>
					Promise.resolve(
						key === 'auth_config:github' ? JSON.stringify({ id: 'configured' }) : null
					)
				)
		};
		const request = new Request('https://example.com/api/setup', {
			method: 'POST',
			headers: { authorization: 'Bearer bootstrap-secret' },
			body: '{}'
		});

		await expect(
			POST({
				request,
				platform: { env: { KV: kv, SETUP_SECRET: 'bootstrap-secret' } },
				locals: {}
			} as never)
		).rejects.toMatchObject({ status: 401 });
	});

	it('authorizes every auth-key method and fails closed without KV', async () => {
		const collection = await import('../../src/routes/api/admin/auth-keys/+server');
		const item = await import('../../src/routes/api/admin/auth-keys/[id]/+server');
		const request = new Request('https://example.com/api/admin/auth-keys', {
			method: 'POST',
			body: JSON.stringify({})
		});
		const anonymous = { locals: {}, platform: { env: {} }, request, params: { id: 'key' } };

		await expect(collection.GET(anonymous as never)).rejects.toMatchObject({ status: 401 });
		await expect(collection.POST(anonymous as never)).rejects.toMatchObject({ status: 401 });
		await expect(item.PUT(anonymous as never)).rejects.toMatchObject({ status: 401 });
		await expect(item.DELETE(anonymous as never)).rejects.toMatchObject({ status: 401 });

		const admin = {
			...anonymous,
			locals: { user: { ...owner, isOwner: false, isAdmin: true } }
		};
		await expect(collection.GET(admin as never)).rejects.toMatchObject({ status: 403 });

		const ownerWithoutKv = { ...anonymous, locals: { user: owner } };
		await expect(collection.GET(ownerWithoutKv as never)).rejects.toMatchObject({ status: 500 });
		await expect(collection.POST(ownerWithoutKv as never)).rejects.toMatchObject({ status: 500 });
		await expect(item.PUT(ownerWithoutKv as never)).rejects.toMatchObject({ status: 500 });
		await expect(item.DELETE(ownerWithoutKv as never)).rejects.toMatchObject({ status: 500 });
	});

	it('allows the owner to use every auth-key method and fails closed on corrupt config', async () => {
		const collection = await import('../../src/routes/api/admin/auth-keys/+server');
		const item = await import('../../src/routes/api/admin/auth-keys/[id]/+server');
		const kv = {
			get: vi.fn().mockResolvedValue(null),
			put: vi.fn().mockResolvedValue(undefined),
			delete: vi.fn().mockResolvedValue(undefined)
		};
		const base = { locals: { user: owner }, platform: { env: { KV: kv } } };

		expect((await (await collection.GET(base as never)).json()).keys).toEqual([]);
		const created = await collection.POST({
			...base,
			request: jsonRequest({
				name: 'Discord',
				provider: 'discord',
				type: 'oauth',
				clientId: 'client-id',
				clientSecret: 'client-secret'
			})
		} as never);
		expect((await created.json()).success).toBe(true);
		kv.get.mockImplementation((key: string) =>
			Promise.resolve(
				key === 'auth_config:discord'
					? JSON.stringify({ id: 'discord-key', provider: 'discord', clientId: 'client-id' })
					: null
			)
		);

		const updated = await item.PUT({
			...base,
			params: { id: 'discord-key' },
			request: jsonRequest({
				name: 'Discord',
				provider: 'discord',
				type: 'oauth',
				clientId: 'updated-client-id'
			})
		} as never);
		expect((await updated.json()).success).toBe(true);

		const deleted = await item.DELETE({ ...base, params: { id: 'discord-key' } } as never);
		expect((await deleted.json()).success).toBe(true);

		kv.get.mockResolvedValue('not-json');
		await expect(collection.GET(base as never)).rejects.toMatchObject({ status: 500 });
		kv.get.mockRejectedValue(new Error('KV unavailable'));
		await expect(
			item.DELETE({ ...base, params: { id: 'missing-key' } } as never)
		).rejects.toMatchObject({ status: 500 });
	});

	it('rejects unsupported auth-key providers', async () => {
		const collection = await import('../../src/routes/api/admin/auth-keys/+server');
		const item = await import('../../src/routes/api/admin/auth-keys/[id]/+server');
		const base = {
			locals: { user: owner },
			platform: {
				env: { KV: { get: vi.fn().mockResolvedValue(null), put: vi.fn() } }
			}
		};
		const body = {
			name: 'Unsupported',
			provider: 'gitlab',
			type: 'oauth',
			clientId: 'client-id',
			clientSecret: 'client-secret'
		};

		await expect(
			collection.POST({ ...base, request: jsonRequest(body) } as never)
		).rejects.toMatchObject({ status: 400 });
		await expect(
			item.PUT({ ...base, params: { id: 'key' }, request: jsonRequest(body) } as never)
		).rejects.toMatchObject({ status: 404 });
		expect(base.platform.env.KV.put).not.toHaveBeenCalled();
	});
});

function jsonRequest(body: unknown): Request {
	return new Request('https://example.com/api/admin/auth-keys', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}
