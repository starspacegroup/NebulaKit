import { describe, expect, it, vi } from 'vitest';
import { verifyTurnstile, turnstileEnabled } from './turnstile';

function jsonResponse(body: unknown, ok = true): Response {
	return { ok, json: async () => body } as unknown as Response;
}

describe('turnstileEnabled', () => {
	it('is true only when a secret key is present', () => {
		expect(turnstileEnabled('secret')).toBe(true);
		expect(turnstileEnabled('')).toBe(false);
		expect(turnstileEnabled(undefined)).toBe(false);
		expect(turnstileEnabled(null)).toBe(false);
	});
});

describe('verifyTurnstile', () => {
	it('returns false immediately when no token is supplied (no network call)', async () => {
		const fetchImpl = vi.fn();
		expect(
			await verifyTurnstile({ secretKey: 's', token: null, fetchImpl: fetchImpl as never })
		).toBe(false);
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it('returns true on a successful verification and forwards secret/token/ip', async () => {
		const fetchImpl = vi.fn(async () => jsonResponse({ success: true }));
		const ok = await verifyTurnstile({
			secretKey: 'sk',
			token: 'tok',
			remoteIp: '1.2.3.4',
			fetchImpl: fetchImpl as never
		});
		expect(ok).toBe(true);
		const [, init] = fetchImpl.mock.calls[0] as unknown as [string, { body: FormData }];
		const body = init.body;
		expect(body.get('secret')).toBe('sk');
		expect(body.get('response')).toBe('tok');
		expect(body.get('remoteip')).toBe('1.2.3.4');
	});

	it('omits remoteip when not provided', async () => {
		const fetchImpl = vi.fn(async () => jsonResponse({ success: true }));
		await verifyTurnstile({ secretKey: 'sk', token: 'tok', fetchImpl: fetchImpl as never });
		const [, init] = fetchImpl.mock.calls[0] as unknown as [string, { body: FormData }];
		const body = init.body;
		expect(body.get('remoteip')).toBeNull();
	});

	it('returns false when the payload is unsuccessful', async () => {
		const fetchImpl = vi.fn(async () => jsonResponse({ success: false }));
		expect(
			await verifyTurnstile({ secretKey: 'sk', token: 'tok', fetchImpl: fetchImpl as never })
		).toBe(false);
	});

	it('returns false on a non-OK HTTP response', async () => {
		const fetchImpl = vi.fn(async () => jsonResponse({ success: true }, false));
		expect(
			await verifyTurnstile({ secretKey: 'sk', token: 'tok', fetchImpl: fetchImpl as never })
		).toBe(false);
	});

	it('returns false when the request throws', async () => {
		const fetchImpl = vi.fn(async () => {
			throw new Error('network');
		});
		expect(
			await verifyTurnstile({ secretKey: 'sk', token: 'tok', fetchImpl: fetchImpl as never })
		).toBe(false);
	});
});
