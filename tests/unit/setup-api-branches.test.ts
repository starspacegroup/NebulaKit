/**
 * Extended tests for setup API endpoint - covering more branches
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '../../src/routes/api/setup/+server';

describe('Setup API - Extended Branch Coverage', () => {
	let mockKVGet: ReturnType<typeof vi.fn>;
	let mockKVPut: ReturnType<typeof vi.fn>;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockKVGet = vi.fn();
		mockKVPut = vi.fn();
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const createMockEvent = (
		overrides: {
			body?: object;
			kvGet?: ReturnType<typeof vi.fn>;
			kvPut?: ReturnType<typeof vi.fn>;
			platform?: object | null;
		} = {}
	) => {
		const mockRequest = {
			json: vi.fn().mockResolvedValue(
				overrides.body || {
					clientId: 'test-client-id',
					clientSecret: 'test-client-secret',
					adminGithubUsername: 'testuser'
				}
			)
		};

		return {
			request: mockRequest,
			platform:
				overrides.platform !== null
					? {
							env: {
								KV: {
									get: overrides.kvGet || mockKVGet,
									put: overrides.kvPut || mockKVPut
								}
							}
						}
					: overrides.platform,
			locals: {}
		};
	};

	describe('GET - Check setup status', () => {
		it('should return all false when KV is not available', async () => {
			const response = await GET(
				createMockEvent({ platform: null }) as unknown as Parameters<typeof GET>[0]
			);
			const data = await response.json();

			expect(data.hasConfig).toBe(false);
			expect(data.hasAdmin).toBe(false);
		});

		it('should return setupLocked true when admin has logged in', async () => {
			mockKVGet
				.mockResolvedValueOnce(JSON.stringify({ id: '1' })) // auth_config
				.mockResolvedValueOnce('12345') // owner_id
				.mockResolvedValueOnce('true'); // admin_first_login_completed

			const response = await GET(createMockEvent() as unknown as Parameters<typeof GET>[0]);
			const data = await response.json();

			expect(data.setupLocked).toBe(true);
		});

		it('should handle errors and return default false values', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			mockKVGet.mockRejectedValue(new Error('KV error'));

			const response = await GET(createMockEvent() as unknown as Parameters<typeof GET>[0]);
			const data = await response.json();

			expect(data.hasConfig).toBe(false);
			expect(data.hasAdmin).toBe(false);
			expect(data.setupLocked).toBe(false);
			consoleSpy.mockRestore();
		});
	});

	describe('POST - Save setup configuration', () => {
		beforeEach(() => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ id: 12345, login: 'testuser' })
			});
		});

		it('should throw 403 when setup is already locked', async () => {
			mockKVGet.mockResolvedValue('true'); // admin_first_login_completed

			await expect(
				POST(createMockEvent() as unknown as Parameters<typeof POST>[0])
			).rejects.toThrow();
		});

		it('should throw 400 when clientId is missing and no existing config', async () => {
			mockKVGet.mockResolvedValue(null);

			await expect(
				POST(
					createMockEvent({
						body: { clientSecret: 'secret', adminGithubUsername: 'test' }
					}) as unknown as Parameters<typeof POST>[0]
				)
			).rejects.toThrow();
		});

		it('should throw 400 when clientSecret is missing and no existing config', async () => {
			mockKVGet.mockResolvedValue(null);

			await expect(
				POST(
					createMockEvent({
						body: { clientId: 'id', adminGithubUsername: 'test' }
					}) as unknown as Parameters<typeof POST>[0]
				)
			).rejects.toThrow();
		});

		it('should throw 400 when adminGithubUsername is empty', async () => {
			mockKVGet.mockResolvedValue(null);

			await expect(
				POST(
					createMockEvent({
						body: { clientId: 'id', clientSecret: 'secret', adminGithubUsername: '   ' }
					}) as unknown as Parameters<typeof POST>[0]
				)
			).rejects.toThrow();
		});

		it('should throw 400 for invalid GitHub username format', async () => {
			mockKVGet.mockResolvedValue(null);

			await expect(
				POST(
					createMockEvent({
						body: { clientId: 'id', clientSecret: 'secret', adminGithubUsername: '-invalid-' }
					}) as unknown as Parameters<typeof POST>[0]
				)
			).rejects.toThrow();
		});

		it('should allow update with existing config and no new credentials', async () => {
			const existingConfig = JSON.stringify({
				id: 'existing-id',
				clientId: 'old-client',
				clientSecret: 'old-secret',
				createdAt: '2024-01-01'
			});
			mockKVGet
				.mockResolvedValueOnce(null) // setup not locked
				.mockResolvedValueOnce(existingConfig); // existing config

			const response = await POST(
				createMockEvent({
					body: { adminGithubUsername: 'testuser' }
				}) as unknown as Parameters<typeof POST>[0]
			);
			const data = await response.json();

			expect(data.success).toBe(true);
		});

		it('should throw 404 when GitHub user is not found', async () => {
			mockKVGet.mockResolvedValue(null);
			mockFetch.mockResolvedValue({
				ok: false,
				status: 404
			});

			await expect(
				POST(createMockEvent() as unknown as Parameters<typeof POST>[0])
			).rejects.toThrow();
		});

		it('should throw 500 for non-404 GitHub API errors', async () => {
			mockKVGet.mockResolvedValue(null);
			mockFetch.mockResolvedValue({
				ok: false,
				status: 500
			});

			await expect(
				POST(createMockEvent() as unknown as Parameters<typeof POST>[0])
			).rejects.toThrow();
		});

		it('should handle fetch errors', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			mockKVGet.mockResolvedValue(null);
			mockFetch.mockRejectedValue(new Error('Network error'));

			await expect(
				POST(createMockEvent() as unknown as Parameters<typeof POST>[0])
			).rejects.toThrow();

			consoleSpy.mockRestore();
		});

		it('should return success message when KV is available', async () => {
			mockKVGet.mockResolvedValue(null);
			mockKVPut.mockResolvedValue(undefined);

			const response = await POST(createMockEvent() as unknown as Parameters<typeof POST>[0]);
			const data = await response.json();

			expect(data.success).toBe(true);
			expect(data.adminUsername).toBe('testuser');
			expect(data.adminId).toBe('12345');
		});

		it('should return instructions when KV is not available', async () => {
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const response = await POST(
				createMockEvent({ platform: null }) as unknown as Parameters<typeof POST>[0]
			);
			const data = await response.json();

			expect(data.success).toBe(true);
			expect(data.message).toContain('Set up KV');
			consoleSpy.mockRestore();
		});

		it('should default to github provider when not specified', async () => {
			mockKVGet.mockResolvedValue(null);

			const response = await POST(createMockEvent() as unknown as Parameters<typeof POST>[0]);
			const data = await response.json();

			expect(data.success).toBe(true);
			expect(mockKVPut).toHaveBeenCalledWith('auth_config:github', expect.any(String));
		});

		it('should use specified provider when provided', async () => {
			mockKVGet.mockResolvedValue(null);

			const response = await POST(
				createMockEvent({
					body: {
						clientId: 'id',
						clientSecret: 'secret',
						adminGithubUsername: 'test',
						provider: 'gitlab'
					}
				}) as unknown as Parameters<typeof POST>[0]
			);
			const data = await response.json();

			expect(data.success).toBe(true);
			expect(mockKVPut).toHaveBeenCalledWith('auth_config:gitlab', expect.any(String));
		});
	});
});
