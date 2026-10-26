import { describe, expect, it } from 'vitest';
import type { KVNamespace } from '@cloudflare/workers-types';
import {
	MAX_ATTEMPTS,
	clearFailures,
	clientAddress,
	isThrottled,
	recordFailure
} from '../../src/lib/server/login-throttle';

function memoryKv(): KVNamespace {
	const store = new Map<string, string>();
	return {
		get: async (key: string) => store.get(key) ?? null,
		put: async (key: string, value: string) => void store.set(key, value),
		delete: async (key: string) => void store.delete(key)
	} as unknown as KVNamespace;
}

describe('login throttle', () => {
	it('closes after MAX_ATTEMPTS failures and opens again on success', async () => {
		const kv = memoryKv();
		for (let i = 0; i < MAX_ATTEMPTS; i++) {
			expect(await isThrottled(kv, '1.1.1.1', 'a@x.test')).toBe(false);
			await recordFailure(kv, '1.1.1.1', 'a@x.test');
		}
		expect(await isThrottled(kv, '1.1.1.1', 'a@x.test')).toBe(true);
		// Same address, other email: the address is spent.
		expect(await isThrottled(kv, '1.1.1.1', 'b@x.test')).toBe(true);
		// Other address, same email: the email is spent.
		expect(await isThrottled(kv, '2.2.2.2', 'A@X.test')).toBe(true);
		// Other address, other email: free.
		expect(await isThrottled(kv, '2.2.2.2', 'c@x.test')).toBe(false);

		await clearFailures(kv, '1.1.1.1', 'a@x.test');
		expect(await isThrottled(kv, '1.1.1.1', 'a@x.test')).toBe(false);
	});

	it('fails open without KV, or when KV throws', async () => {
		expect(await isThrottled(undefined, 'ip', 'e')).toBe(false);
		await expect(recordFailure(undefined, 'ip', 'e')).resolves.toBeUndefined();
		await expect(clearFailures(undefined, 'ip', 'e')).resolves.toBeUndefined();
		const broken = {
			get: async () => {
				throw new Error('down');
			},
			put: async () => {
				throw new Error('down');
			},
			delete: async () => {
				throw new Error('down');
			}
		} as unknown as KVNamespace;
		expect(await isThrottled(broken, 'ip', 'e')).toBe(false);
		await expect(recordFailure(broken, 'ip', 'e')).resolves.toBeUndefined();
		await expect(clearFailures(broken, 'ip', 'e')).resolves.toBeUndefined();
	});

	it('reads the client address from Cloudflare headers', () => {
		const make = (h: Record<string, string>) => new Request('https://x.test', { headers: h });
		expect(clientAddress(make({ 'cf-connecting-ip': '9.9.9.9' }))).toBe('9.9.9.9');
		expect(clientAddress(make({ 'x-real-ip': '8.8.8.8' }))).toBe('8.8.8.8');
		expect(clientAddress(make({}))).toBe('unknown');
	});
});
