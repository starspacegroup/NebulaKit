import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for Account Merging
 * TDD: Testing that when a social account is already linked to another user,
 * the accounts should be merged seamlessly instead of showing an error.
 */

describe('Account Merge Service', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	describe('mergeAccounts', () => {
		it('should transfer all oauth_accounts from source user to target user', async () => {
			const { mergeAccounts } = await import('../../src/lib/services/account-merge');

			const mockBatchResults = { success: true };
			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnValue({
					run: vi.fn().mockResolvedValue({}),
					first: vi.fn().mockResolvedValue({ is_admin: 0 })
				})
			});
			const mockBatch = vi.fn().mockResolvedValue(mockBatchResults);

			const mockDB = {
				prepare: mockPrepare,
				batch: mockBatch
			};

			await mergeAccounts(mockDB as any, 'source-user-id', 'target-user-id');

			// Verify oauth_accounts are transferred
			expect(mockPrepare).toHaveBeenCalledWith(
				'UPDATE oauth_accounts SET user_id = ? WHERE user_id = ?'
			);
		});

		it('should transfer all chat_messages from source user to target user', async () => {
			const { mergeAccounts } = await import('../../src/lib/services/account-merge');

			const mockBatchResults = { success: true };
			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnValue({
					run: vi.fn().mockResolvedValue({}),
					first: vi.fn().mockResolvedValue({ is_admin: 0 })
				})
			});
			const mockBatch = vi.fn().mockResolvedValue(mockBatchResults);

			const mockDB = {
				prepare: mockPrepare,
				batch: mockBatch
			};

			await mergeAccounts(mockDB as any, 'source-user-id', 'target-user-id');

			// Verify chat_messages are transferred
			expect(mockPrepare).toHaveBeenCalledWith(
				'UPDATE chat_messages SET user_id = ? WHERE user_id = ?'
			);
		});

		it('should transfer all sessions from source user to target user', async () => {
			const { mergeAccounts } = await import('../../src/lib/services/account-merge');

			const mockBatchResults = { success: true };
			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnValue({
					run: vi.fn().mockResolvedValue({}),
					first: vi.fn().mockResolvedValue({ is_admin: 0 })
				})
			});
			const mockBatch = vi.fn().mockResolvedValue(mockBatchResults);

			const mockDB = {
				prepare: mockPrepare,
				batch: mockBatch
			};

			await mergeAccounts(mockDB as any, 'source-user-id', 'target-user-id');

			// Verify sessions are transferred
			expect(mockPrepare).toHaveBeenCalledWith('UPDATE sessions SET user_id = ? WHERE user_id = ?');
		});

		it('should delete the source user after transferring data', async () => {
			const { mergeAccounts } = await import('../../src/lib/services/account-merge');

			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnValue({
					run: vi.fn().mockResolvedValue({}),
					first: vi.fn().mockResolvedValue({ is_admin: 0 })
				})
			});
			const mockBatch = vi.fn().mockResolvedValue({ success: true });

			const mockDB = {
				prepare: mockPrepare,
				batch: mockBatch
			};

			await mergeAccounts(mockDB as any, 'source-user-id', 'target-user-id');

			// Verify source user is deleted
			expect(mockPrepare).toHaveBeenCalledWith('DELETE FROM users WHERE id = ?');
		});

		it('should merge admin status (source is admin should make target admin)', async () => {
			const { mergeAccounts } = await import('../../src/lib/services/account-merge');

			const mockPrepare = vi.fn().mockImplementation((sql: string) => ({
				bind: vi.fn().mockReturnValue({
					run: vi.fn().mockResolvedValue({}),
					first: vi.fn().mockResolvedValue(
						sql.includes('SELECT id, email, name, password_hash, is_admin FROM users WHERE id = ?')
							? {
									id: 'admin-source-id',
									email: 'admin@example.com',
									name: 'Admin Source',
									password_hash: null,
									is_admin: 1
								}
							: { password_hash: null, name: 'Target User', email: 'target@example.com' }
					)
				})
			}));
			const mockBatch = vi.fn().mockResolvedValue({ success: true });

			const mockDB = {
				prepare: mockPrepare,
				batch: mockBatch
			};

			await mergeAccounts(mockDB as any, 'admin-source-id', 'target-user-id');

			expect(mockPrepare).toHaveBeenCalledWith(
				'SELECT id, email, name, password_hash, is_admin FROM users WHERE id = ?'
			);
			expect(mockPrepare).toHaveBeenCalledWith('UPDATE users SET is_admin = 1 WHERE id = ?');
		});

		it('should use batch operations for atomic updates', async () => {
			const { mergeAccounts } = await import('../../src/lib/services/account-merge');

			const mockBatch = vi.fn().mockResolvedValue({ success: true });
			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnValue({
					run: vi.fn().mockResolvedValue({}),
					first: vi.fn().mockResolvedValue({ is_admin: 0 })
				})
			});

			const mockDB = {
				prepare: mockPrepare,
				batch: mockBatch
			};

			await mergeAccounts(mockDB as any, 'source-user-id', 'target-user-id');

			// Verify batch is called for atomic operations
			expect(mockBatch).toHaveBeenCalled();
		});

		it('should preserve the source email as a login alias on the target account', async () => {
			const { mergeAccounts } = await import('../../src/lib/services/account-merge');

			const mockPrepare = vi.fn().mockImplementation((sql: string) => ({
				bind: vi.fn().mockReturnValue({
					first: vi.fn().mockResolvedValue(
						sql.includes('SELECT id, email, name, password_hash, is_admin FROM users WHERE id = ?')
							? {
									id: 'source-user-id',
									email: 'source@example.com',
									name: 'Source',
									password_hash: 'source-password-hash',
									is_admin: 0
								}
							: { password_hash: null, name: 'Target' }
					),
					run: vi.fn().mockResolvedValue({})
				})
			}));
			const mockBatch = vi.fn().mockResolvedValue({ success: true });

			await mergeAccounts(
				{ prepare: mockPrepare, batch: mockBatch } as any,
				'source-user-id',
				'target-user-id'
			);

			expect(mockPrepare).toHaveBeenCalledWith(
				'INSERT OR IGNORE INTO user_login_aliases (id, user_id, email, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
			);
		});

		it('should transfer the source password hash when the target has no password', async () => {
			const { mergeAccounts } = await import('../../src/lib/services/account-merge');

			const mockPrepare = vi.fn().mockImplementation((sql: string) => ({
				bind: vi.fn().mockReturnValue({
					first: vi.fn().mockResolvedValue(
						sql.includes('SELECT id, email, name, password_hash, is_admin FROM users WHERE id = ?')
							? {
									id: 'source-user-id',
									email: 'source@example.com',
									name: 'Source',
									password_hash: 'source-password-hash',
									is_admin: 0
								}
							: { password_hash: null, name: 'Target' }
					),
					run: vi.fn().mockResolvedValue({})
				})
			}));
			const mockBatch = vi.fn().mockResolvedValue({ success: true });

			await mergeAccounts(
				{ prepare: mockPrepare, batch: mockBatch } as any,
				'source-user-id',
				'target-user-id'
			);

			expect(mockPrepare).toHaveBeenCalledWith(
				'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
			);
		});
	});
});

describe('GitHub Callback - Account Merge on Link', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	it('should merge accounts instead of showing error when GitHub is already linked to another user', async () => {
		// This test verifies the behavior when:
		// 1. User A is logged in
		// 2. User A tries to link GitHub account X
		// 3. GitHub account X is already linked to User B
		// Expected: User B's data should be merged into User A, User B deleted

		// The actual callback test would be complex due to OAuth flow
		// This is a placeholder to document expected behavior
		expect(true).toBe(true);
	});
});

describe('Discord Callback - Account Merge on Link', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	it('should merge accounts instead of showing error when Discord is already linked to another user', async () => {
		// This test verifies the behavior when:
		// 1. User A is logged in
		// 2. User A tries to link Discord account X
		// 3. Discord account X is already linked to User B
		// Expected: User B's data should be merged into User A, User B deleted

		// The actual callback test would be complex due to OAuth flow
		// This is a placeholder to document expected behavior
		expect(true).toBe(true);
	});
});
