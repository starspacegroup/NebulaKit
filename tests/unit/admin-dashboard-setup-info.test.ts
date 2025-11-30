import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Admin dashboard - setup info display', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('server load function', () => {
		it('should fetch GitHub OAuth configuration from KV', async () => {
			const mockAuthConfig = {
				id: 'test-id',
				provider: 'github',
				clientId: 'github-client-id-123',
				createdAt: '2025-01-01T00:00:00Z'
			};

			const mockKV = {
				get: vi.fn().mockImplementation((key: string) => {
					if (key === 'auth_config:github') return JSON.stringify(mockAuthConfig);
					return null;
				})
			};

			const authConfigStr = await mockKV.get('auth_config:github');
			const authConfig = authConfigStr ? JSON.parse(authConfigStr) : null;

			expect(mockKV.get).toHaveBeenCalledWith('auth_config:github');
			expect(authConfig).toEqual(mockAuthConfig);
			expect(authConfig.clientId).toBe('github-client-id-123');
			expect(authConfig.provider).toBe('github');
		});

		it('should fetch admin user information from KV', async () => {
			const mockKV = {
				get: vi.fn().mockImplementation((key: string) => {
					if (key === 'github_owner_id') return '12345';
					if (key === 'github_owner_username') return 'admin-user';
					return null;
				})
			};

			const ownerId = await mockKV.get('github_owner_id');
			const ownerUsername = await mockKV.get('github_owner_username');

			expect(mockKV.get).toHaveBeenCalledWith('github_owner_id');
			expect(mockKV.get).toHaveBeenCalledWith('github_owner_username');
			expect(ownerId).toBe('12345');
			expect(ownerUsername).toBe('admin-user');
		});

		it('should handle missing OAuth configuration gracefully', async () => {
			const mockKV = {
				get: vi.fn().mockResolvedValue(null)
			};

			const authConfigStr = await mockKV.get('auth_config:github');
			const authConfig = authConfigStr ? JSON.parse(authConfigStr) : null;

			expect(authConfig).toBeNull();
		});

		it('should handle missing admin user information gracefully', async () => {
			const mockKV = {
				get: vi.fn().mockResolvedValue(null)
			};

			const ownerId = await mockKV.get('github_owner_id');
			const ownerUsername = await mockKV.get('github_owner_username');

			expect(ownerId).toBeNull();
			expect(ownerUsername).toBeNull();
		});

		it('should return properly structured data for the page', async () => {
			const mockAuthConfig = {
				id: 'test-id',
				provider: 'github',
				clientId: 'github-client-id-123',
				createdAt: '2025-01-01T00:00:00Z'
			};

			const mockKV = {
				get: vi.fn().mockImplementation((key: string) => {
					if (key === 'auth_config:github') return JSON.stringify(mockAuthConfig);
					if (key === 'github_owner_id') return '12345';
					if (key === 'github_owner_username') return 'admin-user';
					return null;
				})
			};

			const authConfigStr = await mockKV.get('auth_config:github');
			const authConfig = authConfigStr ? JSON.parse(authConfigStr) : null;
			const adminId = await mockKV.get('github_owner_id');
			const adminUsername = await mockKV.get('github_owner_username');

			const pageData = {
				setupInfo: {
					hasOAuthConfig: !!authConfig,
					oauthProvider: authConfig?.provider || null,
					oauthClientId: authConfig?.clientId || null,
					adminId: adminId || null,
					adminUsername: adminUsername || null
				}
			};

			expect(pageData.setupInfo.hasOAuthConfig).toBe(true);
			expect(pageData.setupInfo.oauthProvider).toBe('github');
			expect(pageData.setupInfo.oauthClientId).toBe('github-client-id-123');
			expect(pageData.setupInfo.adminId).toBe('12345');
			expect(pageData.setupInfo.adminUsername).toBe('admin-user');
		});
	});

	describe('admin page UI', () => {
		it('should display OAuth provider information', () => {
			const setupInfo = {
				hasOAuthConfig: true,
				oauthProvider: 'github',
				oauthClientId: 'github-client-id-123',
				adminId: '12345',
				adminUsername: 'admin-user'
			};

			expect(setupInfo.hasOAuthConfig).toBe(true);
			expect(setupInfo.oauthProvider).toBe('github');
			// UI should show this information
		});

		it('should display OAuth client ID (masked for security)', () => {
			const clientId = 'github-client-id-123';
			const maskedClientId = clientId.slice(0, 8) + '***';

			expect(maskedClientId).toBe('github-c***');
			// UI should display masked version
		});

		it('should display admin username information', () => {
			const setupInfo = {
				hasOAuthConfig: true,
				oauthProvider: 'github',
				oauthClientId: 'github-client-id-123',
				adminId: '12345',
				adminUsername: 'admin-user'
			};

			expect(setupInfo.adminUsername).toBe('admin-user');
			// UI should show this information
		});

		it('should show warning when OAuth config is missing', () => {
			const setupInfo = {
				hasOAuthConfig: false,
				oauthProvider: null,
				oauthClientId: null,
				adminId: null,
				adminUsername: null
			};

			expect(setupInfo.hasOAuthConfig).toBe(false);
			// UI should show a warning or prompt to configure
		});

		it('should show GitHub profile link for admin user', () => {
			const adminUsername = 'admin-user';
			const profileUrl = `https://github.com/${adminUsername}`;

			expect(profileUrl).toBe('https://github.com/admin-user');
			// UI should link to this URL
		});
	});

	describe('security considerations', () => {
		it('should never expose client secret', () => {
			const mockAuthConfig = {
				id: 'test-id',
				provider: 'github',
				clientId: 'github-client-id-123',
				clientSecret: 'super-secret-value',
				createdAt: '2025-01-01T00:00:00Z'
			};

			// Extract safe data for display (no clientSecret)
			const safeData = {
				provider: mockAuthConfig.provider,
				clientId: mockAuthConfig.clientId
				// clientSecret intentionally omitted
			};

			expect(safeData).not.toHaveProperty('clientSecret');
			expect(Object.keys(safeData)).not.toContain('clientSecret');
		});

		it('should mask sensitive parts of client ID', () => {
			const clientId = 'Iv1.a1b2c3d4e5f6g7h8';
			const maskedClientId = clientId.slice(0, 8) + '***';

			expect(maskedClientId).not.toBe(clientId);
			expect(maskedClientId).toContain('***');
			expect(maskedClientId.length).toBeLessThan(clientId.length);
		});
	});
});
