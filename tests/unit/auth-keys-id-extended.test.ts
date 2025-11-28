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
								KV: { get: overrides.kvGet || mockKVGet }
							}
						}
					: overrides.platform,
			locals: {}
		};
	};

	describe('PUT - Update auth key', () => {
		it('should allow update when no auth config exists in KV', async () => {
			mockKVGet.mockResolvedValue(null);

			const response = await PUT(createMockEvent() as unknown as Parameters<typeof PUT>[0]);
			const data = await response.json();

			expect(data.success).toBe(true);
			expect(data.key.name).toBe('Test Key');
		});

		it('should allow update when key ID does not match setup key', async () => {
			mockKVGet.mockResolvedValue(JSON.stringify({ id: 'setup-key-different' }));

			const response = await PUT(
				createMockEvent({ id: 'other-key-id' }) as unknown as Parameters<typeof PUT>[0]
			);
			const data = await response.json();

			expect(data.success).toBe(true);
		});

		it('should throw 403 when trying to edit setup key', async () => {
			mockKVGet.mockResolvedValue(JSON.stringify({ id: 'setup-key-id' }));

			await expect(
				PUT(createMockEvent({ id: 'setup-key-id' }) as unknown as Parameters<typeof PUT>[0])
			).rejects.toThrow();
		});

		it('should allow update when KV check throws non-HttpError', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			mockKVGet.mockRejectedValue(new Error('KV connection failed'));

			const response = await PUT(createMockEvent() as unknown as Parameters<typeof PUT>[0]);
			const data = await response.json();

			expect(data.success).toBe(true);
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

		it('should handle platform being undefined', async () => {
			const response = await PUT(
				createMockEvent({ platform: null }) as unknown as Parameters<typeof PUT>[0]
			);
			const data = await response.json();

			expect(data.success).toBe(true);
		});

		it('should include all provided fields in updated key', async () => {
			mockKVGet.mockResolvedValue(null);

			const response = await PUT(
				createMockEvent({
					body: {
						name: 'Updated Key',
						clientId: 'new-client-id',
						provider: 'gitlab',
						type: 'oauth'
					}
				}) as unknown as Parameters<typeof PUT>[0]
			);
			const data = await response.json();

			expect(data.key.name).toBe('Updated Key');
			expect(data.key.clientId).toBe('new-client-id');
			expect(data.key.provider).toBe('gitlab');
			expect(data.key.updatedAt).toBeDefined();
		});
	});

	describe('DELETE - Delete auth key', () => {
		it('should allow deletion when no auth config exists', async () => {
			mockKVGet.mockResolvedValue(null);

			const response = await DELETE(createMockEvent() as unknown as Parameters<typeof DELETE>[0]);
			const data = await response.json();

			expect(data.success).toBe(true);
		});

		it('should allow deletion when key ID does not match setup key', async () => {
			mockKVGet.mockResolvedValue(JSON.stringify({ id: 'setup-key-different' }));

			const response = await DELETE(
				createMockEvent({ id: 'other-key-id' }) as unknown as Parameters<typeof DELETE>[0]
			);
			const data = await response.json();

			expect(data.success).toBe(true);
		});

		it('should throw 403 when trying to delete setup key', async () => {
			mockKVGet.mockResolvedValue(JSON.stringify({ id: 'setup-key-id' }));

			await expect(
				DELETE(createMockEvent({ id: 'setup-key-id' }) as unknown as Parameters<typeof DELETE>[0])
			).rejects.toThrow();
		});

		it('should allow deletion when KV check throws non-HttpError', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			mockKVGet.mockRejectedValue(new Error('KV connection failed'));

			const response = await DELETE(createMockEvent() as unknown as Parameters<typeof DELETE>[0]);
			const data = await response.json();

			expect(data.success).toBe(true);
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it('should handle platform being undefined', async () => {
			const response = await DELETE(
				createMockEvent({ platform: null }) as unknown as Parameters<typeof DELETE>[0]
			);
			const data = await response.json();

			expect(data.success).toBe(true);
		});

		it('should handle empty auth config string', async () => {
			mockKVGet.mockResolvedValue('');

			// Empty string will fail JSON.parse, should be caught and allow deletion
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			const response = await DELETE(createMockEvent() as unknown as Parameters<typeof DELETE>[0]);
			const data = await response.json();

			expect(data.success).toBe(true);
			consoleSpy.mockRestore();
		});
	});
});
