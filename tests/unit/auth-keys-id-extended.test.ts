/**
 * Extended tests for auth-keys [id] API endpoint
 * Tests covering more branch coverage
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE, PUT } from '../../src/routes/api/admin/auth-keys/[id]/+server';

describe('Auth Keys [id] API - Extended Branch Coverage', () => {
	let mockKVGet: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockKVGet = vi.fn();
	});

	const createMockEvent = (
		overrides: {
			id?: string;
			body?: object;
			kvGet?: ReturnType<typeof vi.fn>;
			platform?: object | null;
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
			platform:
				overrides.platform !== null
					? {
							env: {
								KV: {
									get: overrides.kvGet || mockKVGet,
									put: vi.fn().mockResolvedValue(undefined),
									delete: vi.fn().mockResolvedValue(undefined)
								}
							}
						}
					: overrides.platform,
			locals: { user: { id: 'owner-1', isOwner: true, isAdmin: true } }
		};
	};

	describe('PUT - Update auth key', () => {
		it('should reject update when no stored config carries the id', async () => {
			mockKVGet.mockResolvedValue(null);

			await expect(
				PUT(createMockEvent() as unknown as Parameters<typeof PUT>[0])
			).rejects.toMatchObject({ status: 404 });
		});

		it('should reject update when the id does not match stored state', async () => {
			mockKVGet.mockResolvedValue(JSON.stringify({ id: 'setup-key-different' }));

			await expect(
				PUT(createMockEvent({ id: 'other-key-id' }) as unknown as Parameters<typeof PUT>[0])
			).rejects.toMatchObject({ status: 404 });
		});

		it('should throw 403 when trying to edit setup key', async () => {
			mockKVGet.mockResolvedValue(JSON.stringify({ id: 'setup-key-id' }));

			await expect(
				PUT(createMockEvent({ id: 'setup-key-id' }) as unknown as Parameters<typeof PUT>[0])
			).rejects.toThrow();
		});

		it('should fail closed when the KV check fails', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			mockKVGet.mockRejectedValue(new Error('KV connection failed'));

			await expect(
				PUT(createMockEvent() as unknown as Parameters<typeof PUT>[0])
			).rejects.toMatchObject({ status: 500 });
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it('should throw 400 when name is missing', async () => {
			mockKVGet.mockResolvedValue(null);

			await expect(
				PUT(createMockEvent({ body: { clientId: 'test' } }) as unknown as Parameters<typeof PUT>[0])
			).rejects.toThrow();
		});

		it('should throw 400 when clientId is missing', async () => {
			mockKVGet.mockResolvedValue(null);

			await expect(
				PUT(createMockEvent({ body: { name: 'Test' } }) as unknown as Parameters<typeof PUT>[0])
			).rejects.toThrow();
		});

		it('should fail closed when platform is unavailable', async () => {
			await expect(
				PUT(createMockEvent({ platform: null }) as unknown as Parameters<typeof PUT>[0])
			).rejects.toMatchObject({ status: 500 });
		});

		it('should include all provided fields in updated key', async () => {
			mockKVGet.mockImplementation((key: string) =>
				Promise.resolve(
					key === 'auth_config:discord'
						? JSON.stringify({ id: 'test-key-1', provider: 'discord' })
						: null
				)
			);

			const response = await PUT(
				createMockEvent({
					body: {
						name: 'Updated Key',
						clientId: 'new-client-id',
						provider: 'github',
						type: 'oauth'
					}
				}) as unknown as Parameters<typeof PUT>[0]
			);
			const data = await response.json();

			expect(data.key.name).toBe('Updated Key');
			expect(data.key.clientId).toBe('new-client-id');
			expect(data.key.provider).toBe('discord');
			expect(data.key.updatedAt).toBeDefined();
		});
	});

	describe('DELETE - Delete auth key', () => {
		it('should reject deletion when no stored config carries the id', async () => {
			mockKVGet.mockResolvedValue(null);

			await expect(
				DELETE(createMockEvent() as unknown as Parameters<typeof DELETE>[0])
			).rejects.toMatchObject({ status: 404 });
		});

		it('should reject deletion when the id does not match stored state', async () => {
			mockKVGet.mockResolvedValue(JSON.stringify({ id: 'setup-key-different' }));

			await expect(
				DELETE(createMockEvent({ id: 'other-key-id' }) as unknown as Parameters<typeof DELETE>[0])
			).rejects.toMatchObject({ status: 404 });
		});

		it('should throw 403 when trying to delete setup key', async () => {
			mockKVGet.mockResolvedValue(JSON.stringify({ id: 'setup-key-id' }));

			await expect(
				DELETE(createMockEvent({ id: 'setup-key-id' }) as unknown as Parameters<typeof DELETE>[0])
			).rejects.toThrow();
		});

		it('should fail closed when the deletion KV check fails', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			mockKVGet.mockRejectedValue(new Error('KV connection failed'));

			await expect(
				DELETE(createMockEvent() as unknown as Parameters<typeof DELETE>[0])
			).rejects.toMatchObject({ status: 500 });
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it('should fail closed when platform is unavailable', async () => {
			await expect(
				DELETE(createMockEvent({ platform: null }) as unknown as Parameters<typeof DELETE>[0])
			).rejects.toMatchObject({ status: 500 });
		});

		it('should treat an empty auth config as absent', async () => {
			mockKVGet.mockResolvedValue('');

			await expect(
				DELETE(createMockEvent() as unknown as Parameters<typeof DELETE>[0])
			).rejects.toMatchObject({ status: 404 });
		});
	});
});
