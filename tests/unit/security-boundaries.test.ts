import { describe, expect, it, vi } from 'vitest';

const owner = { id: 'owner-1', isOwner: true, isAdmin: true };
const admin = { id: 'admin-1', isOwner: false, isAdmin: true };

function authKeyPlatform() {
	return {
		env: {
			KV: {
				get: vi.fn().mockResolvedValue(null),
				put: vi.fn().mockResolvedValue(undefined),
				delete: vi.fn().mockResolvedValue(undefined)
			}
		}
	};
}

describe('owner-only security administration', () => {
	it.each([
		[
			'GET collection',
			async (locals: object) => {
				const { GET } = await import('../../src/routes/api/admin/auth-keys/+server');
				return GET({ platform: authKeyPlatform(), locals } as never);
			}
		],
		[
			'POST collection',
			async (locals: object) => {
				const { POST } = await import('../../src/routes/api/admin/auth-keys/+server');
				return POST({
					platform: authKeyPlatform(),
					locals,
					request: {
						json: async () => ({
							name: 'GitHub',
							provider: 'github',
							type: 'oauth',
							clientId: 'id',
							clientSecret: 'secret'
						})
					}
				} as never);
			}
		],
		[
			'PUT item',
			async (locals: object) => {
				const { PUT } = await import('../../src/routes/api/admin/auth-keys/[id]/+server');
				return PUT({
					platform: authKeyPlatform(),
					locals,
					params: { id: 'key-1' },
					request: {
						json: async () => ({
							name: 'GitHub',
							provider: 'github',
							type: 'oauth',
							clientId: 'id'
						})
					}
				} as never);
			}
		],
		[
			'DELETE item',
			async (locals: object) => {
				const { DELETE } = await import('../../src/routes/api/admin/auth-keys/[id]/+server');
				return DELETE({ platform: authKeyPlatform(), locals, params: { id: 'key-1' } } as never);
			}
		]
	])('blocks unauthenticated and plain-admin callers for %s', async (_name, invoke) => {
		await expect(invoke({})).rejects.toMatchObject({ status: 401 });
		await expect(invoke({ user: admin })).rejects.toMatchObject({ status: 403 });
	});

	it('allows the owner to read authentication metadata', async () => {
		const { GET } = await import('../../src/routes/api/admin/auth-keys/+server');
		const response = await GET({
			platform: authKeyPlatform(),
			locals: { user: owner }
		} as never);

		expect(response.status).toBe(200);
	});

	it('rejects unsupported OAuth providers', async () => {
		const { POST } = await import('../../src/routes/api/admin/auth-keys/+server');
		await expect(
			POST({
				platform: authKeyPlatform(),
				locals: { user: owner },
				request: {
					json: async () => ({
						name: 'Unknown',
						provider: 'gitlab',
						type: 'oauth',
						clientId: 'id',
						clientSecret: 'secret'
					})
				}
			} as never)
		).rejects.toMatchObject({ status: 400 });
	});
});

describe('reset and setup takeover protection', () => {
	it('blocks destructive reset for unauthenticated callers and plain admins', async () => {
		const { POST } = await import('../../src/routes/api/reset/+server');
		const event = (locals: object) => ({
			locals,
			platform: { env: { KV: { get: vi.fn().mockResolvedValue(null), delete: vi.fn() } } },
			cookies: { delete: vi.fn() }
		});

		await expect(POST(event({}) as never)).rejects.toMatchObject({ status: 401 });
		await expect(POST(event({ user: admin }) as never)).rejects.toMatchObject({ status: 403 });
	});

	it('revokes D1 sessions when the owner resets configuration', async () => {
		const run = vi.fn().mockResolvedValue(undefined);
		const prepare = vi.fn(() => ({ run }));
		const { POST } = await import('../../src/routes/api/reset/+server');
		const response = await POST({
			locals: { user: owner },
			platform: {
				env: {
					KV: {
						get: vi.fn().mockResolvedValue(null),
						delete: vi.fn().mockResolvedValue(undefined)
					},
					DB: { prepare }
				}
			},
			cookies: { delete: vi.fn() }
		} as never);

		expect(response.status).toBe(200);
		expect(prepare).toHaveBeenCalledWith('DELETE FROM sessions');
		expect(run).toHaveBeenCalled();
	});

	it('refuses to replace an existing setup owner before first login', async () => {
		const get = vi.fn(async (key: string) => {
			if (key === 'auth_config:github')
				return JSON.stringify({ id: 'existing', clientId: 'old', clientSecret: 'old-secret' });
			if (key === 'github_owner_id') return '123';
			return null;
		});
		const { POST } = await import('../../src/routes/api/setup/+server');

		await expect(
			POST({
				locals: {},
				platform: { env: { KV: { get, put: vi.fn() } } },
				request: { json: async () => ({ adminGithubUsername: 'attacker' }) },
				fetch: vi.fn()
			} as never)
		).rejects.toMatchObject({ status: 401 });
	});
});
