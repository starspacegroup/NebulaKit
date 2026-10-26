import { describe, expect, it, vi } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/lib/utils/passwords';

describe('password hashing', () => {
	it('hashes within the Workers PBKDF2 cap and verifies', async () => {
		const stored = await hashPassword('correct horse battery');
		const iterations = Number(stored.split('$')[1]);
		// Cloudflare Workers throws above 100,000; a higher count passes locally and 500s in production.
		expect(iterations).toBeLessThanOrEqual(100_000);
		expect(await verifyPassword('correct horse battery', stored)).toBe(true);
		expect(await verifyPassword('wrong password!!', stored)).toBe(false);
	});

	it('refuses, without throwing, a stored hash above the cap', async () => {
		const stored = await hashPassword('correct horse battery');
		const [algorithm, , salt, hash] = stored.split('$');
		const over = [algorithm, '310000', salt, hash].join('$');
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(await verifyPassword('correct horse battery', over)).toBe(false);
		expect(error).toHaveBeenCalled();
		error.mockRestore();
	});

	it('rejects malformed hashes', async () => {
		expect(await verifyPassword('x', 'plain')).toBe(false);
		expect(await verifyPassword('x', 'pbkdf2_sha256$abc$00$00')).toBe(false);
		expect(await verifyPassword('x', 'pbkdf2_sha256$0$00$00')).toBe(false);
	});
});
