import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Extended tests for Admin Users API endpoints
 * TDD: Tests for user search and individual user management
 */

describe('Admin Users Extended API', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	describe('GET /api/admin/users/search', () => {
		it('should return 401 when user is not authenticated', async () => {
			const { GET } = await import('../../src/routes/api/admin/users/search/+server');

			await expect(
				GET({
					url: new URL('http://localhost/api/admin/users/search?q=test'),
					locals: {},
					fetch: vi.fn()
				} as any)
			).rejects.toThrow();
		});

		it('should return 403 when user is not admin', async () => {
			const { GET } = await import('../../src/routes/api/admin/users/search/+server');

			await expect(
				GET({
					url: new URL('http://localhost/api/admin/users/search?q=test'),
					locals: { user: { id: '1', isOwner: false, isAdmin: false } },
					fetch: vi.fn()
				} as any)
			).rejects.toThrow();
		});

		it('should return empty array when query is too short', async () => {
			const { GET } = await import('../../src/routes/api/admin/users/search/+server');

			const response = await GET({
				url: new URL('http://localhost/api/admin/users/search?q=a'),
				locals: { user: { id: '1', isOwner: true } },
				fetch: vi.fn()
			} as any);

			const result = await response.json();
			expect(result.users).toEqual([]);
		});

		it('should return empty array when query is empty', async () => {
			const { GET } = await import('../../src/routes/api/admin/users/search/+server');

			const response = await GET({
				url: new URL('http://localhost/api/admin/users/search'),
				locals: { user: { id: '1', isOwner: true } },
				fetch: vi.fn()
			} as any);

			const result = await response.json();
			expect(result.users).toEqual([]);
		});

		it('should search GitHub users when query is valid', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue({
					items: [
						{
							login: 'testuser1',
							id: 1,
							avatar_url: 'https://example.com/1.jpg',
							html_url: 'https://github.com/testuser1'
						},
						{
							login: 'testuser2',
							id: 2,
							avatar_url: 'https://example.com/2.jpg',
							html_url: 'https://github.com/testuser2'
						}
					]
				})
			});

			const { GET } = await import('../../src/routes/api/admin/users/search/+server');

			const response = await GET({
				url: new URL('http://localhost/api/admin/users/search?q=testuser'),
				locals: { user: { id: '1', isOwner: true } },
				fetch: mockFetch
			} as any);

			const result = await response.json();
			expect(result.users).toHaveLength(2);
			expect(result.users[0].login).toBe('testuser1');
		});

		it('should handle GitHub API errors', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500
			});

			const { GET } = await import('../../src/routes/api/admin/users/search/+server');

			await expect(
				GET({
					url: new URL('http://localhost/api/admin/users/search?q=testuser'),
					locals: { user: { id: '1', isOwner: true } },
					fetch: mockFetch
				} as any)
			).rejects.toThrow();
		});

		it('should allow admin users to search', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue({ items: [] })
			});

			const { GET } = await import('../../src/routes/api/admin/users/search/+server');

			const response = await GET({
				url: new URL('http://localhost/api/admin/users/search?q=test'),
				locals: { user: { id: '1', isOwner: false, isAdmin: true } },
				fetch: mockFetch
			} as any);

			const result = await response.json();
			expect(result.users).toEqual([]);
		});
	});

	describe('PATCH /api/admin/users/[id]', () => {
		it('should return 401 when user is not authenticated', async () => {
			const { PATCH } = await import('../../src/routes/api/admin/users/[id]/+server');

			await expect(
				PATCH({
					params: { id: 'user-123' },
					request: { json: vi.fn().mockResolvedValue({ isAdmin: true }) },
					locals: {},
					platform: {}
				} as any)
			).rejects.toThrow();
		});

		it('should return 403 when user is not admin', async () => {
			const { PATCH } = await import('../../src/routes/api/admin/users/[id]/+server');

			await expect(
				PATCH({
					params: { id: 'user-123' },
					request: { json: vi.fn().mockResolvedValue({ isAdmin: true }) },
					locals: { user: { id: '1', isOwner: false, isAdmin: false } },
					platform: {}
				} as any)
			).rejects.toThrow();
		});

		it('should return 400 when isAdmin is not boolean', async () => {
			const { PATCH } = await import('../../src/routes/api/admin/users/[id]/+server');

			await expect(
				PATCH({
					params: { id: 'user-123' },
					request: { json: vi.fn().mockResolvedValue({ isAdmin: 'yes' }) },
					locals: { user: { id: 'admin-1', isOwner: true } },
					platform: {}
				} as any)
			).rejects.toThrow();
		});

		it('should return 500 when database is not available', async () => {
			const { PATCH } = await import('../../src/routes/api/admin/users/[id]/+server');

			await expect(
				PATCH({
					params: { id: 'user-123' },
					request: { json: vi.fn().mockResolvedValue({ isAdmin: true }) },
					locals: { user: { id: 'admin-1', isOwner: true } },
					platform: { env: {} }
				} as any)
			).rejects.toThrow();
		});

		it('should return 404 when user not found', async () => {
			const mockDb = {
				prepare: vi.fn().mockReturnValue({
					bind: vi.fn().mockReturnThis(),
					first: vi.fn().mockResolvedValue(null)
				})
			};

			const { PATCH } = await import('../../src/routes/api/admin/users/[id]/+server');

			await expect(
				PATCH({
					params: { id: 'nonexistent-user' },
					request: { json: vi.fn().mockResolvedValue({ isAdmin: true }) },
					locals: { user: { id: 'admin-1', isOwner: true } },
					platform: { env: { DB: mockDb } }
				} as any)
			).rejects.toThrow();
		});

		it('should return 400 when trying to modify self', async () => {
			const mockDb = {
				prepare: vi.fn().mockReturnValue({
					bind: vi.fn().mockReturnThis(),
					first: vi.fn().mockResolvedValue({ id: 'admin-1', email: 'admin@test.com' })
				})
			};

			const { PATCH } = await import('../../src/routes/api/admin/users/[id]/+server');

			await expect(
				PATCH({
					params: { id: 'admin-1' },
					request: { json: vi.fn().mockResolvedValue({ isAdmin: false }) },
					locals: { user: { id: 'admin-1', isOwner: true } },
					platform: { env: { DB: mockDb } }
				} as any)
			).rejects.toThrow();
		});

		it('should successfully promote user to admin', async () => {
			const mockRun = vi.fn().mockResolvedValue({});
			const mockDb = {
				prepare: vi.fn().mockReturnValue({
					bind: vi.fn().mockReturnThis(),
					first: vi.fn().mockResolvedValue({ id: 'user-123', email: 'user@test.com' }),
					run: mockRun
				})
			};

			const { PATCH } = await import('../../src/routes/api/admin/users/[id]/+server');

			const response = await PATCH({
				params: { id: 'user-123' },
				request: { json: vi.fn().mockResolvedValue({ isAdmin: true }) },
				locals: { user: { id: 'admin-1', isOwner: true } },
				platform: { env: { DB: mockDb, KV: { get: vi.fn().mockResolvedValue(null) } } }
			} as any);

			const result = await response.json();
			expect(result.success).toBe(true);
			expect(result.message).toContain('promoted');
		});

		it('should prevent demoting setup owner', async () => {
			const mockDb = {
				prepare: vi.fn().mockReturnValue({
					bind: vi.fn().mockReturnThis(),
					first: vi.fn().mockResolvedValue({ id: 'owner-123', email: 'owner@test.com' })
				})
			};

			const mockKV = {
				get: vi.fn().mockResolvedValue(JSON.stringify({ ownerEmail: 'owner@test.com' }))
			};

			const { PATCH } = await import('../../src/routes/api/admin/users/[id]/+server');

			await expect(
				PATCH({
					params: { id: 'owner-123' },
					request: { json: vi.fn().mockResolvedValue({ isAdmin: false }) },
					locals: { user: { id: 'admin-1', isOwner: true } },
					platform: { env: { DB: mockDb, KV: mockKV } }
				} as any)
			).rejects.toThrow();
		});
	});

	describe('DELETE /api/admin/users/[id]', () => {
		it('should return 401 when user is not authenticated', async () => {
			const { DELETE } = await import('../../src/routes/api/admin/users/[id]/+server');

			await expect(
				DELETE({
					params: { id: 'user-123' },
					locals: {},
					platform: {}
				} as any)
			).rejects.toThrow();
		});

		it('should return 403 when user is not admin', async () => {
			const { DELETE } = await import('../../src/routes/api/admin/users/[id]/+server');

			await expect(
				DELETE({
					params: { id: 'user-123' },
					locals: { user: { id: '1', isOwner: false, isAdmin: false } },
					platform: {}
				} as any)
			).rejects.toThrow();
		});

		it('should return 400 when trying to delete self', async () => {
			const mockDb = {
				prepare: vi.fn().mockReturnValue({
					bind: vi.fn().mockReturnThis(),
					first: vi.fn().mockResolvedValue({ id: 'admin-1', email: 'admin@test.com' })
				})
			};

			const { DELETE } = await import('../../src/routes/api/admin/users/[id]/+server');

			await expect(
				DELETE({
					params: { id: 'admin-1' },
					locals: { user: { id: 'admin-1', isOwner: true } },
					platform: { env: { DB: mockDb } }
				} as any)
			).rejects.toThrow();
		});

		it('should return 404 when user not found', async () => {
			const mockDb = {
				prepare: vi.fn().mockReturnValue({
					bind: vi.fn().mockReturnThis(),
					first: vi.fn().mockResolvedValue(null)
				})
			};

			const { DELETE } = await import('../../src/routes/api/admin/users/[id]/+server');

			await expect(
				DELETE({
					params: { id: 'nonexistent' },
					locals: { user: { id: 'admin-1', isOwner: true } },
					platform: { env: { DB: mockDb } }
				} as any)
			).rejects.toThrow();
		});

		it('should prevent deleting setup owner', async () => {
			const mockDb = {
				prepare: vi.fn().mockReturnValue({
					bind: vi.fn().mockReturnThis(),
					first: vi.fn().mockResolvedValue({ id: 'owner-123', email: 'owner@test.com' })
				})
			};

			const mockKV = {
				get: vi.fn().mockResolvedValue(JSON.stringify({ ownerEmail: 'owner@test.com' }))
			};

			const { DELETE } = await import('../../src/routes/api/admin/users/[id]/+server');

			await expect(
				DELETE({
					params: { id: 'owner-123' },
					locals: { user: { id: 'admin-1', isOwner: true } },
					platform: { env: { DB: mockDb, KV: mockKV } }
				} as any)
			).rejects.toThrow();
		});

		it('should successfully delete user', async () => {
			const mockRun = vi.fn().mockResolvedValue({});
			const mockDb = {
				prepare: vi.fn().mockReturnValue({
					bind: vi.fn().mockReturnThis(),
					first: vi.fn().mockResolvedValue({ id: 'user-123', email: 'user@test.com' }),
					run: mockRun
				})
			};

			const { DELETE } = await import('../../src/routes/api/admin/users/[id]/+server');

			const response = await DELETE({
				params: { id: 'user-123' },
				locals: { user: { id: 'admin-1', isOwner: true } },
				platform: { env: { DB: mockDb, KV: { get: vi.fn().mockResolvedValue(null) } } }
			} as any);

			const result = await response.json();
			expect(result.success).toBe(true);
			expect(result.message).toContain('deleted');
		});
	});
});
