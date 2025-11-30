import { describe, expect, it, vi } from 'vitest';
import { createMockPlatform, mockUser } from '../fixtures';

// This is an example of how to test database utilities
describe('Database Utilities', () => {
	it('should query database with parameterized queries', async () => {
		const platform = createMockPlatform();

		// Example test for a database query function
		const query = 'SELECT * FROM users WHERE id = ?';
		const result = await platform.env.DB.prepare(query).bind('1').first();

		expect(result).toEqual(mockUser);
	});

	it('should handle database errors gracefully', async () => {
		const platform = createMockPlatform();

		// Mock a database error
		platform.env.DB.prepare = vi.fn().mockImplementation(() => {
			throw new Error('Database error');
		});

		// Test error handling in your code
		await expect(async () => {
			platform.env.DB.prepare('SELECT * FROM users').first();
		}).rejects.toThrow('Database error');
	});

	it('should use transactions for related operations', async () => {
		const platform = createMockPlatform();

		const statements = [
			platform.env.DB.prepare('INSERT INTO users (name) VALUES (?)').bind('John'),
			platform.env.DB.prepare('INSERT INTO profiles (user_id) VALUES (?)').bind('1')
		];

		const results = await platform.env.DB.batch(statements);
		expect(results).toHaveLength(2);
		expect(results[0].success).toBe(true);
	});
});
