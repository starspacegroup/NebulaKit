import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for Admin Layout Server Load
 * TDD: Tests for admin access control
 */

describe('Admin Layout Server Load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	describe('load function', () => {
		it('should redirect to login when user not authenticated', async () => {
			const { load } = await import('../../src/routes/admin/+layout.server');

			try {
				await load({
					locals: {}
				} as any);
				expect.fail('Should have thrown redirect');
			} catch (err: any) {
				expect(err.status).toBe(302);
				expect(err.location).toContain('/auth/login');
			}
		});

		it('should redirect to home when user is not owner', async () => {
			const { load } = await import('../../src/routes/admin/+layout.server');

			try {
				await load({
					locals: {
						user: {
							id: 'user-123',
							isOwner: false,
							isAdmin: false
						}
					}
				} as any);
				expect.fail('Should have thrown redirect');
			} catch (err: any) {
				expect(err.status).toBe(302);
				expect(err.location).toContain('error=forbidden');
			}
		});

		it('should return user data when owner is authenticated', async () => {
			const mockUser = {
				id: 'owner-123',
				login: 'owner',
				isOwner: true,
				isAdmin: true
			};

			const { load } = await import('../../src/routes/admin/+layout.server');
			const result = await load({
				locals: { user: mockUser }
			} as any);

			expect((result as { user: typeof mockUser }).user).toEqual(mockUser);
		});
	});
});

describe('Admin Dashboard Page Server Load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	describe('load function', () => {
		it('should return setup info from KV', async () => {
			const authConfig = {
				provider: 'github',
				clientId: 'test-client'
			};

			const mockPlatform = {
				env: {
					KV: {
						get: vi
							.fn()
							.mockResolvedValueOnce(JSON.stringify(authConfig))
							.mockResolvedValueOnce('12345')
							.mockResolvedValueOnce('testowner')
					}
				}
			};

			const { load } = await import('../../src/routes/admin/+page.server');
			const result = (await load({
				platform: mockPlatform
			} as any)) as {
				setupInfo: {
					hasOAuthConfig: boolean;
					oauthProvider: string | null;
					oauthClientId: string | null;
					adminId: string | null;
					adminUsername: string | null;
				};
			};

			expect(result.setupInfo.hasOAuthConfig).toBe(true);
			expect(result.setupInfo.oauthProvider).toBe('github');
			expect(result.setupInfo.oauthClientId).toBe('test-client');
			expect(result.setupInfo.adminId).toBe('12345');
			expect(result.setupInfo.adminUsername).toBe('testowner');
		});

		it('should return empty setup info when KV not available', async () => {
			const { load } = await import('../../src/routes/admin/+page.server');
			const result = (await load({
				platform: {}
			} as any)) as {
				setupInfo: {
					hasOAuthConfig: boolean;
					oauthProvider: string | null;
					adminId: string | null;
				};
			};

			expect(result.setupInfo.hasOAuthConfig).toBe(false);
			expect(result.setupInfo.oauthProvider).toBeNull();
			expect(result.setupInfo.adminId).toBeNull();
		});

		it('should handle KV errors gracefully', async () => {
			const mockPlatform = {
				env: {
					KV: {
						get: vi.fn().mockRejectedValue(new Error('KV Error'))
					}
				}
			};

			const { load } = await import('../../src/routes/admin/+page.server');
			const result = (await load({
				platform: mockPlatform
			} as any)) as { setupInfo: { hasOAuthConfig: boolean } };

			expect(result.setupInfo.hasOAuthConfig).toBe(false);
		});

		it('should handle missing auth config', async () => {
			const mockPlatform = {
				env: {
					KV: {
						get: vi
							.fn()
							.mockResolvedValueOnce(null) // No auth config
							.mockResolvedValueOnce('12345')
							.mockResolvedValueOnce('owner')
					}
				}
			};

			const { load } = await import('../../src/routes/admin/+page.server');
			const result = (await load({
				platform: mockPlatform
			} as any)) as { setupInfo: { hasOAuthConfig: boolean; adminId: string | null } };

			expect(result.setupInfo.hasOAuthConfig).toBe(false);
			expect(result.setupInfo.adminId).toBe('12345');
		});
	});
});
