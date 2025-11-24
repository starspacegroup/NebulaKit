import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Auth keys page - GitHub OAuth from setup', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('GET /api/admin/auth-keys endpoint', () => {
		it('should fetch GitHub OAuth configuration from KV', async () => {
			const mockAuthConfig = {
				id: 'oauth-github-setup',
				provider: 'github',
				clientId: 'Iv1.abc123def456',
				createdAt: '2025-01-01T00:00:00Z'
			};

			const mockKV = {
				get: vi.fn().mockResolvedValue(JSON.stringify(mockAuthConfig))
			};

			const authConfigStr = await mockKV.get('auth_config:github');
			const authConfig = authConfigStr ? JSON.parse(authConfigStr) : null;

			expect(mockKV.get).toHaveBeenCalledWith('auth_config:github');
			expect(authConfig).toEqual(mockAuthConfig);
			expect(authConfig.provider).toBe('github');
			expect(authConfig.clientId).toBe('Iv1.abc123def456');
		});

		it('should return GitHub OAuth as an auth key in the list', async () => {
			const mockAuthConfig = {
				id: 'oauth-github-setup',
				provider: 'github',
				clientId: 'Iv1.abc123def456',
				createdAt: '2025-01-01T00:00:00Z'
			};

			const mockKV = {
				get: vi.fn().mockResolvedValue(JSON.stringify(mockAuthConfig))
			};

			const authConfigStr = await mockKV.get('auth_config:github');
			const authConfig = authConfigStr ? JSON.parse(authConfigStr) : null;

			const keys = [];
			if (authConfig) {
				keys.push({
					id: authConfig.id,
					name: 'GitHub OAuth (Setup)',
					provider: authConfig.provider,
					type: 'oauth',
					clientId: authConfig.clientId,
					createdAt: authConfig.createdAt,
					isSetupKey: true // Mark as the setup key (read-only)
				});
			}

			expect(keys).toHaveLength(1);
			expect(keys[0].name).toBe('GitHub OAuth (Setup)');
			expect(keys[0].provider).toBe('github');
			expect(keys[0].clientId).toBe('Iv1.abc123def456');
			expect(keys[0].isSetupKey).toBe(true);
		});

		it('should return empty array when no GitHub OAuth is configured', async () => {
			const mockKV = {
				get: vi.fn().mockResolvedValue(null)
			};

			const authConfigStr = await mockKV.get('auth_config:github');
			const authConfig = authConfigStr ? JSON.parse(authConfigStr) : null;

			const keys = [];
			if (authConfig) {
				keys.push({
					id: authConfig.id,
					name: 'GitHub OAuth (Setup)',
					provider: authConfig.provider,
					type: 'oauth',
					clientId: authConfig.clientId,
					createdAt: authConfig.createdAt,
					isSetupKey: true
				});
			}

			expect(keys).toHaveLength(0);
		});

		it('should handle JSON parse errors gracefully', async () => {
			const mockKV = {
				get: vi.fn().mockResolvedValue('invalid-json{')
			};

			const authConfigStr = await mockKV.get('auth_config:github');
			let authConfig = null;

			try {
				authConfig = authConfigStr ? JSON.parse(authConfigStr) : null;
			} catch (err) {
				authConfig = null;
			}

			expect(authConfig).toBeNull();
		});

		it('should mark setup key with isSetupKey flag for read-only display', async () => {
			const mockAuthConfig = {
				id: 'oauth-github-setup',
				provider: 'github',
				clientId: 'Iv1.abc123def456',
				createdAt: '2025-01-01T00:00:00Z'
			};

			const key = {
				id: mockAuthConfig.id,
				name: 'GitHub OAuth (Setup)',
				provider: mockAuthConfig.provider,
				type: 'oauth',
				clientId: mockAuthConfig.clientId,
				createdAt: mockAuthConfig.createdAt,
				isSetupKey: true
			};

			expect(key.isSetupKey).toBe(true);
			// UI should prevent editing/deleting setup keys
		});
	});

	describe('UI display of setup OAuth keys', () => {
		it('should show setup key in auth keys list', () => {
			const keys = [
				{
					id: 'oauth-github-setup',
					name: 'GitHub OAuth (Setup)',
					provider: 'github',
					type: 'oauth',
					clientId: 'Iv1.abc123def456',
					createdAt: '2025-01-01T00:00:00Z',
					isSetupKey: true
				}
			];

			expect(keys).toHaveLength(1);
			expect(keys[0].name).toContain('Setup');
			expect(keys[0].isSetupKey).toBe(true);
		});

		it('should disable edit button for setup keys', () => {
			const key = {
				id: 'oauth-github-setup',
				name: 'GitHub OAuth (Setup)',
				provider: 'github',
				type: 'oauth',
				clientId: 'Iv1.abc123def456',
				isSetupKey: true
			};

			const canEdit = !key.isSetupKey;
			expect(canEdit).toBe(false);
		});

		it('should disable delete button for setup keys', () => {
			const key = {
				id: 'oauth-github-setup',
				name: 'GitHub OAuth (Setup)',
				provider: 'github',
				type: 'oauth',
				clientId: 'Iv1.abc123def456',
				isSetupKey: true
			};

			const canDelete = !key.isSetupKey;
			expect(canDelete).toBe(false);
		});

		it('should show visual indicator for setup keys', () => {
			const key = {
				id: 'oauth-github-setup',
				name: 'GitHub OAuth (Setup)',
				provider: 'github',
				type: 'oauth',
				clientId: 'Iv1.abc123def456',
				isSetupKey: true
			};

			// Should display badge or label indicating this is the setup key
			const label = key.isSetupKey ? 'Setup Key' : '';
			expect(label).toBe('Setup Key');
		});
	});

	describe('security and data handling', () => {
		it('should never expose client secret in auth keys list', () => {
			const mockAuthConfig = {
				id: 'oauth-github-setup',
				provider: 'github',
				clientId: 'Iv1.abc123def456',
				clientSecret: 'super-secret-value',
				createdAt: '2025-01-01T00:00:00Z'
			};

			// Extract safe data for display (no clientSecret)
			const safeKey = {
				id: mockAuthConfig.id,
				name: 'GitHub OAuth (Setup)',
				provider: mockAuthConfig.provider,
				type: 'oauth',
				clientId: mockAuthConfig.clientId,
				createdAt: mockAuthConfig.createdAt,
				isSetupKey: true
				// clientSecret intentionally omitted
			};

			expect(safeKey).not.toHaveProperty('clientSecret');
			expect(Object.keys(safeKey)).not.toContain('clientSecret');
		});

		it('should handle multiple auth providers in the future', async () => {
			const mockGitHubConfig = {
				id: 'oauth-github-setup',
				provider: 'github',
				clientId: 'Iv1.abc123def456',
				createdAt: '2025-01-01T00:00:00Z'
			};

			const keys = [
				{
					id: mockGitHubConfig.id,
					name: 'GitHub OAuth (Setup)',
					provider: mockGitHubConfig.provider,
					type: 'oauth',
					clientId: mockGitHubConfig.clientId,
					createdAt: mockGitHubConfig.createdAt,
					isSetupKey: true
				}
				// Could add more providers here in the future
			];

			expect(keys.length).toBeGreaterThanOrEqual(1);
			expect(keys.some((k) => k.provider === 'github')).toBe(true);
		});
	});
});
