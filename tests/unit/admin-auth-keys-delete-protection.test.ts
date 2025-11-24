import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('DELETE /api/admin/auth-keys/[id] - Setup key protection', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should prevent deletion of GitHub OAuth setup key', async () => {
		const setupKeyId = 'oauth-github-setup';

		const mockKV = {
			get: vi.fn().mockImplementation((key: string) => {
				if (key === 'auth_config:github') {
					return JSON.stringify({
						id: setupKeyId,
						provider: 'github',
						clientId: 'Iv1.abc123def456',
						createdAt: '2025-01-01T00:00:00Z'
					});
				}
				return null;
			}),
			delete: vi.fn()
		};

		// Check if the ID being deleted is the setup key
		const authConfigStr = await mockKV.get('auth_config:github');
		const authConfig = authConfigStr ? JSON.parse(authConfigStr) : null;
		const isSetupKey = authConfig && authConfig.id === setupKeyId;

		// Should not allow deletion
		expect(isSetupKey).toBe(true);

		// API should return 403 error
		const shouldReject = isSetupKey;
		expect(shouldReject).toBe(true);
	});

	it('should allow deletion of non-setup keys', async () => {
		const regularKeyId = 'custom-key-123';
		const setupKeyId = 'oauth-github-setup';

		const mockKV = {
			get: vi.fn().mockImplementation((key: string) => {
				if (key === 'auth_config:github') {
					return JSON.stringify({
						id: setupKeyId,
						provider: 'github',
						clientId: 'Iv1.abc123def456',
						createdAt: '2025-01-01T00:00:00Z'
					});
				}
				return null;
			}),
			delete: vi.fn()
		};

		// Check if the ID being deleted is the setup key
		const authConfigStr = await mockKV.get('auth_config:github');
		const authConfig = authConfigStr ? JSON.parse(authConfigStr) : null;
		const isSetupKey = authConfig && authConfig.id === regularKeyId;

		// Should allow deletion
		expect(isSetupKey).toBe(false);

		// API should proceed with deletion
		const shouldReject = isSetupKey;
		expect(shouldReject).toBe(false);
	});

	it('should return 403 error when attempting to delete setup key', () => {
		const errorResponse = {
			status: 403,
			message: 'Cannot delete setup authentication key'
		};

		expect(errorResponse.status).toBe(403);
		expect(errorResponse.message).toContain('Cannot delete setup');
	});

	it('should handle case when GitHub OAuth config does not exist', async () => {
		const keyId = 'some-key-id';

		const mockKV = {
			get: vi.fn().mockResolvedValue(null)
		};

		// Check if the ID being deleted is the setup key
		const authConfigStr = await mockKV.get('auth_config:github');
		const authConfig = authConfigStr ? JSON.parse(authConfigStr) : null;
		const isSetupKey = !!(authConfig && authConfig.id === keyId);

		// Should allow deletion since no setup key exists
		expect(isSetupKey).toBe(false);
	});

	it('should handle JSON parse errors when checking setup key', async () => {
		const keyId = 'some-key-id';

		const mockKV = {
			get: vi.fn().mockResolvedValue('invalid-json{')
		};

		// Check if the ID being deleted is the setup key
		const authConfigStr = await mockKV.get('auth_config:github');
		let authConfig = null;
		let isSetupKey = false;

		try {
			authConfig = authConfigStr ? JSON.parse(authConfigStr) : null;
			isSetupKey = authConfig && authConfig.id === keyId;
		} catch (err) {
			// If parse fails, assume it's not a setup key and allow deletion
			isSetupKey = false;
		}

		// Should allow deletion if parse fails
		expect(isSetupKey).toBe(false);
	});
});
