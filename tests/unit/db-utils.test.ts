import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for Database Utility Functions (db.ts)
 * TDD: Tests for D1 database operations
 */

describe('Database Utilities', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	describe('createUser', () => {
		it('should create a new user and return the created user', async () => {
			const mockUser = {
				id: 'test-uuid',
				email: 'test@example.com',
				name: 'Test User',
				created_at: new Date()
			};

			const mockDb = {
				prepare: vi.fn().mockReturnValue({
					bind: vi.fn().mockReturnValue({
						first: vi.fn().mockResolvedValue(mockUser)
					})
				})
			};

			// Mock crypto.randomUUID
			vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });

			const { createUser } = await import('../../src/lib/utils/db');
			const result = await createUser(mockDb as any, 'test@example.com', 'Test User');

			expect(result).toEqual(mockUser);
			expect(mockDb.prepare).toHaveBeenCalledWith(
				'INSERT INTO users (id, email, name) VALUES (?, ?, ?) RETURNING *'
			);
		});

		it('should throw error if user creation fails', async () => {
			const mockDb = {
				prepare: vi.fn().mockReturnValue({
					bind: vi.fn().mockReturnValue({
						first: vi.fn().mockResolvedValue(null)
					})
				})
			};

			vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });

			const { createUser } = await import('../../src/lib/utils/db');

			await expect(createUser(mockDb as any, 'test@example.com')).rejects.toThrow(
				'Failed to create user'
			);
		});

		it('should create user with null name if not provided', async () => {
			const mockUser = {
				id: 'test-uuid',
				email: 'test@example.com',
				name: null,
				created_at: new Date()
			};

			const mockBind = vi.fn().mockReturnValue({
				first: vi.fn().mockResolvedValue(mockUser)
			});

			const mockDb = {
				prepare: vi.fn().mockReturnValue({
					bind: mockBind
				})
			};

			vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });

			const { createUser } = await import('../../src/lib/utils/db');
			await createUser(mockDb as any, 'test@example.com');

			expect(mockBind).toHaveBeenCalledWith('test-uuid', 'test@example.com', null);
		});
	});

	describe('findUserByEmail', () => {
		it('should return user when found', async () => {
			const mockUser = {
				id: 'user-123',
				email: 'test@example.com',
				name: 'Test User'
			};

			const mockDb = {
				prepare: vi.fn().mockReturnValue({
					bind: vi.fn().mockReturnValue({
						first: vi.fn().mockResolvedValue(mockUser)
					})
				})
			};

			const { findUserByEmail } = await import('../../src/lib/utils/db');
			const result = await findUserByEmail(mockDb as any, 'test@example.com');

			expect(result).toEqual(mockUser);
			expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM users WHERE email = ?');
		});

		it('should return null when user not found', async () => {
			const mockDb = {
				prepare: vi.fn().mockReturnValue({
					bind: vi.fn().mockReturnValue({
						first: vi.fn().mockResolvedValue(null)
					})
				})
			};

			const { findUserByEmail } = await import('../../src/lib/utils/db');
			const result = await findUserByEmail(mockDb as any, 'nonexistent@example.com');

			expect(result).toBeNull();
		});
	});

	describe('findUserById', () => {
		it('should return user when found', async () => {
			const mockUser = {
				id: 'user-123',
				email: 'test@example.com',
				name: 'Test User'
			};

			const mockDb = {
				prepare: vi.fn().mockReturnValue({
					bind: vi.fn().mockReturnValue({
						first: vi.fn().mockResolvedValue(mockUser)
					})
				})
			};

			const { findUserById } = await import('../../src/lib/utils/db');
			const result = await findUserById(mockDb as any, 'user-123');

			expect(result).toEqual(mockUser);
			expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?');
		});

		it('should return null when user not found', async () => {
			const mockDb = {
				prepare: vi.fn().mockReturnValue({
					bind: vi.fn().mockReturnValue({
						first: vi.fn().mockResolvedValue(null)
					})
				})
			};

			const { findUserById } = await import('../../src/lib/utils/db');
			const result = await findUserById(mockDb as any, 'nonexistent-id');

			expect(result).toBeNull();
		});
	});

	describe('createSession', () => {
		it('should create a new session with default expiry', async () => {
			const mockSession = {
				id: 'session-uuid',
				user_id: 'user-123',
				expires_at: new Date()
			};

			const mockDb = {
				prepare: vi.fn().mockReturnValue({
					bind: vi.fn().mockReturnValue({
						first: vi.fn().mockResolvedValue(mockSession)
					})
				})
			};

			vi.stubGlobal('crypto', { randomUUID: () => 'session-uuid' });

			const { createSession } = await import('../../src/lib/utils/db');
			const result = await createSession(mockDb as any, 'user-123');

			expect(result).toEqual(mockSession);
			expect(mockDb.prepare).toHaveBeenCalledWith(
				'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?) RETURNING *'
			);
		});

		it('should create session with custom expiry days', async () => {
			const mockSession = {
				id: 'session-uuid',
				user_id: 'user-123',
				expires_at: new Date()
			};

			const mockBind = vi.fn().mockReturnValue({
				first: vi.fn().mockResolvedValue(mockSession)
			});

			const mockDb = {
				prepare: vi.fn().mockReturnValue({
					bind: mockBind
				})
			};

			vi.stubGlobal('crypto', { randomUUID: () => 'session-uuid' });

			const { createSession } = await import('../../src/lib/utils/db');
			await createSession(mockDb as any, 'user-123', 7);

			// Check that bind was called with correct arguments
			expect(mockBind).toHaveBeenCalled();
			const bindArgs = mockBind.mock.calls[0];
			expect(bindArgs[0]).toBe('session-uuid');
			expect(bindArgs[1]).toBe('user-123');
			// Third arg is the expiry date string
			expect(typeof bindArgs[2]).toBe('string');
		});

		it('should throw error if session creation fails', async () => {
			const mockDb = {
				prepare: vi.fn().mockReturnValue({
					bind: vi.fn().mockReturnValue({
						first: vi.fn().mockResolvedValue(null)
					})
				})
			};

			vi.stubGlobal('crypto', { randomUUID: () => 'session-uuid' });

			const { createSession } = await import('../../src/lib/utils/db');

			await expect(createSession(mockDb as any, 'user-123')).rejects.toThrow(
				'Failed to create session'
			);
		});
	});

	describe('findValidSession', () => {
		it('should return session when found and valid', async () => {
			const mockSession = {
				id: 'session-123',
				user_id: 'user-123',
				expires_at: new Date()
			};

			const mockDb = {
				prepare: vi.fn().mockReturnValue({
					bind: vi.fn().mockReturnValue({
						first: vi.fn().mockResolvedValue(mockSession)
					})
				})
			};

			const { findValidSession } = await import('../../src/lib/utils/db');
			const result = await findValidSession(mockDb as any, 'session-123');

			expect(result).toEqual(mockSession);
			expect(mockDb.prepare).toHaveBeenCalledWith(
				'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
			);
		});

		it('should return null when session not found or expired', async () => {
			const mockDb = {
				prepare: vi.fn().mockReturnValue({
					bind: vi.fn().mockReturnValue({
						first: vi.fn().mockResolvedValue(null)
					})
				})
			};

			const { findValidSession } = await import('../../src/lib/utils/db');
			const result = await findValidSession(mockDb as any, 'expired-session');

			expect(result).toBeNull();
		});
	});

	describe('deleteSession', () => {
		it('should delete session by ID', async () => {
			const mockRun = vi.fn().mockResolvedValue(undefined);

			const mockDb = {
				prepare: vi.fn().mockReturnValue({
					bind: vi.fn().mockReturnValue({
						run: mockRun
					})
				})
			};

			const { deleteSession } = await import('../../src/lib/utils/db');
			await deleteSession(mockDb as any, 'session-123');

			expect(mockDb.prepare).toHaveBeenCalledWith('DELETE FROM sessions WHERE id = ?');
			expect(mockRun).toHaveBeenCalled();
		});
	});

	describe('cleanupExpiredSessions', () => {
		it('should delete all expired sessions', async () => {
			const mockRun = vi.fn().mockResolvedValue(undefined);

			const mockDb = {
				prepare: vi.fn().mockReturnValue({
					run: mockRun
				})
			};

			const { cleanupExpiredSessions } = await import('../../src/lib/utils/db');
			await cleanupExpiredSessions(mockDb as any);

			expect(mockDb.prepare).toHaveBeenCalledWith(
				'DELETE FROM sessions WHERE expires_at < datetime("now")'
			);
			expect(mockRun).toHaveBeenCalled();
		});
	});
});
