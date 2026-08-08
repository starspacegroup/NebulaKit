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
			locals?: object;
		} = {}
	) => {
		const mockRequest = {
			headers: new Headers({ authorization: 'Bearer test-setup-secret' }),
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
								SETUP_SECRET: 'test-setup-secret',
								KV: {
									get: overrides.kvGet || mockKVGet,
									put: overrides.kvPut || mockKVPut
								}
							}
						}
					: overrides.platform,
			locals: overrides.locals || {}
		};
	};

	describe('GET - Check setup status', () => {
		it('should fail closed when KV is not available', async () => {
			await expect(
				GET(createMockEvent({ platform: null }) as unknown as Parameters<typeof GET>[0])
			).rejects.toMatchObject({ status: 500 });
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

		it('should fail closed when setup status cannot be read', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			mockKVGet.mockRejectedValue(new Error('KV error'));

			await expect(
				GET(createMockEvent() as unknown as Parameters<typeof GET>[0])
			).rejects.toMatchObject({ status: 500 });
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

		it('should require reset before replacing an existing config', async () => {
			const existingConfig = JSON.stringify({
				id: 'existing-id',
				clientId: 'old-client',
				clientSecret: 'old-secret',
				createdAt: '2024-01-01'
			});
			mockKVGet.mockImplementation((key: string) =>
				key === 'auth_config:github' ? existingConfig : null
			);

			await expect(
				POST(
					createMockEvent({
						body: { adminGithubUsername: 'testuser' },
						locals: { user: { id: 'owner-1', isOwner: true } }
					}) as unknown as Parameters<typeof POST>[0]
				)
			).rejects.toMatchObject({ status: 403 });
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

		it('should fail closed when KV is not available', async () => {
			await expect(
				POST(createMockEvent({ platform: null }) as unknown as Parameters<typeof POST>[0])
			).rejects.toMatchObject({ status: 500 });
		});

		it('should default to github provider when not specified', async () => {
			mockKVGet.mockResolvedValue(null);

			const response = await POST(createMockEvent() as unknown as Parameters<typeof POST>[0]);
			const data = await response.json();

			expect(data.success).toBe(true);
			expect(mockKVPut).toHaveBeenCalledWith('auth_config:github', expect.any(String));
		});

		it('should reject unsupported initial setup providers', async () => {
			mockKVGet.mockResolvedValue(null);

			await expect(
				POST(
					createMockEvent({
						body: {
							clientId: 'id',
							clientSecret: 'secret',
							adminGithubUsername: 'test',
							provider: 'gitlab'
						}
					}) as unknown as Parameters<typeof POST>[0]
				)
			).rejects.toMatchObject({ status: 400 });
		});
	});
});
