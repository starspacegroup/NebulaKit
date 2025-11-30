/**
 * Extended tests for AI provider status endpoint
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../../src/routes/api/admin/ai-keys/status/+server';

describe('AI Keys Status API - Extended Coverage', () => {
	let mockKVGet: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockKVGet = vi.fn();
	});

	const createMockEvent = (
		overrides: {
			kvGet?: ReturnType<typeof vi.fn>;
			platform?: object | null;
		} = {}
	) => ({
		platform:
			overrides.platform !== null
				? {
						env: {
							KV: { get: overrides.kvGet || mockKVGet }
						}
					}
				: overrides.platform,
		locals: {},
		url: new URL('http://localhost/api/admin/ai-keys/status')
	});

	it('should return hasProviders: false when KV is not available', async () => {
		const event = {
			platform: undefined,
			locals: {},
			url: new URL('http://localhost/api/admin/ai-keys/status')
		};

		const response = await GET(event as unknown as Parameters<typeof GET>[0]);
		const data = await response.json();

		expect(data.hasProviders).toBe(false);
	});

	it('should return hasProviders: false when ai_keys_list is null', async () => {
		mockKVGet.mockResolvedValue(null);

		const response = await GET(createMockEvent() as unknown as Parameters<typeof GET>[0]);
		const data = await response.json();

		expect(data.hasProviders).toBe(false);
		expect(mockKVGet).toHaveBeenCalledWith('ai_keys_list');
	});

	it('should return hasProviders: true when at least one key is enabled', async () => {
		mockKVGet
			.mockResolvedValueOnce(JSON.stringify(['key1', 'key2']))
			.mockResolvedValueOnce(JSON.stringify({ id: 'key1', name: 'Test', enabled: true }));

		const response = await GET(createMockEvent() as unknown as Parameters<typeof GET>[0]);
		const data = await response.json();

		expect(data.hasProviders).toBe(true);
	});

	it('should return hasProviders: true when key has no enabled property (defaults to enabled)', async () => {
		mockKVGet
			.mockResolvedValueOnce(JSON.stringify(['key1']))
			.mockResolvedValueOnce(JSON.stringify({ id: 'key1', name: 'Test' }));

		const response = await GET(createMockEvent() as unknown as Parameters<typeof GET>[0]);
		const data = await response.json();

		expect(data.hasProviders).toBe(true);
	});

	it('should return hasProviders: false when all keys are disabled', async () => {
		mockKVGet
			.mockResolvedValueOnce(JSON.stringify(['key1', 'key2']))
			.mockResolvedValueOnce(JSON.stringify({ id: 'key1', enabled: false }))
			.mockResolvedValueOnce(JSON.stringify({ id: 'key2', enabled: false }));

		const response = await GET(createMockEvent() as unknown as Parameters<typeof GET>[0]);
		const data = await response.json();

		expect(data.hasProviders).toBe(false);
	});

	it('should skip keys that return null data', async () => {
		mockKVGet
			.mockResolvedValueOnce(JSON.stringify(['key1', 'key2']))
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(JSON.stringify({ id: 'key2', enabled: true }));

		const response = await GET(createMockEvent() as unknown as Parameters<typeof GET>[0]);
		const data = await response.json();

		expect(data.hasProviders).toBe(true);
	});

	it('should return hasProviders: false when exception is thrown', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		mockKVGet.mockRejectedValue(new Error('KV error'));

		const response = await GET(createMockEvent() as unknown as Parameters<typeof GET>[0]);
		const data = await response.json();

		expect(data.hasProviders).toBe(false);
		expect(consoleSpy).toHaveBeenCalled();
		consoleSpy.mockRestore();
	});

	it('should handle empty key list', async () => {
		mockKVGet.mockResolvedValueOnce(JSON.stringify([]));

		const response = await GET(createMockEvent() as unknown as Parameters<typeof GET>[0]);
		const data = await response.json();

		expect(data.hasProviders).toBe(false);
	});

	it('should handle platform with null env', async () => {
		const event = {
			platform: { env: null },
			locals: {},
			url: new URL('http://localhost/api/admin/ai-keys/status')
		};

		const response = await GET(event as unknown as Parameters<typeof GET>[0]);
		const data = await response.json();

		expect(data.hasProviders).toBe(false);
	});
});
