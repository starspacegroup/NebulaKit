import { describe, expect, it, vi } from 'vitest';
import { getTurnstileConfig, verifyTurnstile } from './turnstile';

function jsonResponse(body: unknown, ok = true): Response {
	return { ok, json: async () => body } as unknown as Response;
}

describe('getTurnstileConfig', () => {
	it('enables Turnstile only when both keys are present', () => {
		expect(getTurnstileConfig('site', 'secret')).toEqual({
			enabled: true,
			siteKey: 'site',
			secretKey: 'secret'
		});
	});

	it('disables Turnstile when both keys are absent', () => {
		expect(getTurnstileConfig(undefined, null)).toEqual({ enabled: false });
		expect(getTurnstileConfig('', '  ')).toEqual({ enabled: false });
	});

	it.each([
		['site', undefined],
		[undefined, 'secret']
	])('fails safely when only one key is configured', (siteKey, secretKey) => {
		const config = getTurnstileConfig(siteKey, secretKey);
		expect(config.enabled).toBe(false);
		expect(config).toHaveProperty(
			'error',
			'Turnstile requires both TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY.'
		);
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
