/**
 * Extended tests for auth-keys [id] API endpoint
 * Tests covering more branch coverage
 *
 * These endpoints used to be unauthenticated and fail-open: a KV read that
 * threw, an empty config, or a missing platform all fell through to "success".
 * They are now admin-gated and fail-closed, and the target provider is resolved
 * from stored state rather than from the request body — so the cases below
 * assert rejection where they previously asserted success.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE, PUT } from '../../src/routes/api/admin/auth-keys/[id]/+server';

const OWNER_LOCALS = {
	user: {
		id: '72961',
		login: 'davis9001',
		email: 'owner@example.com',
		isOwner: true,
		isAdmin: true
	}
};

describe('Auth Keys [id] API - Extended Branch Coverage', () => {
	let kvPut: ReturnType<typeof vi.fn>;
	let kvDelete: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();
		kvPut = vi.fn().mockResolvedValue(undefined);
		kvDelete = vi.fn().mockResolvedValue(undefined);
	});

	/** A KV whose `get` answers from a plain map of key -> raw string. */
	const kvFrom = (entries: Record<string, string | null>) => ({
		get: vi.fn((key: string) => Promise.resolve(entries[key] ?? null)),
		put: kvPut,
		delete: kvDelete
	});

	const createMockEvent = (
		overrides: {
			id?: string;
			body?: object;
			kv?: object | null;
			locals?: object;
		} = {}
	) => {
		const mockRequest = {
			json: vi.fn().mockResolvedValue(
				overrides.body || {
					name: 'Test Key',
					clientId: 'client-id-123',
					provider: 'github',
					type: 'oauth'
				}
			)
		};

		return {
			params: { id: overrides.id || 'test-key-1' },
			request: mockRequest,
			platform: overrides.kv === null ? {} : { env: { KV: overrides.kv ?? kvFrom({}) } },
			locals: 'locals' in overrides ? overrides.locals : OWNER_LOCALS
		};
	};

	describe('authorization', () => {
		it('rejects an unauthenticated caller', async () => {
			await expect(
				PUT(createMockEvent({ locals: undefined }) as unknown as Parameters<typeof PUT>[0])
			).rejects.toMatchObject({ status: 401 });
			await expect(
				DELETE(createMockEvent({ locals: undefined }) as unknown as Parameters<typeof DELETE>[0])
			).rejects.toMatchObject({ status: 401 });
			expect(kvPut).not.toHaveBeenCalled();
			expect(kvDelete).not.toHaveBeenCalled();
		});

		it('rejects an authenticated non-admin', async () => {
			const locals = { user: { id: '1', login: 'x', email: 'x@e.com', isOwner: false } };
			await expect(
				PUT(createMockEvent({ locals }) as unknown as Parameters<typeof PUT>[0])
			).rejects.toMatchObject({ status: 403 });
			await expect(
				DELETE(createMockEvent({ locals }) as unknown as Parameters<typeof DELETE>[0])
			).rejects.toMatchObject({ status: 403 });
			expect(kvPut).not.toHaveBeenCalled();
			expect(kvDelete).not.toHaveBeenCalled();
		});
	});

	describe('PUT - Update auth key', () => {
		it('updates the provider that actually holds the id', async () => {
			const kv = kvFrom({
				'auth_config:discord': JSON.stringify({
					id: 'test-key-1',
					provider: 'discord',
					clientId: 'old-client',
					clientSecret: 'existing-secret'
				})
			});

			const response = await PUT(
				createMockEvent({
					kv,
					body: { name: 'Renamed', clientId: 'new-client' }
				}) as unknown as Parameters<typeof PUT>[0]
			);
			const data = await response.json();

			expect(data.success).toBe(true);
			expect(data.key.provider).toBe('discord');
			expect(kvPut).toHaveBeenCalledWith('auth_config:discord', expect.any(String));

			// clientSecret was not supplied, so the stored one survives
			const written = JSON.parse(kvPut.mock.calls[0][1]);
			expect(written.clientSecret).toBe('existing-secret');
			expect(written.clientId).toBe('new-client');
		});

		it('replaces clientSecret only when one is supplied', async () => {
			const kv = kvFrom({
				'auth_config:discord': JSON.stringify({
					id: 'test-key-1',
					provider: 'discord',
					clientSecret: 'existing-secret'
				})
			});

			await PUT(
				createMockEvent({
					kv,
					body: { name: 'N', clientId: 'c', clientSecret: 'rotated-secret' }
				}) as unknown as Parameters<typeof PUT>[0]
			);

			expect(JSON.parse(kvPut.mock.calls[0][1]).clientSecret).toBe('rotated-secret');
		});

		it('ignores the provider in the request body', async () => {
			// Body claims github; only discord actually holds this id.
			const kv = kvFrom({
				'auth_config:github': JSON.stringify({ id: 'setup-key-id', provider: 'github' }),
				'auth_config:discord': JSON.stringify({ id: 'test-key-1', provider: 'discord' })
			});

			await PUT(
				createMockEvent({
					kv,
					body: { name: 'N', clientId: 'c', provider: 'github' }
				}) as unknown as Parameters<typeof PUT>[0]
			);

			expect(kvPut).toHaveBeenCalledTimes(1);
			expect(kvPut).toHaveBeenCalledWith('auth_config:discord', expect.any(String));
		});

		it('throws 404 when no stored config carries the id', async () => {
			await expect(
				PUT(createMockEvent() as unknown as Parameters<typeof PUT>[0])
			).rejects.toMatchObject({ status: 404 });
			expect(kvPut).not.toHaveBeenCalled();
		});

		it('throws 403 when trying to edit the setup key', async () => {
			const kv = kvFrom({
				'auth_config:github': JSON.stringify({ id: 'setup-key-id', provider: 'github' })
			});

			await expect(
				PUT(createMockEvent({ id: 'setup-key-id', kv }) as unknown as Parameters<typeof PUT>[0])
			).rejects.toMatchObject({ status: 403 });
			expect(kvPut).not.toHaveBeenCalled();
		});

		it('throws 500 rather than proceeding when the stored GitHub config is unparseable', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			const kv = kvFrom({ 'auth_config:github': 'not json' });

			await expect(
				PUT(createMockEvent({ kv }) as unknown as Parameters<typeof PUT>[0])
			).rejects.toMatchObject({ status: 500 });
			expect(kvPut).not.toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it('throws 400 when name is missing', async () => {
			await expect(
				PUT(createMockEvent({ body: { clientId: 'test' } }) as unknown as Parameters<typeof PUT>[0])
			).rejects.toMatchObject({ status: 400 });
		});

		it('throws 400 when clientId is missing', async () => {
			await expect(
				PUT(createMockEvent({ body: { name: 'Test' } }) as unknown as Parameters<typeof PUT>[0])
			).rejects.toMatchObject({ status: 400 });
		});

		it('throws 500 when KV is unavailable', async () => {
			await expect(
				PUT(createMockEvent({ kv: null }) as unknown as Parameters<typeof PUT>[0])
			).rejects.toMatchObject({ status: 500 });
		});
	});

	describe('DELETE - Delete auth key', () => {
		it('deletes the provider that actually holds the id', async () => {
			const kv = kvFrom({
				'auth_config:discord': JSON.stringify({ id: 'test-key-1', provider: 'discord' })
			});

			const response = await DELETE(
				createMockEvent({ kv }) as unknown as Parameters<typeof DELETE>[0]
			);
			const data = await response.json();

			expect(data.success).toBe(true);
			expect(kvDelete).toHaveBeenCalledWith('auth_config:discord');
		});

		it('throws 404 when no stored config carries the id', async () => {
			await expect(
				DELETE(createMockEvent() as unknown as Parameters<typeof DELETE>[0])
			).rejects.toMatchObject({ status: 404 });
			expect(kvDelete).not.toHaveBeenCalled();
		});

		it('throws 403 when trying to delete the setup key', async () => {
			const kv = kvFrom({
				'auth_config:github': JSON.stringify({ id: 'setup-key-id', provider: 'github' })
			});

			await expect(
				DELETE(
					createMockEvent({ id: 'setup-key-id', kv }) as unknown as Parameters<typeof DELETE>[0]
				)
			).rejects.toMatchObject({ status: 403 });
			expect(kvDelete).not.toHaveBeenCalled();
		});

		it('deletes nothing when the stored GitHub config is an empty string', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			const kv = kvFrom({ 'auth_config:github': '' });

			// An empty string used to fail JSON.parse, get swallowed, and let the
			// delete through. It is falsy, so it now reads as "no config stored"
			// and no provider claims the id — a 404 with nothing deleted.
			await expect(
				DELETE(createMockEvent({ kv }) as unknown as Parameters<typeof DELETE>[0])
			).rejects.toMatchObject({ status: 404 });
			expect(kvDelete).not.toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it('throws 500 when KV is unavailable', async () => {
			await expect(
				DELETE(createMockEvent({ kv: null }) as unknown as Parameters<typeof DELETE>[0])
			).rejects.toMatchObject({ status: 500 });
		});
	});
});
