import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Admin Users API - Extended Branch Coverage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	describe('GET /api/admin/users - Error handling', () => {
		it('should return 500 when database is not available', async () => {
			const mockEvent = {
				locals: {
					user: { id: '1', isOwner: true, isAdmin: true }
				},
				platform: {
					env: {}
				}
			};

			const { GET } = await import('../../src/routes/api/admin/users/+server');

			try {
				await GET(mockEvent as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		// D1 returns `results: undefined` for an empty set on some paths; the
		// handler must degrade to an empty list rather than throwing while mapping.
		it('should return an empty list when the query yields no results array', async () => {
			const mockEvent = {
				locals: { user: { id: '1', isOwner: true, isAdmin: true } },
				cookies: { get: vi.fn().mockReturnValue(undefined) },
				platform: {
					env: {
						DB: {
							prepare: vi.fn().mockReturnValue({
								all: vi.fn().mockResolvedValue({})
							})
						}
					}
				}
			};

			const { GET } = await import('../../src/routes/api/admin/users/+server');
			const response = await GET(mockEvent as any);

			await expect(response.json()).resolves.toEqual({ users: [] });
		});

		it('should return 500 when database query fails', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const mockEvent = {
				locals: {
					user: { id: '1', isOwner: true, isAdmin: true }
				},
				platform: {
					env: {
						DB: {
							prepare: vi.fn().mockReturnValue({
								all: vi.fn().mockRejectedValue(new Error('DB Query failed'))
							})
						}
					}
				}
			};

			const { GET } = await import('../../src/routes/api/admin/users/+server');

			try {
				await GET(mockEvent as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}

			consoleSpy.mockRestore();
		});
	});

	describe('POST /api/admin/users - Error handling', () => {
		it('should return 500 when database is not available', async () => {
			const mockEvent = {
				locals: {
					user: { id: '1', isOwner: true, isAdmin: true }
				},
				platform: {
					env: {}
				},
				request: {
					json: vi.fn().mockResolvedValue({
						githubLogin: 'testuser',
						email: 'test@test.com'
					})
				}
			};

			const { POST } = await import('../../src/routes/api/admin/users/+server');

			try {
				await POST(mockEvent as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('should return 400 when UNIQUE constraint is violated', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const uniqueError = new Error('UNIQUE constraint failed');

			const mockEvent = {
				locals: {
					user: { id: '1', isOwner: true, isAdmin: true }
				},
				platform: {
					env: {
						DB: {
							prepare: vi.fn().mockReturnValue({
								bind: vi.fn().mockReturnValue({
									run: vi.fn().mockRejectedValue(uniqueError)
								})
							})
						}
					}
				},
				request: {
					json: vi.fn().mockResolvedValue({
						githubLogin: 'existinguser',
						email: 'existing@test.com'
					})
				}
			};

			const { POST } = await import('../../src/routes/api/admin/users/+server');

			try {
				await POST(mockEvent as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}

			consoleSpy.mockRestore();
		});

		it('should return 500 when general database error occurs', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const mockEvent = {
				locals: {
					user: { id: '1', isOwner: true, isAdmin: true }
				},
				platform: {
					env: {
						DB: {
							prepare: vi.fn().mockReturnValue({
								bind: vi.fn().mockReturnValue({
									run: vi.fn().mockRejectedValue(new Error('Some other DB error'))
								})
							})
						}
					}
				},
				request: {
					json: vi.fn().mockResolvedValue({
						githubLogin: 'testuser',
						email: 'test@test.com'
					})
				}
			};

			const { POST } = await import('../../src/routes/api/admin/users/+server');

			try {
				await POST(mockEvent as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}

			consoleSpy.mockRestore();
		});
	});
});
