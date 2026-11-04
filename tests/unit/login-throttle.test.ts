import { describe, expect, it } from 'vitest';
import type { KVNamespace } from '@cloudflare/workers-types';
import {
	EMAIL_MAX_ATTEMPTS,
	MAX_ATTEMPTS,
	WINDOW_SECONDS,
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
	it('closes an address after MAX_ATTEMPTS failures; a success does not reopen it', async () => {
		const kv = memoryKv();
		for (let i = 0; i < MAX_ATTEMPTS; i++) {
			expect(await isThrottled(kv, '1.1.1.1', 'a@x.test')).toBe(false);
			await recordFailure(kv, '1.1.1.1', 'a@x.test');
		}
		expect(await isThrottled(kv, '1.1.1.1', 'a@x.test')).toBe(true);
		// Same address, other email: the address is spent.
		expect(await isThrottled(kv, '1.1.1.1', 'b@x.test')).toBe(true);
		// Other address, same email: the owner is NOT locked out (cx_lockout_from_other_ip).
		expect(await isThrottled(kv, '2.2.2.2', 'A@X.test')).toBe(false);

		// Logging in to some account does not reset the address's budget.
		await clearFailures(kv, '1.1.1.1', 'a@x.test');
		expect(await isThrottled(kv, '1.1.1.1', 'a@x.test')).toBe(true);
	});

	it('closes an email after EMAIL_MAX_ATTEMPTS failures from many addresses', async () => {
		const kv = memoryKv();
		const now = 1_000_000;
		for (let i = 0; i < EMAIL_MAX_ATTEMPTS; i++) {
			const ip = `10.0.${Math.floor(i / MAX_ATTEMPTS)}.1`;
			expect(await isThrottled(kv, ip, 'v@x.test', now)).toBe(false);
			await recordFailure(kv, ip, 'v@x.test', now);
		}
		expect(await isThrottled(kv, '9.9.9.9', 'v@x.test', now)).toBe(true);
		// The email window is fixed at the first failure, then lapses.
		expect(await isThrottled(kv, '9.9.9.9', 'v@x.test', now + WINDOW_SECONDS)).toBe(false);
		// A success clears the email brake.
		await clearFailures(kv, '9.9.9.9', 'v@x.test');
		expect(await isThrottled(kv, '9.9.9.9', 'v@x.test', now)).toBe(false);
	});

	it('a later failure does not extend the email window', async () => {
		const kv = memoryKv();
		await recordFailure(kv, '1.1.1.1', 'w@x.test', 100);
		await recordFailure(kv, '2.2.2.2', 'w@x.test', 100 + WINDOW_SECONDS - 1);
		const raw = await kv.get('login_attempts:email:w@x.test');
		expect(raw).toBe(`2:${100 + WINDOW_SECONDS}`);
		await recordFailure(kv, '3.3.3.3', 'w@x.test', 100 + WINDOW_SECONDS);
		expect(await kv.get('login_attempts:email:w@x.test')).toBe(`1:${100 + 2 * WINDOW_SECONDS}`);
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
