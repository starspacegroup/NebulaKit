/**
 * Tests for admin page server load functions
 * These test the +page.server.ts files for admin pages
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock types for PageServerLoad
interface MockLoadEvent {
	fetch: ReturnType<typeof vi.fn>;
}

describe('Admin AI Keys Page Server', () => {
	let mockFetch: ReturnType<typeof vi.fn>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let load: any;

	beforeEach(async () => {
		vi.resetModules();
		mockFetch = vi.fn();

		// Dynamic import to get fresh module
		const module = await import('../../src/routes/admin/ai-keys/+page.server');
		load = module.load;
	});

	it('should return keys when fetch is successful', async () => {
		const mockKeys = [
			{ id: '1', name: 'OpenAI Key', provider: 'openai' },
			{ id: '2', name: 'Anthropic Key', provider: 'anthropic' }
		];

		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ keys: mockKeys })
		});

		const result = await load({ fetch: mockFetch });

		expect(result.keys).toEqual(mockKeys);
		expect(mockFetch).toHaveBeenCalledWith('/api/admin/ai-keys');
	});

	it('should return empty keys when fetch fails', async () => {
		mockFetch.mockResolvedValue({
			ok: false
		});

		const result = await load({ fetch: mockFetch });

		expect(result.keys).toEqual([]);
	});

	it('should return empty keys when fetch throws error', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		mockFetch.mockRejectedValue(new Error('Network error'));

		const result = await load({ fetch: mockFetch });

		expect(result.keys).toEqual([]);
		expect(consoleSpy).toHaveBeenCalledWith('Failed to load AI keys:', expect.any(Error));
		consoleSpy.mockRestore();
	});

	it('should return empty array when response has no keys property', async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({})
		});

		const result = await load({ fetch: mockFetch });

		expect(result.keys).toEqual([]);
	});
});

describe('Admin Auth Keys Page Server', () => {
	let mockFetch: ReturnType<typeof vi.fn>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let load: any;

	beforeEach(async () => {
		vi.resetModules();
		mockFetch = vi.fn();

		const module = await import('../../src/routes/admin/auth-keys/+page.server');
		load = module.load;
	});

	it('should return keys when fetch is successful', async () => {
		const mockKeys = [
			{ id: '1', name: 'github_client_id', value: 'abc123' },
			{ id: '2', name: 'github_client_secret', value: 'secret' }
		];

		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ keys: mockKeys })
		});

		const result = await load({ fetch: mockFetch });

		expect(result.keys).toEqual(mockKeys);
		expect(mockFetch).toHaveBeenCalledWith('/api/admin/auth-keys');
	});

	it('should return empty keys when fetch fails', async () => {
		mockFetch.mockResolvedValue({
			ok: false
		});

		const result = await load({ fetch: mockFetch });

		expect(result.keys).toEqual([]);
	});

	it('should return empty keys when fetch throws error', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		mockFetch.mockRejectedValue(new Error('Network error'));

		const result = await load({ fetch: mockFetch });

		expect(result.keys).toEqual([]);
		expect(consoleSpy).toHaveBeenCalledWith('Failed to load auth keys:', expect.any(Error));
		consoleSpy.mockRestore();
	});

	it('should return empty array when response has no keys property', async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({})
		});

		const result = await load({ fetch: mockFetch });

		expect(result.keys).toEqual([]);
	});
});

describe('Admin Users Page Server', () => {
	let mockFetch: ReturnType<typeof vi.fn>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let load: any;

	beforeEach(async () => {
		vi.resetModules();
		mockFetch = vi.fn();

		const module = await import('../../src/routes/admin/users/+page.server');
		load = module.load;
	});

	it('should return users when fetch is successful', async () => {
		const mockUsers = [
			{ id: '1', name: 'Admin User', role: 'admin' },
			{ id: '2', name: 'Regular User', role: 'user' }
		];

		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ users: mockUsers })
		});

		const result = await load({ fetch: mockFetch });

		expect(result.users).toEqual(mockUsers);
		expect(mockFetch).toHaveBeenCalledWith('/api/admin/users');
	});

	it('should return empty users when fetch fails', async () => {
		mockFetch.mockResolvedValue({
			ok: false
		});

		const result = await load({ fetch: mockFetch });

		expect(result.users).toEqual([]);
	});

	it('should return empty users when fetch throws error', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		mockFetch.mockRejectedValue(new Error('Network error'));

		const result = await load({ fetch: mockFetch });

		expect(result.users).toEqual([]);
		expect(consoleSpy).toHaveBeenCalledWith('Failed to load users:', expect.any(Error));
		consoleSpy.mockRestore();
	});

	it('should return empty array when response has no users property', async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({})
		});

		const result = await load({ fetch: mockFetch });

		expect(result.users).toEqual([]);
	});
});
