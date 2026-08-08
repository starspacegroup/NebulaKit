import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('logout session revocation', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubGlobal('crypto', webcrypto as Crypto);
	});

	it('revokes the current D1 session before clearing the cookie', async () => {
		const run = vi.fn().mockResolvedValue({ success: true });
		const event = await logoutEvent(run);
		const { POST } = await import('../../src/routes/api/auth/logout/+server');

		await expect(POST(event as never)).rejects.toMatchObject({ status: 302 });
		expect(run).toHaveBeenCalledTimes(1);
		expect(event.cookies.delete).toHaveBeenCalledWith('session', { path: '/' });
	});

	it('still clears the cookie when D1 revocation fails', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const event = await logoutEvent(vi.fn().mockRejectedValue(new Error('D1 unavailable')));
		const { GET } = await import('../../src/routes/api/auth/logout/+server');

		await expect(GET(event as never)).rejects.toMatchObject({ status: 302 });
		expect(event.cookies.delete).toHaveBeenCalledWith('session', { path: '/' });
		expect(consoleSpy).toHaveBeenCalled();
		consoleSpy.mockRestore();
	});
});

async function logoutEvent(run: ReturnType<typeof vi.fn>) {
	const { signValue } = await import('../../src/lib/utils/session');
	return {
		cookies: {
			get: vi
				.fn()
				.mockReturnValue(await signValue({ token: 'opaque-session-token' }, 'test-session-secret')),
			delete: vi.fn()
		},
		platform: {
			env: {
				SESSION_SECRET: 'test-session-secret',
				DB: {
					prepare: vi.fn(() => ({
						bind: vi.fn(() => ({ run }))
					}))
				}
			}
		}
	};
}
